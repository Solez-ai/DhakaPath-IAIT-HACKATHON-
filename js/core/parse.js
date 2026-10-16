import { HUBS, HUB_BY_ID, searchTokens, FARE_RULES } from './network.js';

/* ===============================
   Intent parsing — English + Banglish, dataset vocabulary only
   ===============================
   The stop vocabulary is the dataset: every hub name, plus the alternate names a
   merged interchange carries ("Shahbag" for "Shahbagh"). No invented aliases, so
   the parser can never resolve a place the network does not have.

   Beyond "A to B" the parser understands, in both languages:

     budget      "under 60 taka", "60 takar moddhe", "kom dam", "max 50"
     student     "student", "half pass", "ছাত্র", "student hole"
     avoid       "avoid Farmgate", "Farmgate bad diye", "Farmgate chara"
     mode        "metro diye", "bus e", "walk", "hatte", "only bus"
     prefer      "fastest", "cheapest", "fewest transfers", "reliable",
                 "kom somoy", "kom dam", "kom bodol"

   The result is the same structured query core/router.js consumes, and the same
   object the chat and the fare calculator show as intent chips. */

const PREFERENCE_RULES = [
  { key: 'time', label: 'Fastest', icon: 'fa-gauge-high', words: ['fastest', 'quickest', 'fast', 'quick', 'druto', 'kom somoy', 'somporke druto'] },
  { key: 'cost', label: 'Cheapest', icon: 'fa-taka-sign', words: ['cheapest', 'cheap', 'lowest fare', 'kom dam', 'sosta', 'kom taka', 'budget'] },
  { key: 'transfers', label: 'Fewest transfers', icon: 'fa-shuffle', words: ['fewest transfers', 'minimum transfer', 'no transfer', 'least change', 'kom bodol', 'transfer kom'] },
  { key: 'reliable', label: 'Most reliable', icon: 'fa-circle-check', words: ['reliable', 'on time', 'on-time', 'least delay', 'nirbhorjoggo'] }
];

const STUDENT_PATTERN = /student|half[-\s]?pass|ছাত্র|হাফ/;
const MODE_WORDS = {
  metro: ['metro', 'mrt', 'mrt-6', 'mrt6', 'মেট্রো', 'রেল'],
  bus: ['bus', 'bus e', 'বাস', 'bikolpo', 'uttara bus'],
  walk: ['walk', 'walking', 'on foot', 'hatte', 'hete', 'হেঁটে']
};

const NOISE_PATTERN = /\b(student|half[-\s]?pass|fare|fare chart|cheapest|cheap|fastest|fast|quickest|quick|most reliable|reliable|on[-\s]?time|route|journey|plan|please|from|via|under|below|max|maximum|taka|tk|bdt|moddhe|theke|jabo|jete|diye|e|only|avoid|chara|bad|kom|somoy|dam|druto|bodol|nirbhorjoggo)\b/g;

const SPLIT_PATTERN = /\s+(?:to|towards|theke|tek|jabo|jete|porjonto)\s+|\s*(?:→|->|=>)\s*/;

const CHIP_TONES = {
  default: 'bg-surface-2 text-ink-2 border-line',
  signal: 'bg-signal/10 text-signal border-signal/30',
  muted: 'bg-surface-2 text-ink-3 border-line'
};

const normalize = value => (value || '').replace(/\s+/g, ' ').trim();

/* Resolve a hub mention to a hub id, longest token first so "Mirpur 10" wins
   over "Mirpur 11" when both could match. */
export function matchHubs(text) {
  const lowered = ` ${normalize(text).toLowerCase()} `;
  const found = [];
  const used = [];

  searchTokens().forEach(entry => {
    if (!lowered.includes(entry.token)) return;
    if (used.some(range => range.token === entry.token)) return;
    used.push(entry);
    found.push(entry.hubId);
  });

  return [...new Set(found)];
}

function extractNodes(text) {
  const matched = matchHubs(text);
  return matched;
}

function parseBudget(text) {
  const patterns = [
    /(?:under|below|less than|max|maximum|up to|moddhe|niche)\s*৳?\s*(\d{2,4})/i,
    /৳?\s*(\d{2,4})\s*(?:taka|tk|bdt|৳)?\s*(?:takar?|taka)?\s*(?:moddhe|niche|er\s+moddhe|max)/i,
    /(\d{2,4})\s*(?:taka|tk|৳)/i
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) {
      const value = Number(match[1]);
      if (Number.isFinite(value) && value >= 5) return value;
    }
  }
  return null;
}

function parseModes(text) {
  const only = [];
  const avoid = [];

  Object.entries(MODE_WORDS).forEach(([mode, words]) => {
    if (!words.some(word => text.includes(word))) return;
    if (/(avoid|no|chara|bad|without)\s+\w*\s*/.test(text) && text.includes(`avoid ${word}`)) avoid.push(mode);
    else only.push(mode);
  });

  return { only, avoid };
}

function parseAvoidHubs(text) {
  const hubIds = [];

  HUBS.forEach(entry => {
    const name = entry.name.toLowerCase();
    if (!text.includes(name)) return;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(?:avoid|chara|bad|without|bypass)\\s+(?:the\\s+)?${escaped}|${escaped}\\s+(?:chara|bad|bondho)`, 'i');
    if (pattern.test(text)) hubIds.push(entry.id);
  });

  return hubIds;
}

/* Turn free text into the query the router consumes. */
export function parseQuery(rawQuery) {
  const query = normalize(rawQuery);
  const intent = {
    query,
    origin: null,
    destination: null,
    from: null,
    to: null,
    preference: 'time',
    prefer: 'time',
    student: false,
    maxFare: null,
    avoidHubs: [],
    avoidModes: [],
    onlyModes: [],
    tokens: []
  };

  if (!query) return intent;

  const lower = query.toLowerCase();
  const modifierTokens = [];

  PREFERENCE_RULES.forEach(rule => {
    if (intent.preference !== 'time') return;
    if (!rule.words.some(word => lower.includes(word))) return;
    intent.preference = rule.key;
    intent.prefer = rule.key;
    modifierTokens.push({ label: rule.label, icon: rule.icon });
  });

  if (STUDENT_PATTERN.test(lower)) {
    intent.student = true;
    modifierTokens.push({ label: 'Student half pass', icon: 'fa-id-card', tone: 'signal' });
  }

  const budget = parseBudget(lower);
  if (budget) {
    intent.maxFare = budget;
    modifierTokens.push({ label: `Under ৳${budget}`, icon: 'fa-taka-sign' });
  }

  intent.avoidHubs = parseAvoidHubs(lower);
  intent.avoidHubs.forEach(hubId => modifierTokens.push({
    label: `Avoid ${HUB_BY_ID.get(hubId).name}`,
    icon: 'fa-ban',
    tone: 'signal'
  }));

  const modes = parseModes(lower);
  intent.onlyModes = modes.only;
  intent.avoidModes = modes.avoid;
  modes.only.forEach(mode => modifierTokens.push({ label: `Only ${FARE_RULES[mode].label}`, icon: 'fa-filter' }));
  modes.avoid.forEach(mode => modifierTokens.push({ label: `No ${FARE_RULES[mode].label}`, icon: 'fa-ban' }));

  // Places: split on "to / theke / jabo" first, then fall back to "first hub
  // mentioned is the origin, next is the destination".
  const places = lower.replace(NOISE_PATTERN, ' ');
  const parts = places
    .split(SPLIT_PATTERN)
    .map(part => part.replace(/[^a-z0-9\u0980-\u09FF\s·-]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  let origins = [];
  let destinations = [];

  if (parts.length > 1) {
    origins = extractNodes(parts[0]);
    destinations = extractNodes(parts.slice(1).join(' '));
  } else {
    const found = extractNodes(parts[0] || '');
    origins = found.slice(0, 1);
    destinations = found.slice(1, 2);
  }

  const locationTokens = [];

  if (origins[0]) {
    intent.origin = origins[0];
    intent.from = origins[0];
    locationTokens.push({ label: `From ${HUB_BY_ID.get(intent.origin).name}`, icon: 'fa-location-dot', tone: 'signal' });
  }

  if (destinations[0] && destinations[0] !== intent.origin) {
    intent.destination = destinations[0];
    intent.to = destinations[0];
    locationTokens.push({ label: `To ${HUB_BY_ID.get(intent.destination).name}`, icon: 'fa-flag-checkered' });
  }

  // Keep the legacy origin/destination names and the newer from/to aliases in sync
  // so older callers and newer UI code both work with the same parsed intent.
  if (!intent.origin && intent.from) intent.origin = intent.from;
  if (!intent.destination && intent.to) intent.destination = intent.to;
  if (!intent.from && intent.origin) intent.from = intent.origin;
  if (!intent.to && intent.destination) intent.to = intent.destination;

  intent.tokens = [...locationTokens, ...modifierTokens];
  if (!intent.tokens.length) {
    intent.tokens.push({ label: 'Try "Mirpur 10 theke Motijheel, student"', icon: 'fa-circle-info', tone: 'muted' });
  }

  return intent;
}

/* Render the parsed intent as chips above the search field. */
export function renderIntentChips(container, parsed, notice) {
  if (!container) return;

  const chips = [...(parsed?.tokens || [])];
  if (notice) chips.push({ label: notice, icon: 'fa-triangle-exclamation', tone: 'signal' });

  if (!chips.length) {
    container.innerHTML = `
      <span class="text-[11px] bg-surface-2 text-ink-2 px-2 py-0.5 rounded border border-line flex items-center gap-1">
        <i class="fa-solid fa-location-dot text-[9px] text-signal"></i> Auto-detecting stops
      </span>`;
    return;
  }

  container.innerHTML = chips.map(token => `
    <span class="text-[11px] px-2 py-0.5 rounded border flex items-center gap-1 ${CHIP_TONES[token.tone || 'default']}">
      <i class="fa-solid ${token.icon} text-[9px]"></i> ${token.label}
    </span>
  `).join('');
}

export { CHIP_TONES };
