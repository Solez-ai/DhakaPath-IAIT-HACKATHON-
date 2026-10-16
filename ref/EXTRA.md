
## Why these features

Every other team will build: map + route search + fare table + chatbot. These five features go beyond that and each one is **integrated** with the core system (graph, fares, alerts, simulation, validation) rather than bolted on. Judges should see them as one coherent product.

Build order by wow-per-minute: **E → B → A → C → D**. Core Parts 1–5 must already be stable before starting these. Everything here must keep the "works without Gemini" rule: every AI piece has a deterministic fallback.

---

## Feature A: "Arrive-By Guarantee" (reliability-aware planning)

**Idea:** Other apps show one ETA. Dhaka commuters need *"will I make it?"*. Show **on-time probability**, not just average time.

**Spec**
- User input (UI field + natural language + chat): "I must reach Shahbagh by 9:00" / "9 tar moddhe Motijheel pouchate hobe".
- Each link gets a **travel-time distribution**, not a constant: lognormal around `base_time × multipliers` (rush hour, rain, active alerts weighted by confidence), with a per-mode variance (metro low, bus/rickshaw/CNG high). Add random **transfer wait** based on `frequency_min`.
- Run a **seeded Monte Carlo (≈2,000 runs)** per candidate route (in a Web Worker or server util so the UI stays smooth).
- Output per route: P50 and P90 times, **on-time probability for the deadline**, a **"Leave by" time for 90% confidence**, and a **reliability badge** (e.g. High / Medium / Risky). Show a small histogram or range bar of arrival times.
- Add "Most reliable" as a ranking mode next to Cheapest / Fastest / Fewest transfers. Include the insight line, auto-generated, e.g. *"Metro is 6 min slower on average but 94% on-time vs 71% for the bus. Leave by 7:35."*
- Simulation panel interplay: when rain/rush/blockage is toggled, probabilities update live.
- Tests: seeded RNG gives deterministic results; more disruption → lower on-time probability; metro stays more reliable than bus under the same scenario.

## Feature B: "Monsoon Shield" (live weather → predicted waterlogging)

**Idea:** Don't wait for crowd reports. Predict problems from **real weather**, then reroute proactively. (Dhaka's waterlogging is the problem statement's centerpiece.)

**Spec**
- Fetch the real hourly forecast from **Open-Meteo** (free, no API key) for Dhaka via a server proxy with ~15-minute cache. Fallback: bundled sample forecast JSON, clearly labeled "offline sample".
- Add `hub_vulnerability` (0–1) to hubs, representing chronic waterlogging-prone areas. Seed illustrative values and label them as such (e.g. Jatrabari, Malibagh, Motijheel, Mirpur higher; Uttara lower).
- **Risk model:** `flood_risk(hub, t) = f(rain mm/h over the previous 1–3 hours, forecast next hours, vulnerability)`, with a transparent formula documented in `docs/ARCHITECTURE.md`.
- UI: a **heat overlay on the map** (hub circles colored by predicted risk), a **12-hour timeline slider** to scrub forward, and a **"Dhaka Pulse" city stress index** in the header (0–100).
- "Predicted" alerts are shown with a distinct style (**"Predicted by model"**, dashed border) and are clearly separate from crowd-reported ones. They feed routing with a lower weight, and crowd confirmations can promote them to real alerts.
- **"Use live weather" button** in the Simulation panel: sets the scenario automatically from the real forecast.
- **Proactive nudge card** on search: *"Rain expected around 5 PM (in 1h 20m). Jatrabari corridor likely waterlogged. Metro route recommended."*
- Tests: no rain → near-zero risk; heavy rain + high vulnerability → high risk; fallback works when the fetch fails.

## Feature C: "Fair Fare Coach" (anti-overcharge, bargaining assistant)

**Idea:** Rickshaw/CNG fares are unmetered and negotiated. Give the commuter confidence and a script.

**Spec**
- For every non-metered leg show: **fair range**, **typical opening quote**, **suggested target price**, adjusted for rain/rush/night via `fare_rules`.
- **"Check a quote" widget:** user types what the driver asked ("driver 120 chaise") → verdict **Fair / A bit high / Overcharge** with color and the reason, plus a counter-offer.
- **Bargaining script** button: short, polite Bangla and Banglish lines for that situation (generated from templates; Gemini may polish them, with template fallback). Optional speak-aloud via `speechSynthesis`.
- Integrates with the chat ("rickshaw wala 150 chacche Farmgate theke Science Lab, thik ache?") and with the sanity-check engine (same bounds).
- Label clearly: "Estimates based on demo fare rules, not legal rates."

## Feature D: Offline-first PWA with in-browser routing

**Idea:** The bonus asks for low-connectivity users. Go further: **the whole routing and fare engine runs offline.**

**Spec**
- Put graph, router, fare engine and reliability code in a shared package (`packages/core`) used by both the server and the browser.
- Installable **PWA** (`vite-plugin-pwa`): cache app shell and a snapshot of the transit graph, fare rules and active alerts in IndexedDB.
- When offline: route search, fare breakdown, scenario simulation and the Arrive-By planner still work. Show an **"Offline mode"** badge and a "data as of HH:MM" stamp.
- Reports submitted offline are **queued in IndexedDB and synced** when connectivity returns.
- Map tiles: cache only viewed tiles (runtime cache; respect OSM tile policy, no bulk prefetch). If tiles are unavailable, **auto-switch to the schematic SVG node-graph map** of the 14 hubs (which doubles as the allowed alternative map).
- Demo moment: turn on airplane mode live and search a route.

## Feature E: "Paste a Post / Say It" (social media and voice to validated alert)

**Idea:** The problem statement says commuters rely on scattered social posts that go stale in minutes. We **ingest them and make them trustworthy.**

**Spec**
- **"Paste a post"** box: paste text from Facebook/Telegram/X/WhatsApp in Bangla, Banglish or English. Gemini (structured output) extracts incidents: `{hub/link, type, severity, claimed_time, description}`. Rule-based keyword/fuzzy-match fallback for hubs and incident words.
- **Voice report:** mic button using `SpeechRecognition` (bn-BD / en-US, with graceful message if unsupported) feeding the same pipeline.
- Extracted alerts appear in an **editable preview** with detected hub on the map. Source is tagged **"Social post (unverified)"** with a low starting confidence, then they go through the existing sanity checks, de-duplication (merge with an existing nearby alert of the same type instead of duplicating), and crowd corroboration/decay.
- Show a **credibility explanation** ("Matches 2 existing reports at Farmgate, +confidence" or "No corroboration, expires in 40 min").
- Tests: duplicate merge, contradictory posts flagged, unknown hub rejected.

---

## Small polished extras (only if time remains; each ≤10 min)

- **Shareable route:** copy-to-clipboard text summary for WhatsApp, plus QR code of a deep link (`?from=&to=&student=`) using a free JS QR library.
- **Student savings counter** in the fare view: "You save ৳X on this trip, ৳Y/month at 2 trips a day".
- **Bangla numerals toggle** (০১২৩) in BN language mode.

## Integration rules (important)

1. One shared scenario state drives everything: Monsoon Shield, Simulation, Arrive-By probabilities, Fare Coach surge ranges, chat answers, the briefing card and the audio briefing. Toggle rain once and all of them respond.
2. The **briefing card / audio briefing** (bonus) must include the new data: on-time probability, "leave by" time, predicted-flood warnings and fair-fare targets.
3. The **chat assistant** gets matching tools: `plan_arrive_by`, `get_flood_risk`, `check_fare_quote`, `ingest_social_post`.
4. Every new feature has an empty state, a loading state, an error/fallback state, and a short "How it works" tooltip.
5. Document each in `README.md` (one paragraph + screenshot) and `docs/ARCHITECTURE.md` (the formulas).

## Revised timeline (overrides the master prompt's phases)

| Time | Phase |
|---|---|
| 0:00–3:15 | Master prompt P1–P5 (core Parts 1–5, stable and committed) |
| 3:15–4:35 | Unique features in order **E → B → A → C → D** (use parallel subagents where independent; cut D first if behind) |
| 3:45–4:35 | In parallel: the three bonus tasks from the master prompt |
| 4:35–5:20 | Integration pass, polish, mobile/a11y, deploy, README, architecture doc, tests green |
| 5:20–5:40 | Demo rehearsal, freeze, tag `v1.0` (no new features) |

## The "wow" demo choreography (put this in `DEMO_SCRIPT.md`, 4–5 minutes)

1. **(0:00–0:30) Hook:** "Dhaka commuters don't need the fastest route, they need to *arrive on time* and not get ripped off." Open the app, Dhaka Pulse shows live city stress from real weather.
2. **(0:30–1:30) Search:** "Mirpur theke Motijheel, student, 9 tar moddhe" → ranked multi-leg options with landmarks, student vs regular fares, **on-time probability and Leave-By time**.
3. **(1:30–2:30) Monsoon Shield:** drag the timeline to the rain window, flood risk heat grows at Jatrabari/Farmgate; click **Use live weather**; route breaks in red, detour appears with before/after time, cost and reliability.
4. **(2:30–3:15) Paste a Post:** paste a Banglish Facebook-style post about waterlogging; it becomes a structured, sanity-checked alert with a credibility score; confirm it, watch confidence rise; show an old alert decaying.
5. **(3:15–3:45) Fair Fare Coach:** "rickshaw wala 150 chaise" → verdict "Overcharge", counter-offer and Bangla script.
6. **(3:45–4:30) Chat + bonuses:** ask the assistant a follow-up ("student hole koto?"), play the audio briefing, download the offline card, flip to airplane mode and search again (PWA offline).
7. **(4:30–5:00) Close:** architecture in one slide: deterministic graph engine + grounded AI + crowd validation, 100% free stack, works without the LLM.

Before building, update `PLAN.md` with these features and the revised timeline, then continue from where you are.
