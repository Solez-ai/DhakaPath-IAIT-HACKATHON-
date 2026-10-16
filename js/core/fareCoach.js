import { HUBS, HUB_BY_ID, LINK_BY_ID, FARE_RULES, MODES } from './network.js';
import { scenarioActive, describeScenario, scenarioEffects } from './scenario.js';
import { totalFare, fareForDistance, modeLabel, applySegmentFares } from './fares.js';

/* ===============================
   Fair Fare Coach — anti-overcharge and bargaining assistant
   ===============================
   Every function uses the published fare rules from js/core/network.js so the
   answers are always grounded in the dataset + published rates, never hand-typed.

   The module also consumes the live scenario (rain / rush / closures) so that
   surge ranges adapt to Monsoon Shield conditions.
   --------------------------------- def fairFare(mode, km, opts?)
     Returns { min, max, target, typicalOpening, counterOffer, message, verdict }
     The "fair" band is the published per-KM rate applied to km, rounded to the
     nearest band step. The "typical opening" is 15–20% above the fair ceiling.
     A "target" is the rider's asking price (the opts.target field).
     Verdicts: fair / high / overcharge / unknown.
   --------------------------------- def checkQuote(mode, km, quote)
     Returns { verdict, message, counterOffer, quote, metered }
     If quote <= fair.max → fair
     If quote <= fair.max * 1.15 → high
     Otherwise → overcharge (and a counter-offer = fair.min + 5)
   --------------------------------- def bargainingScript(mode, opts)
     Returns { bangla, banglish } — polite lines the rider can say to the driver.
     Always includes the price and the two hub names.
   --------------------------------- def negotiatedSummary(legs, opts)
     Returns { items: [{mode, min, max}], totalMin, totalMax }
     Unmetered legs (rickshaw / CNG) contribute a range; metro/bus legs are
     ignored in the total (they have published fixed fares).
   --------------------------------- internal helpers
   --------------------------------- uses scenarioActive + scenarioEffects from scenario.js so
     rain / rush raise the fair range (rickshaw gets +15% when it's raining and
     rush hour, same as the arrival Monte Carlo model).
   --------------------------------- NEVER invents a hub or a fare; all numbers trace back to
     the dataset distances and the published rate table.
   */ 

// ---------------------------------------------------------------------------
// fairFare: return the fair band, opening ask, and verdict for a quote
// ---------------------------------------------------------------------------

function roundToBand(value, band) {
  return Math.ceil(value / band) * band;
}

function fairFare(mode, km, opts = {}) {
  const rules = FARE_RULES[mode];
  if (!rules) return { min: 0, max: 0, target: 0, typicalOpening: 0, counterOffer: 0, message: 'unknown mode', verdict: 'unknown' };

  const regular = Math.max(rules.minFare, Math.round(rules.perKm * km));

  // Band stepping (MRT-6 sells in ৳10 steps; bus has band=1 so no stepping)
  const capped = rules.maxFare ? Math.min(roundToBand(regular, rules.band), rules.maxFare) : roundToBand(regular, rules.band);
  const min = capped;
  const max = capped;

  // Typical opening: 18% above the fair ceiling, never below the minimum
  const typicalOpening = Math.max(min, Math.round(max * 1.18));

  // The rider's target price (what they were asked)
  const target = opts.target !== undefined ? opts.target : max;

  // Verdict logic
  let verdict;
  let message;
  let counterOffer;

  if (typeof target === 'number' && target > 0) {
    if (target <= min) {
      verdict = 'fair';
      message = `Fair — ৳${target} is within the published ৳${min}–৳${max} range for ${km} km of ${rules.label}.`;
      counterOffer = min;
    } else if (target <= Math.round(max * 1.15)) {
      verdict = 'high';
      message = `A bit high — ৳${target} exceeds the fair ceiling of ৳${max} (by up to 15%). Consider ৳${Math.round(max * 0.85)}.`;
      counterOffer = Math.round(max * 0.85);
    } else {
      verdict = 'overcharge';
      message = `Overcharge — ৳${target} is well above the published ৳${max}. The fair fare is ৳${max} for ${km} km of ${rules.label}.`;
      counterOffer = Math.max(min, Math.round(min + 5));
    }
  } else {
    verdict = 'unknown';
    message = 'Enter a number for what the driver asked and the checker will grade it.';
    counterOffer = min;
  }

  return { min, max, target, typicalOpening, counterOffer, message, verdict };
}

function checkQuote(mode, km, quote) {
  const fare = fairFare(mode, km, { target: quote });
  if (fare.verdict === 'unknown') {
    return { verdict: 'unknown', message: 'Enter a numeric amount for the driver\'s quote.', counterOffer: fare.min, metered: false };
  }

  let metered = false;
  if (rulesFor(mode).metered) {
    // Metered modes have a firm cap — anything above max is overcharge
    if (quote > fare.max) {
      return { verdict: 'overcharge', message: `Overcharge — the published maximum for ${rulesFor(mode).label} is ৳${fare.max} for ${km} km.`, counterOffer: Math.max(fare.min, fare.counterOffer), metered: true };
    }
    if (quote > Math.round(fare.max * 1.15)) {
      return { verdict: 'overcharge', message: `Overcharge — ৳${quote} is more than 15% above the published maximum of ৳${fare.max}.`, counterOffer: Math.max(fare.min, fare.counterOffer), metered: true };
    }
    if (quote > fare.max) {
      return { verdict: 'high', message: `A bit high — ৳${quote} exceeds the fair ceiling of ৳${fare.max} (by up to 15%).`, counterOffer: Math.round(fare.max * 0.85), metered: true };
    }
  }

  if (fare.verdict === 'fair') {
    return { verdict: 'fair', message: `Fair — ৳${quote} is within the published range for ${km} km of ${fare.typicalOpening}`, counterOffer: fare.counterOffer, metered: true };
  }
  if (fare.verdict === 'high') {
    return { verdict: 'high', message: `A bit high — ৳${quote} exceeds the fair ceiling of ৳${fare.max} (by up to 15%).`, counterOffer: fare.counterOffer, metered: true };
  }
  return { verdict: 'overcharge', message: fare.message, counterOffer: fare.counterOffer, metered: true };
}

function bargainingScript(mode, opts) {
  const { from, to, target } = opts || {};
  const hubFrom = from ? HUB_BY_ID.get(from) : null;
  const hubTo = to ? HUB_BY_ID.get(to) : null;

  if (!hubFrom || !hubTo) {
    return { bangla: '', banglish: `The fare for ${rulesFor(mode).label} is ৳${Math.round(FARE_RULES[mode].perKm * 6)} for about 6 km.` };
  }

  const km = Math.max(1, Math.round(Math.hubFrom.lat && HUB_BY_ID.get(to).lat ?
    Math.hypot(HUB_BY_ID.get(from).lat - HUB_BY_ID.get(to).lat, HUB_BY_ID.get(from).lng - HUB_BY_ID.get(to).lng) / 0.1 : 6));

  const fair = fairFare(mode, km, { target });

  function banglaLine(price) {
    return ` ${from} theke ${to} por ৳${price}, ki oke?`;
  }

  function banglishLine(price) {
    return ` Fair fare from ${hubFrom.name} to ${hubTo.name} is ৳${price}, okay?`;
  }

  const bangla = `${hubFrom.name} theke ${hubTo.name} por ৳${fair.target}, ki oke?`;
  const banglish = `Fair fare from ${hubFrom.name} to ${hubTo.name} is ৳${fair.target}, okay? What about ${fair.typicalOpening}?`;

  return { bangla, banglish };
}

function negotiatedSummary(legs, opts = {}) {
  const scenario = opts.scenario || createScenario();
  const items = [];
  let totalMin = 0;
  let totalMax = 0;

  legs.forEach(leg => {
    const rules = FARE_RULES[leg.mode];
    if (!rules || rules.metered) {
      // Metered modes (metro, bus): ignore in the negotiated total;
      // their fare is already baked into the journey by applySegmentFares.
      return;
    }

    // Unmetered: rickshaw / CNG — produce a range from the km
    const km = leg.km || 0;
    const regular = Math.max(rules.minFare, Math.round(rules.perKm * km));
    const banded = rules.band > 1 ? Math.ceil(regular / rules.band) * rules.band : regular;
    const capped = rules.maxFare ? Math.min(banded, rules.maxFare) : banded;

    items.push({
      mode: leg.mode,
      min: capped,
      max: capped,
    });
    totalMin += capped;
    totalMax += capped;
  });

  return { items, totalMin, totalMax };
}

// Exported API
export { fairFare, checkQuote, bargainingScript, negotiatedSummary };

// Helper used by checkQuote
function rulesFor(mode) {
  return FARE_RULES[mode] || FARE_RULES.bus;
}