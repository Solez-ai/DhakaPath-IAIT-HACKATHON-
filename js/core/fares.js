import { FARE_RULES } from './network.js';

/* ===============================
   Fare engine — official rates only
   ===============================
   Every price the app shows comes from a published government rate applied to a
   dataset distance. Nothing is hand-typed, nothing is estimated.

   MRT-6  (DTCA circular, 8 September 2022)
      ৳5 per kilometre, minimum ৳20, capped at ৳100 for the Uttara North →
      Motijheel journey. Single-journey tickets are sold in ৳10 bands, so the
      kilometre fare is rounded UP to the next ৳10 step. Reconstructed from the
      dataset's station distances this reproduces the published chart exactly:
      Uttara Center ৳20 · Uttara South ৳20 · Pallabi ৳30 · Mirpur 11 ৳30 ·
      Mirpur 10 ৳40 · Motijheel ৳100. `tools/build-network.mjs` fails the build
      if that ever stops holding.
      There is NO student half fare on MRT-6 (DMTCL: "no half fare for
      students"), and this engine says so per leg instead of quietly applying it.

   City bus  (MoRTB gazette, 23 September 2026)
      ৳2.70 per kilometre with a ৳10 minimum for Dhaka metropolitan services.
      The competition brief's student rule applies on buses: 50% off, with the
      ৳10 minimum fare floor.

   Walk — free.

   Journey (segment) pricing, not per hop: one continuous metro ride is ONE
   fare, and one continuous ride on a bus line is ONE fare. That is how the
   operators actually charge, and it is why ten metro hops cost ৳40 instead of
   ten minimum fares of ৳20. */

const round = value => Math.round(value);

export function rulesFor(mode) {
  return FARE_RULES[mode] || FARE_RULES.bus;
}

/* Rule → price for a distance on one mode. */
export function fareForDistance(mode, km, { student = false } = {}) {
  const rules = rulesFor(mode);

  if (mode === 'walk') {
    return { regular: 0, student: 0, min: 0, max: 0, marginal: 0, isRange: false, eligibleForStudent: false, studentRule: 'Free — walking costs nothing.' };
  }

  const raw = Math.max(rules.minFare, rules.perKm * km);
  const banded = rules.band > 1 ? Math.ceil(raw / rules.band) * rules.band : Math.ceil(raw);
  const capped = rules.maxFare ? Math.min(banded, rules.maxFare) : banded;
  const regular = round(capped);

  const eligible = (rules.studentDiscountPct || 0) > 0;
  const studentFare = eligible
    ? round(Math.max(rules.studentMinFare ?? rules.minFare, regular * (1 - rules.studentDiscountPct / 100)))
    : regular;

  return {
    regular,
    student: studentFare,
    min: regular,
    max: regular,
    // The price of extending an already-boarded vehicle: no minimum fare, no
    // band floor. The router ranks with this, the ledger quotes the real fare.
    marginal: round(Math.min(rules.maxFare ?? Infinity, rules.perKm * km)),
    isRange: false,
    eligibleForStudent: eligible,
    studentRule: eligible
      ? `${rules.label}: student half pass — ${rules.studentDiscountPct}% off with a ৳${rules.studentMinFare} floor (brief rule).`
      : `${rules.label}: no student half fare (${rules.source}).`
  };
}

/* Same shape, but for a graph link (which already knows its distance). */
export function linkFare(link, { student = false } = {}) {
  const fare = fareForDistance(link.mode, link.km, { student });
  return { ...fare, km: link.km };
}

/* ------------------------------------------------------------------
   Segment fares
   ------------------------------------------------------------------
   A journey is billed per continuous ride, not per graph link:
     · consecutive metro hops = one MRT-6 journey (distance summed, ৳100 cap)
     · consecutive bus hops on the SAME line = one bus journey (৳10 floor once)
     · changing bus line is a new vehicle and a new fare
     · walking is always free
   `fareSegment` records which legs share a fare and `includedIn` marks the legs
   whose fare is already covered by the head of the segment. */
export function applySegmentFares(legs, { student = false } = {}) {
  let index = 0;

  while (index < legs.length) {
    const head = legs[index];

    if (head.mode === 'walk') {
      head.fare = linkFare(head, { student });
      head.fareSegment = { km: head.km, legs: 1, head: head.linkId, label: 'Walk (free)' };
      index += 1;
      continue;
    }

    const key = head.mode === 'metro' ? 'metro' : `${head.mode}:${head.routeName}`;
    const group = [];
    let km = 0;

    while (index < legs.length) {
      const leg = legs[index];
      const legKey = leg.mode === 'metro' ? 'metro' : `${leg.mode}:${leg.routeName}`;
      if (leg.mode === 'walk' || legKey !== key) break;
      group.push(leg);
      km += leg.km;
      index += 1;
    }

    const fare = fareForDistance(head.mode, km, { student });

    group.forEach((leg, position) => {
      leg.fare = { ...fare, km };
      leg.fareSegment = {
        km: Number(km.toFixed(2)),
        legs: group.length,
        head: head.linkId,
        label: `${rulesFor(head.mode).label} ${Number(km.toFixed(2))} km`
      };
      if (position > 0) leg.fare.includedIn = head.linkId;
    });
  }

  return legs;
}

export function totalFare(legs, { student = false } = {}) {
  let regular = 0;
  let studentTotal = 0;
  let billed = 0;

  legs.forEach(leg => {
    if (leg.fare?.includedIn) return; // already paid as part of an earlier segment
    if (!leg.fare) return;
    regular += leg.fare.regular;
    studentTotal += leg.fare.student;
    billed += 1;
  });

  return {
    regular,
    student: studentTotal,
    savings: regular - studentTotal,
    billedLegs: billed
  };
}

/* Why a leg costs what it costs, in one line. Used by the ledger and the chat. */
export function fareExplanation(mode) {
  const rules = rulesFor(mode);
  if (mode === 'walk') return 'Walking is free.';
  return rules.source;
}

export function modeLabel(mode) {
  return rulesFor(mode).label;
}
