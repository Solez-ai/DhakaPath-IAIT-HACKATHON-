import { state, planEndpoints } from './state.js';
import { HUBS, HUB_BY_ID, FARE_RULES, OPERATIONS } from './core/network.js';
import { fareForDistance, fareExplanation, modeLabel } from './core/fares.js';
import { metroFareChart } from './core/router.js';
import { checkQuote, bargainingScript } from './core/fareCoach.js';

/* ===============================
   Fare calculator
   ===============================
   Three things, all from published rates and dataset distances:

     1. The official MRT-6 fare chart — every station from Uttara North, priced
        by the DTCA rule (৳5/km, min ৳20, max ৳100, ৳10 bands).
     2. Any stop pair → the journey the planner actually finds for it, with the
        regular and student total side by side and a per-leg ledger.
     3. The student rule, stated where it applies: buses only, 50% off with the
        ৳10 minimum floor. MRT-6 has no student fare, and the ledger says so
        instead of quietly discounting it. */

const money = value => `৳${value}`;

export function initFareCalculator() {
  const from = document.getElementById('fareFrom');
  const to = document.getElementById('fareTo');
  if (!from || !to) return;

  const options = HUBS.map(hub => `<option value="${hub.id}">${hub.name}</option>`).join('');
  const keepFrom = from.value;
  const keepTo = to.value;
  from.innerHTML = options;
  to.innerHTML = options;

  from.value = keepFrom || 'mirpur-10';
  to.value = keepTo || 'motijheel';

  renderFareChart();
  renderFareTable();
}

/* The official MRT-6 chart, from Uttara North. */
export function renderFareChart() {
  const host = document.getElementById('metroFareChart');
  if (!host) return;

  const chart = state.fareChart || metroFareChart();
  const origin = chart.stations[0];

  host.innerHTML = `
    <table class="w-full text-[10px] font-mono text-ink-2">
      <thead class="text-[9px] uppercase tracking-wider text-ink-3">
        <tr><th class="text-left">From ${origin.name}</th><th class="text-right">km</th><th class="text-right">৳</th></tr>
      </thead>
      <tbody>
        ${chart.stations.slice(1).map(station => {
          const fare = chart.fareBetween(origin.id, station.id);
          return `<tr class="border-t border-line">
            <td class="py-1 font-sans text-ink">${station.name}</td>
            <td class="text-right">${fare.km.toFixed(2)}</td>
            <td class="text-right font-semibold text-ink">${fare.regular}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <p class="mt-2 text-[10px] text-ink-3 leading-snug">${FARE_RULES.metro.source}. Distances measured from the dataset station coordinates; the rule reproduces the published chart, and <span class="font-mono">npm run build:data</span> fails if it ever stops matching.</p>`;
}

export function syncFareInputs() {
  const from = document.getElementById('fareFrom');
  const to = document.getElementById('fareTo');
  if (!from || !to) return;
  if (state.search.origin) from.value = state.search.origin;
  if (state.search.destination) to.value = state.search.destination;
}

export function swapFareEndpoints() {
  const from = document.getElementById('fareFrom');
  const to = document.getElementById('fareTo');
  if (!from || !to) return;
  const value = from.value;
  from.value = to.value;
  to.value = value;
  renderFareTable();
}

function legRow(leg, student) {
  const fare = leg.fareValue;
  const studentFare = leg.studentFare;
  const covered = Boolean(leg.includedIn);
  return `
    <tr class="border-t border-line align-top">
      <td class="py-1.5">
        <p class="text-[11px] text-ink"><i class="fa-solid ${leg.modeKey === 'walk' ? 'fa-person-walking' : leg.modeKey === 'metro' ? 'fa-train-subway' : 'fa-bus'} me-1" style="color:${leg.color}"></i>${leg.line}</p>
        <p class="text-[10px] text-ink-3">${leg.from} → ${leg.to} · ${leg.km} km · ${leg.time}</p>
      </td>
      <td class="text-right font-mono text-[11px] text-ink">${covered ? '<span class="text-ink-3">included</span>' : money(fare)}</td>
      <td class="text-right font-mono text-[11px] ${student && studentFare < fare ? 'text-ok' : 'text-ink-2'}">${covered ? '' : money(studentFare)}</td>
    </tr>`;
}

/* Any stop pair → the real journey, regular vs student. */
export function renderFareTable() {
  const host = document.getElementById('fareResults');
  const from = document.getElementById('fareFrom');
  const to = document.getElementById('fareTo');
  const badge = document.getElementById('farePanelBadge');
  if (!host || !from || !to) return;

  const fromId = from.value;
  const toId = to.value;

  if (!fromId || !toId || fromId === toId) {
    host.innerHTML = '<p class="text-[11px] text-ink-3">Pick two different stops to compare the fare.</p>';
    if (badge) badge.textContent = 'pick two stops';
    return;
  }

  const plan = planEndpoints(fromId, toId, { prefer: 'cost', student: false, limit: 3 });
  const chart = state.fareChart || metroFareChart();

  if (!plan.options.length) {
    host.innerHTML = `<p class="text-[11px] text-warn">No connected journey between ${HUB_BY_ID.get(fromId).name} and ${HUB_BY_ID.get(toId).name} in the dataset.</p>`;
    if (badge) badge.textContent = 'not connected';
    return;
  }

  const cheapest = [...plan.options].sort((a, b) => a.fare.regular - b.fare.regular)[0];
  const studentPlan = planEndpoints(fromId, toId, { prefer: 'cost', student: true, limit: 1 }).options[0] || cheapest;
  const regularPlan = planEndpoints(fromId, toId, { prefer: 'cost', student: false, limit: 1 }).options[0] || cheapest;

  const metroFare = chart.stations.some(entry => entry.id === fromId) && chart.stations.some(entry => entry.id === toId)
    ? chart.fareBetween(fromId, toId)
    : null;

  const saving = regularPlan.fare.regular - studentPlan.fare.student;

  host.innerHTML = `
    <div class="border border-line rounded bg-surface p-2 space-y-2">
      <div class="flex items-baseline justify-between">
        <div>
          <p class="text-[10px] uppercase tracking-wider text-ink-3">Regular total</p>
          <p class="font-mono text-lg font-bold text-ink">${money(regularPlan.fare.regular)}</p>
        </div>
        <div class="text-right">
          <p class="text-[10px] uppercase tracking-wider text-ink-3">Student total</p>
          <p class="font-mono text-lg font-bold ${saving > 0 ? 'text-ok' : 'text-ink-2'}">${money(studentPlan.fare.student)}</p>
        </div>
      </div>
      ${saving > 0
        ? `<p class="text-[10px] text-ok">Student half pass saves ${money(saving)} on this journey — 50% off bus legs, ৳10 floor. MRT-6 has no student fare.</p>`
        : `<p class="text-[10px] text-ink-3">No student discount on this journey: the student half pass applies to city buses only, and MRT-6 fares have no half rate.</p>`}

      <table class="w-full text-[11px]">
        <thead class="text-[9px] uppercase tracking-wider text-ink-3">
          <tr><th class="text-left">Leg</th><th class="text-right">Regular</th><th class="text-right">Student</th></tr>
        </thead>
        <tbody>${regularPlan.legs.map(leg => legRow(leg, true)).join('')}</tbody>
      </table>

      <div class="text-[10px] text-ink-3 space-y-0.5">
        <p><i class="fa-solid fa-route me-1"></i>${regularPlan.legs.length} legs · ${regularPlan.timeMin} min · ${regularPlan.transfers} transfer${regularPlan.transfers === 1 ? '' : 's'}</p>
        ${metroFare ? `<p><i class="fa-solid fa-train-subway me-1"></i>MRT-6 station-to-station: ${metroFare.km} km → ${money(metroFare.regular)} (official chart)</p>` : ''}
        ${plan.options.length > 1 ? `<p><i class="fa-solid fa-code-compare me-1"></i>Other options: ${plan.options.slice(1).map(option => `${option.lines.join('+')} ${money(option.fare.regular)}/${option.timeMin} min`).join(' · ')}</p>` : ''}
        <p><i class="fa-solid fa-circle-info me-1"></i>${fareExplanation('metro')}</p>
        <p><i class="fa-solid fa-circle-info me-1"></i>${fareExplanation('bus')}</p>
      </div>
    </div>`;

  if (badge) {
    badge.textContent = `${regularPlan.timeMin} min · ${regularPlan.transfers} transfer${regularPlan.transfers === 1 ? '' : 's'}`;
  }
}

export function compareFares() {
  renderFareTable();
}

/* ------------------------------------------------------------------
   Fare coach wrappers — read the quote panel, hand the verdict back to the UI
   ------------------------------------------------------------------ */

export function checkQuoteFromPanel() {
  const modeEl = document.getElementById('quoteMode');
  const kmEl = document.getElementById('quoteKm');
  const amountEl = document.getElementById('quoteAmount');
  const verdictEl = document.getElementById('quoteVerdict');
  const counterEl = document.getElementById('quoteCounter');
  if (!modeEl || !kmEl || !amountEl) return;

  const mode = modeEl.value || 'rickshaw';
  const km = Number(kmEl.value) || 0;
  const quote = Number(amountEl.value);
  const verdict = checkQuote(mode, km, quote);

  if (verdictEl) {
    verdictEl.textContent = verdict.message;
    verdictEl.dataset.tone = verdict.verdict;
  }
  if (counterEl) {
    counterEl.textContent = verdict.counterOffer != null ? `Counter: ৳${verdict.counterOffer}` : '';
  }
}

export function speakScript() {
  const fromEl = document.getElementById('fareFrom');
  const toEl = document.getElementById('fareTo');
  const amountEl = document.getElementById('quoteAmount');
  if (!fromEl || !toEl) return;

  const from = fromEl.value;
  const to = toEl.value;
  const target = Number(amountEl?.value) || 0;
  const script = bargainingScript('rickshaw', { from, to, target });

  if (!('speechSynthesis' in window)) {
    setVerdict('Speech not supported in this browser — read the line instead.', 'warn');
    return;
  }
  const utterance = new SpeechSynthesisUtterance(script.banglish);
  utterance.lang = state.lang === 'bn' ? 'bn-BD' : 'en-US';
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function setVerdict(message, tone) {
  const el = document.getElementById('quoteVerdict');
  if (!el) return;
  el.textContent = message;
  el.dataset.tone = tone || 'ink';
}

export { fareForDistance, modeLabel, OPERATIONS };
