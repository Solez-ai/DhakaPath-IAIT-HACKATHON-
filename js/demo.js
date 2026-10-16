import { state, refresh, setScenario, toggleBlockedHub } from './state.js';
import { renderRoutes, renderRouteRibbon, selectRoute } from './routes.js';
import { renderAlerts } from './alerts.js';
import { refreshMap } from './map.js';
import { renderAdmin } from './admin.js';
import { syncFareInputs, renderFareTable } from './fares.js';
import { readLocal, writeLocal } from './persist.js';

/* ===============================
   Demo mode + About data
   ===============================
   The whole point of a one-click demo is reproducibility: the same query, the
   same disruption, the same detour, every single time. `runDemo` drives the
   real UI (it never fakes a screen), so the demo doubles as a smoke test.

   Timeline:  search student trip (0ms) → open the planner tab → show the
   disruption banner → rain + a Farmgate closure (~1.6s) → detour + deltas. */

let runToken = 0;

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function typeSearch(text) {
  const input = document.getElementById('searchInput');
  if (input) input.value = text;
  const mobile = document.getElementById('mobileSearchInput');
  if (mobile) mobile.value = text;
}

function setTab(tab) {
  const button = document.getElementById(`tabBtn-${tab}`);
  if (button) button.click();
}

function toast(message) {
  const el = document.getElementById('appToast');
  if (!el) return;
  el.textContent = message;
  el.classList.remove('hidden');
  el.classList.add('flex');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => {
    el.classList.add('hidden');
    el.classList.remove('flex');
  }, 4200);
}

function resetDemoState() {
  const student = document.getElementById('studentToggle');
  if (student) student.checked = false;
  state.studentPass = false;
  state.deadline = '';
  const deadline = document.getElementById('deadlineInput');
  if (deadline) deadline.value = '09:00';
}

/* Step 1 — a student trip with an arrival deadline: the whole engine in one query. */
export async function runDemo() {
  const token = ++runToken;
  closeAbout();

  resetDemoState();
  setTab('plan');
  typeSearch('Mirpur theke Motijheel student, 9 tar moddhe');

  state.studentPass = true;
  const student = document.getElementById('studentToggle');
  if (student) student.checked = true;
  state.deadline = '09:00';

  const { executeSearch } = await import('./search.js');
  executeSearch();
  syncFareInputs();
  renderFareTable();
  refreshMap();
  toast('Demo 1/3 — student trip planned with an arrive-by guarantee');

  await wait(1800);
  if (token !== runToken) return;

  // Step 2 — monsoon + a blocked Farmgate transfer: the route must break and reroute
  setScenario({ rain: 'heavy', rush: true });
  if (!state.scenario.blockedHubs.includes('farmgate')) toggleBlockedHub('farmgate');
  refresh();
  renderRoutes();
  renderRouteRibbon();
  refreshMap();
  toast('Demo 2/3 — heavy rain + Farmgate closed: watch the plan reroute');

  await wait(2400);
  if (token !== runToken) return;

  // Step 3 — prove the ledger changed too, then hand the keyboard back to the rider
  setTab('alerts');
  renderAlerts();
  toast('Demo 3/3 — Monsoon Shield raised predicted waterlogging alerts');

  await wait(2600);
  if (token !== runToken) return;
  setTab('plan');
  if (state.routes[0]) selectRoute(state.routes[0].id);
  renderAdmin();
}

export function cancelDemo() {
  runToken += 1;
}

/* ---------------- About data ---------------- */

export function openAbout() {
  const modal = document.getElementById('aboutModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  const stamp = document.getElementById('aboutStamp');
  if (stamp) stamp.textContent = new Date().toLocaleString();
}

export function closeAbout() {
  const modal = document.getElementById('aboutModal');
  if (!modal) return;
  modal.classList.add('hidden');
}

/* First visit only: state the demo-data position before anyone has to ask. */
export function maybeShowAbout() {
  if (readLocal('aboutSeen', false)) return;
  writeLocal('aboutSeen', true);
  setTimeout(openAbout, 700);
}
