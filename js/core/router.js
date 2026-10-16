import { FARE_RULES, HUB_BY_ID, LINK_BY_ID, linksFrom, LINES_INFO } from './network.js';
import { applySegmentFares, fareForDistance, totalFare, modeLabel, rulesFor } from './fares.js';
import { linkStatus, linkUsable, scenarioActive, scenarioEffects, timeMultiplier } from './scenario.js';

/* ===============================
   Cost-efficient pathfinding
   ===============================
   Dijkstra with a priority queue over the dataset graph, where a search state is
   (hub, current line). Carrying the line in the state is what makes the cost
   real: continuing on the same metro ride or the same bus line is cheap, while a
   change of vehicle costs a transfer (time and a small ৳ penalty) even when the
   mode stays the same — Bikolpo → Uttara bus is a transfer, two hops of MRT-6
   are not.

   Four objectives, each a genuine cost function rather than a re-sort:

     time       travel minutes            + transferPenaltyMin per change
     cost       ৳ of the ride you are on  + transferPenaltyBdt per change
                (the marginal ৳/km rate, so extending one metro ride does not
                 look like a second minimum fare)
     transfers  transfers weighted at 60  + 0.1 × minutes
     reliable   minutes × (1 + 3 × mode variance)

   Options: Dijkstra runs once per objective; results are de-duplicated by leg
   signature and tagged (Cheapest / Fastest / Fewest transfers / Most reliable).
   Then, for every hop of the fastest route, the search runs again with that hop
   removed — that is what produces genuinely different alternatives ("avoids
   Mirpur 10 → Motijheel") instead of four copies of the same ride.

   Every returned option is priced by core/fares.js from the official rates, on
   the real dataset distances, and every leg is validated by core/ground.js
   before the UI shows it. */

export const PREFERENCES = ['time', 'cost', 'transfers', 'reliable'];

export const PREFERENCE_LABELS = {
  time: 'Fastest',
  cost: 'Cheapest',
  transfers: 'Fewest transfers',
  reliable: 'Most reliable',
  alternate: 'Alternative'
};

/* A change of vehicle costs a wait and a small penalty in the cost model. Both
   are modelling parameters, labelled as such (the wait itself comes from the
   line headway in js/core/network.js). */
const TRANSFER_PENALTY_MIN = 4;
const TRANSFER_PENALTY_BDT = 5;

/* Small binary heap: keeps the pathfinder O(E log V) on a 100+ link graph and
   stays dependency-free. */
class PriorityQueue {
  constructor() {
    this.items = [];
  }

  get size() {
    return this.items.length;
  }

  push(item) {
    this.items.push(item);
    let index = this.items.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.items[parent].cost <= this.items[index].cost) break;
      [this.items[parent], this.items[index]] = [this.items[index], this.items[parent]];
      index = parent;
    }
  }

  pop() {
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length) {
      this.items[0] = last;
      let index = 0;
      for (;;) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (left < this.items.length && this.items[left].cost < this.items[smallest].cost) smallest = left;
        if (right < this.items.length && this.items[right].cost < this.items[smallest].cost) smallest = right;
        if (smallest === index) break;
        [this.items[smallest], this.items[index]] = [this.items[index], this.items[smallest]];
        index = smallest;
      }
    }
    return top;
  }
}

const lineKeyOf = link => (link.mode === 'metro' ? 'mrt6' : link.mode === 'walk' ? 'walk' : link.lineId);

/* Price of one link inside a journey: continuing a line pays its marginal
   ৳/km rate, starting one pays that link's own rule price (with its minimum). */
function linkPrice(link, continuing) {
  if (link.mode === 'walk') return 0;
  if (continuing) return fareForDistance(link.mode, link.km).marginal;
  return fareForDistance(link.mode, link.km).regular;
}

function edgeCost(leg, preference, isTransfer, continuing) {
  const variance = FARE_RULES[leg.mode].variance || 0;

  switch (preference) {
    case 'cost':
      return linkPrice(leg, continuing) + (isTransfer ? TRANSFER_PENALTY_BDT : 0);
    case 'transfers':
      return (isTransfer ? 60 : 0) + leg.timeMin * 0.1;
    case 'reliable':
      return (leg.timeMin + (isTransfer ? TRANSFER_PENALTY_MIN : 0)) * (1 + variance * 3);
    default:
      return leg.timeMin + (isTransfer ? TRANSFER_PENALTY_MIN : 0);
  }
}

function allowed(link, query) {
  if (link.active === false) return false;                       // CMS: out of service
  if (query.bannedLinks?.has(link.id)) return false;             // alternative search
  if (!linkUsable(link, query.scenario)) return false;           // disruption / closure
  if (query.avoidHubs?.includes(link.from) || query.avoidHubs?.includes(link.to)) return false;
  if (query.avoidModes?.includes(link.mode)) return false;
  if (query.onlyModes?.length && !query.onlyModes.includes(link.mode)) return false;
  return true;
}

/* Wait time belongs to boarding, once per vehicle. */
function legFor(link, { scenario, waitMin }) {
  const rules = rulesFor(link.mode);
  const moving = Math.max(1, Math.round(link.timeMin * timeMultiplier(link, scenario)));

  return {
    linkId: link.id,
    lineId: link.lineId,
    mode: link.mode,
    routeName: link.routeName,
    from: link.from,
    to: link.to,
    km: link.km,
    timeMin: moving,
    waitMin: waitMin ?? 0,
    frequencyMin: link.frequencyMin,
    dataset: link.dataset,
    notes: link.notes || '',
    status: linkStatus(link, scenario),
    rulesLabel: rules.label
  };
}

/* Dijkstra from `query.from` to `query.to` under one objective. Returns the leg
   chain or null. */
function searchLegs(query, preference) {
  const startKey = `${query.from}|start`;
  const best = new Map([[startKey, 0]]);
  const previous = new Map();
  const settled = new Set();
  const queue = new PriorityQueue();
  queue.push({ key: startKey, hubId: query.from, line: null, mode: null, cost: 0 });

  while (queue.size) {
    const current = queue.pop();
    if (settled.has(current.key)) continue;
    settled.add(current.key);

    if (current.hubId === query.to) {
      const legs = [];
      let cursor = current.key;
      while (previous.has(cursor)) {
        const step = previous.get(cursor);
        legs.unshift(step.leg);
        cursor = step.key;
      }
      return legs;
    }

    for (const link of linksFrom(current.hubId)) {
      if (!allowed(link, query)) continue;

      const line = lineKeyOf(link);
      // Walking is always available; every other change of vehicle is a transfer
      const isTransfer = Boolean(current.line) && current.line !== line && link.mode !== 'walk' && current.mode !== 'walk';
      const continuing = Boolean(current.line) && current.line === line;
      const boarding = !current.line || isTransfer;

      const waitMin = boarding ? Math.round((link.frequencyMin || 0) / 2) : 0;
      const leg = legFor(link, { scenario: query.scenario, waitMin });
      const key = `${link.to}|${line}`;
      if (settled.has(key)) continue;

      const cost = current.cost + edgeCost(leg, preference, isTransfer, continuing);
      if (best.has(key) && cost >= best.get(key)) continue;

      best.set(key, cost);
      previous.set(key, { key: current.key, leg });
      queue.push({ key, hubId: link.to, line, mode: link.mode, cost });
    }
  }

  return null;
}

function signatureOf(legs) {
  return legs.map(leg => `${leg.mode}:${leg.from}>${leg.to}`).join('|');
}

/* 0–100 heuristic from the mode mix: the metro is dependable, buses are not. */
function reliabilityOf(legs) {
  const moving = legs.reduce((sum, leg) => sum + leg.timeMin, 0) || 1;
  const weighted = legs.reduce((sum, leg) => {
    const variance = FARE_RULES[leg.mode].variance || 0;
    return sum + (leg.timeMin / moving) * (1 - variance);
  }, 0);
  return Math.round(weighted * 100);
}

function buildOption(legs, preference, query) {
  const transfers = legs.reduce((count, leg, index) => {
    if (index === 0) return count;
    const previous = legs[index - 1];
    if (previous.mode === 'walk' || leg.mode === 'walk') return count;
    return previous.lineId === leg.lineId ? count : count + 1;
  }, 0);

  const detailed = legs.map((leg, index) => {
    const fromHub = HUB_BY_ID.get(leg.from);
    const toHub = HUB_BY_ID.get(leg.to);
    const previous = index > 0 ? legs[index - 1] : null;
    const isTransfer = Boolean(previous) && previous.mode !== 'walk' && leg.mode !== 'walk' && previous.lineId !== leg.lineId;
    const waiting = leg.waitMin ? ` · about ${leg.waitMin} min wait (headway ${leg.frequencyMin} min)` : '';

    return {
      ...leg,
      fromHub,
      toHub,
      isTransfer,
      board: leg.mode === 'walk'
        ? `Walk from ${fromHub.name} to ${toHub.name} (${leg.km} km)`
        : `Board ${leg.routeName} at ${fromHub.name}${waiting}`,
      alight: leg.mode === 'walk'
        ? `Arrive ${toHub.name}`
        : `Get off at ${toHub.name}${isTransfer ? ' and change' : ''}`
    };
  });

  applySegmentFares(detailed, { student: query.student });

  detailed.forEach(leg => {
    if (leg.mode === 'walk') {
      leg.why = 'Walking is free.';
      return;
    }
    const head = leg.fare.includedIn
      ? detailed.find(entry => entry.linkId === leg.fare.includedIn)
      : null;
    if (head) leg.why = `Covered by the ৳${head.fare.regular} ${modeLabel(leg.mode)} fare from ${head.fromHub.name}.`;
    else if (leg.fare.eligibleForStudent) leg.why = leg.fare.studentRule;
    else leg.why = leg.fare.studentRule;
  });

  return {
    id: signatureOf(legs),
    signature: signatureOf(legs),
    preference,
    legs: detailed,
    fare: totalFare(detailed, { student: query.student }),
    timeMin: detailed.reduce((sum, leg) => sum + leg.timeMin, 0),
    rideMin: detailed.reduce((sum, leg) => sum + (leg.mode === 'walk' ? 0 : leg.timeMin), 0),
    walkMin: detailed.reduce((sum, leg) => sum + (leg.mode === 'walk' ? leg.timeMin : 0), 0),
    transfers,
    modes: [...new Set(detailed.map(leg => leg.mode))],
    lines: [...new Set(detailed.filter(leg => leg.mode !== 'walk').map(leg => leg.routeName))],
    walkKm: detailed.filter(leg => leg.mode === 'walk').reduce((sum, leg) => sum + leg.km, 0),
    reliability: reliabilityOf(detailed)
  };
}

function rank(option, preference) {
  switch (preference) {
    case 'cost': return option.fare.regular;
    case 'transfers': return option.transfers * 1000 + option.timeMin;
    case 'reliable': return -option.reliability;
    default: return option.timeMin;
  }
}

export function planRoutes(query) {
  const normalised = {
    from: query.from,
    to: query.to,
    student: Boolean(query.student),
    scenario: query.scenario || null,
    avoidHubs: query.avoidHubs || [],
    avoidModes: query.avoidModes || [],
    onlyModes: query.onlyModes || [],
    maxFare: query.maxFare ?? null,
    bannedLinks: query.bannedLinks || null,
    limit: query.limit || 4
  };

  if (!normalised.from || !normalised.to || normalised.from === normalised.to) return [];

  const bySignature = new Map();
  const openOption = (legs, preference) => {
    if (!legs) return null;
    const option = buildOption(legs, preference, normalised);
    const existing = bySignature.get(option.signature);
    if (existing) {
      existing.tags.push(PREFERENCE_LABELS[preference]);
      return existing;
    }
    option.tags = [PREFERENCE_LABELS[preference]];
    bySignature.set(option.signature, option);
    return option;
  };

  PREFERENCES.forEach(preference => openOption(searchLegs(normalised, preference), preference));

  // Alternatives: drop one hop of the fastest route at a time and search again.
  const primary = bySignature.values().next().value || null;
  if (primary) {
    primary.legs.forEach(leg => {
      const bannedLinks = new Set([leg.linkId, `${leg.linkId.split(':')[0] === 'walk' ? 'walk' : leg.lineId}:${leg.to}>${leg.from}`]);
      const legs = searchLegs({ ...normalised, bannedLinks }, 'time');
      if (!legs) return;
      const option = buildOption(legs, 'alternate', normalised);
      if (bySignature.has(option.signature)) return;
      option.tags = [`Avoids ${HUB_BY_ID.get(leg.from).name} → ${HUB_BY_ID.get(leg.to).name}`];
      bySignature.set(option.signature, option);
    });
  }

  let options = [...bySignature.values()];

  if (normalised.maxFare) {
    const within = options.filter(option => (normalised.student ? option.fare.student : option.fare.regular) <= normalised.maxFare);
    options = within.length ? within : options.filter(option => option.preference === 'cost');
  }

  const requested = query.prefer || 'time';
  options.sort((a, b) => (rank(a, requested) - rank(b, requested)) || (b.reliability - a.reliability));

  return options.slice(0, normalised.limit);
}

/* Planner entry point used by the UI, the chat and the tests. */
export function planTrip(query, scenario) {
  const withScenario = { ...query, scenario };
  const options = planRoutes(withScenario);
  const effects = scenarioEffects(scenario);

  if (!scenarioActive(scenario)) {
    return { options, baselineOptions: options, baselineBest: options[0] || null, deltas: null, effects, brokenOnBaseline: [] };
  }

  const baselineOptions = planRoutes({ ...query, scenario: null });
  const baselineBest = baselineOptions[0] || null;
  const best = options[0] || null;

  const brokenOnBaseline = baselineBest
    ? baselineBest.legs
      .map(leg => ({ leg, link: LINK_BY_ID.get(leg.linkId), status: leg.link ? linkStatus(leg.link, scenario) : 'ok' }))
      .filter(entry => entry.link && entry.status !== 'ok')
    : [];

  const deltas = baselineBest && best
    ? {
      timeMin: best.timeMin - baselineBest.timeMin,
      fare: best.fare.regular - baselineBest.fare.regular,
      studentFare: best.fare.student - baselineBest.fare.student,
      transfers: best.transfers - baselineBest.transfers,
      metric: query.prefer === 'cost' ? 'fare' : 'timeMin',
      lostOptions: baselineOptions.length - options.length
    }
    : null;

  return {
    options,
    baselineOptions,
    baselineBest,
    best,
    deltas,
    effects,
    brokenOnBaseline,
    // When the fastest route is no longer usable, this is the changed plan.
    note: best && baselineBest && best.signature !== baselineBest.signature
      ? `Rerouted around the disruption: ${baselineBest.timeMin} → ${best.timeMin} min, ৳${baselineBest.fare.regular} → ৳${best.fare.regular}.`
      : null
  };
}

/* Fare-chart helper for the UI and the tests: every MRT-6 station pair, priced
   by the official rates from the dataset distances. */
export function metroFareChart() {
  const line = LINES_INFO.find(entry => entry.id === 'mrt6');
  if (!line) return [];
  const byId = new Map();
  let cumulative = 0;

  byId.set(line.stops[0], 0);
  for (let index = 1; index < line.stops.length; index += 1) {
    const from = line.stops[index - 1];
    const to = line.stops[index];
    const link = LINK_BY_ID.get(`mrt6:${from}>${to}`) || LINK_BY_ID.get(`mrt6:${to}>${from}`);
    cumulative += link ? link.km : 0;
    byId.set(to, Number(cumulative.toFixed(2)));
  }

  const stations = line.stops.map(id => ({ id, name: HUB_BY_ID.get(id).name, kmFromStart: byId.get(id) }));

  return {
    stations,
    fareBetween: (fromId, toId) => {
      const distance = Math.abs((byId.get(fromId) ?? 0) - (byId.get(toId) ?? 0));
      return { km: Number(distance.toFixed(2)), ...fareForDistance('metro', distance) };
    }
  };
}
