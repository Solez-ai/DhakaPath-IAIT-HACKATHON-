import { state, refresh, moderateAlert } from './state.js';
import {
  HUBS, LINKS, FARE_RULES, MODES, HUB_BY_ID, LINES_INFO, DATASET_INFO,
  setLinkActive, setLinkField, setFareRule,
  resetFareRule, resetLink, resetNetwork,
  networkOverrides, applyNetworkOverrides
} from './core/network.js';
import { corridorRisk } from './core/weather.js';
import { readLocal, writeLocal, removeLocal } from './persist.js';

/* ===============================
   Part 1 — Transit & Street-Status CMS
   ===============================
   Two managed datasets, exactly as the brief frames them: the Transit Network
   (links + fare rules + hub notes) and Street Alerts (moderation queue).

   Scope decision, documented in README: this is a demo-grade CMS. It edits the
   in-memory graph the router reads, persists overrides to localStorage and can
   export/import the whole payload as JSON. It is passphrase-gated but NOT
   server-authenticated — the passphrase keeps a demo tidy, it is not security. */

const PASSPHRASE = 'dhakapath-admin';
const OVERRIDE_KEY = 'admin.network';
const UNLOCK_KEY = 'admin.unlocked';
const LINK_PAGE = 30;

let unlocked = false;
let linkFilter = { mode: 'all', text: '' };
let linkPage = 0;

/* Replay persisted overrides on boot, before the first render. */
export function initAdmin() {
  const stored = readLocal(OVERRIDE_KEY, null);
  const applied = stored ? applyNetworkOverrides(stored) : 0;
  unlocked = Boolean(readLocal(UNLOCK_KEY, false));
  if (applied) {
    state.feed.unshift({
      kind: 'admin',
      message: `Re-applied ${applied} saved network overrides from the admin panel.`,
      at: new Date().toISOString()
    });
  }
  renderAdmin();
  return applied;
}

function saveOverrides() {
  writeLocal(OVERRIDE_KEY, networkOverrides());
}

function roleTag(alert) {
  if (alert.status === 'flagged') return { label: 'Flagged', tone: 'text-danger' };
  if (alert.status === 'resolved') return { label: 'Resolved', tone: 'text-ink-3' };
  if (alert.source === 'model') return { label: 'Predicted', tone: 'text-water' };
  return { label: 'Active', tone: 'text-ok' };
}

/* One editable row per mode. The columns are the published rate fields
   (৳/km, minimum, maximum, fare band, student discount) — editing one changes
   every card, ledger and chat answer, because the fare engine reads this table. */
function ruleRows() {
  return MODES.map(mode => {
    const rule = FARE_RULES[mode];
    const field = (name, width = 'w-12') => {
      const value = rule[name] ?? '';
      const disabled = rule[name] === undefined || rule[name] === null ? 'disabled' : '';
      return `<input type="number" step="0.1" min="0" value="${value}" ${disabled}
        data-action="admin-rule" data-mode="${mode}" data-field="${name}"
        class="${width} bg-paper border border-line-strong rounded px-1 py-0.5 text-[10px] font-mono text-ink ${disabled ? 'opacity-40' : ''}">`;
    };

    return `<tr class="border-t border-line">
      <td class="py-1.5 pr-2">
        <p class="font-semibold text-ink">${rule.label}</p>
        <p class="text-[9px] text-ink-3">${rule.source}</p>
      </td>
      <td>${field('perKm')}</td>
      <td>${field('minFare')}</td>
      <td>${field('maxFare')}</td>
      <td>${field('band', 'w-10')}</td>
      <td>${field('studentDiscountPct', 'w-12')}</td>
      <td class="text-right">
        <button data-action="admin-reset-rule" data-mode="${mode}" class="text-[10px] text-signal hover:underline">reset</button>
      </td>
    </tr>`;
  }).join('');
}

function linkRows() {
  const mode = linkFilter.mode;
  const needle = linkFilter.text.trim().toLowerCase();

  const filtered = LINKS.filter(entry => {
    if (mode !== 'all' && entry.mode !== mode) return false;
    if (!needle) return true;
    return `${entry.from} ${entry.to} ${entry.routeName} ${entry.id} ${HUB_BY_ID.get(entry.from)?.name || ''} ${HUB_BY_ID.get(entry.to)?.name || ''}`
      .toLowerCase().includes(needle);
  });

  const pages = Math.max(1, Math.ceil(filtered.length / LINK_PAGE));
  linkPage = Math.min(linkPage, pages - 1);
  const slice = filtered.slice(linkPage * LINK_PAGE, linkPage * LINK_PAGE + LINK_PAGE);

  const body = slice.map(entry => {
    const from = HUB_BY_ID.get(entry.from);
    const to = HUB_BY_ID.get(entry.to);
    const off = entry.active === false;
    return `<tr class="border-t border-line ${off ? 'opacity-50' : ''}">
      <td class="py-1.5 pr-2">
        <p class="font-semibold text-ink">${from.name} → ${to.name}</p>
        <p class="text-[9px] text-ink-3 font-mono">${entry.id} · ${entry.km} km · ${entry.frequencyMin || 0} min headway</p>
        <input type="text" value="${entry.routeName.replace(/"/g, '&quot;')}" data-action="admin-link-name" data-link-id="${entry.id}"
          class="mt-1 w-full bg-paper border border-line-strong rounded px-1 py-0.5 text-[10px] text-ink">
      </td>
      <td class="text-center">
        <input type="checkbox" data-action="admin-link-active" data-link-id="${entry.id}" ${off ? '' : 'checked'} class="accent-[var(--ok)]">
      </td>
      <td class="text-center">
        <input type="number" step="0.1" min="0.1" value="${entry.km}" data-action="admin-link-km" data-link-id="${entry.id}"
          class="w-14 bg-paper border border-line-strong rounded px-1 py-0.5 text-[10px] font-mono text-ink">
      </td>
      <td class="text-center">
        <button data-action="admin-reset-link" data-link-id="${entry.id}" title="Restore the committed seed values for this link"
          class="text-[10px] text-signal hover:underline">restore</button>
      </td>
    </tr>`;
  }).join('');

  return {
    html: `<table class="w-full text-[11px] text-ink-2">
      <thead class="text-[9px] uppercase tracking-wider text-ink-3">
        <tr><th class="text-left">Link</th><th class="text-center">In service</th><th class="text-center">km</th><th></th></tr>
      </thead>
      <tbody>${body || '<tr><td class="py-2 text-ink-3">No links match this filter.</td></tr>'}</tbody>
    </table>
    <div class="flex items-center justify-between mt-2 text-[10px] font-mono text-ink-3">
      <span>${filtered.length} of ${LINKS.length} directed links</span>
      <span class="flex gap-2">
        <button data-action="admin-link-page" data-page="${linkPage - 1}" class="hover:text-ink ${linkPage === 0 ? 'opacity-40' : ''}">prev</button>
        <span>${linkPage + 1}/${pages}</span>
        <button data-action="admin-link-page" data-page="${linkPage + 1}" class="hover:text-ink ${linkPage >= pages - 1 ? 'opacity-40' : ''}">next</button>
      </span>
    </div>`
  };
}

function moderationRows() {
  if (!state.reportStore.length) {
    return '<p class="text-[11px] text-ink-3">No reports in the ledger. Nothing is seeded — a report appears here once a rider, a pasted post or the weather model creates one.</p>';
  }

  return state.reportStore.map(alert => {
    const hub = HUB_BY_ID.get(alert.hubId);
    const tag = roleTag(alert);
    return `<div class="border border-line rounded p-2 space-y-1.5 bg-surface-2">
      <div class="flex items-start justify-between gap-2">
        <div>
          <p class="text-[11px] font-semibold text-ink">${alert.type} · ${hub ? hub.name : alert.linkId || 'unlocated'}</p>
          <p class="text-[10px] text-ink-3">${alert.description}</p>
        </div>
        <span class="text-[9px] font-mono ${tag.tone} shrink-0">${tag.label} · sev ${alert.severity}</span>
      </div>
      <div class="flex flex-wrap gap-1.5 text-[10px]">
        <button data-action="admin-approve" data-alert-id="${alert.id}" class="px-2 py-0.5 rounded border border-line text-ok hover:border-ok">Approve</button>
        <button data-action="admin-flag" data-alert-id="${alert.id}" class="px-2 py-0.5 rounded border border-line text-warn hover:border-warn">Hold for review</button>
        <button data-action="admin-resolve" data-alert-id="${alert.id}" class="px-2 py-0.5 rounded border border-line text-ink-2 hover:border-line-strong">Mark cleared</button>
        <button data-action="admin-delete" data-alert-id="${alert.id}" class="px-2 py-0.5 rounded border border-line text-danger hover:border-danger">Delete</button>
        <span class="ms-auto font-mono text-ink-3">source ${alert.source} · ${alert.confirmations || 0}👍</span>
      </div>
    </div>`;
  }).join('');
}

/* Which corridor the rain model currently exposes (bus lanes at street level;
   the MRT-6 viaduct is not exposed). Shown instead of the old per-hub
   vulnerability sliders: the dataset has no drainage field, so a per-street
   score would be invented. Which street IS under water comes from reports. */
function exposureRows() {
  const { corridors } = corridorRisk(state.weather, { hour: state.weatherHour });

  const rows = LINES_INFO.map(line => {
    const entry = corridors.get(line.id);
    const exposure = entry ? entry.value : 0;
    const note = entry ? entry.reason : 'on a viaduct — rainfall does not close it';
    return `<div class="flex items-center gap-2">
      <span class="flex-1 text-[11px] text-ink">${line.name}</span>
      <span class="w-24 h-1.5 rounded bg-line overflow-hidden">
        <span class="block h-full" style="width:${Math.round(exposure * 100)}%; background:var(--water)"></span>
      </span>
      <span class="w-8 text-right text-[10px] font-mono text-ink-3">${Math.round(exposure * 100)}%</span>
      <span class="w-56 text-[9px] text-ink-3">${note}</span>
    </div>`;
  }).join('');

  return `${rows}
    <p class="text-[10px] text-ink-3 leading-snug pt-1">${DATASET_INFO.sources.note} Rainfall load comes from the forecast (${state.weather.label}); the model refuses to rank one street above another, so every bus corridor shows the same load.</p>`;
}

export function renderAdmin() {
  const gate = document.getElementById('adminGate');
  const body = document.getElementById('adminBody');
  if (!gate || !body) return;

  gate.classList.toggle('hidden', unlocked);
  body.classList.toggle('hidden', !unlocked);
  const lockButton = document.querySelector('[data-action="admin-lock"]');
  if (lockButton) lockButton.classList.toggle('hidden', !unlocked);
  if (!unlocked) return;

  const links = linkRows();
  const count = el => document.getElementById(el);
  if (count('adminRuleRows')) count('adminRuleRows').innerHTML = ruleRows();
  if (count('adminLinkRows')) count('adminLinkRows').innerHTML = links.html;
  if (count('adminModeration')) count('adminModeration').innerHTML = moderationRows();
  if (count('adminVulnerability')) count('adminVulnerability').innerHTML = exposureRows();

  const badge = count('adminOverridesBadge');
  if (badge) {
    const stored = readLocal(OVERRIDE_KEY, null) ? 'overrides saved' : 'seed data as committed';
    badge.textContent = `${LINKS.length} links · ${HUBS.length} hubs · ${stored}`;
  }
}

/* ---------------- actions ---------------- */

export function handleAdminAction(action, el) {
  switch (action) {
    case 'admin-unlock': {
      const input = document.getElementById('adminPassphrase');
      const note = document.getElementById('adminGateNote');
      if (!input) return;
      if (input.value.trim() !== PASSPHRASE) {
        if (note) note.textContent = 'Wrong passphrase. The demo passphrase is printed in README.md.';
        return;
      }
      unlocked = true;
      writeLocal(UNLOCK_KEY, true);
      input.value = '';
      if (note) note.textContent = '';
      renderAdmin();
      return;
    }
    case 'admin-lock':
      unlocked = false;
      writeLocal(UNLOCK_KEY, false);
      renderAdmin();
      return;
    case 'admin-save':
      saveOverrides();
      renderAdmin();
      return;
    case 'admin-reset-network':
      resetNetwork();
      removeLocal(OVERRIDE_KEY);
      refresh();
      renderAdmin();
      return;
    case 'admin-reset-rule':
      resetFareRule(el.dataset.mode);
      saveOverrides();
      refresh();
      renderAdmin();
      return;
    case 'admin-reset-link':
      resetLink(el.dataset.linkId);
      saveOverrides();
      refresh();
      renderAdmin();
      return;
    case 'admin-link-filter':
      linkFilter.mode = el.value;
      linkPage = 0;
      renderAdmin();
      return;
    case 'admin-link-search':
      linkFilter.text = el.value;
      linkPage = 0;
      renderAdmin();
      return;
    case 'admin-link-page': {
      linkPage = Math.max(0, Number(el.dataset.page) || 0);
      renderAdmin();
      return;
    }
    case 'admin-approve':
    case 'admin-flag':
    case 'admin-resolve':
    case 'admin-delete': {
      const id = el.dataset.alertId;
      const map = { 'admin-approve': 'approve', 'admin-flag': 'flag', 'admin-resolve': 'resolve', 'admin-delete': 'delete' };
      moderateAlert(id, map[action]);
      refresh();
      renderAdmin();
      return;
    }
    case 'admin-export': {
      const payload = {
        app: 'DhakaPath',
        version: 1,
        exportedAt: new Date().toISOString(),
        note: 'DhakaPath CMS payload: fare-rule and link overrides plus the report ledger, as edited in the admin panel.',
        network: networkOverrides(),
        alerts: state.reportStore
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `dhakapath-cms-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      // Give the browser time to start the download before the blob URL dies.
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      return;
    }
    case 'admin-import': {
      const area = document.getElementById('adminImportInput');
      const note = document.getElementById('adminImportNote');
      if (!area || !note) return;
      try {
        const payload = JSON.parse(area.value);
        const applied = applyNetworkOverrides(payload.network);
        if (Array.isArray(payload.alerts)) state.reportStore = payload.alerts;
        saveOverrides();
        refresh();
        renderAdmin();
        note.textContent = `Imported ${applied} network records${Array.isArray(payload.alerts) ? ` and ${payload.alerts.length} alerts` : ''}.`;
      } catch (error) {
        note.textContent = `Import failed: ${error.message}`;
      }
      return;
    }
    case 'admin-link-active': {
      setLinkActive(el.dataset.linkId, el.checked);
      saveOverrides();
      refresh();
      renderAdmin();
      return;
    }
    case 'admin-link-km': {
      setLinkField(el.dataset.linkId, 'km', el.value);
      saveOverrides();
      refresh();
      return;
    }
    case 'admin-link-name': {
      setLinkField(el.dataset.linkId, 'routeName', el.value);
      saveOverrides();
      return;
    }
    case 'admin-rule': {
      setFareRule(el.dataset.mode, { [el.dataset.field]: el.value });
      saveOverrides();
      refresh();
      return;
    }
    default:
  }
}

/* Change-shaped controls (checkboxes, sliders, number inputs) route here too, so
   a slider drag or a checkbox click commits exactly like a button press. */
export function handleAdminChange(action, el) {
  return handleAdminAction(action, el);
}

export const ADMIN_ACTIONS = [
  'admin-unlock', 'admin-lock', 'admin-save', 'admin-reset-network', 'admin-reset-rule',
  'admin-reset-link', 'admin-link-page', 'admin-link-active', 'admin-link-km', 'admin-link-name',
  'admin-link-filter', 'admin-link-search',
  'admin-rule', 'admin-approve', 'admin-flag',
  'admin-resolve', 'admin-delete', 'admin-export', 'admin-import'
];
