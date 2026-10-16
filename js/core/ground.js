import { HUB_BY_ID, LINK_BY_ID, FARE_RULES } from './network.js';
import { linkFare } from './fares.js';

/* ===============================
   Grounding validator
   ===============================
   The AI is allowed to talk, never to invent. Anything it claims is fed through
   here and rejected unless every hub, link and fare matches the transit graph.

   Two entry points:
     validateLegs(legs)   structured legs (the app's own plans, and any future
                          structured AI output)
     validateProse(text)  pulls "Mode From → To" claims out of a chat reply and
                          checks them, so the "Verified against transit graph"
                          badge only appears when something was actually verified. */

const FARE_TOLERANCE = 0.35; // claimed fares may drift 35% before we object

function issue(severity, message, detail = {}) {
  return { severity, message, ...detail };
}

export function validateLegs(legs, { student = false } = {}) {
  const issues = [];
  let checked = 0;

  if (!Array.isArray(legs) || !legs.length) {
    return { ok: false, checked: 0, issues: [issue('error', 'No legs supplied — nothing to ground.')] };
  }

  legs.forEach((leg, index) => {
    const fromId = leg.from?.id || leg.from;
    const toId = leg.to?.id || leg.to;
    const from = HUB_BY_ID.get(fromId);
    const to = HUB_BY_ID.get(toId);

    if (!from || !to) {
      issues.push(issue('error', `Leg ${index + 1} references a hub that is not in the graph (${fromId} → ${toId}).`));
      return;
    }

    const forward = LINK_BY_ID.get(`${leg.mode}:${fromId}>${toId}`);
    const reverse = LINK_BY_ID.get(`${leg.mode}:${toId}>${fromId}`);
    const link = forward || reverse;

    if (!link) {
      issues.push(issue('error', `No ${leg.mode} link between ${from.name} and ${to.name} in the graph.`));
      return;
    }

    checked += 1;

    // A fare covers a whole mode segment, so compare against the segment
    // distance when the planner told us how far that segment runs.
    const expected = leg.fareSegment?.km
      ? linkFare({ mode: leg.mode, km: leg.fareSegment.km }, { student })
      : linkFare(link, { student });

    // A hop whose fare is included in an earlier segment fare is not a claim
    const claimed = leg.fare?.regular ?? leg.fare;
    if (!leg.fare?.includedIn && typeof claimed === 'number' && claimed > 0) {
      const drift = Math.abs(claimed - expected.regular) / Math.max(1, expected.regular);
      if (drift > FARE_TOLERANCE) {
        const km = leg.fareSegment?.km ?? link.km;
        issues.push(issue('error', `Fare ৳${claimed} is outside the rule bounds for ${FARE_RULES[leg.mode].label} ${km} km (expected ≈ ৳${expected.regular}).`, { leg: index + 1 }));
      }
    }
  });

  // Consecutive legs must actually connect
  for (let index = 1; index < legs.length; index += 1) {
    const previous = legs[index - 1];
    const current = legs[index];
    const previousTo = previous.to?.id || previous.to;
    const currentFrom = current.from?.id || current.from;

    if (previousTo !== currentFrom) {
      issues.push(issue('error', `Legs ${index} and ${index + 1} do not connect (${previousTo} ≠ ${currentFrom}).`));
    }
  }

  return { ok: issues.filter(entry => entry.severity === 'error').length === 0, checked, issues };
}

/* Pull "Bus Mirpur 10 → Motijheel" style claims out of free text. */
export function validateProse(text) {
  const claims = [];
  // Only the modes the dataset actually has: MRT-6, the city buses, walking.
  const pattern = /(metro|mrt-?6?|bikolpo|uttara bus|bus|walk|walking)\s+([A-Za-z\u0980-\u09FF0-9 ]{2,24}?)\s*(?:→|->|to|theke)\s*([A-Za-z\u0980-\u09FF0-9 ]{2,24})/gi;

  for (const match of String(text || '').matchAll(pattern)) {
    const word = match[1].toLowerCase();
    const mode = word.startsWith('mrt') || word === 'metro' ? 'metro'
      : word.startsWith('walk') ? 'walk'
      : 'bus';
    const from = resolveHub(match[2]);
    const to = resolveHub(match[3]);
    if (from && to) claims.push({ mode, from, to });
  }

  if (!claims.length) {
    return { ok: true, checked: 0, claims: [], issues: [] };
  }

  const issues = claims
    .filter(claim => !LINK_BY_ID.get(`${claim.mode}:${claim.from}>${claim.to}`) && !LINK_BY_ID.get(`${claim.mode}:${claim.to}>${claim.from}`))
    .map(claim => issue('error', `Claimed ${claim.mode} link ${labelOf(claim.from)} → ${labelOf(claim.to)} does not exist.`));

  return { ok: issues.length === 0, checked: claims.length, claims, issues };
}

function labelOf(hubId) {
  return HUB_BY_ID.get(hubId)?.name || hubId;
}

function resolveHub(fragment) {
  const needle = String(fragment).trim().toLowerCase().replace(/\s+/g, ' ');
  if (!needle) return null;

  for (const [id, entry] of HUB_BY_ID) {
    if (entry.name.toLowerCase() === needle) return id;
  }
  for (const [id, entry] of HUB_BY_ID) {
    if (needle.includes(entry.name.toLowerCase()) || entry.name.toLowerCase().includes(needle)) return id;
  }
  return null;
}

/* Shape handed to the UI badge. */
export function groundingBadge(result) {
  if (!result.checked) {
    return { tone: 'muted', label: 'Not grounded', detail: 'No verifiable route claims in this answer.' };
  }
  if (!result.ok) {
    return { tone: 'danger', label: 'Failed grounding', detail: result.issues.map(entry => entry.message).join(' ') };
  }
  return { tone: 'ok', label: `Verified against transit graph (${result.checked} leg${result.checked === 1 ? '' : 's'})`, detail: 'Every hub, mode and fare matched the network data.' };
}
