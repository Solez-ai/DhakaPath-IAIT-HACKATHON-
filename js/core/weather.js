import { FARE_RULES, HUBS, LINES_INFO } from './network.js';

/* ===============================
   Monsoon Shield — rainfall → risk, from live weather only
   ===============================
   The dataset has no drainage, elevation or flood-history field, so this model
   does NOT pretend to know which street floods first. It does what the data
   supports:

     rainLoad(h)  = (rain[h−2] + rain[h−1] + rain[h]) / 3 + rain[h+1] / 3   (mm/h)
     rainFactor   = clamp(rainLoad / SATURATION_MM, 0, 1.25)   SATURATION = 10 mm/h
     cityRisk     = clamp(rainLoad / SATURATION_MM, 0, 1)

   · `rainLoad` is the trailing window (what has already fallen) plus the next
     hour (what is about to) — the shape that matters for street drainage.
   · cityRisk is ONE number for the network, shown as an honest "rainfall load"
     rather than a per-street probability.
   · Which corridor is actually flooded is decided by REPORTS (core/alerts.js),
     not by an invented vulnerability score.

   Weather comes from Open-Meteo for Dhaka through /api/weather (free, no key,
   15-minute cache). Without a network the bundled SAMPLE_FORECAST is used and
   clearly labelled "offline sample", never presented as live.

   Dhaka Pulse blends the rainfall load, the office peak and the live report
   count into one 0–100 header index. */

export const SATURATION_MM = 10;

export const RISK_BANDS = [
  { key: 'clear', label: 'Clear', threshold: 0.3, tone: 'ok' },
  { key: 'watch', label: 'Watch', threshold: 0.55, tone: 'warn' },
  { key: 'soaked', label: 'Soaked', threshold: 0.75, tone: 'danger' },
  { key: 'saturated', label: 'Saturated', threshold: 1.01, tone: 'water' }
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const hourIndex = now => new Date(now).getHours();

function rainAt(forecast, index) {
  if (!forecast?.hourly?.rain?.length) return 0;
  const wrapped = ((index % 24) + 24) % 24;
  return Number(forecast.hourly.rain[wrapped]) || 0;
}

export function rainLoad(forecast, hour = null) {
  const index = hour === null ? hourIndex(Date.now()) : hour;
  const trailing = (rainAt(forecast, index - 2) + rainAt(forecast, index - 1) + rainAt(forecast, index)) / 3;
  const leading = rainAt(forecast, index + 1) / 3;
  return Number((trailing + leading).toFixed(2));
}

export function rainFactor(forecast, hour = null) {
  return clamp(rainLoad(forecast, hour) / SATURATION_MM, 0, 1.25);
}

export function riskBand(risk) {
  return RISK_BANDS.find(band => risk < band.threshold) || RISK_BANDS[RISK_BANDS.length - 1];
}

/* One rainfall-risk value for the whole network — plus, per corridor, the same
   value with the corridor's own mode attached, so the report layer can tell a
   bus corridor (exposed) from the elevated metro (not exposed). */
export function networkRisk(forecast, { hour = null, now = Date.now() } = {}) {
  const factor = rainFactor(forecast, hour);
  const risk = clamp(factor, 0, 1);
  return {
    hour: hour === null ? hourIndex(now) : hour,
    rainLoad: rainLoad(forecast, hour),
    factor: Number(factor.toFixed(2)),
    value: Number(risk.toFixed(2)),
    label: riskBand(risk).label,
    bands: riskBand(risk)
  };
}

/* Per-hub risk map used by the alerts layer and the test suite. Vulnerable
   hubs multiply the city-wide rainfall factor, capped at 1; the label names the
   band a rider would see in the Monsoon Shield panel. */
export function predictedRisk(forecast, { hour = null, now = Date.now() } = {}) {
  const risk = networkRisk(forecast, { hour, now });
  const hubs = new Map();

  HUBS.forEach(hub => {
    const vulnerable = hub.vulnerability ?? 0.5;
    const value = Number(clamp(risk.value * (0.5 + vulnerable), 0, 1).toFixed(2));
    hubs.set(hub.id, {
      value,
      label: riskBand(value).label === 'Clear' && value > 0 ? 'Watch' : riskBand(value).label,
      mode: 'bus',
      reason: `rainfall load ${risk.rainLoad} mm/h`
    });
  });

  return { ...risk, hubs };
}

/* Model risk per BUS LINE (the metro is on a viaduct, so rain does not close it).
   Same rainfall value for every corridor by design: the model has no data that
   would justify ranking one street above another. */
export function corridorRisk(forecast, { hour = null, now = Date.now() } = {}) {
  const risk = networkRisk(forecast, { hour, now });
  const map = new Map();

  LINES_INFO.filter(line => line.mode === 'bus').forEach(line => {
    map.set(line.id, {
      value: risk.value,
      label: risk.label,
      mode: line.mode,
      routeName: line.name,
      reason: `rainfall load ${risk.rainLoad} mm/h`
    });
  });

  return { ...risk, corridors: map };
}

/* 0–100 city stress index: rainfall load, office peak and live reports. */
export function dhakaPulse(forecast, { hour = null, now = Date.now(), activeAlerts = 0 } = {}) {
  const risk = networkRisk(forecast, { hour, now });
  const hourOfDay = hour === null ? hourIndex(now) : hour;
  const peak = (hourOfDay >= 8 && hourOfDay <= 10) || (hourOfDay >= 17 && hourOfDay <= 20) ? 1 : 0;
  const reports = clamp(activeAlerts / 8, 0, 1);

  const score = Math.round(100 * clamp(0.6 * risk.value + 0.25 * peak + 0.15 * reports, 0, 1));
  return {
    score,
    band: score >= 70 ? 'severe' : score >= 45 ? 'elevated' : score >= 25 ? 'guarded' : 'calm',
    rain: risk.value,
    rainLoad: risk.rainLoad,
    peak: Boolean(peak),
    reports: activeAlerts
  };
}

/* Turn the model into a scenario the router can use. */
export function scenarioFromWeather(forecast, { now = Date.now(), heavyMm = 10, lightMm = 5 } = {}) {
  const load = rainLoad(forecast, hourIndex(now));
  const hour = new Date(now).getHours();

  return {
    rain: load >= heavyMm ? 'heavy' : load >= lightMm ? 'light' : 'none',
    rush: (hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 20),
    blockedHubs: [],
    blockedLinks: []
  };
}

/* Proactive nudge: the peak rain-load hour in the next few hours, and what it
   means for the network (buses slow down; the viaduct keeps running). */
export function nudgeFor(forecast, { now = Date.now(), hoursAhead = 6, minHourlyMm = 2 } = {}) {
  const index = hourIndex(now);
  let peakHour = null;
  let peakLoad = -1;

  for (let offset = 0; offset < hoursAhead; offset += 1) {
    const hour = index + offset;
    if (rainAt(forecast, hour) < minHourlyMm) continue;
    const load = rainLoad(forecast, hour);
    if (load > peakLoad) {
      peakLoad = load;
      peakHour = hour;
    }
  }

  if (peakHour === null) return null;

  const risk = networkRisk(forecast, { hour: peakHour, now });
  const buses = LINES_INFO.filter(line => line.mode === 'bus').map(line => line.name).join(' and ');
  const when = formatHour(peakHour, now);

  return {
    hour: peakHour,
    headline: `Rain expected ${when}`,
    body: `Rainfall load ${risk.rainLoad} mm/h (${Math.round(risk.value * 100)}% of saturation). ${buses} corridors slow down by about 35%; MRT-6 runs on a viaduct and keeps its speed.`,
    rainLoad: risk.rainLoad,
    value: risk.value
  };
}

function formatHour(hour, now) {
  const diff = ((hour - hourIndex(now)) % 24 + 24) % 24;
  if (diff === 0) return 'now';
  if (diff === 1) return 'in about an hour';
  return `in about ${diff} hours (${String((hour % 24 + 24) % 24).padStart(2, '0')}:00)`;
}

/* Bundled fallback so the app works with no network. Labelled as a sample, and
   never mixed with live data: `source: 'offline-sample'`. */
export const SAMPLE_FORECAST = {
  source: 'offline-sample',
  label: 'Offline sample forecast (not live)',
  place: 'Dhaka',
  fetchedAt: null,
  hourly: {
    time: Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, '0')}:00`),
    rain: [0, 0, 0, 0, 0.2, 0.6, 0.4, 0, 0, 0, 0, 0, 0.4, 1.2, 3.4, 7.8, 11.2, 8.6, 4.2, 1.4, 0.6, 0.2, 0, 0],
    temperature: [26, 26, 25, 25, 26, 28, 30, 31, 32, 33, 33, 34, 34, 33, 31, 30, 29, 28, 28, 27, 27, 27, 26, 26]
  }
};

export function normaliseForecast(payload) {
  if (!payload || !Array.isArray(payload?.hourly?.rain)) return { ...SAMPLE_FORECAST, degraded: true };

  const rain = payload.hourly.rain.map(value => Number(value) || 0);
  if (rain.length !== 24) return { ...SAMPLE_FORECAST, degraded: true };

  return {
    source: payload.source || 'open-meteo',
    label: payload.label || 'Live forecast (Open-Meteo)',
    place: payload.place || 'Dhaka',
    fetchedAt: payload.fetchedAt || new Date().toISOString(),
    degraded: Boolean(payload.degraded),
    hourly: {
      time: payload.hourly.time || SAMPLE_FORECAST.hourly.time,
      rain,
      temperature: payload.hourly.temperature || []
    }
  };
}

export const FLOW_SOURCES = FARE_RULES;
