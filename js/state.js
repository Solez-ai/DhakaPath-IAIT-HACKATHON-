import {
  HUBS, HUB_BY_ID, LINK_BY_ID, FARE_RULES, MODE_GLYPHS, MODE_COLORS,
  OPERATIONS, LINKS, LINES_INFO, DATASET_INFO, networkSummary, linksFrom
} from './core/network.js';
import { createScenario, cloneScenario, scenarioActive, hubStatus, scenarioEffects, describeScenario } from './core/scenario.js';
import { planTrip, metroFareChart } from './core/router.js';
import { arrivalReport } from './core/arrival.js';
import { networkRisk, corridorRisk, dhakaPulse, nudgeFor, SAMPLE_FORECAST, normaliseForecast } from './core/weather.js';
import {
  ALERT_TYPES, createAlert, confidenceOf, freshness, routingWeight,
  sanityCheck, mergeReport, confirmAlert, denyAlert, resolveAlert, dedupe,
  predictedAlerts, disruptedLinks
} from './core/alerts.js';

/* ===============================
   Application store
   ===============================
   One place holds the scenario, the report ledger, the live forecast and the
   current plan. Everything the UI shows is derived from here, and everything
   here is derived from the dataset + the published fare rates.

   The ledger starts EMPTY: this build ships no fabricated reports (see
   README "Reporting system"). Live state is a real submission, or the weather
   model's own prediction, which is labelled as such. */

const START = Date.now();
const DEFAULT_ROUTE_LIMIT = 20;

const safeNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

export const state = {
  theme: 'light',
  lang: 'en',
  studentPass: false,
  selectedRouteId: null,
  showDisruptedHubs: true,
  deadline: '',

  scenario: createScenario(),
  weather: normaliseForecast(null),
  weatherHour: new Date().getHours(),

  search: {
    query: 'Mirpur 10 to Motijheel',
    origin: 'metro-mirpur-10',
    destination: 'metro-motijheel',
    preference: 'time',
    student: false,
    maxFare: null,
    avoidHubs: [],
    avoidModes: [],
    onlyModes: [],
    tokens: [
      { label: 'From Mirpur 10', icon: 'fa-location-dot', tone: 'signal' },
      { label: 'To Motijheel', icon: 'fa-flag-checkered' }
    ]
  },

  hubs: [],
  routes: [],
  reportStore: [],
  alerts: [],
  feed: [],
  plan: null,
  pulse: { score: 0, band: 'calm' },
  nudge: null,
  fareChart: metroFareChart(),
  summary: networkSummary(),
  dataset: DATASET_INFO
};

export const mapContext = {
  map: null,
  streetsLayer: null,
  lineLayers: new Map(),
  stopMarkers: new Map(),
  linkLayers: [],
  riskLayers: [],
  hubMarkers: new Map(),
  routeLayers: [],
  alertMarkers: [],
  disruptedMarkers: []
};

const logEntry = (kind, message, detail = {}) => {
  state.feed.unshift({ kind, message, at: new Date().toISOString(), ...detail });
  state.feed = state.feed.slice(0, 40);
};

/* ------------------------------------------------------------------
   Reports
   ------------------------------------------------------------------ */

/* Live reports that may influence routing: active, not expired, de-duplicated. */
export function activeReports(now = Date.now()) {
  const live = state.reportStore.filter(entry => {
    const info = freshness(entry, now);
    return entry.status === 'active' && !info.expired;
  });
  return dedupe(live, now).sort((a, b) => routingWeight(b, now) - routingWeight(a, now));
}

/* Core report → the flat shape the cards render. */
export function displayReport(report, now = Date.now()) {
  const info = freshness(report, now);
  const type = ALERT_TYPES[report.type] || ALERT_TYPES.incident;
  const hub = report.hubId ? HUB_BY_ID.get(report.hubId) : null;
  const link = report.linkId ? LINK_BY_ID.get(report.linkId) : null;

  return {
    id: report.id,
    title: `${type.label}${report.source === 'model' ? ' (predicted)' : ''}`,
    target: link ? `${link.routeName}: ${HUB_BY_ID.get(link.from).name} → ${HUB_BY_ID.get(link.to).name}` : (hub ? hub.name : 'unlocated'),
    hubId: report.hubId,
    linkId: report.linkId,
    tone: type.tone,
    icon: type.icon,
    description: report.description,
    freshness: `${info.label} · ${Math.round(info.confidence * 100)}% confidence`,
    confidence: info.confidence,
    status: report.status,
    lifecycle: info.status,
    source: report.source,
    predicted: report.source === 'model',
    confirmations: report.confirmations,
    denials: report.denials,
    severity: report.severity,
    weight: routingWeight(report, now),
    raw: report
  };
}

export function displayReports(now = Date.now()) {
  return state.reportStore
    .filter(entry => entry.status === 'active' && freshness(entry, now).status !== 'expired')
    .map(entry => displayReport(entry, now))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
      return b.confidence - a.confidence;
    });
}

/* Every mutation funnels through here so the provenance feed stays honest. */
export function addReport(report, now = Date.now()) {
  const outcome = sanityCheck(report, { now, existing: state.reportStore });

  if (outcome.action === 'merge' && outcome.mergeInto) {
    const target = state.reportStore.find(entry => entry.id === outcome.mergeInto);
    if (target) mergeReport(target, report, now);
    logEntry('merge', outcome.reason, { hubId: report.hubId });
    syncDisruptions(now);
    return { ...outcome, alert: target ? displayReport(target, now) : null };
  }

  if (!outcome.ok) {
    logEntry(outcome.action === 'flag' ? 'flagged' : 'rejected', outcome.reason, { hubId: report.hubId });
    return outcome;
  }

  const alert = createAlert(report, now);
  state.reportStore.unshift(alert);
  logEntry('accepted', outcome.reason, { hubId: report.hubId, id: alert.id });
  syncDisruptions(now);
  return { ...outcome, alert: displayReport(alert, now) };
}

export function confirmDisplayedReport(id, now = Date.now()) {
  const report = state.reportStore.find(entry => entry.id === id);
  if (!report) return null;
  confirmAlert(report, now);
  logEntry('confirmed', `Rider confirmation added to ${ALERT_TYPES[report.type].label}. Confidence up.`, { id });
  syncDisruptions(now);
  return displayReport(report, now);
}

export function denyDisplayedReport(id, now = Date.now()) {
  const report = state.reportStore.find(entry => entry.id === id);
  if (!report) return null;
  denyAlert(report, now);
  logEntry('denied', `Rider marked ${ALERT_TYPES[report.type].label} as not there. Confidence down.`, { id });
  return displayReport(report, now);
}

export function resolveDisplayedReport(id, now = Date.now()) {
  const report = state.reportStore.find(entry => entry.id === id);
  if (!report) return null;
  resolveAlert(report, now);
  logEntry('resolved', `${ALERT_TYPES[report.type].label} cleared. Routing weight removed.`, { id });
  syncDisruptions(now);
  return displayReport(report, now);
}

/* Admin moderation (Part 1 CMS). */
export function moderateReport(id, action, now = Date.now()) {
  const index = state.reportStore.findIndex(entry => entry.id === id);
  if (index === -1) return null;
  const report = state.reportStore[index];
  const label = ALERT_TYPES[report.type].label;

  if (action === 'delete') {
    state.reportStore.splice(index, 1);
    logEntry('admin', `Deleted a ${label} report.`, { id });
    syncDisruptions(now);
    return null;
  }

  if (action === 'approve') {
    report.status = 'active';
    report.flaggedReason = null;
    report.updatedAt = new Date(now).toISOString();
    logEntry('admin', `Approved a ${label} report — it now affects routing.`, { id });
  } else if (action === 'flag') {
    report.status = 'flagged';
    logEntry('admin', `Held a ${label} report out of routing for review.`, { id });
  } else if (action === 'resolve') {
    resolveAlert(report, now);
    logEntry('admin', `Marked a ${label} report as cleared.`, { id });
  } else {
    return null;
  }

  syncDisruptions(now);
  return displayReport(report, now);
}

/* ------------------------------------------------------------------
   Disruptions: confirmed reports close real corridors
   ------------------------------------------------------------------ */

/* The single place where the scenario learns about reports: a confirmed
   waterlogging/blockade report on a corridor takes that corridor out of
   service, and it comes back when the report decays or is cleared. */
function syncDisruptions(now = Date.now()) {
  const links = disruptedLinks(activeReports(now), now);
  const manual = state.scenario.blockedLinks.filter(id => !state.reportStore.some(report => report.linkId === id));
  const next = [...new Set([...manual, ...links])];

  if (next.length !== state.scenario.blockedLinks.length || next.some(id => !state.scenario.blockedLinks.includes(id))) {
    state.scenario = { ...cloneScenario(state.scenario), blockedLinks: next };
  }
}

/* Weather-model predictions: rainfall → predicted waterlogging on bus lines,
   clearly labelled and separate from crowd reports. */
export function syncPredictedReports(now = Date.now()) {
  const { corridors } = corridorRisk(state.weather, { hour: state.weatherHour, now });
  const byLink = new Map();

  corridors.forEach((entry, lineId) => {
    if (entry.value < 0.65) return;
    LINES_INFO.filter(line => line.id === lineId).forEach(line => {
      for (let index = 1; index < line.stops.length; index += 1) {
        const link = LINK_BY_ID.get(`${line.id}:${line.stops[index - 1]}>${line.stops[index]}`);
        if (link) byLink.set(link.id, entry);
      }
    });
  });

  const modelAlerts = state.reportStore.filter(entry => entry.source === 'model' && entry.status === 'active');
  if (modelAlerts.length > 4) {
    const keepIds = new Set(modelAlerts.slice(-4).map(entry => entry.id));
    state.reportStore = state.reportStore.filter(entry => !entry.source || entry.source !== 'model' || keepIds.has(entry.id));
  }

  if (!byLink.size) return state.reportStore.filter(entry => entry.source === 'model').length;

  const predictions = predictedAlerts(byLink, { now, threshold: 0.65 }).slice(0, 4);
  let added = 0;

  predictions.forEach(prediction => {
    const existing = state.reportStore.find(entry => entry.linkId === prediction.linkId && entry.type === 'waterlogging' && entry.source === 'model' && entry.status === 'active');
    if (existing) {
      existing.description = prediction.description;
      existing.updatedAt = new Date(now).toISOString();
      return;
    }
    if (state.reportStore.filter(entry => entry.source === 'model' && entry.status === 'active').length >= 4) {
      const oldest = state.reportStore.filter(entry => entry.source === 'model' && entry.status === 'active').sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt))[0];
      if (oldest) {
        state.reportStore = state.reportStore.filter(entry => entry.id !== oldest.id);
      }
    }
    state.reportStore.unshift(prediction);
    added += 1;
    logEntry('predicted', `Monsoon Shield predicts waterlogging on ${LINK_BY_ID.get(prediction.linkId)?.routeName || prediction.linkId} from ${corridors.get('bikolpo')?.reason || 'forecast rainfall'}.`, { id: prediction.id });
  });

  const modelCount = state.reportStore.filter(entry => entry.source === 'model' && entry.status === 'active').length;
  if (modelCount > 4) {
    const trimmed = state.reportStore.filter(entry => entry.source === 'model' && entry.status === 'active').sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt)).slice(0, 4);
    const keepIds = new Set(trimmed.map(entry => entry.id));
    state.reportStore = state.reportStore.filter(entry => entry.source !== 'model' || keepIds.has(entry.id));
  }

  return added;
}

/* ------------------------------------------------------------------
   Stops → map/card shape
   ------------------------------------------------------------------ */

export function stopStatus(hubId, now = Date.now()) {
  const scenarioStatus = hubStatus(hubId, state.scenario);
  if (scenarioStatus === 'blocked') return 'blocked';
  const reported = activeReports(now).filter(entry => entry.hubId === hubId);
  if (!reported.length) return scenarioStatus;
  return reported.some(entry => entry.severity >= 4) ? 'disrupted' : 'reported';
}

export function rebuildHubs(now = Date.now()) {
  state.hubs = HUBS.map(entry => ({
    id: entry.id,
    name: entry.name,
    coords: [entry.lat, entry.lng],
    services: entry.services,
    lines: [...new Set(linksFrom(entry.id).filter(link => link.mode !== 'walk').map(link => link.routeName))],
    interchange: entry.interchange,
    datasetIds: entry.datasetIds,
    zone: entry.zone,
    status: stopStatus(entry.id, now),
    reports: activeReports(now).filter(report => report.hubId === entry.id).length
  }));
}

/* ------------------------------------------------------------------
   Plan → cards
   ------------------------------------------------------------------ */

function titleFor(option) {
  if (option.lines.length === 1) return `${option.lines[0]} only`;
  if (option.lines.length) return option.lines.join(' + ');
  return 'Walk only';
}

function notesFor(option) {
  const parts = [
    `${HUB_BY_ID.get(option.legs[0].from).name} → ${HUB_BY_ID.get(option.legs.at(-1).to).name}`,
    `${option.timeMin} min`,
    option.transfers ? `${option.transfers} transfer${option.transfers === 1 ? '' : 's'}` : 'no transfers'
  ];
  if (option.walkMin) parts.push(`${option.walkMin} min walking`);
  return parts.join(' · ');
}

export function toRouteCard(option, arrival, selected, deltas = null) {
  const legs = option.legs.map(leg => {
    const fromHub = HUB_BY_ID.get(leg.from);
    const toHub = HUB_BY_ID.get(leg.to);
    const fare = leg.fare || {};
    return {
      modeKey: leg.mode,
      mode: FARE_RULES[leg.mode].label,
      line: leg.routeName,
      from: fromHub ? fromHub.name : leg.from,
      to: toHub ? toHub.name : leg.to,
      fromId: leg.from,
      toId: leg.to,
      time: `${leg.timeMin} min`,
      timeMin: safeNumber(leg.timeMin, 0),
      waitMin: safeNumber(leg.waitMin, 0),
      km: safeNumber(leg.km, 0),
      fare,
      fareValue: safeNumber(fare.regular ?? leg.fareValue ?? 0, 0),
      studentFare: safeNumber(fare.student ?? leg.studentFare ?? 0, 0),
      includedIn: fare.includedIn || null,
      isTransfer: leg.isTransfer,
      color: MODE_COLORS[leg.mode],
      icon: MODE_GLYPHS[leg.mode],
      board: leg.board,
      alight: leg.alight,
      why: leg.why,
      status: leg.status,
      dataset: leg.dataset
    };
  });

  return {
    id: option.signature,
    planId: option.signature,
    title: titleFor(option),
    tag: (option.tags?.[0] || option.preference).toUpperCase(),
    tags: option.tags || [],
    timeMinutes: safeNumber(option.timeMin, 0),
    walkMinutes: safeNumber(option.walkMin, 0),
    baseFare: safeNumber(option.fare?.regular ?? 0, 0),
    studentFare: safeNumber(option.fare?.student ?? 0, 0),
    transfers: option.transfers,
    reliability: option.reliability,
    notes: notesFor(option),
    modes: option.modes,
    legs,
    plan: option,
    arrival,
    deltas,
    selected
  };
}

export function refreshRoutePlan({ now = Date.now() } = {}) {
  const intent = state.search;
  const from = intent.origin || 'metro-mirpur-10';
  const to = intent.destination || 'metro-motijheel';
  const featured = !intent.origin && !intent.destination;

  const query = {
    from,
    to,
    student: state.studentPass || intent.student,
    prefer: intent.preference || 'time',
    maxFare: intent.maxFare,
    avoidHubs: intent.avoidHubs,
    avoidModes: intent.avoidModes,
    onlyModes: intent.onlyModes,
    limit: DEFAULT_ROUTE_LIMIT
  };

  const alerts = activeReports(now);
  const plan = planTrip(query, state.scenario);
  state.plan = { ...plan, query, featured, alerts };

  const cards = plan.options.map(option => {
    const arrival = arrivalReport(option, { deadline: state.deadline, now, scenario: state.scenario, alerts });
    const deltas = option.signature === plan.options[0].signature ? plan.deltas : null;
    return toRouteCard(option, arrival, false, deltas);
  });

  const chosen = cards.find(card => card.id === state.selectedRouteId) || cards[0] || null;
  state.selectedRouteId = chosen ? chosen.id : null;
  cards.forEach(card => { card.selected = card.id === state.selectedRouteId; });

  state.routes = cards;
  return cards;
}

/* Plan an explicit pair without disturbing the current search. */
export function planEndpoints(from, to, { prefer = 'cost', student = state.studentPass, limit = DEFAULT_ROUTE_LIMIT, now = Date.now() } = {}) {
  if (!from || !to || from === to) return { options: [], query: null, effects: scenarioEffects(state.scenario), alerts: [], featured: false };

  const query = { from, to, student, prefer, limit };
  const plan = planTrip(query, state.scenario);
  const alerts = activeReports(now);

  return {
    ...plan,
    query,
    alerts,
    cards: plan.options.map(option => toRouteCard(option, arrivalReport(option, { now, scenario: state.scenario, alerts }), false))
  };
}

/* ------------------------------------------------------------------
   Scenario + weather
   ------------------------------------------------------------------ */

export function setScenario(patch, { now = Date.now() } = {}) {
  state.scenario = { ...cloneScenario(state.scenario), ...patch };
  logEntry('scenario', describeScenario(state.scenario));
  refresh({ now });
}

export function toggleBlockedHub(hubId, now = Date.now()) {
  const blocked = new Set(state.scenario.blockedHubs);
  if (blocked.has(hubId)) blocked.delete(hubId);
  else blocked.add(hubId);
  setScenario({ blockedHubs: [...blocked] }, { now });
}

export function setForecast(payload) {
  state.weather = normaliseForecast(payload);
  state.weatherHour = new Date().getHours();
  return state.weather;
}

export function applyLiveWeather({ now = Date.now() } = {}) {
  state.weatherHour = new Date(now).getHours();
  const risk = networkRisk(state.weather, { hour: state.weatherHour, now });
  const rain = risk.rainLoad >= 10 ? 'heavy' : risk.rainLoad >= 5 ? 'light' : 'none';
  const hour = new Date(now).getHours();
  const rush = (hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 20);

  setScenario({ rain, rush }, { now });
  logEntry('weather', `Scenario set from ${state.weather.label}: rainfall load ${risk.rainLoad} mm/h → ${rain === 'none' ? 'no rain' : `${rain} rain`}${rush ? ' + peak hour' : ''}.`);
  return { rain, rush, risk };
}

export function setWeatherHour(hour, { now = Date.now() } = {}) {
  state.weatherHour = hour;
  syncPredictedReports(now);
  rebuildHubs(now);
  refreshRoutePlan({ now });
}

/* ------------------------------------------------------------------
   Full refresh
   ------------------------------------------------------------------ */

export function refresh({ now = Date.now() } = {}) {
  syncPredictedReports(now);
  syncDisruptions(now);
  rebuildHubs(now);
  state.alerts = displayReports(now);
  state.pulse = dhakaPulse(state.weather, { hour: state.weatherHour, now, activeAlerts: activeReports(now).length });
  state.nudge = nudgeFor(state.weather, { now });
  state.summary = networkSummary();
  state.fareChart = metroFareChart();
  refreshRoutePlan({ now });
  return state;
}

logEntry('system', `Loaded the organizer dataset: ${state.summary.hubs} stops, ${LINES_INFO.length} services, ${state.summary.links} directed links. Report ledger starts empty — nothing is fabricated.`);
logEntry('dataset', DATASET_INFO.sources.note || 'Dataset loaded from Map Data/.');

export const STORE_START = START;
export { SAMPLE_FORECAST };

/* Vocabulary bridge: a rider sees an ALERT (a card on the board) while the core
   records a REPORT (a submission that went through validation). The UI modules
   are written against the alert vocabulary, so it is aliased once here instead
   of being respelled in five files. */
export const activeAlerts = activeReports;
export const confirmDisplayedAlert = confirmDisplayedReport;
export const denyDisplayedAlert = denyDisplayedReport;
export const resolveDisplayedAlert = resolveDisplayedReport;
export const moderateAlert = moderateReport;
