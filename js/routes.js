import { state, refresh } from './state.js';
import { refreshMap } from './map.js';
import { HUBS, FARE_RULES } from './core/network.js';

/* ===============================
   Planner renderer
   ===============================
   Route options, the chart-style route ribbon and the fare ledger. Every number
   comes from the planner (core/router.js), which prices the journey with the
   official rates and validates every leg against the dataset graph. */

const money = value => `৳${Number.isFinite(Number(value)) ? Number(value) : 0}`;

const TAG_TONES = {
  CHEAPEST: 'bg-ok/10 text-ok border-ok/30',
  FASTEST: 'bg-signal/10 text-signal border-signal/30',
  'FEWEST TRANSFERS': 'bg-water/10 text-water border-water/30',
  'MOST RELIABLE': 'bg-ok/10 text-ok border-ok/30'
};

function toneFor(tag) {
  return TAG_TONES[tag.toUpperCase()] || 'bg-surface-2 text-ink-2 border-line';
}

function deltaLine(deltas) {
  if (!deltas) return '';
  const time = `${deltas.timeMin >= 0 ? '+' : ''}${deltas.timeMin} min`;
  const fare = `${deltas.fare >= 0 ? '+' : ''}${money(Math.abs(deltas.fare))}`;
  const transfers = `${deltas.transfers >= 0 ? '+' : ''}${deltas.transfers}`;
  return `<p class="text-[10px] text-warn leading-snug mt-1"><i class="fa-solid fa-diagram-project me-1"></i>Against clear conditions: ${time} · ${fare} · ${transfers} transfer(s)${deltas.lostOptions > 0 ? ` · ${deltas.lostOptions} option(s) gone` : ''}</p>`;
}

function legPreview(legs) {
  return `<div class="flex items-center gap-1 mt-1.5">${legs.map(leg => `
    <span class="h-1.5 rounded-full" style="background:${leg.color}; flex:${Math.max(1, leg.timeMin)}"></span>`).join('')}</div>`;
}

export function renderRoutes() {
  const host = document.getElementById('routeResultsList');
  const count = document.getElementById('routeCount');
  if (!host) return;

  const cards = state.routes || [];
  const mobileHost = document.getElementById('mobileRouteList');

  if (count) {
    count.textContent = cards.length
      ? `${cards.length} option${cards.length === 1 ? '' : 's'} · ${state.summary.lines.length} services`
      : 'no connection found';
  }

  if (!cards.length) {
    host.innerHTML = `
      <div class="border border-line rounded-md bg-surface-2 p-3 text-[11px] text-ink-2 space-y-1">
        <p class="font-semibold text-ink"><i class="fa-solid fa-circle-info me-1 text-signal"></i>No journey in the dataset for that pair</p>
        <p>The network is the MRT-6 line (Uttara North → Motijheel), Bikolpo (Mirpur 12 → TSC) and the Uttara bus (BRTC → Secretariat), plus walking links between nearby stops.</p>
        <p class="text-ink-3">Try a pair on those corridors, for example ${HUBS.slice(0, 2).map(hub => hub.name).join(' → ')}.</p>
      </div>`;
    if (mobileHost) mobileHost.innerHTML = '<p class="text-[11px] text-ink-3">No journey for that pair.</p>';
    return;
  }

  host.innerHTML = cards.map(card => `
    <button data-action="select-route" data-route-id="${card.id}"
      class="w-full text-left border rounded-md p-2.5 transition-colors ${card.selected ? 'border-signal bg-signal/5' : 'border-line bg-surface hover:border-line-strong'}">
      <div class="flex items-start justify-between gap-2">
        <div>
          <p class="text-xs font-bold text-ink">${card.title}</p>
          <p class="text-[10px] text-ink-3">${card.notes}</p>
        </div>
        <div class="text-right shrink-0">
          <p class="font-mono text-base font-bold text-ink">${money(card.baseFare)}</p>
          ${state.studentPass
            ? `<p class="font-mono text-[10px] ${card.studentFare < card.baseFare ? 'text-ok' : 'text-ink-2'}">${money(card.studentFare)} student${card.studentFare < card.baseFare ? ` · saves ${money(card.baseFare - card.studentFare)}` : ' (bus legs half price; MRT-6 has no student fare)'}</p>`
            : `<p class="font-mono text-[10px] text-ink-3">regular</p>`}
        </div>
      </div>
      <div class="flex flex-wrap gap-1 mt-1.5">
        ${card.tags.map(tag => `<span class="text-[9px] font-semibold px-1.5 py-0.5 rounded border ${toneFor(tag)}">${tag}</span>`).join('')}
        ${card.arrival ? `<span class="text-[9px] font-mono px-1.5 py-0.5 rounded border border-line text-ink-2">${Math.round((card.arrival.onTime ?? 0) * 100)}% on time · leave by ${card.arrival.leaveBy || '—'}</span>` : ''}
      </div>
      ${legPreview(card.legs)}
      ${deltaLine(card.deltas)}
    </button>`).join('');

  if (mobileHost) {
    mobileHost.innerHTML = cards.map(card => `
      <button data-action="select-route" data-route-id="${card.id}" class="w-full text-left border rounded p-2 ${card.selected ? 'border-signal bg-signal/5' : 'border-line'}">
        <p class="text-[11px] font-semibold text-ink">${card.title}</p>
        <p class="text-[10px] text-ink-3">${card.timeMinutes} min · ${money(card.baseFare)} · ${card.transfers} transfer(s)</p>
      </button>`).join('');
  }
}

/* The "route ribbon": one column per leg, like a printed line diagram. */
function ribbonLeg(leg) {
  const broken = leg.status !== 'ok';
  return `
    <div class="flex gap-2">
      <div class="flex flex-col items-center pt-1">
        <span class="w-2.5 h-2.5 rounded-full border-2" style="border-color:${leg.color}; background:${leg.isTransfer ? 'var(--surface)' : leg.color}"></span>
        <span class="w-0.5 flex-1 min-h-[26px]" style="background:${leg.color}; ${broken ? 'opacity:.35' : ''}"></span>
      </div>
      <div class="flex-1 pb-2">
        <div class="flex items-baseline justify-between gap-2">
          <p class="text-[11px] font-semibold text-ink">
            <i class="fa-solid ${leg.modeKey === 'walk' ? 'fa-person-walking' : leg.modeKey === 'metro' ? 'fa-train-subway' : 'fa-bus'} me-1"></i>${leg.line}
            ${leg.isTransfer ? '<span class="text-[9px] font-mono text-water">transfer</span>' : ''}
            ${broken ? '<span class="text-[9px] font-mono text-danger">closed</span>' : ''}
          </p>
          <p class="font-mono text-[11px] text-ink shrink-0">${leg.includedIn ? 'included' : money(leg.fareValue)}</p>
        </div>
        <p class="text-[10px] text-ink-2">${leg.from} → ${leg.to} · ${leg.km} km · ${leg.time}${leg.waitMin ? ` (+${leg.waitMin} min wait)` : ''}</p>
        <p class="text-[10px] text-ink-3">${leg.board}</p>
        <p class="text-[10px] text-ink-3">${leg.alight}</p>
        <p class="text-[10px] text-ink-3 italic">${leg.why}</p>
      </div>
    </div>`;
}

export function renderRouteRibbon() {
  const host = document.getElementById('routeDetailRibbon');
  if (!host) return;

  const card = (state.routes || []).find(entry => entry.id === state.selectedRouteId) || state.routes[0];
  if (!card) {
    host.classList.add('hidden');
    return;
  }

  host.classList.remove('hidden');
  host.innerHTML = `
    <div class="flex items-start justify-between gap-2">
      <div>
        <p class="text-xs font-bold text-ink">${card.title}</p>
        <p class="text-[10px] text-ink-3">${card.notes}</p>
      </div>
      <div class="text-right">
        <p class="font-mono text-base font-bold text-ink">${money(card.baseFare)}</p>
        ${state.studentPass && card.studentFare < card.baseFare ? `<p class="font-mono text-[10px] text-ok">${money(card.studentFare)} student</p>` : ''}
      </div>
    </div>

    <div class="space-y-0">${card.legs.map(ribbonLeg).join('')}</div>

    <div class="border-t border-line pt-2 space-y-1 text-[10px] text-ink-2">
      ${card.arrival ? `<p><i class="fa-solid fa-stopwatch me-1 text-signal"></i>P50 ${card.arrival.stats.p50} min · P90 ${card.arrival.stats.p90} min · ${Math.round((card.arrival.onTime ?? 0) * 100)}% on time · ${card.arrival.badge.label} reliability</p>` : ''}
      <p><i class="fa-solid fa-taka-sign me-1 text-signal"></i>Regular ${money(card.baseFare)}${card.studentFare < card.baseFare ? ` · student ${money(card.studentFare)} (bus legs only, ৳10 floor)` : ' · no student discount on this journey'}</p>
      <p><i class="fa-solid fa-circle-info me-1"></i>${FARE_RULES.metro.source} · ${FARE_RULES.bus.source}</p>
      <p class="font-mono text-[9px] text-ink-3">${card.legs.map(leg => `${leg.modeKey}:${leg.km}km`).join(' · ')}</p>
    </div>`;
}

export function selectRoute(routeId) {
  if (!routeId) {
    state.selectedRouteId = null;
    state.routes.forEach(card => { card.selected = false; });
    renderRoutes();
    renderRouteRibbon();
    refreshMap();
    return;
  }

  if (state.selectedRouteId === routeId) {
    state.selectedRouteId = null;
    state.routes.forEach(card => { card.selected = false; });
  } else {
    state.selectedRouteId = routeId;
    state.routes.forEach(card => { card.selected = card.id === routeId; });
  }

  renderRoutes();
  renderRouteRibbon();
  refreshMap();
}

export function toggleStudentPass() {
  state.studentPass = !state.studentPass;
  state.search = { ...state.search, student: state.studentPass };
  const toggle = document.getElementById('studentToggle');
  if (toggle) toggle.checked = state.studentPass;
  refresh();
  renderRoutes();
  renderRouteRibbon();
}

export { money };
