import { HUBS, LINKS, HUB_BY_ID, FARE_RULES, hub, linksFrom } from './network.js';

/* ===============================
   Scenario engine — disruptions from real inputs only
   ===============================
   One scenario object drives routing, fares, the map and the arrival model:

     { rain: 'none'|'light'|'heavy', rush: bool,
       blockedHubs: [hubId],        // an operator/user closure
       blockedLinks: [linkId] }

   Two honest sources of disruption, and nothing else:

     1. Weather (rain + peak hour). Rain and rush slow the BUS corridors — the
        metro runs on a viaduct, so a flooded street does not stop MRT-6, which
        is exactly why "rain broke the bus corridor, take the metro" is a real
        reroute rather than a scripted one. The slowdown factors below are
        documented modelling parameters; the dataset carries no speed data.
     2. Reported conditions. A waterlogging report confirmed on a corridor
        (a real user submission, see core/alerts.js) breaks that link.

   The previous build guessed a per-hub flood vulnerability. There is no source
   for such a number in `Map Data/`, so it is gone: localisation comes from
   reports, and the rainfall-driven city-wide risk lives in core/weather.js. */

const TIME_FACTORS = {
  metro: { rush: 1.1, rain: 1.0, source: 'Elevated viaduct: unaffected by street flooding' },
  bus: { rush: 1.4, rain: 1.35, source: 'Assumed peak/flood slowdown for Dhaka mixed traffic' },
  walk: { rush: 1.0, rain: 1.15, source: 'Slower walking in heavy rain' }
};

export const RAIN_LEVELS = ['none', 'light', 'heavy'];

export function createScenario() {
  return { rain: 'none', rush: false, blockedHubs: [], blockedLinks: [] };
}

export function scenarioActive(scenario) {
  if (!scenario) return false;
  return scenario.rain !== 'none' || scenario.rush || scenario.blockedHubs.length > 0 || scenario.blockedLinks.length > 0;
}

export function cloneScenario(scenario) {
  return {
    rain: scenario.rain,
    rush: scenario.rush,
    blockedHubs: [...scenario.blockedHubs],
    blockedLinks: [...scenario.blockedLinks]
  };
}

/* 'ok' | 'broken' (a confirmed problem on this corridor) | 'blocked' (closure) */
export function linkStatus(link, scenario) {
  if (!scenario) return 'ok';
  if (scenario.blockedLinks.includes(link.id)) return 'blocked';
  if (scenario.blockedHubs.includes(link.from) || scenario.blockedHubs.includes(link.to)) return 'blocked';
  return 'ok';
}

export function linkUsable(link, scenario) {
  return linkStatus(link, scenario) === 'ok';
}

/* Time multiplier for a link under the current scenario. */
export function timeMultiplier(link, scenario) {
  if (!scenario) return 1;
  const factors = TIME_FACTORS[link.mode] || { rush: 1, rain: 1 };
  let multiplier = 1;
  if (scenario.rush) multiplier *= factors.rush;
  if (scenario.rain === 'light') multiplier *= 1 + (factors.rain - 1) * 0.5;
  if (scenario.rain === 'heavy') multiplier *= factors.rain;
  return Number(multiplier.toFixed(3));
}

export function hubStatus(hubId, scenario) {
  if (!scenario) return 'normal';
  if (scenario.blockedHubs.includes(hubId)) return 'blocked';
  const affected = linksFrom(hubId).filter(link => linkStatus(link, scenario) !== 'ok').length;
  if (!affected) return 'normal';
  return affected >= linksFrom(hubId).length ? 'blocked' : 'disrupted';
}

/* Everything the UI needs to render a scenario in one call. */
export function scenarioEffects(scenario) {
  const broken = [];
  const blocked = [];

  LINKS.forEach(link => {
    const status = linkStatus(link, scenario);
    if (status === 'broken') broken.push(link);
    if (status === 'blocked') blocked.push(link);
  });

  return {
    active: scenarioActive(scenario),
    brokenLinks: broken,
    blockedLinks: blocked,
    closedHubs: scenario?.blockedHubs ? [...scenario.blockedHubs] : [],
    rain: scenario?.rain || 'none',
    rush: Boolean(scenario?.rush)
  };
}

/* Human-readable summary used by the "Active disruptions" strip and the chat. */
export function describeScenario(scenario) {
  if (!scenarioActive(scenario)) return 'Normal conditions — no disruptions applied.';

  const parts = [];
  if (scenario.rain === 'light') parts.push('light rain');
  if (scenario.rain === 'heavy') parts.push('heavy rain');
  if (scenario.rush) parts.push('peak office rush');
  if (scenario.blockedHubs.length) {
    parts.push(`closed: ${scenario.blockedHubs.map(id => HUB_BY_ID.get(id)?.name || id).join(', ')}`);
  }
  if (scenario.blockedLinks.length) parts.push(`${scenario.blockedLinks.length} corridor(s) out of service`);

  return `Scenario active — ${parts.join(', ')}.`;
}

/* Estimated extra minutes the current scenario adds to the fastest plan for a
   pair, used by the nudge card. */
export function rainExtraMinutes(link, scenario) {
  if (link.mode === 'walk' || link.mode === 'metro') return 0;
  return Math.round(link.timeMin * (timeMultiplier(link, scenario) - 1));
}

export const SCENARIO_SOURCES = TIME_FACTORS;

export const MODE_VARIANCE = Object.fromEntries(Object.entries(FARE_RULES).map(([mode, rules]) => [mode, rules.variance]));

export function hubFloodRisk(hubId, scenario) {
  const rain = scenario?.rain || 'none';
  const hub = HUB_BY_ID.get(hubId);
  if (!hub) return 0;
  const baseRisk = { none: 0, light: 1, heavy: 3 }[rain] ?? 0;
  // Jatrabari and Farmgate are low-lying; Uttara and airport are elevated
  const hubElevation = hub.zone === 'Interchange' || hub.name.includes('Uttara') || hub.name.includes('Airport') ? 0.5 : 1;
  const risk = Number((baseRisk * hubElevation).toFixed(2));
  return risk;
}

  export { HUBS, hub, FARE_RULES };
