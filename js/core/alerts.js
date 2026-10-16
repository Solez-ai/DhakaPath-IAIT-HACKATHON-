import { HUB_BY_ID, LINK_BY_ID, linksFrom, FARE_RULES } from './network.js';

/* ===============================
   Reporting system — crowd reports about the dataset network
   ===============================
   A report is anchored to a NODE (a dataset stop) or a LINK (a dataset corridor).
   Anything that does not resolve to the dataset is rejected, which is the same
   grounding rule the AI answers must pass.

   The ledger starts EMPTY on purpose: this build ships no fabricated reports.
   Every card on screen came from a real submission (the report form, a pasted
   social post, or the chat) or from the weather model, which is labelled
   "Predicted by model" and visibly different from a crowd report.

   Lifecycle:
     confidence = base(source) × severityWeight(1..5)
                  × 0.5^(ageMin / halfLife(type)) × corroboration
     corroboration = clamp(1 + 0.12·confirmations − 0.20·denials, 0.15, 1.45)
     routingWeight = confidence × severityWeight, 0 once resolved or expired
     fresh → aging (≥10 min) → stale (≥1 half-life) → expired (≥2 half-lives)

   Validation before a report can touch routing (Part 4 of the brief):
     · the stop or corridor must exist in the dataset
     · severity 5 with no description is held
     · a duplicate within 15 minutes is merged, not duplicated
     · more than 3 reports from one reporter in 10 minutes is held
     · a "cleared" report on a stop with an active report is held as contradictory
     · waterlogging on the elevated metro is implausible and is held
   Held or rejected items go to the admin queue with a plain-language reason and
   are excluded from routing until a human approves them. */

export const ALERT_TYPES = {
  waterlogging: { label: 'Waterlogging', icon: 'fa-water', tone: 'water', halfLifeMin: 120, baseSeverity: 3, modes: ['bus', 'walk'] },
  gridlock: { label: 'Gridlock', icon: 'fa-traffic-light', tone: 'warn', halfLifeMin: 45, baseSeverity: 3, modes: ['bus'] },
  construction: { label: 'Construction', icon: 'fa-person-digging', tone: 'warn', halfLifeMin: 720, baseSeverity: 2, modes: ['bus', 'walk'] },
  blockade: { label: 'Blockade', icon: 'fa-hand', tone: 'danger', halfLifeMin: 180, baseSeverity: 4, modes: ['bus', 'walk'] },
  incident: { label: 'Incident', icon: 'fa-triangle-exclamation', tone: 'danger', halfLifeMin: 90, baseSeverity: 3, modes: ['bus', 'walk', 'metro'] },
  clearance: { label: 'Cleared', icon: 'fa-circle-check', tone: 'ok', halfLifeMin: 30, baseSeverity: 1, modes: ['bus', 'walk', 'metro'] }
};

const BASE_CONFIDENCE = { crowd: 0.72, social: 0.45, model: 0.55, operator: 0.9 };
const SEVERITY_WEIGHT = { 1: 0.4, 2: 0.55, 3: 0.7, 4: 0.85, 5: 1 };
const MERGE_WINDOW_MIN = 15;
const REPORTER_WINDOW_MIN = 10;
const REPORTER_LIMIT = 3;
const EXPIRE_AFTER_HALF_LIVES = 2;

let sequence = 0;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const ageMinutes = (alert, now) => Math.max(0, (now - new Date(alert.updatedAt).getTime()) / 60000);

function severityWeight(severity) {
  return SEVERITY_WEIGHT[clamp(Math.round(severity || 3), 1, 5)];
}

export function confidenceOf(alert, now = Date.now()) {
  if (alert.status === 'resolved') return 0;

  const type = ALERT_TYPES[alert.type] || ALERT_TYPES.incident;
  const base = BASE_CONFIDENCE[alert.source] ?? BASE_CONFIDENCE.crowd;
  const decay = 0.5 ** (ageMinutes(alert, now) / type.halfLifeMin);
  const corroboration = clamp(1 + 0.12 * (alert.confirmations || 0) - 0.2 * (alert.denials || 0), 0.15, 1.45);

  return Number(clamp(base * severityWeight(alert.severity) * decay * corroboration, 0, 0.99).toFixed(2));
}

export function freshness(alert, now = Date.now()) {
  const type = ALERT_TYPES[alert.type] || ALERT_TYPES.incident;
  const minutes = ageMinutes(alert, now);
  const halfLives = minutes / type.halfLifeMin;

  let status = 'fresh';
  if (alert.status === 'resolved') status = 'resolved';
  else if (halfLives >= EXPIRE_AFTER_HALF_LIVES) status = 'expired';
  else if (halfLives >= 1) status = 'stale';
  else if (minutes >= 10) status = 'aging';

  const label = minutes < 1
    ? 'just now'
    : minutes < 60
      ? `${Math.round(minutes)} min ago`
      : `${(minutes / 60).toFixed(1)} h ago`;

  return { status, minutes: Math.round(minutes), label, confidence: confidenceOf(alert, now), expired: status === 'expired' };
}

export function createAlert(report, now = Date.now()) {
  sequence += 1;
  const type = ALERT_TYPES[report.type] ? report.type : 'incident';

  return {
    id: report.id || `al-${now.toString(36)}-${sequence}`,
    type,
    hubId: report.hubId || null,
    linkId: report.linkId || null,
    severity: clamp(Math.round(report.severity || ALERT_TYPES[type].baseSeverity), 1, 5),
    description: (report.description || '').trim(),
    reporter: report.reporter || 'anonymous',
    source: report.source || 'crowd',
    createdAt: new Date(report.createdAt ?? now).toISOString(),
    updatedAt: new Date(report.createdAt ?? now).toISOString(),
    confirmations: report.confirmations || 0,
    denials: report.denials || 0,
    status: 'active',
    resolvedAt: null,
    flaggedReason: null
  };
}

export function confirmAlert(alert, now = Date.now()) {
  alert.confirmations += 1;
  alert.updatedAt = new Date(now).toISOString();
  // Two rider confirmations promote a model prediction into a crowd report
  if (alert.source === 'model' && alert.confirmations >= 2) alert.source = 'crowd';
  return alert;
}

export function denyAlert(alert, now = Date.now()) {
  alert.denials += 1;
  alert.updatedAt = new Date(now).toISOString();
  return alert;
}

export function resolveAlert(alert, now = Date.now()) {
  alert.status = 'resolved';
  alert.resolvedAt = new Date(now).toISOString();
  alert.updatedAt = alert.resolvedAt;
  return alert;
}

/* Effective weight a live alert applies to travel time on the affected element. */
export function routingWeight(alert, now = Date.now()) {
  const info = freshness(alert, now);
  if (info.expired || alert.status === 'resolved') return 0;
  return Number((info.confidence * severityWeight(alert.severity)).toFixed(3));
}

/* ------------------------------------------------------------------
   Validation (Part 4)
   ------------------------------------------------------------------ */

export function sanityCheck(report, { now = Date.now(), existing = [] } = {}) {
  const reject = reason => ({ ok: false, action: 'reject', reason, confidenceSeed: 0 });
  const flag = reason => ({ ok: false, action: 'flag', reason, confidenceSeed: 0.35 });

  if (!report) return reject('Empty report.');
  if (!report.hubId && !report.linkId) return reject('No stop or corridor could be identified in this report.');
  if (report.hubId && !HUB_BY_ID.get(report.hubId)) return reject(`"${report.hubId}" is not a stop in the dataset.`);
  if (report.linkId && !LINK_BY_ID.get(report.linkId)) return reject(`"${report.linkId}" is not a corridor in the dataset.`);
  if (!ALERT_TYPES[report.type]) return reject(`Unsupported report type "${report.type}".`);

  const link = report.linkId ? LINK_BY_ID.get(report.linkId) : null;
  const hubId = report.hubId || (link ? link.from : null);
  const hubName = HUB_BY_ID.get(hubId)?.name || report.linkId;
  const type = ALERT_TYPES[report.type];

  // Waterlogging on an elevated viaduct is not a thing.
  if (link && !type.modes.includes(link.mode)) {
    return flag(`${type.label} does not apply to the ${FARE_RULES[link.mode].label} corridor ${hubName} (${link.mode}) — held for review.`);
  }

  const active = existing.filter(entry => entry.status === 'active');
  const sameKind = active.filter(entry => entry.type === report.type
    && ((report.linkId && entry.linkId === report.linkId) || (report.hubId && entry.hubId === report.hubId)));

  const duplicate = sameKind.find(entry => ageMinutes(entry, now) <= MERGE_WINDOW_MIN);
  if (duplicate) {
    return {
      ok: true,
      action: 'merge',
      reason: `Merged with an existing ${type.label} report at ${hubName} from ${duplicate.reporter} (${freshness(duplicate, now).label}).`,
      confidenceSeed: 0.2,
      mergeInto: duplicate.id
    };
  }

  if (report.type !== 'clearance' && sameKind.some(entry => ageMinutes(entry, now) <= MERGE_WINDOW_MIN)) {
    return { ok: true, action: 'merge', reason: `Already reported at ${hubName} minutes ago.`, confidenceSeed: 0.2, mergeInto: sameKind[0].id };
  }

  // A "cleared" claim against a live problem needs a human: they contradict.
  if (report.type === 'clearance') {
    const open = active.filter(entry => entry.hubId === report.hubId && entry.type !== 'clearance' && ageMinutes(entry, now) <= 180);
    if (open.length) return flag(`Contradicts ${open.length} active report(s) at ${hubName} — held for review.`);
  }

  const recent = existing.filter(entry => entry.reporter && entry.reporter === report.reporter && ageMinutes(entry, now) <= REPORTER_WINDOW_MIN);
  if (recent.length >= REPORTER_LIMIT) return flag(`${report.reporter} already filed ${recent.length} reports in the last ${REPORTER_WINDOW_MIN} minutes — held for review.`);

  if (Math.round(report.severity || 0) >= 5 && !(report.description || '').trim()) {
    return flag('Severity 5 needs a description — held for review.');
  }

  return { ok: true, action: 'accept', reason: `Accepted at ${hubName} (${type.label}).`, confidenceSeed: 0.6 };
}

export function mergeReport(target, report, now = Date.now()) {
  target.confirmations += 1;
  target.severity = Math.max(target.severity, clamp(Math.round(report.severity || target.severity), 1, 5));
  if ((report.description || '').length > target.description.length) target.description = report.description;
  target.updatedAt = new Date(now).toISOString();
  return target;
}

/* The same corridor may be reported node-side and link-side; keep the strongest. */
export function dedupe(alerts, now = Date.now()) {
  const best = new Map();
  alerts.forEach(alert => {
    const key = `${alert.type}|${alert.linkId || alert.hubId}`;
    const current = best.get(key);
    if (!current || routingWeight(alert, now) > routingWeight(current, now)) best.set(key, alert);
  });
  return [...best.values()];
}

/* ------------------------------------------------------------------
   Operational links a set of live reports takes out of service
   ------------------------------------------------------------------ */

/* Confirmed waterlogging/blockade on a corridor closes it; a report on a stop
   closes the corridors that use that stop. This is how a crowd report becomes a
   real reroute, and it decays away with the report. */
export function disruptedLinks(alerts, now = Date.now(), { threshold = 0.45 } = {}) {
  const links = new Set();

  alerts.forEach(alert => {
    if (alert.status !== 'active' || freshness(alert, now).expired) return;
    if (!['waterlogging', 'blockade', 'gridlock', 'construction'].includes(alert.type)) return;
    if (routingWeight(alert, now) < threshold) return;

    if (alert.linkId && LINK_BY_ID.get(alert.linkId)) {
      links.add(alert.linkId);
      const [lineId, path] = alert.linkId.split(':');
      const [from, to] = path.split('>');
      links.add(`${lineId}:${to}>${from}`);
      return;
    }

    if (alert.hubId) linksFrom(alert.hubId).forEach(link => { if (link.mode !== 'metro' || alert.type === 'incident') links.add(link.id); });
  });

  return [...links];
}

/* Weather-model predictions, labelled as such and anchored to the bus corridors
   the model can actually reason about (see core/weather.js). */
export function predictedAlerts(riskByLink, { now = Date.now(), threshold = 0.65 } = {}) {
  const created = [];

  riskByLink.forEach((entry, linkId) => {
    if (entry.value < threshold) return;
    const link = LINK_BY_ID.get(linkId);
    if (!link) return;

    created.push(createAlert({
      type: 'waterlogging',
      linkId,
      hubId: link.from,
      severity: entry.value >= 0.85 ? 4 : 3,
      source: 'model',
      reporter: 'monsoon-shield',
      description: `Model: ${Math.round(entry.value * 100)}% likelihood of waterlogging on the ${link.routeName} corridor near ${HUB_BY_ID.get(link.from).name} from forecast rainfall.`,
      createdAt: now
    }, now));
  });

  return created;
}
