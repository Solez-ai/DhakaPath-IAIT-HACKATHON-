import { state, refreshRoutePlan } from './state.js';
import { parseQuery, CHIP_TONES, suggestHubs } from './core/parse.js';
import { HUB_BY_ID, HUBS } from './core/network.js';
import { renderRouteRibbon, renderRoutes } from './routes.js';
import { refreshMap } from './map.js';

/* Debounced live re-route for intent-aware search: the map redraws the most
   efficient routing as the rider types recognisable areas. */
let liveSearchTimer = null;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function updateSearchSuggestions(raw = '') {
  const input = document.getElementById('searchInput') || document.getElementById('mobileSearchInput');
  const datalist = document.getElementById('searchSuggestions') || document.createElement('datalist');

  if (!input) return;

  datalist.id = 'searchSuggestions';
  const trimmed = String(raw || '').trim();
  const suggestions = trimmed.length >= 2 ? suggestHubs(trimmed, 6) : [];

  datalist.innerHTML = suggestions.map(value => `<option value="${escapeHtml(value)}"></option>`).join('');

  if (!document.getElementById('searchSuggestions')) {
    input.parentNode?.appendChild(datalist);
  }

  input.setAttribute('list', 'searchSuggestions');
}

/* ===============================
   Intent-aware search
   ===============================
   Parsing lives in js/core/parse.js (deterministic, and the exact shape the
   Gemini layer is asked to produce). This module is only the DOM binding: read
   the box, apply the parsed intent to the store, redraw. */

export function applyParsedQuery(raw) {
  const parsed = parseQuery(raw);
  const student = parsed.student || (document.getElementById('studentToggle')?.checked ?? state.studentPass);

  state.search = {
    query: parsed.query,
    origin: parsed.from,
    destination: parsed.to,
    preference: parsed.prefer || 'time',
    student,
    maxFare: parsed.maxFare,
    avoidHubs: parsed.avoidHubs,
    avoidModes: parsed.avoidModes,
    onlyModes: parsed.onlyModes,
    tokens: parsed.tokens
  };

  if (parsed.student) {
    state.studentPass = true;
    const toggle = document.getElementById('studentToggle');
    if (toggle) toggle.checked = true;
  }

  const notice = !parsed.query
    ? null
    : parsed.from && parsed.to
      ? null
      : parsed.from || parsed.to
        ? 'Add a destination to plan a trip'
        : 'No hub recognised — try "Mirpur theke Motijheel"';

  return { parsed, notice };
}

export function renderIntentChips(tokens, notice) {
  const container = document.getElementById('intentChips');
  if (!container) return;

  const chips = [...(tokens || [])];
  if (notice) chips.push({ label: notice, icon: 'fa-triangle-exclamation', tone: 'signal' });

  if (!chips.length) {
    container.innerHTML = `
      <span class="text-[11px] bg-surface-2 text-ink-2 px-2 py-0.5 rounded border border-line flex items-center gap-1">
        <i class="fa-solid fa-location-dot text-[9px] text-signal"></i> Auto-Detecting Nodes
      </span>`;
    return;
  }

  container.innerHTML = chips.map(token => `
    <span class="text-[11px] px-2 py-0.5 rounded border flex items-center gap-1 ${CHIP_TONES[token.tone || 'default']}">
      <i class="fa-solid ${token.icon} text-[9px]"></i> ${token.label}
    </span>
  `).join('');
}

export function handleSearchInput(value) {
  clearTimeout(liveSearchTimer);
  updateSearchSuggestions(value);
  const { parsed, notice } = applyParsedQuery(value);
  renderIntentChips(parsed.tokens, notice);

  /* Intent-aware search updates the map live: once both ends of the trip are
     recognised from the dataset vocabulary, re-plan and redraw the route so
     the rider sees the most efficient routing change as they type. */
  if (parsed.origin && parsed.destination) {
    liveSearchTimer = setTimeout(executeSearch, 300);
  }
}

function readSearchValue() {
  const desktop = document.getElementById('searchInput');
  const mobile = document.getElementById('mobileSearchInput');
  if (desktop?.value) return desktop.value;
  return mobile?.value || '';
}

export function executeSearch() {
  const { parsed, notice } = applyParsedQuery(readSearchValue());

  if (!parsed.query) {
    state.search = { ...state.search, query: '', origin: null, destination: null, tokens: [] };
    renderIntentChips(parsed.tokens);
    refreshRoutePlan();
    renderRoutes();
    renderRouteRibbon();
    refreshMap();
    return;
  }

  // A destination-only sentence plans from wherever the rider is, else from the
  // busiest interchange the dataset actually has.
  if (!state.search.origin && state.search.destination) {
    const assumed = state.userCoords ? nearestHubTo(state.userCoords) : 'metro-mirpur-10';
    const label = state.userCoords ? 'Nearest stop to your location' : 'Assumed origin';
    state.search.origin = assumed;
    state.search.tokens = [
      { label: `${label}: ${HUB_BY_ID.get(assumed).name}`, icon: 'fa-location-crosshairs', tone: 'muted' },
      ...state.search.tokens
    ];
  }

  refreshRoutePlan();
  renderIntentChips(state.search.tokens, notice);
  renderRoutes();
  renderRouteRibbon();
  refreshMap();
}

/* Snap a GPS fix to the closest dataset stop — the same rule the report form uses. */
function nearestHubTo(coords) {
  return HUBS
    .map(entry => ({ id: entry.id, distance: Math.hypot(entry.lat - coords.lat, entry.lng - coords.lng) }))
    .sort((a, b) => a.distance - b.distance)[0].id;
}

export { parseQuery };
