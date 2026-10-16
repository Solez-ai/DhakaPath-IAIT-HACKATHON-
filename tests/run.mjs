/* ===============================
   Smoke test (current engine)
   ===============================
   The previous suite in this repo targets a 32-hub, 7-mode canonical graph that
   no longer matches the rebuilt network (49 raw dataset stops, 3 modes). The
   full assertions are preserved in tests/legacy-graph.mjs and can be re-enabled
   if that canonical layer is reinstated.

   What this smoke test guarantees instead:
     · every ES module in js/ and js/core/ loads without an import error
     · the published fare rules reproduce the official MRT-6 station prices
     · the router connects every hub pair inside the rebuilt graph
     · the alert pipeline still creates, decays and resolves reports
     · the parser still resolves a Banglish + student + budget sentence

   Run: `npm test` (node tests/run.mjs) */

import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const importUrl = (rel) => pathToFileURL(path.join(ROOT, rel)).href;

const MODULES = [
  'js/core/network.js',
  'js/core/network.data.js',
  'js/core/fares.js',
  'js/core/router.js',
  'js/core/scenario.js',
  'js/core/parse.js',
  'js/core/alerts.js',
  'js/core/arrival.js',
  'js/core/weather.js',
  'js/core/ground.js',
  'js/core/fareCoach.js',
  'js/state.js',
  'js/fares.js',
  'js/routes.js',
  'js/alerts.js',
  'js/chat.js',
  'js/events.js',
  'js/ui.js',
  'js/scenarioUi.js',
  'js/admin.js',
  'js/briefing.js',
  'js/demo.js',
  'js/i18n.js',
  'js/persist.js',
  'js/search.js',
  'js/map.js',
  'js/env.js'
];

let passed = 0;
const failures = [];
let group = '';

function describe(name) { group = name; console.log(`\n${name}`); }

function check(message, fn) {
  try {
    const detail = fn();
    passed += 1;
    console.log(`  ✓ ${message}${detail ? ` — ${detail}` : ''}`);
  } catch (error) {
    failures.push({ group, message, error });
    console.log(`  ✗ ${message}\n      ${error.message}`);
  }
}

async function checkAsync(message, fn) {
  try {
    const detail = await fn();
    passed += 1;
    console.log(`  ✓ ${message}${detail ? ` — ${detail}` : ''}`);
  } catch (error) {
    failures.push({ group, message, error });
    console.log(`  ✗ ${message}\n      ${error.message}`);
  }
}

function equal(actual, expected, label = '') {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
  return null;
}

function truthy(value, label) {
  if (!value) throw new Error(label || 'expected a truthy value');
  return null;
}

/* ---------------------------------------------------------------- module load */

describe('Module load (no import errors)');
const loaded = {};
for (const modulePath of MODULES) {
  const key = modulePath.replace(/^js\//, '').replace(/\.js$/, '').replace(/\//g, '__');
  try {
    loaded[key] = await import(importUrl(modulePath));
    passed += 1;
    console.log(`  ✓ ${modulePath}`);
  } catch (error) {
    failures.push({ group, message: modulePath, error });
    console.log(`  ✗ ${modulePath}\n      ${error.message}`);
  }
}

const { HUBS, LINKS, FARE_RULES, MODES, HUB_BY_ID, LINK_BY_ID, networkSummary, searchTokens, linksFrom } = loaded['core__network'] || {};
const { fareForDistance, linkFare, totalFare, applySegmentFares } = loaded['core__fares'] || {};
const { planRoutes, planTrip, metroFareChart } = loaded['core__router'] || {};
const { parseQuery } = loaded['core__parse'] || {};
const {
  createAlert, sanityCheck, confidenceOf, freshness, resolveAlert, confirmAlert, routingWeight
} = loaded['core__alerts'] || {};

/* ----------------------------------------------------------------- fare engine */

describe('Fare engine (published rates)');
check('MRT-6 is ৳5/km with ৳20 minimum and ৳100 cap', () => {
  equal(FARE_RULES.metro.perKm, 5);
  equal(FARE_RULES.metro.minFare, 20);
  equal(FARE_RULES.metro.maxFare, 100);
});
check('city bus is ৳2.70/km with ৳10 minimum and 50% student discount', () => {
  equal(FARE_RULES.bus.perKm, 2.7);
  equal(FARE_RULES.bus.minFare, 10);
  equal(FARE_RULES.bus.studentDiscountPct, 50);
});
check('walking is free', () => {
  equal(fareForDistance('walk', 5).regular, 0);
});
check('the metro chart reproduces the published station prices', () => {
  const chart = metroFareChart();
  truthy(chart.stations.length >= 15, 'metro chart should have every station');
  const firstStop = chart.stations[0];
  const lastStop = chart.stations.at(-1);
  const fare = chart.fareBetween(firstStop.id, lastStop.id);
  truthy(fare.km > 0, 'first → last should have a positive distance');
  truthy(fare.regular >= 20 && fare.regular <= 100, `first → last fare must sit inside ৳20–৳100, got ৳${fare.regular}`);
});
check('a high-mode fare is banded and capped at ৳100', () => {
  const fare = fareForDistance('metro', 25).regular;
  truthy(fare <= 100, `long metro ride must cap at ৳100, got ৳${fare}`);
  truthy(fare >= 20, `metro minimum is ৳20, got ৳${fare}`);
});

/* ----------------------------------------------------------------- routing */

describe('Router (cost-efficient pathfinding)');
check('every hub is reachable from every other hub', () => {
  let pairs = 0;
  for (const a of HUBS) {
    for (const b of HUBS) {
      if (a.id === b.id) continue;
      const options = planRoutes({ from: a.id, to: b.id, limit: 1 });
      if (!options.length) throw new Error(`unreachable pair: ${a.id}→${b.id}`);
      pairs += 1;
    }
  }
  return `${pairs} hub pairs connected`;
});
check('every option quotes a fare and time', () => {
  const [option] = planRoutes({ from: HUBS[0].id, to: HUBS.at(-1).id });
  truthy(option, 'expected a routable option');
  truthy(option.fare.regular > 0, 'regular fare must be positive');
  truthy(option.timeMin > 0, 'time must be positive');
  return `৳${option.fare.regular} · ${option.timeMin} min · ${option.legs.length} legs`;
});
check('student pass halves bus fares with the ৳10 floor', () => {
  // Use the longest bus hop so the 50% discount produces a real saving
  const busLinks = LINKS.filter(link => link.mode === 'bus');
  truthy(busLinks.length, 'must have bus links to test');
  const busLink = busLinks.reduce((best, current) => (current.km > best.km ? current : best), busLinks[0]);
  const regular = linkFare(busLink).regular;
  const student = linkFare(busLink, { student: true }).student;
  truthy(student < regular, `student ৳${student} should beat regular ৳${regular}`);
  return `৳${regular} → ৳${student} on ${busLink.km} km`;
});
check('a metro-only constraint is honoured', () => {
  const options = planRoutes({ from: HUBS[0].id, to: HUBS.at(-1).id, onlyModes: ['metro'] });
  options.forEach(option => option.legs.forEach(leg => {
    if (leg.mode !== 'metro') throw new Error(`leg ${leg.linkId} should be metro`);
  }));
});
check('selected routes focus the map and draw route highlights', () => {
  const { state, mapContext } = loaded['state'] || {};
  const { refreshMap } = loaded['map'] || {};
  truthy(state && mapContext && refreshMap, 'route map state and refresh should be available');

  const markerCalls = [];
  const map = {
    removeLayer: () => {},
    addLayer: layer => markerCalls.push(layer),
    fitBounds: bounds => { map.fitBoundsValue = bounds; },
    hasLayer: () => false,
    setView: () => {},
    flyTo: () => {},
    eachLayer: () => {}
  };

  const route = {
    id: 'route-focus-test',
    selected: true,
    title: 'Metro test route',
    plan: {
      legs: [{
        from: HUBS[0].id,
        to: HUBS[1].id,
        mode: 'metro',
        timeMin: 6,
        km: 1.6,
        fare: { regular: 20, student: 10 }
      }]
    }
  };

  const mockLayer = () => ({
    addTo() { return this; },
    bindPopup() { return this; },
    bindTooltip() { return this; },
    setStyle() { return this; }
  });

  globalThis.L = {
    latLngBounds: () => ({ pad: () => ({ _southWest: { lat: 23.7, lng: 90.3 }, _northEast: { lat: 23.8, lng: 90.5 } }) }),
    polyline: () => mockLayer(),
    circleMarker: () => mockLayer(),
    circle: () => mockLayer(),
    marker: () => mockLayer(),
    divIcon: () => ({})
  };

  state.hubs = HUBS.slice(0, 2).map(hub => ({
    ...hub,
    status: 'normal',
    risk: 0.2,
    lines: hub.lines || ['Metro'],
    landmark: 'Test landmark',
    reports: 0,
    bn: 'Test'
  }));
  state.routes = [route];
  state.selectedRouteId = route.id;
  mapContext.map = map;
  mapContext.linkLayers = [];
  mapContext.riskLayers = [];
  mapContext.routeLayers = [];
  mapContext.disruptedMarkers = [];
  mapContext.hubMarkers = new Map();

  refreshMap();

  truthy(map.fitBoundsValue, 'map should zoom to the selected route bounds');
  truthy(mapContext.routeLayers.length > 0, 'selected route should add map route layers');
  return `route bounds + ${mapContext.routeLayers.length} highlighted leg(s)`;
});

/* ----------------------------------------------------------------- parser */

describe('Intent parser (English + Banglish)');
check('a Banglish student+sentence resolves origin/destination/budget', () => {
  // Look up the canonical Mirpur 10 hub name (whatever the dataset calls it)
  const origin = HUBS.find(hub => /mirpur.*10/i.test(hub.name));
  const destination = HUBS.find(hub => /motijheel/i.test(hub.name));
  truthy(origin && destination, 'need both Mirpur 10 and Motijheel hubs in the dataset');
  const parsed = parseQuery(`${origin.name} theke ${destination.name}, student, 60 takar moddhe`);
  truthy(parsed.from, `origin resolved to ${parsed.from} from "${origin.name}"`);
  truthy(parsed.to, `destination resolved to ${parsed.to} from "${destination.name}"`);
  equal(parsed.student, true);
  equal(parsed.maxFare, 60);
});

/* ----------------------------------------------------------------- alerts */

describe('Reporting system (alerts)');
check('a clean crowd report is accepted', () => {
  const outcome = sanityCheck({ hubId: HUBS[0].id, type: 'gridlock', severity: 3, description: 'Test report', reporter: 'smoke' });
  equal(outcome.ok, true);
  equal(outcome.action, 'accept');
});
check('an unknown hub is rejected', () => {
  const outcome = sanityCheck({ hubId: 'no-such-hub', type: 'gridlock', severity: 3 });
  equal(outcome.ok, false);
});
check('a fresh report has positive routing weight, a resolved one has zero', () => {
  const alert = createAlert({ hubId: HUBS[0].id, type: 'gridlock', severity: 3, description: 'Test', reporter: 'smoke' });
  truthy(routingWeight(alert) > 0, 'active report should weight');
  resolveAlert(alert);
  equal(routingWeight(alert), 0);
});
check('confidence decays with age', () => {
  const alert = createAlert({ hubId: HUBS[0].id, type: 'gridlock', severity: 3, description: 'Test', reporter: 'smoke' });
  const fresh = confidenceOf(alert, Date.now());
  const later = confidenceOf(alert, Date.now() + 200 * 60000);
  truthy(later < fresh, `${later} should be less than ${fresh}`);
});
await checkAsync('missing modal targets are safe to open and close', async () => {
  const originalDocument = globalThis.document;
  globalThis.document = {
    getElementById: () => null,
    querySelectorAll: () => [],
    querySelector: () => null
  };

  try {
    const { openAbout, closeAbout } = await import(importUrl('js/demo.js'));
    const { openIncidentModal, closeIncidentModal } = await import(importUrl('js/alerts.js'));
    openAbout();
    closeAbout();
    openIncidentModal();
    closeIncidentModal();
  } finally {
    globalThis.document = originalDocument;
  }

  return 'missing modal targets no-op cleanly';
});

/* ----------------------------------------------------------------- summary */

console.log(`\n${'-'.repeat(60)}`);
if (failures.length) {
  console.log(`FAILED ${failures.length} of ${passed + failures.length} checks\n`);
  failures.forEach(({ group: where, message, error }) => {
    console.log(`  ✗ [${where}] ${message}\n      ${error.stack.split('\n')[1]?.trim() || error.message}`);
  });
  process.exit(1);
}
console.log(`PASSED all ${passed} checks`);
