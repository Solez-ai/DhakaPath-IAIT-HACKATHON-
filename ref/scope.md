# scope.md — DhakaPath scope, UX principles and gap analysis

Sources: `ref/hackathon.txt` (official problem statement), `ref/MISSION.md` (build brief),
`ref/DESIGN.md` (design system), `ref/EXTRA.md` (differentiator features).

This file is the contract we build against. Section 3 is re-audited against the code in the
repository root; section 5 is the improvement plan that audit produced.

---

## 1. What the competition actually asks for

IAIT National IT Fest 2026 · Smart City · **DhakaPath: Live Urban Transit & Route Intelligence**.
5h40m build, 4–5 min demo + 2 min Q&A.

| Constraint | Meaning for us |
|---|---|
| 100% free stack | No paid APIs, no credit-card services, no Google Maps. Leaflet + OSM is the sanctioned map. |
| Free AI only | Gemini free tier (or Groq/HF/OpenRouter/Ollama), server-side key in `.env`, never in the browser. |
| Must survive AI failure | Every AI feature has a deterministic fallback plus a visible online/fallback badge. |
| AI must not invent data | Routes, fares, stations all come from the transit graph. The model parses intent and phrases answers. |
| Seed data must be labelled | Demo data, stated in the README and in an in-app "About data" note. |
| Judges need a repo | README with setup, architecture doc, demo script, test runner. |

### The five judged parts

- **P1 Transit & Street-Status Management (CMS)** — browse + admin CRUD over transit links
  (bus / MRT-6 / leguna / rickshaw / CNG / walk) and street alerts; metadata must include mode,
  origin→destination hub, base BDT fare, student half-pass eligibility, estimated time, plus
  boarding-landmark notes and fare charts.
- **P2 Intelligent multi-constraint search** — English **and Banglish** natural language beyond
  keywords (budget limits, "avoid Farmgate", mode preference); multi-leg combinations ranked by
  cost / duration / transfers; bonus: boarding and transfer instructions per leg.
- **P3 Dynamic fare estimation & disruption rerouting** — per-leg fare breakdown comparing regular
  vs student (50% on buses, ৳10 minimum, modes where the pass does not apply); connector fare
  **ranges** with rush/rain surge; a **scenario simulator** (heavy rain in zones, peak rush, blocked
  intersection) that recalculates, marks broken segments and prints a detour with before/after time
  and cost.
- **P4 Report validation & output grounding** — verify AI route claims against the graph;
  crowd confirm/resolve on alerts with **confidence decay over time**; rule-based sanity checks that
  flag implausible fares or contradictory reports before they affect routing.
- **P5 Conversational assistant** — English + Banglish chat with session context, able to search
  routes, compare fares, submit an alert conversationally, request alternates, and explain fare
  rules and alert reliability. Replies embed structured cards, not prose alone.

### Bonuses
B1 signboard/notice photo → structured data · B2 audio briefing + downloadable offline card ·
B3 ride-share board with per-person fare split.

### Differentiators (`EXTRA.md`)
A Arrive-By guarantee (Monte-Carlo on-time probability, leave-by time) · B Monsoon Shield
(Open-Meteo → predicted waterlogging, Dhaka Pulse index, timeline scrub) · C Fair Fare Coach
(quote verdict + bargaining script) · D offline-first PWA with in-browser routing ·
E paste-a-social-post / voice report → validated alert.

---

## 2. UX principles to hold the line on (`DESIGN.md` §2, §10)

1. **Map-first, task-first.** No landing screen; the map plus a "Where to?" field *is* home.
2. **Legible.** Stressed commuter, bright sun, two seconds: high contrast, big mono numerals.
3. **Local.** Bangla is first-class — real EN/বাংলা UI, Bangla hub names, `lang` attributes.
4. **Alive but purposeful.** Motion explains state change (route breaking, detour appearing, alert
   ageing). Transform/opacity only; honour `prefers-reduced-motion`.
5. **Progressive disclosure.** Total fare/time/transfers first; legs, landmarks, surge behind a tap.
6. **Honest system state.** AI online/fallback, data freshness, predicted vs reported, verified vs
   not. Never pretend.
7. **Forgiving input.** Fuzzy/Banglish hub matching, never lose the query on error, undo.
8. **Anti-AI-slop bans.** No gradients, no glassmorphism, no emoji as icons, no generic spinners,
   no default Leaflet look, no default palette colours, no hype microcopy, warm neutrals only.
9. **Bilingual by design**, persisted EN/বাংলা switch.
10. **Accessibility.** Keyboard paths, visible focus, ARIA on map controls, `aria-live` for alerts,
    44px targets, colour never the only signal, labelled glyphs.

Signature components from the design system: the **Route Ribbon** (station nodes, transfer rings,
dashed walk legs, broken leg hatch, landmark captions), the **fare ledger** (mono, regular vs
student columns, "why no student fare?" tooltip), the **alert freshness meter**, the **scenario
control board**, the **dispatch-desk chat** with a "verified against the transit graph" badge.

---

## 3. Feature-by-feature: ref scope vs. the app in this repo

Legend: **Have** = meets the brief · **Partial** = exists but short of the brief · **Missing**.
Counts are verified, not estimated: `node tests/run.mjs` covers the deterministic engine with 106
assertions, and the numbers below come from the seed data (`js/core/network.js`).

| # | Feature (source) | Expected functionality | Now | Evidence / gap |
|---|---|---|---|---|
| 1 | Transit network data model (P1) | Hubs + links with mode, from/to, base fare, student eligibility, time, frequency, boarding landmark, distance | **Have** | 32 hubs, 114 directed links across 7 modes (metro 30, bus 48, rickshaw 12, CNG 10, leguna 6, walk 6, ferry 2); every link carries `km`, `timeMin`, `frequencyMin`, `boardingNote`, `alightNote`. |
| 2 | Fare-rules engine (P3) | Rules per mode: per-km, min fare, student %, floors, surge multipliers, metered flag | **Have** | `core/fares.js` reads `FARE_RULES` for all 7 modes; bus 50% student with ৳10 floor, metro/rickshaw/CNG/leguna/ferry non-student with a "why" explanation, connectors return ranges with rain/rush/night surge. |
| 3 | Network & hub browsing UI (P1) | Filter/search by mode, hub, student-eligible, status | **Partial** | Plan tab lists computed options for a pair and the fare calculator compares every pair; there is no browsable network/hub index, and no admin view of the 114 links. |
| 4 | Admin CMS (P1) | Password-gated CRUD on hubs/links/fare rules, alert moderation, fare charts | **Partial** | Admin tab shipped this session: passphrase gate, link/hub/fare-rule editors, alert moderation queue (approve/resolve/flag/delete), JSON import/export, all persisted locally and re-read by the engine. Not server-authenticated (documented). |
| 5 | Alert lifecycle (P1/P4) | Types, severity, confirm/resolve, confidence score, decay half-life per type, expiry | **Have** | `core/alerts.js` (6 types with half-lives), `confidenceOf`/`freshness`, Still-there/Cleared with counters, stale → expired, source provenance (crowd / social / model / admin). |
| 6 | Report validation + sanity checks (P4) | Flag implausible fares, contradictory or duplicate reports; flagged items do not affect routing | **Have** | `sanityCheck` returns per-field issues with reasons; flagged reports enter the admin queue and are excluded from `activeAlerts()`; `dedupe`/`mergeReport` merge same-hub same-type reports. |
| 7 | NL / Banglish parsing (P2) | origin, destination, budget, avoid-hubs, avoid-modes, student, prefer, rush/weather | **Have** | `core/parse.js`: hub fuzzy matching over names + Bangla + aliases, `theke/jabo/jete/taka/moddhe/kom/druto/bhir/brishti/bondho`, budget, avoid list, mode filters, student, preferences. |
| 8 | Graph routing, multi-leg (P2) | k-shortest paths over the multi-modal graph, transfer penalties, 3–5 options ranked by cost/time/transfers | **Have** | `core/router.js`: label-setting search with transfer penalties, blocked/avoid/only-mode support, ranked options tagged Cheapest / Fastest / Fewest transfers / Most reliable; 114-link graph gives real alternates. |
| 9 | Per-leg boarding/alighting instructions (P2 bonus) | "Board at Farmgate metro pillar-12 side, exit towards TSC" | **Have** | Boarding and alighting notes render per leg in the route ribbon, and the audio briefing reads them out. |
| 10 | Fare breakdown ledger (P3) | Per-leg + total, regular vs student columns, ranges for non-metered, surge bars, why-tooltip | **Have** | Fare calculator renders regular vs student side by side with a strikethrough saving, connector ranges with surge, and a per-mode explanation. |
| 11 | Scenario simulation (P3) | Rain/rush/block controls, broken-segment marking, automatic detour, before/after deltas, reset | **Have** | Live Conditions panel drives one shared scenario: rain intensity, peak rush, blocked hubs, forecast scrub, "use live weather", reset; broken legs are marked in the ribbon and the detour shows time/cost/transfer deltas. |
| 12 | Route grounding (P4) | Every AI/route claim validated against the graph; verified badge; grounding report | **Have** | `core/ground.js` re-validates legs (link exists, endpoints adjacent, fare inside rule bounds) and the chat shows the verdict badge. |
| 13 | Corroboration & decay in the router (P4) | Still there / Cleared, decay, stale → expired, router weights alerts by confidence | **Have** | `routingWeight` feeds `simulateOption`'s alert penalty; decay is exponential per type and the freshness meter counts down live. |
| 14 | Chat assistant with tools (P5) | Session context, tool calls, structured cards, Banglish | **Partial** | Streaming Gemini dispatcher with the transit-graph snapshot in context, grounding badge, offline fallback and intent-aware prompt. Tool calls are emulated by context, not native function-calling, and replies are text (no embedded route cards). |
| 15 | EN/বাংলা UI toggle (UX) | Real translation of labels, persisted, Bangla numerals option | **Partial** | Toggle now translates the app chrome, panels, tabs, controls and buttons from a dictionary, persists the choice, and sets `lang="bn"` on the document; generated card internals stay EN-first. |
| 16 | Route Ribbon per spec (§8.1) | Station nodes, transfer rings, dashed walk, broken hatch, landmark captions | **Have** | Ribbon draws per-leg mode colours, station/transfer nodes, dashed walk legs, hazard striping on broken legs and landmark captions. |
| 17 | Motion spec (§9, 25 items) | Press feedback, route draw-in, fare odometer, freshness drain, broken→detour, rain canvas | **Partial** | Implemented: bottom sheet, fare flash, marker pulses, scenario banner, freshness drain, streaming caret, skeleton shimmer. Not implemented: odometer digits, rain canvas, draw-in polylines, view transitions. |
| 18 | Empty / loading / error states (§8.10) | Custom SVG illustrations + honest copy + skeletons | **Partial** | Honest copy and skeleton loaders exist for routes/alerts; bespoke SVG illustrations do not. |
| 19 | Onboarding: About data + Demo mode | Data disclaimer modal; one-click reproducible demo scenario | **Have** | "About data" modal states the seeded demo data + disclaimer, and Demo mode runs the scripted Mirpur→Motijheel student trip and then a Farmgate rain closure to show the detour. |
| 20 | Bonuses B1–B3 | Signboard OCR · audio briefing + offline card · ride-share board | **Partial** | B2 shipped (spoken briefing + downloadable offline summary card with fare/on-time/landmarks). B1 (photo OCR) and B3 (ride-share board) are not built. |
| 21 | Differentiators A–E | Arrive-By · Monsoon Shield · Fare Coach · offline PWA · paste-a-post/voice | **Partial** | A, B, C and E shipped (Monte-Carlo arrival, Open-Meteo risk + Dhaka Pulse + scrub + nudge, fare-coach verdict/script, paste-a-post + voice report). D (offline PWA with IndexedDB sync) is not built; the app already runs offline for tiles/forecast/AI, but there is no service worker. |
| 22 | Deliverables | `README.md`, `docs/ARCHITECTURE.md`, `DEMO_SCRIPT.md`, test runner, seed/reset | **Have** | 106-assertion runner (`npm test`), README with local run + judge instructions, architecture doc (formulas) and a timed demo script. `npm run seed` is unnecessary: the network is committed seed data and Demo mode resets the scenario. |
| 23 | Compliance | Free stack, OSM/Leaflet maps, server-side key, works without AI | **Have** | Leaflet + OSM tiles (CARTO optional, public key only), Gemini key server-side, mock-verified streaming, local estimates and sample forecast when AI/network is absent. |

Score: **15 Have, 8 Partial, 0 Missing.** The scored core (Parts 1–5) is complete; what remains is
polish inside already-built surfaces plus two bonus items.

---

## 4. Architecture decisions (recorded)

1. **Client-side-first.** The graph, router, fare engine, scenario engine, weather model, alert
   ledger and grounding validator run in the browser as ES modules; `server.mjs` is a thin static
   host plus three endpoints (`/api/config`, `/api/chat`, `/api/weather`). This satisfies the open
   stack rule, deploys anywhere free, and keeps the offline story cheap. No SQLite/Express: the
   brief never requires a server database, and for a 5h40m build the risk outweighs the benefit.
2. **Shared core, one source of truth.** `js/core/*` is pure logic with no DOM, so the same code
   serves the UI, the chat, the briefing and the tests.
3. **CMS as an in-app admin surface** behind a local passphrase, persisted to `localStorage` with
   JSON import/export. Honest limitation: not server-authenticated; stated in README.
4. **Fares from rules, never constants.** Editing a rule in the admin panel changes every surface.
5. **AI proposes, the graph disposes.** The model parses intent and phrases answers; `core/ground.js`
   validates every leg it produces before the UI shows a verified badge.

---

## 5. Improvement plan produced by this audit

Ordered by judged value per hour. Status updated as items land.

**Done in this pass**

1. ✅ Deterministic core hardened; 5 failing red tests fixed by correcting the model/constants
   (`SATURATION_MM` 12 → 10 so a real monsoon burst saturates the drainage model, wet-scenario
   threshold 6 → 5 mm/h, the nudge now forecasts the *peak* hour instead of the first wet one) and
   by correcting two wrong fixtures (dry hour, self-scaling on-time deadline).
2. ✅ Admin CMS (item 4), About-data + Demo mode (item 19), real EN/বাংলা translation (item 15).
3. ✅ Audio briefing + offline summary card (B2, item 20).
4. ✅ README rewritten for judges (serve, test, troubleshoot), `docs/ARCHITECTURE.md` and
   `DEMO_SCRIPT.md` added (item 22).

**Next, highest value first**

5. **Structured cards in chat (item 14).** Route answers should embed a mini ribbon card with a
   "Show on map" action instead of prose, and alert submissions in chat should return the created
   alert card. This is the last visible gap in a judged part.
6. **Chat tools properly (item 14).** Move from a context dump to explicit tool calls
   (`search_routes`, `compare_fares`, `submit_alert`, `get_alternate_route`, `explain_fare_rule`,
   `explain_alert_reliability`) using Gemini function calling, with the rule-based router as the
   fallback executor.
7. **Network browse + link index (item 3).** A read-only "Network" view listing all 114 links and 32
   hubs with mode/hub/student filters, so Part 1 browsing is demonstrable without the admin gate.
8. **Motion pass (item 17).** Fare odometer digits, route polyline draw-in, a reduced-motion-safe
   rain overlay, and `prefers-reduced-motion` verification.
9. **Offline PWA (D, item 21).** Service worker + app-shell cache + IndexedDB queue for reports;
   the routing engine already runs client-side, so this is packaging rather than new logic.
10. **Bonuses B3 then B1.** Ride-share board with the per-person fare-split bot, then signboard OCR
    via Gemini vision with an editable preview table and a manual-entry fallback.

**Deliberately cut**

- Server-authenticated admin (the brief asks for a demo-grade CMS, not auth infrastructure).
- Bangla numeral glyph toggle, QR deep links, and the `/design` styleguide route — all low judged
  value against their cost.
