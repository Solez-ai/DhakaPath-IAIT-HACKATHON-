/* ===============================
   Client Environment
   ===============================
   Keys live in .env and are read by server.mjs. The browser only ever receives
   the public CARTO basemap key; the Gemini key stays on the server.

   Served statically (python -m http.server, file://) /api/config does not exist,
   so everything stays disabled and the app falls back to OpenStreetMap tiles
   plus local AI estimates. */

import { normaliseForecast } from './core/weather.js';

const FALLBACK = Object.freeze({
  reachable: false,
  cartoKey: null,
  gemini: Object.freeze({ enabled: false, model: null })
});

let env = { ...FALLBACK };

export async function loadEnv() {
  try {
    const response = await fetch('/api/config', { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const config = await response.json();
    env = {
      reachable: true,
      cartoKey: config.cartoKey || null,
      gemini: {
        enabled: Boolean(config.gemini && config.gemini.enabled),
        model: (config.gemini && config.gemini.model) || null
      }
    };
  } catch {
    env = { ...FALLBACK };
  }

  return env;
}

export function getEnv() {
  return env;
}

/* Dhaka rainfall for the Monsoon Shield model.

   /api/weather is served by server.mjs and proxies Open-Meteo (free, no key,
   15-minute cache). Served statically, or with the upstream down, the bundled
   sample forecast is used — and it is labelled "offline sample" everywhere it
   appears, so it can never pass for live data. */
export async function loadWeather() {
  try {
    const response = await fetch('/api/weather', { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return normaliseForecast(await response.json());
  } catch {
    return normaliseForecast(null);
  }
}
