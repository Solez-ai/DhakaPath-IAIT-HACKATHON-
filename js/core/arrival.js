import { FARE_RULES, LINK_BY_ID } from './network.js';
import { timeMultiplier } from './scenario.js';
import { ALERT_TYPES, routingWeight } from './alerts.js';

/* ===============================
   "Arrive-By Guarantee" — reliability engine
   ===============================
   One ETA is not an answer; a rider needs "will I make it?". Every leg gets a
   travel-time *distribution* instead of a constant and the whole route is
   simulated. The model is deliberately simple, seeded and reproducible:

     mean_leg   = ride minutes × timeMultiplier(scenario) × (1 + alertPenalty)
     wait_leg   = exponential(mean = headway / 2) when you board
     spread_leg = lognormal with sigma = FARE_RULES[mode].variance
     total      = Σ sampled legs

   sigma is the mode's own variance (metro 0.08, bus 0.35, walk 0.15), which is
   why MRT-6 stays predictable when the roads do not. Seeding makes every number
   reproducible: the same seed always returns the same P50/P90.

   P50/P90, the on-time probability for a deadline, the "leave by" time for 90%
   confidence and the reliability badge all come from the same 2,000-run sample. */

export const DEFAULT_RUNS = 2000;
export const DEFAULT_SEED = 20261016;

/* Small, fast, well-known seeded PRNG (mulberry32). */
export function mulberry32(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Box–Muller, one value per call. */
function normal(random) {
  let u = 0;
  let v = 0;
  while (u === 0) u = random();
  while (v === 0) v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function exponential(random, mean) {
  const u = random() || Number.EPSILON;
  return -Math.log(u) * mean;
}

/* Log-normal draw whose median is the mean, so the sample is right-skewed the
   way real journeys are: usually on time, occasionally badly late. */
function lognormal(random, mean, sigma) {
  const mu = Math.log(Math.max(0.5, mean)) - (sigma * sigma) / 2;
  return Math.exp(mu + sigma * normal(random));
}

function alertPenalty(leg, alerts, now) {
  if (!alerts.length) return 0;

  const linkId = leg.linkId;
  return alerts.reduce((penalty, alert) => {
    if (alert.status !== 'active') return penalty;
    const touchesLink = alert.linkId === linkId;
    const touchesHub = alert.hubId === leg.from || alert.hubId === leg.to;
    if (!touchesLink && !touchesHub) return penalty;

    const ageMin = Math.max(0, (now - new Date(alert.updatedAt).getTime()) / 60000);
    const halfLife = (ALERT_TYPES[alert.type] || ALERT_TYPES.incident).halfLifeMin;
    const decay = 0.5 ** (ageMin / halfLife);
    const severity = alert.severity / 5;
    // A live report on this exact link hurts more than one at the station
    return penalty + decay * severity * (touchesLink ? 0.45 : 0.18);
  }, 0);
}

/* One leg's simulated distribution parameters. The deterministic wait is
   stripped out of `mean` because waiting is sampled separately: you board once,
   and how long you stand there is the random part of the trip. */
function legModel(leg, index, { scenario, alerts, now }) {
  const rules = FARE_RULES[leg.mode] || FARE_RULES.bus;
  const link = LINK_BY_ID.get(leg.linkId);
  const multiplier = link ? timeMultiplier(link, scenario) : 1;
  const penalty = alertPenalty(leg, alerts, now);
  const boarding = index === 0 || Boolean(leg.isTransfer);

  // The planner already separated the boarding wait from the ride; waiting is
  // sampled separately because you stand at the stop once per vehicle.
  const waitMin = leg.waitMin || 0;
  const moving = Math.max(0.5, leg.timeMin - (boarding ? waitMin : 0));

  return {
    mean: Math.max(1, moving * multiplier * (1 + penalty)),
    sigma: rules.variance ?? 0.3,
    headway: boarding ? Math.max(waitMin, (link?.frequencyMin || 0) / 2) : 0
  };
}

function percentile(sorted, fraction) {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round(fraction * (sorted.length - 1))));
  return sorted[index];
}

export function simulateOption(option, { scenario = null, alerts = [], now = Date.now(), runs = DEFAULT_RUNS, seed = DEFAULT_SEED } = {}) {
  const models = option.legs.map((leg, index) => legModel(leg, index, { scenario, alerts, now }));
  const random = mulberry32(seed);
  const samples = new Array(runs);

  for (let run = 0; run < runs; run += 1) {
    let total = 0;
    for (const model of models) {
      total += lognormal(random, model.mean, model.sigma);
      if (model.headway > 0) total += exponential(random, model.headway);
    }
    samples[run] = total;
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const p10 = percentile(sorted, 0.1);
  const p50 = percentile(sorted, 0.5);
  const p90 = percentile(sorted, 0.9);
  const mean = samples.reduce((sum, value) => sum + value, 0) / runs;

  return {
    runs,
    seed,
    p10: Math.round(p10),
    p50: Math.round(p50),
    p90: Math.round(p90),
    mean: Math.round(mean),
    worst: Math.round(sorted[sorted.length - 1]),
    best: Math.round(sorted[0]),
    histogram: buildHistogram(sorted, 12)
  };
}

function buildHistogram(sorted, buckets) {
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const width = Math.max(1, (max - min) / buckets);
  const counts = new Array(buckets).fill(0);

  sorted.forEach(value => {
    const index = Math.min(buckets - 1, Math.floor((value - min) / width));
    counts[index] += 1;
  });

  return counts.map((count, index) => ({
    from: Math.round(min + index * width),
    to: Math.round(min + (index + 1) * width),
    count,
    share: Number((count / sorted.length).toFixed(3))
  }));
}

/* Probability of finishing within `budgetMin` minutes. */
export function onTimeProbability(stats, budgetMin) {
  if (!stats || !Number.isFinite(budgetMin)) return null;
  const below = stats.histogram.filter(bucket => bucket.to <= budgetMin)
    .reduce((sum, bucket) => sum + bucket.share, 0);
  const straddling = stats.histogram.find(bucket => bucket.from < budgetMin && bucket.to > budgetMin);

  // Linear interpolation inside the bucket that contains the deadline
  let partial = 0;
  if (straddling) {
    const fraction = (budgetMin - straddling.from) / Math.max(1, straddling.to - straddling.from);
    partial = straddling.share * fraction;
  }

  return Number(Math.min(0.999, below + partial).toFixed(2));
}

export function reliabilityBadge(probability) {
  if (probability === null || probability === undefined) return { label: 'Unknown', tone: 'muted', icon: 'fa-circle-question' };
  if (probability >= 0.85) return { label: 'High', tone: 'ok', icon: 'fa-shield-heart' };
  if (probability >= 0.65) return { label: 'Medium', tone: 'warn', icon: 'fa-shield-halved' };
  return { label: 'Risky', tone: 'danger', icon: 'fa-triangle-exclamation' };
}

/* "HH:MM" (or minutes past midnight) → minutes past midnight. */
export function parseClock(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;
  const match = /^\s*(\d{1,2})[:.](\d{2})\s*(am|pm)?\s*$/i.exec(String(value));
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toLowerCase();
  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

export function formatClock(minutesPastMidnight) {
  const wrapped = ((Math.round(minutesPastMidnight) % 1440) + 1440) % 1440;
  const hours = Math.floor(wrapped / 60);
  const minutes = wrapped % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/* Full arrival report for a route against an optional deadline. */
export function arrivalReport(option, { deadline = null, now = Date.now(), scenario = null, alerts = [], runs = DEFAULT_RUNS, seed = DEFAULT_SEED } = {}) {
  const stats = simulateOption(option, { scenario, alerts, now, runs, seed });
  const deadlineMin = parseClock(deadline);
  const nowMin = new Date(now).getHours() * 60 + new Date(now).getMinutes();

  // No explicit deadline: give the rider 30 minutes of slack over the median
  const budgetMin = deadlineMin === null ? stats.p50 + 30 : deadlineMin - nowMin;
  const probability = onTimeProbability(stats, budgetMin);

  return {
    stats,
    deadline: deadlineMin,
    budgetMin: Math.round(budgetMin),
    onTime: probability,
    badge: reliabilityBadge(probability),
    leaveBy: deadlineMin === null ? null : formatClock(deadlineMin - stats.p90),
    arriveBy: formatClock(nowMin + stats.p90),
    slackMin: Math.round(budgetMin - stats.p90)
  };
}

/* Auto-generated insight line, e.g. "MRT-6 is 6 min slower but 94% on time". */
export function arrivalInsight(primary, alternative, deadline = null) {
  if (!primary || !alternative) return '';
  const faster = primary.stats.p50 <= alternative.stats.p50 ? primary : alternative;
  const safer = (primary.onTime ?? 0) >= (alternative.onTime ?? 0) ? primary : alternative;
  if (faster === safer) {
    return `${faster.optionLabel} is both the quickest and the most reliable option here (${faster.onTime === null ? '' : `${Math.round(faster.onTime * 100)}% on time`}).`;
  }

  const gap = Math.abs(primary.stats.p50 - alternative.stats.p50);
  const lead = `${faster.optionLabel} is ${gap} min faster on average, but ${safer.optionLabel} is ${Math.round((safer.onTime ?? 0) * 100)}% on time against ${Math.round((faster.onTime ?? 0) * 100)}%.`;
  return deadline ? `${lead} Leave by ${safer.leaveBy} to be safe.` : lead;
}

/* Estimated minutes a live report adds to a link, used by the map and chat to
   explain why a corridor looks slow. */
export function alertExtraMinutes(alert, now = Date.now()) {
  if (!alert || alert.status !== 'active') return 0;
  const weight = routingWeight(alert, now);
  return Math.round(weight * 12);
}
