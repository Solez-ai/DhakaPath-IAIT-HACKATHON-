# Architecture — DhakaPath

Every number the app shows is computed from one in-memory graph, one fare-rule table and one
disruption state. The AI parses intent and phrases answers; it never supplies a route, a fare or a
station. This document records the models and the formulas, so a judge (or a maintainer) can check
the behaviour instead of trusting it.

```
browser
  js/core/*        PURE deterministic engine  (no DOM, no network, unit-tested)
      ↑
  js/state.js      the store: scenario + ledger + forecast → cards
      ↑
  renderers        map · routes · fares · alerts · chat · briefing · admin
      ↕  fetch
server.mjs         static files + /api/config + /api/weather + /api/chat
      ↕
  Gemini (optional)                    Open-Meteo (optional)
```

Everything except the two upstream calls runs client-side, which is why the app is fully usable
with no keys, no network and no AI provider.

---

## 1. The network (Part 1)

- **32 hubs** (`HUBS`): id, English + Bangla name, real-ish lat/lng, zone, a boarding landmark and
  a `vulnerability` (0–1) used by Monsoon Shield.
- **57 declared corridors → 114 directed links** (`LINKS`): each declared link is registered in both
  directions, and the id always reads `mode:from>to`, so a lookup never depends on declaration
  order. Modes: metro 30, bus 48, rickshaw 12, CNG 10, leguna 6, walk 6, ferry 2.
- A link carries `km`, `routeName`, `frequencyMin`, `notes`, `active`. Travel time is derived, not
  stored: `timeMin = round(km / speedKmh × 60 × timeMultiplier) + boardingWait`, with `speedKmh` and
  `waitMin` from the mode's fare rule.
- **All demo data**, stated in the README and the in-app *About data* modal.

The admin panel edits these objects in place — `LINK_BY_ID`/`HUB_BY_ID` keep pointing at the same
references, so a fare rule or a closure is in force everywhere on the next render, with no cache to
invalidate. Overrides persist to `localStorage` and are replayed before the first paint.

---

## 2. Router (Part 2)

Deterministic label-setting search. **Search state is `(hub, lastMode)`**, so a transfer is charged
whenever the mode changes — that is what stops "metro then rickshaw" from looking free.

```
allowed(link) = link.active && status(link) === 'ok'
                && !banned && !avoidHubs.includes(from|to)
                && !avoidModes.includes(mode)
                && (onlyModes.length === 0 || onlyModes.includes(mode))

cost(leg, preference, isTransfer):
  time       timeMin + 4·transfer
  cost       marginalFare + ৳5·transfer + 0.05·timeMin
  transfers  60·transfer + 0.1·timeMin
  reliable   (timeMin + 4·transfer) × (1 + 3·modeVariance)
```

`marginalFare` is the fare of extending an already-boarded vehicle (no minimum fare), so ten metro
hops do not look like ten separate ৳20 minimums.

Because a full k-shortest-paths would be overkill here, the search runs **once per objective**
(time, cost, transfers, reliable) and the results are de-duplicated by leg signature. Multi-objective
wins are tagged (`Cheapest`, `Fastest`, …). Then, for every hop of the time-optimal spine, the search
runs again with that hop banned, which is where genuinely different *alternatives* come from
(`Avoids Farmgate → Kawran Bazar`) instead of four copies of the same metro ride.

`planTrip(query, scenario)` additionally plans the same trip with `scenario: null` and reports the
before/after deltas (time, regular fare, student fare, transfers, options lost) plus which baseline
legs are broken — the numbers behind the "detour" banner.

---

## 3. Fares (Part 3)

One table, `FARE_RULES`, read by everything (cards, ledger, coach, chat, briefing, admin):

| mode | per km | min | student | metered | wait | variance | rain×rush time |
|---|---|---|---|---|---|---|---|
| MRT-6 | 3.8 | 20 (cap 100) | — | yes | 4 min | 0.08 | 1.05 / 1.10 |
| Bus | 2.4 | 10 | 50% off, ৳10 floor | yes | 8 min | 0.35 | 1.35 / 1.40 |
| Leguna | 3.0 | 15 | — | yes | 5 min | 0.25 | 1.30 / 1.35 |
| Rickshaw | 18 | 30 | — | no (±25%) | 2 min | 0.30 | 1.45 / 1.20 |
| CNG | 32 | 60 | — | no (±20%) | 3 min | 0.30 | 1.40 / 1.50 |
| Ferry | 4 | 15 | — | yes | 10 min | 0.25 | 1.50 / 1.10 |
| Walk | 0 | 0 | — | yes | 0 | 0.15 | 1.15 / 1.00 |

```
surge       = (rain ? surgeRain : 1) × (rush ? surgeRush : 1)
metered     = min(maxFare, max(minFare, perKm × km) × surge)
student     = discount > 0 ? max(studentMinFare, metered × (1 − discount/100)) : metered
unmetered   = [midpoint × (1 − spread), midpoint × (1 + spread)]   // negotiated
```

**Segment fares, not link fares.** Consecutive metered legs that share a mode *and* a route name are
one vehicle journey and get one distance-based fare (MRT-6's ৳100 ceiling is why this matters: the
Dilkusha run is ৳42, not ten ৳20 minimums). A different `routeName` is a real change of vehicle and
is billed separately. Unmetered modes are negotiated per ride and stay per leg. Walking is free.

**Fair Fare Coach** (`core/fareCoach.js`) turns the same rules into a fair band, a typical opening
ask, a target price, a verdict (`fair` / `high` / `overcharge`) with a counter-offer, and a polite
Bangla + Banglish script — with rain/rush/night adjustments, and a "metered — no negotiation" answer
for modes that are not negotiated.

---

## 4. Scenario engine + disruption (Part 3)

One state object drives every surface:

```
scenario = { rain: 'none' | 'light' | 'heavy', rush: boolean,
             blockedHubs: [], blockedLinks: [] }

RAIN_FACTOR       = { none: 0, light: 0.95, heavy: 1.15 }
BREAK_THRESHOLD   = { light: 0.85, heavy: 0.75 }        // risk at which a link breaks

hubRisk(hub)      = min(1, vulnerability(hub) × RAIN_FACTOR[rain])
hubStatus(hub)    = blocked | flooded (≥0.75) | congested (≥0.55) | normal
status(link)      = blocked (closure / blocked endpoint)
                    | 'ok' for metro — MRT-6 is elevated, so street flooding never stops it
                    | broken  when max(risk(from), risk(to)) ≥ BREAK_THRESHOLD[rain]
timeMultiplier    = Π rules.timeRain (only if it touches a hub with risk > 0.4) and rules.timeRush
```

Heavy rain (factor 1.15) therefore breaks Farmgate (0.78), Motijheel (0.82), Jatrabari (0.86) and
Malibagh (0.72 × 1.15 = 0.83) corridors, while light rain (0.95) only closes the worst of them —
the seeded vulnerabilities are what make that gradient visible in a demo.

Broken links leave the graph, so the router reroutes; the ribbon marks the affected legs and the
banner prints the deltas. Because metro is waterproof, "the bus corridor is flooded, take MRT-6" is
a real, computed reroute rather than a scripted one.

---

## 5. Alerts: validation, decay, corroboration (Part 4)

```
confidence = base(source) × severityWeight(1..5) × 0.5^(ageMin / halfLife(type)) × corroboration
corroboration = clamp(1 + 0.12·confirmations − 0.20·denials, 0.15, 1.45)
routingWeight = confidence × severityWeight          // 0 once resolved or expired
base: crowd 0.72 · social 0.45 · model 0.55 · seed 0.82
half-lives: gridlock 45 min · incident 90 · waterlogging 120 · blockade 180
            · construction 12 h · facility 24 h
lifecycle: fresh → aging (≥10 min) → stale (≥1 half-life) → expired (≥2 half-lives)
```

**Sanity checks** (rule-based, before anything can affect routing): unknown hub, unknown link,
unsupported type, duplicate within 15 min (merged, not duplicated), more than 3 reports from one
reporter inside 10 min, severity 5 with no description, contradictory "cleared" on a hub with an
active report, and fares outside the rule band for the mode and distance. Rejections and holds carry
a plain-language reason, land in the admin queue, and are excluded from routing until approved.

**Predicted alerts** are labelled `source: model`, drawn with a dashed border, carry a lower base
confidence, enter routing with a lower weight, and are promoted to crowd reports after two
confirmations.

---

## 6. Arrive-By Guarantee (Monte-Carlo)

Seeded (`mulberry32`, seed 20261016) so a run is reproducible — the same seed always returns the
same P50/P90, which is what makes the tests meaningful.

```
per leg:  mean  = max(0.5, timeMin − boardingWait) × timeMultiplier × (1 + alertPenalty)
          sigma = FARE_RULES[mode].variance           // metro 0.08, bus 0.35
          wait  = exponential(mean = max(rules.waitMin, frequencyMin/2))   // boarding only
per run:  total = Σ lognormal(mean, sigma) + Σ wait
2,000 runs → P10/P50/P90, mean, worst, best and a 12-bucket histogram
P(on time within budget) = share of buckets wholly below + linear interpolation in the bucket
                           that contains the deadline, capped at 0.999 (never claim certainty)
badge: High ≥ 0.85 · Medium ≥ 0.65 · Risky below
leaveBy = deadline − P90
alertPenalty = Σ over active alerts touching the leg of  decay(age, type) × severity/5
               × (0.45 if the alert is on this exact link else 0.18)
```

Lognormal (right-skewed, occasionally badly late) is why the metro's `p90/p50` stays near 1.1 while a
bus route's spread is far wider under the same rain — the reliability insight quotes exactly that.

---

## 7. Monsoon Shield (weather → predicted waterlogging)

Rain does not flood Dhaka evenly; it pools where the drainage is already broken.

```
rainLoad(h) = (rain[h−2] + rain[h−1] + rain[h]) / 3 + rain[h+1] / 3      // mm/h, trailing + next
rainFactor  = clamp(rainLoad / 10, 0, 1.25)                              // SATURATION_MM = 10
risk(hub)   = clamp(vulnerability(hub) × rainFactor, 0, 1)
bands: Clear < 0.30 ≤ Watch < 0.55 ≤ Congested < 0.75 ≤ Likely flooded
Dhaka Pulse = 100 × (0.45·mean(worst 5 hub risks) + 0.30·rain + 0.15·peakHour + 0.10·reports/8)
```

- Forecast: Open-Meteo hourly rain/temperature for Dhaka through `/api/weather`, 15-minute cache,
  falling back to a bundled, clearly-labelled sample forecast when the network is unavailable.
- `scenarioFromWeather` turns the current hour into the scenario: heavy ≥ 10 mm/h, light ≥ 5 mm/h.
- The **proactive nudge** scans the next 6 hours, picks the *peak* rain-load hour (not the first
  wet one) and warns only when a corridor is actually exposed (risk ≥ 0.55) at that hour.
- The prompt for the forecast hour is scrubbed by a slider, and the risk feeds the map heat overlay,
  predicted alerts and the planner's time multipliers.

---

## 8. AI layer and grounding (Part 4 + Part 5)

**AI proposes, the graph disposes.**

- `server.mjs` holds the only copy of the key (`X-goog-api-key`), never the browser. It streams SSE
  (`meta` → `chunk`* → `done`), drops reasoning parts so internal thoughts are never shown, walks a
  configurable model fallback chain on `404`/`429`/`503`, and exposes `GEMINI_API_BASE` so the chat
  can be pointed at a local mock for testing.
- The chat is given a compact snapshot of the *real* graph (hubs, links, fare rules, live alerts and
  scenario) plus the conversation history, and is instructed to answer only from it.
- **Grounding validator** (`core/ground.js`) re-checks the answer against the graph:
  `validateLegs` verifies that every hub exists, that a link of that mode really connects the two
  endpoints, that consecutive legs connect, and that any claimed fare is within 35% of the rule
  price for that mode and distance; `validateProse` extracts `Mode From → To` claims from free text
  so the *Verified against transit graph* badge appears only when something was actually verified.
  Hallucinated hubs, links and fares are removed and reported instead of being shown.
- **No key? No problem.** Every AI-shaped feature has a deterministic twin: intent parsing
  (EN + Banglish) in `core/parse.js`, alert extraction from a pasted post by keyword rules, and
  template replies for the chat. The header badge says which mode is live.

---

## 9. Frontend contract

- `index.html` declares behaviour as `data-action="…"` (never inline handlers) and labels as
  `data-i18n="…"`; `js/events.js` is the single dispatcher for click/input/change/keydown.
- `js/core/*` is pure and DOM-free, which is why the same code powers the UI, the chat, the
  briefing, the tests and (in future) a Web Worker.
- `js/state.js` is the only place that mutates app state, and every mutation is logged to the
  provenance feed, so the UI can explain *why* the ledger looks the way it does.
- Accessibility: focus-visible rings on everything, `aria-live` on the toast, labelled map controls,
  colour always paired with an icon or a word, `lang="bn"` switching the Bangla font stack and
  line-height.

---

## 10. Limitations (stated honestly)

- Demo data throughout; fares, headways and vulnerabilities are estimates, not official rates.
- The CMS is demo-grade (passphrase + `localStorage`), not server-authenticated.
- Weather is the only live feed; there is no live bus AVL or official incident API in Dhaka to bind
  to, which is precisely why the model predicts waterlogging from rainfall and crowd reports.
- The Monte-Carlo run is 2,000 samples on the main thread (a few milliseconds); a Web Worker is the
  next step if the option count grows.
- No service worker yet: the engine runs offline, but the page needs one successful load.
