import { state, addReport, confirmDisplayedAlert, resolveDisplayedAlert, activeAlerts } from './state.js';
import { ALERT_TYPES } from './core/alerts.js';
import { matchHubs } from './core/parse.js';
import { HUB_BY_ID, HUBS } from './core/network.js';
import { scenarioActive, describeScenario } from './core/scenario.js';

/* ===============================
   Alerts, reporting and social ingest
   ===============================
   Every entry on this board came through js/core/alerts.js: parsed → sanity
   checked → de-duplicated or merged → given a confidence seed → decays with a
   per-type half-life → corroborated by other riders. The UI only renders that
   pipeline and lets a rider move a report through it. */

const ALERT_STYLES = {
  water: { icon: 'fa-water', text: 'text-water', border: 'border-l-water' },
  danger: { icon: 'fa-triangle-exclamation', text: 'text-danger', border: 'border-l-danger' },
  warn: { icon: 'fa-circle-exclamation', text: 'text-warn', border: 'border-l-warn' },
  ok: { icon: 'fa-circle-check', text: 'text-ok', border: 'border-l-ok' }
};

const ACTIVE_ALERT_TYPES = ['danger', 'water', 'warn'];
const SOURCE_TAGS = {
  crowd: { label: 'Rider report', cls: 'bg-surface-2 text-ink-2 border-line' },
  social: { label: 'Social post (unverified)', cls: 'bg-signal/10 text-signal border-signal/30' },
  model: { label: 'Predicted by model', cls: 'bg-water/10 text-water border-water/40 border-dashed' },
  operator: { label: 'Operator bulletin', cls: 'bg-surface-2 text-ink-2 border-line' }
};

const CATEGORY_TYPES = {
  'Waterlogging': 'waterlogging',
  'Transit Delay': 'gridlock',
  'Road Hazard': 'incident',
  'Construction': 'construction',
  'Blockade': 'blockade',
  'Resting / Waiting Place': 'facility'
};

function alertStyle(type) {
  return ALERT_STYLES[type] || ALERT_STYLES.warn;
}

export function renderAlerts() {
  const container = document.getElementById('alertsList');
  if (container) {
    container.innerHTML = state.alerts.map(alertCard).join('');
  }

  syncAlertBadge();
  renderDisruptionBanner();
  renderFeed();
}

function alertCard(alert) {
  const style = alertStyle(alert.type);
  const source = SOURCE_TAGS[alert.source] || SOURCE_TAGS.crowd;
  const confidencePct = Math.round(alert.confidence * 100);
  const resolved = alert.status === 'resolved';

  return `
    <div class="p-2.5 rounded-md border border-line border-l-2 ${style.border} bg-surface ${resolved ? 'opacity-70' : ''} space-y-1.5 ${alert.predicted ? 'border-dashed' : ''}">
      <div class="flex items-center justify-between text-xs gap-2">
        <span class="font-bold text-ink flex items-center gap-1.5 min-w-0">
          <i class="fa-solid ${style.icon} ${style.text} shrink-0"></i> <span class="truncate">${alert.title}</span>
        </span>
        <span class="text-[10px] font-mono text-ink-3 shrink-0">${alert.freshness}</span>
      </div>

      <p class="text-xs font-semibold text-ink-2 flex items-center gap-1.5">
        ${alert.target}
        <span class="text-[9px] px-1.5 py-0.5 rounded border ${source.cls}">${source.label}</span>
        ${alert.confirmations ? `<span class="text-[9px] text-ok font-mono">+${alert.confirmations} confirm</span>` : ''}
        ${alert.denials ? `<span class="text-[9px] text-danger font-mono">−${alert.denials} deny</span>` : ''}
      </p>

      <p class="text-[11px] text-ink-3 leading-snug">${alert.description}</p>

      <div class="w-full h-1 rounded bg-line overflow-hidden" title="Confidence ${confidencePct}%">
        <div class="h-full ${style.text.replace('text-', 'bg-')}" style="width: ${confidencePct}%"></div>
      </div>

      <div class="flex items-center gap-1.5 pt-0.5">
        <button data-action="confirm-alert" data-alert-id="${alert.id}" ${resolved ? 'disabled' : ''}
          class="text-[10px] px-1.5 py-0.5 rounded border border-line hover:border-ok hover:text-ok disabled:opacity-40">
          <i class="fa-solid fa-thumbs-up"></i> I see this too
        </button>
        <button data-action="resolve-alert" data-alert-id="${alert.id}" ${resolved ? 'disabled' : ''}
          class="text-[10px] px-1.5 py-0.5 rounded border border-line hover:border-signal hover:text-signal disabled:opacity-40">
          <i class="fa-solid fa-circle-check"></i> Clear now
        </button>
        ${alert.predicted ? '<span class="text-[10px] text-ink-3 ms-auto">Becomes a live report after 2 confirmations</span>' : ''}
      </div>
    </div>`;
}

function renderDisruptionBanner() {
  const heading = document.getElementById('disruptionHeading');
  const summary = document.getElementById('disruptionSummary');
  const stamp = document.getElementById('disruptionUpdatedAt');
  const active = state.alerts.filter(alert => alert.status === 'active' && ACTIVE_ALERT_TYPES.includes(alert.type));
  const live = activeAlerts();

  if (heading) heading.textContent = `Active Disruptions (${active.length})`;

  if (summary) {
    const scenarioText = scenarioActive(state.scenario) ? `${describeScenario(state.scenario)} ` : '';
    const lead = active[0];
    summary.textContent = lead
      ? `${scenarioText}${lead.title} at ${lead.target} — ${lead.freshness}.`
      : `${scenarioText}No disruptions reported across the network.`;
  }

  if (stamp) {
    stamp.textContent = `${live.length} FEEDING ROUTING`;
  }
}

function syncAlertBadge() {
  const badge = document.getElementById('alertBadge');
  if (!badge) return;
  const count = state.alerts.filter(alert => alert.status === 'active').length;
  badge.textContent = count;
  badge.classList.toggle('hidden', count === 0);
}

export function renderFeed() {
  const list = document.getElementById('feedList');
  const count = document.getElementById('feedCount');
  if (count) count.textContent = String(state.feed.length);
  if (!list) return;

  list.innerHTML = state.feed.slice(0, 12).map(entry => {
    const icon = {
      accepted: 'fa-circle-check text-ok',
      merge: 'fa-code-merge text-signal',
      flagged: 'fa-triangle-exclamation text-warn',
      rejected: 'fa-ban text-danger',
      confirmed: 'fa-thumbs-up text-ok',
      resolved: 'fa-flag-checkered text-ink-3',
      predicted: 'fa-water text-water',
      scenario: 'fa-sliders text-signal',
      weather: 'fa-cloud-sun-rain text-water',
      system: 'fa-circle-info text-ink-3'
    }[entry.kind] || 'fa-circle-info text-ink-3';

    const at = new Date(entry.at);
    const time = `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
    return `<div class="flex items-start gap-1.5">
      <i class="fa-solid ${icon} mt-0.5 shrink-0"></i>
      <span class="flex-1">${entry.message}</span>
      <span class="font-mono text-[10px] text-ink-3 shrink-0">${time}</span>
    </div>`;
  }).join('') || '<p class="text-[11px] text-ink-3">No validation events yet.</p>';
}

/* Alert lifecycle actions */
export function confirmAlertById(id) {
  confirmDisplayedAlert(id);
  renderAlerts();
}

export function resolveAlertById(id) {
  resolveDisplayedAlert(id);
  renderAlerts();
}

export function refreshAlerts() {
  const button = document.getElementById('refreshAlertsBtn');
  if (!button || button.disabled) return;

  const icon = button.querySelector('i');
  const list = document.getElementById('alertsList');

  button.disabled = true;
  button.classList.add('opacity-60', 'cursor-wait');
  if (icon) icon.classList.add('fa-spin');
  if (list) list.classList.add('opacity-50');

  window.setTimeout(() => {
    renderAlerts();
    button.disabled = false;
    button.classList.remove('opacity-60', 'cursor-wait');
    if (icon) icon.classList.remove('fa-spin');
    if (list) list.classList.remove('opacity-50');
  }, 400);
}

/* ------------------------------------------------------------------
   Incident modal
   ------------------------------------------------------------------ */

export function openIncidentModal() {
  const modal = document.getElementById('incidentModal');
  if (!modal) return;

  const select = document.getElementById('incidentHubSelect');
  if (select && !select.options.length) {
    select.innerHTML = HUBS.map(hub => `<option value="${hub.id}">${hub.name}</option>`).join('');
  }
  modal.classList.remove('hidden');
}

export function closeIncidentModal() {
  const modal = document.getElementById('incidentModal');
  if (!modal) return;
  modal.classList.add('hidden');
}

export function selectIncidentCategory(button, category) {
  document.querySelectorAll('#categoryPills .cat-pill').forEach(el => {
    el.classList.remove('border-signal', 'bg-signal-wash/30');
  });
  button.classList.add('border-signal', 'bg-signal-wash/30');
  state.selectedIncidentCategory = category;
}

export function detectUserLocationForIncident() {
  const geoStatus = document.getElementById('geoStatusText');
  if (!('geolocation' in navigator)) {
    setVerdict('Geolocation is not supported by this browser — pick the hub from the list.', 'warn');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    position => {
      const lat = position.coords.latitude.toFixed(4);
      const lng = position.coords.longitude.toFixed(4);
      state.userCoords = { lat: Number(lat), lng: Number(lng) };

      // Snap to the closest hub so the report can join the graph
      const nearest = HUBS
        .map(hub => ({ hub, distance: Math.hypot(hub.lat - Number(lat), hub.lng - Number(lng)) }))
        .sort((a, b) => a.distance - b.distance)[0];

      const input = document.getElementById('incidentLocationInput');
      if (input) input.value = `GPS ${lat}, ${lng} → ${nearest.hub.name}`;
      const select = document.getElementById('incidentHubSelect');
      if (select) select.value = nearest.hub.id;
      if (geoStatus) geoStatus.classList.remove('hidden');
      setVerdict(`Snapped to ${nearest.hub.name} (${(nearest.distance * 111).toFixed(1)} km away).`, 'ok');
    },
    () => setVerdict('Location permission denied — pick the hub manually.', 'warn')
  );
}

export function submitIncidentReport() {
  const hubId = document.getElementById('incidentHubSelect')?.value;
  const details = document.getElementById('incidentDetailsInput')?.value?.trim() || '';
  const category = state.selectedIncidentCategory;

  if (!category) {
    setVerdict('Pick a category first.', 'warn');
    return;
  }

  const outcome = addReport({
    type: CATEGORY_TYPES[category] || 'incident',
    hubId,
    severity: category === 'Waterlogging' ? 4 : 3,
    description: details || `${category} reported by a rider on the ground.`,
    reporter: 'you',
    source: 'crowd'
  });

  renderAlerts();
  closeIncidentModal();

  if (outcome.action === 'merge') setVerdict(`Merged: ${outcome.reason}`, 'ok');
  else if (outcome.ok) setVerdict(`Accepted: ${outcome.reason}`, 'ok');
  else setVerdict(`${outcome.action === 'reject' ? 'Rejected' : 'Held'}: ${outcome.reason}`, 'warn');

  document.querySelector('[data-action="switch-tab"][data-tab="alerts"]')?.click();
}

/* ------------------------------------------------------------------
   Social post / voice ingest
   ------------------------------------------------------------------ */

const TYPE_KEYWORDS = {
  waterlogging: ['pani', 'jol', 'পানি', 'জল', 'jome', 'জমে', 'water', 'flood', 'ডুবে', 'tuli', 'haddi', 'বন্যা', 'knee-deep'],
  gridlock: ['jam', 'জ্যাম', 'traffic', 'আটকে', 'deri', 'দেরি', 'delay', 'slow', 'থেমে', 'queue'],
  construction: ['repair', 'নির্মাণ', 'construction', 'kaaj', 'কাজ', 'digging', 'khadai'],
  blockade: ['blockade', 'অবরোধ', 'procession', 'মিছিল', 'michil', 'blocked', 'bondho', 'বন্ধ'],
  incident: ['accident', 'দুর্ঘটনা', 'breakdown', 'ভাঙা', 'sinkhole', 'footbridge']
};

const SEVERITY_HINTS = [
  { words: ['knee-deep', 'হাঁটু', '8 inch', 'busy', 'serious', 'breast', 'বুক', 'গভীর'], bump: 1 }
];

/* Rule-based extraction. Gemini is optional polish, never a dependency. */
export function parsePost(text) {
  const lower = String(text || '').toLowerCase();
  const hubs = matchHubs(text);
  const hubId = hubs[0] || null;

  let type = null;
  let hits = 0;
  Object.entries(TYPE_KEYWORDS).forEach(([candidate, words]) => {
    const matches = words.filter(word => lower.includes(word)).length;
    if (matches > hits) {
      hits = matches;
      type = candidate;
    }
  });

  const severity = Math.min(5, (type === 'blockade' ? 4 : 3) + SEVERITY_HINTS.reduce((bump, hint) => (
    hint.words.some(word => lower.includes(word)) ? bump + hint.bump : bump
  ), 0));

  const timeMatch = /(\d{1,2})\s*(?:min|minutes|মিনিট)/.exec(lower);

  return {
    hubId,
    type,
    severity,
    description: String(text || '').trim().slice(0, 180),
    reporter: 'pasted-post',
    source: 'social',
    claimedMinutesAgo: timeMatch ? Number(timeMatch[1]) : null,
    confidence: hubId && type ? 0.45 : 0
  };
}

export function ingestPost() {
  const input = document.getElementById('postInput');
  const text = input?.value?.trim();
  if (!text) {
    setVerdict('Paste a post first, in Bangla, Banglish or English.', 'warn');
    return;
  }

  const parsed = parsePost(text);

  if (!parsed.hubId) {
    setVerdict('No hub in the transit graph matched this post. Add the stop or landmark name and try again.', 'warn');
    return;
  }
  if (!parsed.type) {
    setVerdict(`Found ${HUB_BY_ID.get(parsed.hubId).name}, but no incident I recognise. Mention water, jam, blockade, repair or an accident.`, 'warn');
    return;
  }

  const outcome = addReport(parsed);
  renderAlerts();

  if (input) input.value = '';

  const hubName = HUB_BY_ID.get(parsed.hubId).name;
  const label = ALERT_TYPES[parsed.type].label;
  if (outcome.action === 'merge') {
    setVerdict(`Matched an existing report at ${hubName}: merged and confidence raised. ${outcome.reason}`, 'ok');
  } else if (outcome.ok) {
    setVerdict(`Parsed as ${label} at ${hubName} (severity ${parsed.severity}), tagged "Social post (unverified)". ${outcome.reason}`, 'ok');
  } else {
    setVerdict(`Held for corroboration: ${outcome.reason}`, 'warn');
  }
}

export function voiceReport() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const input = document.getElementById('postInput');

  if (!Recognition) {
    setVerdict('This browser has no speech recognition — type or paste the report instead.', 'warn');
    return;
  }

  const recognition = new Recognition();
  recognition.lang = state.lang === 'bn' ? 'bn-BD' : 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  setVerdict('Listening… say something like "Motijheel e pani jome gese".', 'ok');

  recognition.onresult = event => {
    const transcript = event.results[0][0].transcript;
    if (input) input.value = transcript;
    setVerdict(`Heard: “${transcript}”. Review it, then press Check & add report.`, 'ok');
  };
  recognition.onerror = () => setVerdict('Could not hear anything — try again or type the report.', 'warn');
  recognition.start();
}

function setVerdict(message, tone) {
  const el = document.getElementById('ingestVerdict');
  if (!el) return;
  el.textContent = message;
  el.className = `text-[11px] leading-snug ${tone === 'ok' ? 'text-ok' : tone === 'warn' ? 'text-warn' : 'text-ink-3'}`;
}
