import './config.js';
import { loadEnv } from './env.js';
import { state, refresh } from './state.js';
import { initMap, refreshMap } from './map.js';
import { renderRoutes, renderRouteRibbon } from './routes.js';
import { renderAlerts } from './alerts.js';
import { initFareCalculator } from './fares.js';
import { initAiStatus } from './chat.js';
import { bindAppEvents } from './events.js';
import { initConditions } from './scenarioUi.js';
import { initLanguage } from './i18n.js';
import { initAdmin, renderAdmin } from './admin.js';
import { maybeShowAbout } from './demo.js';

/* ===============================
   Application bootstrap
   ===============================
   Order matters: language → config → admin overrides → store → renderers.
   The store derives every hub, card and alert from js/core, so the first paint
   is already consistent across the map, the planner, the ledger and the chat.
   Admin overrides are replayed *before* the first refresh so a saved fare rule
   or a closed link is already in force on paint. */

document.addEventListener('DOMContentLoaded', async () => {
  initLanguage();

  // /api/config and /api/weather are served by server.mjs; without them the app
  // runs fully offline (OSM tiles, bundled sample forecast, local estimates)
  await loadEnv();

  bindAppEvents();

  // Part 1 CMS: persisted network/fare edits come back before anything renders
  initAdmin();

  refresh();
  initMap();
  refreshMap();
  renderRoutes();
  renderAlerts();
  initFareCalculator();
  initAiStatus();

  // Live forecast loads after first paint so the UI is never blocked on the network
  await initConditions();

  renderRouteRibbon();
  renderAdmin();

  document.documentElement.dataset.ready = 'true';
  maybeShowAbout();
  window.__dhakapath = { state };
});
