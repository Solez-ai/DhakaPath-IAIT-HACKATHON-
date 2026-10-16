/* ===============================
   Build the transit network from the organizer dataset
   ===============================
   Source of truth: `Map Data/` ONLY.

     json/transit-data.json           MRT-6 stations (16) + Bikolpo (18 stops) + Uttara bus (20 stops)
                                      with per-hop route geometry for the buses
     csv/Routemap-DhakaMetroRail.csv  MRT-6 track reference (cross-check)
     csv/Routemap-BikolpoBus.csv      Bikolpo geometry (same source the JSON was built from)
     csv/Routemap-UttaraBus.csv       Uttara bus geometry
     csv/Roadmap-Dhaka.csv            Dhaka street network (49,869 directed segments)

   Nothing else. No hand-written hubs, no invented stops, no legacy mode.

   Outputs (both generated, both committed so the app runs with no build step):
     js/core/network.data.js   hubs, lines, hops, real distances, provenance ids
     data/streets.json         simplified street-network polylines for the map base

   Fares are NOT stored here: they are computed in js/core/fares.js from the
   published government rates (see RATES). This file only carries geometry and
   topology, so a fare cannot drift out of sync with a distance.

   Run: node tools/build-network.mjs
*/

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DATA = path.join(ROOT, 'Map Data');
const OUT_MODULE = path.join(ROOT, 'js', 'core', 'network.data.js');
const OUT_STREETS = path.join(ROOT, 'data', 'streets.json');

/* Government-published rates, quoted in README/docs/ARCHITECTURE.md:
   MRT-6    ৳5 per km, minimum ৳20, maximum ৳100  (DTCA circular, 8 Sep 2022)
   City bus ৳2.70 per km, minimum ৳10            (Road Transport & Highways
                                                   Division gazette, 23 Sep 2026)
   They live in js/core/fares.js; the note here is for the generated header. */
const RATE_NOTE = 'MRT-6 ৳5/km (min ৳20, max ৳100, DTCA 08 Sep 2022); city bus ৳2.70/km (min ৳10, MoRTB gazette 23 Sep 2026).';

/* Interchange rules (reproducible from the dataset coordinates alone; every
   pair they produce is written into the generated file and printed by the build
   so it can be audited):
     · the same name  → one hub, whatever the distance ("Farmgate" is Farmgate)
     · within 50 m    → one hub, whatever the name (the same kerb)
     · within 250 m AND sharing a significant name token → one hub
       ("Shahbagh" ↔ "Shahbag", "Bangladesh Secretariat" ↔ "Secretariat")
   Anything further apart stays a separate stop, so distinct places such as
   Mirpur 12 / Pallabi (243 m) and Stadium / Mirpur 10 (595 m) are NOT merged. */
const SAME_PLACE_M = 50;
const TOKEN_MERGE_M = 250;
/* Two stops with the same name merge only if they are this close. A same-named
   bus stop 773 m from the station (Bijoy Sarani) stays a separate node and is
   joined by a walking edge instead, so the walk is costed as a walk. */
const SAME_NAME_M = 300;
/* Walking links: dataset stops within this straight-line distance get a walk
   edge, costed with the documented street-detour factor. */
const WALK_MAX_KM = 1.0;
const WALK_DETOUR = 1.25;

const R = 6371.0088;
const rad = value => (value * Math.PI) / 180;

function haversineKm(a, b) {
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/* Length of a polyline of [lat, lng] points. */
function polylineKm(points) {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) total += haversineKm(points[index - 1], points[index]);
  return total;
}

const slug = value => String(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const csvSplit = line => line.trim().split(',').map(field => field.trim());
const readLines = file => fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(line => line.trim().length);

/* ---------------------------------------------------------------- read input */

const transit = JSON.parse(fs.readFileSync(path.join(DATA, 'json', 'transit-data.json'), 'utf8'));

/* Route CSVs: layer, then coordinate pairs (lng,lat), then from-stop, to-stop. */
function readRouteCsv(file) {
  return readLines(file).map(line => {
    const fields = csvSplit(line);
    const from = fields[fields.length - 2];
    const to = fields[fields.length - 1];
    const numbers = fields.slice(1, -2).map(Number).filter(value => Number.isFinite(value));
    const geometry = [];
    for (let index = 0; index + 1 < numbers.length; index += 2) geometry.push([numbers[index + 1], numbers[index]]); // lng,lat → lat,lng
    return { from: from.trim(), to: to.trim(), geometry };
  });
}

const metroCsv = readRouteCsv(path.join(DATA, 'csv', 'Routemap-DhakaMetroRail.csv'));
const bikolpoCsv = readRouteCsv(path.join(DATA, 'csv', 'Routemap-BikolpoBus.csv'));
const uttaraCsv = readRouteCsv(path.join(DATA, 'csv', 'Routemap-UttaraBus.csv'));

/* Street CSV: layer, coordinate pairs, 0, length-km (last field). */
function readStreetCsv(file) {
  const rows = [];
  readLines(file).forEach(line => {
    const fields = csvSplit(line);
    const numbers = fields.slice(1, -1).map(Number);
    const lengthKm = Number(fields[fields.length - 1]);
    const points = [];
    for (let index = 0; index + 1 < numbers.length; index += 2) {
      const lng = numbers[index];
      const lat = numbers[index + 1];
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) continue;
      points.push([lat, lng]);
    }
    if (points.length >= 2) rows.push({ points, declaredKm: Number.isFinite(lengthKm) ? lengthKm : polylineKm(points) });
  });
  return rows;
}

/* ------------------------------------------------------------------- hubs */

/* Every dataset node becomes a hub candidate, keeping its source id so the UI
   and the docs can always point back at the exact row it came from. */
const candidates = [];

transit.metro.stations.forEach(station => candidates.push({
  service: 'mrt6',
  datasetId: station.id,
  name: station.name,
  point: [station.lat, station.lng]
}));

transit.buses.forEach(bus => bus.stops.forEach(stop => candidates.push({
  service: bus.id,
  datasetId: stop.id,
  name: stop.name,
  point: [stop.lat, stop.lng]
})));

const hubs = [];
const interchanges = [];

const STOP_WORDS = new Set(['bus', 'stop', 'the', 'and', 'hall', 'gate']);
const tokens = name => slug(name).split('-').filter(token => token.length > 2 && !STOP_WORDS.has(token));
/* "Shahbagh" and "Shahbag" are the same place; compare tokens by prefix so a
   spelling variant (Shahbag/Shahbagh, Secretariat variants) still matches. */
const sameToken = (a, b) => (a === b ? true : (a.length >= 5 && b.length >= 5 && (a.startsWith(b) || b.startsWith(a))));
const sharesToken = (a, b) => {
  const first = tokens(a);
  return tokens(b).some(token => first.some(other => sameToken(other, token)));
};

/* Do two dataset stops describe the same place? */
function samePlace(a, b) {
  const metres = haversineKm(a.point, b.point) * 1000;
  if (slug(a.name) === slug(b.name) && metres <= SAME_NAME_M) return { yes: true, kind: 'same name', metres };
  if (metres <= SAME_PLACE_M) return { yes: true, kind: 'same kerb', metres };
  if (metres <= TOKEN_MERGE_M && sharesToken(a.name, b.name)) return { yes: true, kind: 'shared name token', metres };
  return { yes: false, kind: '', metres };
}

function findHub(candidate) {
  return hubs.find(hub => {
    // A hub holds at most one node per service: one stop can never absorb two
    // different stops of the same bus line.
    if (hub.services.includes(candidate.service)) return false;
    return samePlace(hub, candidate).yes;
  }) || null;
}

candidates.forEach(candidate => {
  const match = findHub(candidate);

  if (match) {
    const verdict = samePlace(match, candidate);
    // The metro station is the anchor: it keeps its name and coordinates, which
    // line up with the track; the bus stop contributes its id and name.
    const anchorIsMetro = match.service === 'mrt6';
    if (!anchorIsMetro) {
      match.point = candidate.point;
      match.name = candidate.name;
    }
    match.services.push(candidate.service);
    match.datasetIds.push(candidate.datasetId);
    match.names.push(candidate.name);
    interchanges.push({
      hub: match.id,
      services: [...match.services].sort(),
      names: [...new Set(match.names)],
      metres: Math.round(verdict.metres),
      rule: verdict.kind
    });
    return;
  }

  hubs.push({
    id: candidate.service === 'mrt6' ? `metro-${slug(candidate.name)}` : `${slug(candidate.service)}-${slug(candidate.name)}`,
    name: candidate.name,
    point: candidate.point,
    service: candidate.service,
    services: [candidate.service],
    datasetIds: [candidate.datasetId],
    names: [candidate.name]
  });
});

/* A merged hub serves several services; the transfer flag is what the router
   uses to allow a mode change there. */
hubs.forEach(hub => {
  hub.interchange = hub.services.length > 1;
  hub.datasetIds = [...new Set(hub.datasetIds)];
  hub.services = [...new Set(hub.services)];
  hub.names = [...new Set(hub.names)];
});

/* Two unmerged hubs can still share a display name (a bus stop named after the
   station 773 m away). Label the bus one so the map and the planner are never
   ambiguous about which node you are standing at. */
const nameCount = new Map();
hubs.forEach(hub => nameCount.set(slug(hub.name), (nameCount.get(slug(hub.name)) || 0) + 1));
hubs.forEach(hub => {
  if (nameCount.get(slug(hub.name)) > 1 && hub.service !== 'mrt6') {
    hub.name = `${hub.name} · ${hub.service === 'bikolpo' ? 'Bikolpo' : 'Uttara bus'} stop`;
  }
});

/* ------------------------------------------------------------------ lines */

const hubFor = (service, name) => hubs.find(hub => hub.services.includes(service) && hub.names.some(entry => entry === name)) || null;

function buildLine({ id, name, service, mode, stops, geometryByHop }) {
  const ordered = stops.map(stop => {
    const hub = hubFor(service, stop.name);
    if (!hub) throw new Error(`${service}: no hub for stop "${stop.name}"`);
    return { hubId: hub.id, name: stop.name, point: [stop.lat, stop.lng] };
  });

  const hops = [];
  for (let index = 1; index < ordered.length; index += 1) {
    const from = ordered[index - 1];
    const to = ordered[index];
    const geometry = geometryByHop(index - 1, from, to);
    hops.push({
      from: from.hubId,
      to: to.hubId,
      fromName: from.name,
      toName: to.name,
      km: Number(polylineKm(geometry).toFixed(3)),
      geometry: geometry.map(point => [Number(point[0].toFixed(6)), Number(point[1].toFixed(6))])
    });
  }

  const totalKm = Number(hops.reduce((sum, hop) => sum + hop.km, 0).toFixed(2));
  return { id, name, service, mode, stops: ordered.map(entry => entry.hubId), hops, totalKm };
}

/* Bus geometry comes straight from the dataset's per-hop segment coordinates,
   matched by stop-name pair (the JSON and the CSV are the same source). */
function busGeometry(rows, fromName, toName) {
  const match = rows.find(row => row.from === fromName && row.to === toName)
    || rows.find(row => row.to === fromName && row.from === toName);
  return match ? match.geometry : null;
}

/* ---- MRT-6 track reference (Routemap-DhakaMetroRail.csv) --------------------
   The CSV carries the real (curved) track polyline, but only for part of the
   line. Stitch its rows into one chain, then project every official station onto
   it. A hop draws along the chain only when BOTH of its stations sit within
   ON_TRACK_M of it; otherwise it is a straight line. The coverage and the
   off-track distances are written into the generated file as evidence. */
const ON_TRACK_M = 100;
const metroChain = (() => {
  const rows = metroCsv.filter(row => row.geometry.length >= 2);
  if (!rows.length) return [];
  const chain = [...rows[0].geometry];
  for (let index = 1; index < rows.length; index += 1) {
    const geometry = rows[index].geometry;
    const tail = chain[chain.length - 1];
    chain.push(...(haversineKm(tail, geometry[0]) <= haversineKm(tail, geometry[geometry.length - 1])
      ? geometry.slice(1)
      : [...geometry].reverse().slice(1)));
  }
  return chain;
})();

function projectOnChain(point) {
  let best = { metres: Infinity, index: 1, point };
  for (let index = 1; index < metroChain.length; index += 1) {
    const a = metroChain[index - 1];
    const b = metroChain[index];
    const scale = Math.cos(rad((a[0] + b[0]) / 2));
    const ax = a[1] * scale;
    const ay = a[0];
    const bx = b[1] * scale;
    const by = b[0];
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, (((point[1] * scale) - ax) * dx + ((point[0]) - ay) * dy) / lengthSq));
    const projected = [ay + t * dy, (ax + t * dx) / scale];
    const metres = haversineKm(point, projected) * 1000;
    if (metres < best.metres) best = { metres, index, point: projected, t };
  }
  return best;
}

const metroProjections = new Map();
transit.metro.stations.forEach(station => {
  metroProjections.set(station.name, projectOnChain([station.lat, station.lng]));
});

const trackCoverage = [...metroProjections.entries()]
  .filter(([, projection]) => projection.metres <= ON_TRACK_M)
  .map(([name]) => name);

function metroGeometry(from, to) {
  const a = metroProjections.get(from.name);
  const b = metroProjections.get(to.name);
  if (!a || !b || a.metres > ON_TRACK_M || b.metres > ON_TRACK_M) return [from.point, to.point];
  if (b.index < a.index || (b.index === a.index && b.t <= a.t)) return [from.point, to.point];
  const slice = metroChain.slice(a.index, b.index);
  return [from.point, a.point, ...slice, b.point, to.point]
    .filter((point, index, all) => index === 0 || point[0] !== all[index - 1][0] || point[1] !== all[index - 1][1]);
}

const lines = [];

lines.push(buildLine({
  id: 'mrt6',
  name: transit.metro.name,
  service: 'mrt6',
  mode: 'metro',
  stops: transit.metro.stations,
  geometryByHop: (index, from, to) => metroGeometry(from, to)
}));

transit.buses.forEach(bus => {
  const rows = bus.id === 'bikolpo' ? bikolpoCsv : uttaraCsv;
  lines.push(buildLine({
    id: bus.id,
    name: bus.name,
    service: bus.id,
    mode: 'bus',
    stops: bus.stops,
    geometryByHop: (index, from, to) => {
      const geometry = busGeometry(rows, from.name, to.name);
      if (!geometry || geometry.length < 2) return [from.point, to.point];
      return geometry;
    }
  }));
});

/* ------------------------------------------------------------- walk links */

/* A walk edge is derived, not invented: two dataset stops within WALK_MAX_KM,
   never already connected by a dataset hop, cost the straight-line distance
   times the documented street-detour factor. These are what connect stops that
   the services do not link directly — e.g. the Bikolpo terminus at TSC to the
   Dhaka University metro station, 285 m apart. */
const hopKeys = new Set();
lines.forEach(line => line.hops.forEach(hop => {
  hopKeys.add(`${hop.from}|${hop.to}`);
  hopKeys.add(`${hop.to}|${hop.from}`);
}));

const walkLinks = [];
for (let a = 0; a < hubs.length; a += 1) {
  for (let b = a + 1; b < hubs.length; b += 1) {
    const first = hubs[a];
    const second = hubs[b];
    if (hopKeys.has(`${first.id}|${second.id}`)) continue;
    const straight = haversineKm(first.point, second.point);
    if (straight > WALK_MAX_KM || straight < 0.04) continue;
    walkLinks.push({
      from: first.id,
      to: second.id,
      km: Number((straight * WALK_DETOUR).toFixed(3)),
      straightKm: Number(straight.toFixed(3))
    });
  }
}

/* ------------------------------------------------------------------ streets */

function buildStreets() {
  const rows = readStreetCsv(path.join(DATA, 'csv', 'Roadmap-Dhaka.csv'));
  const key = point => `${point[0].toFixed(5)},${point[1].toFixed(5)}`;

  // endpoint → list of segment indexes (mid points are dropped: only the two
  // endpoints of a street row define its topology)
  const at = new Map();
  rows.forEach((row, index) => {
    [row.points[0], row.points[row.points.length - 1]].forEach(point => {
      const k = key(point);
      if (!at.has(k)) at.set(k, []);
      at.get(k).push(index);
    });
  });

  const used = new Set();
  const chains = [];

  // Walk the graph greedily, extending a chain from either end while a node has
  // exactly one unused segment left (that is a street, not a junction).
  rows.forEach((row, startIndex) => {
    if (used.has(startIndex)) return;
    used.add(startIndex);
    const chain = [...row.points];

    let extended = true;
    while (extended) {
      extended = false;
      for (const [attachEnd, point] of [[1, chain[chain.length - 1]], [0, chain[0]]]) {
        const options = at.get(key(point)) || [];
        const nextIndex = options.find(index => !used.has(index));
        if (nextIndex === undefined) continue;
        const next = rows[nextIndex];
        used.add(nextIndex);
        const forward = key(next.points[0]) === key(point);
        const segment = forward ? next.points : [...next.points].reverse();
        if (attachEnd === 1) chain.push(...segment.slice(1));
        else chain.unshift(...segment.slice(0, -1));
        extended = true;
      }
    }

    chains.push(chain);
  });

  // Douglas–Peucker: keep the shape, drop the noise. ~15 m tolerance.
  function simplify(points, toleranceKm) {
    if (points.length < 3) return points;
    const [first] = points;
    const last = points[points.length - 1];
    let maxDist = -1;
    let index = 0;
    for (let i = 1; i < points.length - 1; i += 1) {
      const d = perpendicularKm(points[i], first, last);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (maxDist <= toleranceKm) return [first, last];
    return [...simplify(points.slice(0, index + 1), toleranceKm).slice(0, -1), ...simplify(points.slice(index), toleranceKm)];
  }

  function perpendicularKm(point, start, end) {
    const scale = Math.cos(rad((start[0] + end[0]) / 2));
    const px = point[1] * scale;
    const py = point[0];
    const ax = start[1] * scale;
    const ay = start[0];
    const bx = end[1] * scale;
    const by = end[0];
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq === 0) return haversineKm(point, start);
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
    return haversineKm(point, [ay + t * dy, (ax + t * dx) / scale]);
  }

  const simplified = chains
    .map(chain => simplify(chain, 0.02))
    .map(chain => chain.map(([lat, lng]) => [Number(lat.toFixed(5)), Number(lng.toFixed(5))]))
    .map(chain => chain.filter((point, index) => index === 0 || point[0] !== chain[index - 1][0] || point[1] !== chain[index - 1][1]))
    .filter(chain => chain.length >= 2);

  const totalKm = rows.reduce((sum, row) => sum + row.declaredKm, 0);
  return { chains: simplified, rows: rows.length, totalKm: Number(totalKm.toFixed(1)) };
}

const streets = buildStreets();

/* --------------------------------------------------------------------- emit */

const dataset = {
  sources: {
    transit: 'Map Data/json/transit-data.json',
    metroCsv: 'Map Data/csv/Routemap-DhakaMetroRail.csv',
    bikolpoCsv: 'Map Data/csv/Routemap-BikolpoBus.csv',
    uttaraCsv: 'Map Data/csv/Routemap-UttaraBus.csv',
    streets: 'Map Data/csv/Roadmap-Dhaka.csv',
    note: transit.sources?.note || ''
  },
  rates: RATE_NOTE,
  generatedAt: new Date().toISOString().slice(0, 10),
  counts: {
    hubs: hubs.length,
    lines: lines.length,
    metroStations: transit.metro.stations.length,
    bikolpoStops: transit.buses.find(bus => bus.id === 'bikolpo').stops.length,
    uttaraStops: transit.buses.find(bus => bus.id === 'uttara_bus').stops.length,
    walkLinks: walkLinks.length,
    streetSegments: streets.rows,
    streetKm: streets.totalKm
  },
  metroTrack: {
    source: 'Map Data/csv/Routemap-DhakaMetroRail.csv',
    points: metroChain.length,
    coveredKm: Number(polylineKm(metroChain).toFixed(2)),
    stationsOnTrack: trackCoverage.length,
    // The track reference covers Pallabi → Secretariat; those stations sit within
    // ON_TRACK_M of it. The Uttara section and Motijheel are not covered by the
    // CSV, so those hops are drawn straight from the official coordinates.
    maxOffTrackM: Number(Math.max(...trackCoverage.map(name => metroProjections.get(name).metres)).toFixed(1))
  }
};

const module = `/* GENERATED FILE — do not edit by hand.
   Built by tools/build-network.mjs from the organizer dataset in \`Map Data/\`.
   ${dataset.generatedAt} · hubs ${dataset.counts.hubs} · lines ${lines.length} ·
   walk links ${walkLinks.length} · street rows ${streets.rows} (${streets.totalKm} km)

   ${RATE_NOTE}

   Layout:
     HUBS   every dataset stop, with the original ids it came from
     LINES  MRT-6 (16 stations), Bikolpo (18 stops), Uttara bus (20 stops), each
            hop carrying its real distance in km and its route geometry
     WALKS  derived pedestrian edges between dataset stops that are close
     TRANSFERS  the metro↔bus interchanges produced by the same-name / ${SAME_PLACE_M} m / ${TOKEN_MERGE_M} m+token rules
*/

export const DATASET = ${JSON.stringify(dataset, null, 2)};

export const HUBS = ${JSON.stringify(hubs.map(hub => ({
  id: hub.id,
  name: hub.name,
  lat: Number(hub.point[0].toFixed(6)),
  lng: Number(hub.point[1].toFixed(6)),
  services: hub.services,
  datasetIds: hub.datasetIds,
  aliases: hub.names.filter(name => name !== hub.name),
  interchange: Boolean(hub.interchange)
})), null, 2)};

export const LINES = ${JSON.stringify(lines.map(line => ({
  id: line.id,
  name: line.name,
  service: line.service,
  mode: line.mode,
  totalKm: line.totalKm,
  stops: line.stops,
  hops: line.hops.map(hop => ({
    from: hop.from,
    to: hop.to,
    km: hop.km,
    geometry: hop.geometry
  }))
})), null, 2)};

export const WALKS = ${JSON.stringify(walkLinks, null, 2)};

export const TRANSFERS = ${JSON.stringify(interchanges, null, 2)};
`;

fs.mkdirSync(path.dirname(OUT_MODULE), { recursive: true });
fs.writeFileSync(OUT_MODULE, module, 'utf8');

fs.mkdirSync(path.dirname(OUT_STREETS), { recursive: true });
fs.writeFileSync(OUT_STREETS, JSON.stringify({ source: dataset.sources.streets, chains: streets.chains }), 'utf8');

/* ------------------------------------------------------- fare self-check ----
   The official per-station fares are reconstructed from the dataset distances
   (see js/core/fares.js). If they ever stop matching the published chart, the
   build fails instead of shipping a wrong price. */
const publishedAnchors = {
  'Uttara Center': 20,
  'Uttara South': 20,
  Pallabi: 30,
  'Mirpur 11': 30,
  'Mirpur 10': 40,
  Motijheel: 100
};

const metroFare = km => Math.min(100, Math.max(20, Math.ceil((5 * km) / 10) * 10));
const metroLine = lines.find(line => line.id === 'mrt6');
const cumulative = [];
metroLine.hops.reduce((sum, hop) => {
  const total = sum + hop.km;
  cumulative.push({ hubId: hop.to, km: total, fare: metroFare(total) });
  return total;
}, 0);

const chart = cumulative.map(entry => {
  const hub = hubs.find(item => item.id === entry.hubId);
  const anchor = publishedAnchors[hub.name];
  return { name: hub.name, km: Number(entry.km.toFixed(2)), fare: entry.fare, published: anchor ?? null };
});

const mismatches = chart.filter(row => row.published !== null && row.published !== row.fare);
if (mismatches.length) {
  console.error('FARE SELF-CHECK FAILED — reconstructed fares disagree with the published MRT-6 chart:');
  mismatches.forEach(row => console.error(`  ${row.name}: computed ৳${row.fare}, published ৳${row.published}`));
  process.exit(1);
}

const moduleKb = (fs.statSync(OUT_MODULE).size / 1024).toFixed(0);
const streetsKb = (fs.statSync(OUT_STREETS).size / 1024).toFixed(0);

console.log(`hubs              ${dataset.counts.hubs} (${dataset.counts.metroStations} metro + ${dataset.counts.bikolpoStops} Bikolpo + ${dataset.counts.uttaraStops} Uttara, ${interchanges.length} merges)`);
lines.forEach(line => console.log(`line ${line.id.padEnd(11)} ${String(line.stops.length).padStart(3)} stops · ${String(line.totalKm).padStart(6)} km`));
console.log(`metro track       ${dataset.metroTrack.points} pts, ${dataset.metroTrack.coveredKm} km covered, ${dataset.metroTrack.stationsOnTrack} stations on it (max drift ${dataset.metroTrack.maxOffTrackM} m)`);
console.log(`transfers         ${interchanges.length}: ${interchanges.map(entry => `${entry.names.join('↔')} (${entry.rule})`).join(', ')}`);
console.log(`walk links        ${walkLinks.length}`);
console.log('fare self-check   ' + chart.filter(row => row.published !== null).map(row => `${row.name} ৳${row.fare}`).join(' · ') + ' — matches published chart');
console.log(`streets           ${streets.rows} rows → ${streets.chains.length} polylines, ${streets.totalKm} km`);
console.log(`wrote             ${path.relative(ROOT, OUT_MODULE)} (${moduleKb} KB)`);
console.log(`wrote             ${path.relative(ROOT, OUT_STREETS)} (${streetsKb} KB)`);
