# DhakaPath — Live Urban Transit & Route Intelligence

**IAIT National IT Fest 2026 · Smart City theme.** A multi-modal transit, fare-intelligence
and live street-alert platform for Dhaka: a real link graph rather than a list of fixed routes,
fares computed from rules, a disruption simulator that reroutes and shows the before/after, a
crowd-report ledger with decay and sanity checks, and a Gemini-powered dispatcher that is
**grounded against the graph** and works with no API key at all.

100% free stack: Leaflet + OpenStreetMap tiles, a zero-dependency Node server, and the Google
Gemini free tier (optional, server-side only). No paid APIs, no card-gated services.

---

## 1. Run it locally (the way the judges will)

Requirements: **Node 18+** (uses global `fetch`). Nothing to install — there are no dependencies.

```bash
git clone <your-repo-url> dhakapath
cd dhakapath
node server.mjs            # → http://localhost:8000
```

Open <http://localhost:8000>. That is the whole setup: the app boots with **no keys at all**
(local routing, OSM tiles, bundled sample forecast, rule-based AI fallback).

Windows note: run the same two commands in **Git Bash**, PowerShell or `cmd` — no paths to edit.

### Optional: turn on the AI and a nicer basemap

```bash
cp .env.example .env       # Windows: copy .env.example .env
```

then fill in the file and restart the server:

```bash
node server.mjs
```

A **free** Gemini key takes a minute: <https://aistudio.google.com/apikey> → *Create API key*
(no card required). Paste it as `GEMINI_API_KEY`. The app picks it up on restart and the header
badge flips from `OFFLINE` to the live model name. Remove the key and everything still works.

### Run the tests

```bash
npm test                   # 112 assertions, no network, no browser needed
```

The suite covers the deterministic engine the UI depends on: graph integrity, fare rules and the
student half-pass, the router and its transfer penalties, EN/Banglish parsing, grounding
validation, alert decay/corroboration/sanity checks, the Monte-Carlo arrival model, the
weather→flood model and the admin mutation surface.

### A one-command "is it alive" check

```bash
node server.mjs &          # start in the background (bash)
curl -s localhost:8000/api/config
```

---

## 2. What to look at (feature map, by judged part)

| Part | Where it lives in the UI | What to try |
|---|---|---|
| **P1 Transit & Street-Status CMS** | **Admin** tab (passphrase below) + **Live Alerts** tab | Edit a fare rule and watch every screen change; take a bus corridor out of service and watch the router detour; moderate reports (approve / hold / clear / delete); export or import the whole payload as JSON. |
| **P2 Multi-constraint search** | **Route Planner** tab, search box | `Mirpur theke Motijheel student, 9 tar moddhe`, `avoid Farmgate fastest to Uttara`, `Banasree to Dhanmondi minimum transfer`, `under 60 taka`. Parsed-intent chips appear as you type and show what the engine understood. |
| **P3 Fares + disruption rerouting** | Planner (fare ledger, **Live Conditions** panel) | Compare regular vs student for every mode, connector fare ranges with surge; then toggle heavy rain / peak rush / block a hub and watch broken legs turn red, the detour appear and the deltas print. |
| **P4 Validation & grounding** | **Live Alerts** tab + chat replies | Paste a Banglish Facebook-style post → sanity-checked, de-duplicated, decayed into the ledger; confirm an alert and watch confidence rise; the chat shows a *verified against the transit graph* verdict. |
| **P5 Conversational assistant** | **Transit AI** tab | Ask a route question, then a follow-up (`student hole koto?`). Works in EN or Banglish, with a labelled local estimate when Gemini is unavailable. |
| **Monsoon Shield** | Live Conditions → forecast scrub, Dhaka Pulse, nudge card | Drag the hour slider; risk follows Open-Meteo rainfall (or the bundled sample forecast offline). |
| **Arrive-By Guarantee** | Planner → *Arrive-By* (set a time) | On-time probability, leave-by time and a reliability badge per option, from a seeded Monte-Carlo run. |
| **Fair Fare Coach** | Planner → *Fair Fare Coach* | Type what a rickshaw driver asked: fair / a bit high / overcharge, a counter-offer and a Bangla script (with speak-aloud). |
| **Bonus B2** | Planner → *Play briefing* / *Offline card* | Spoken route briefing (`speechSynthesis`) and a downloadable high-contrast PNG summary for no-signal, low-battery situations. |
| **Demo mode** | Header button | One click, reproducible: student trip + arrive-by → heavy rain + Farmgate closed → predicted alerts. Use it as the live demo. |

### Admin passphrase

The **Admin** tab is gated by the demo passphrase **`dhakapath-admin`** (also printed in the panel
placeholder). It is a *demo lock*, not authentication: it edits the in-memory graph, persists
overrides to `localStorage` in your browser, and is deliberately not a server-side auth system.
Nothing in the graded app depends on it.

### Data disclaimer

Hub coordinates, link distances, fares, headways, flood-vulnerability values and the seeded street
reports are **realistic demo data** assembled for this prototype — not official BRTA/DMTCL/DNCC
figures and not a live feed. The in-app **About data** button states this, and every estimate is
labelled where it appears. Live pieces: Open-Meteo weather and OpenStreetMap tiles.

---

## 3. Architecture in one screen

```
index.html            markup + `data-action` hooks (no inline handlers) + `data-i18n` labels
css/tokens.css        design tokens (warm neutrals, mode colors, elevation, radius)
css/styles.css        components, map filter, motion, Bangla typography
js/core/*             PURE logic, no DOM — the single source of truth
  network.js            32 hubs · 114 directed links · fare rules · admin mutation surface
  fares.js              fare maths from FARE_RULES (per-km, floors, student %, surge, ranges)
  router.js             label-setting k-shortest search, transfer penalties, ranked options
  scenario.js           one disruption state: rain level, rush, blocked hubs → time multipliers
  alerts.js             lifecycle: decay half-lives, corroboration, dedupe, sanity checks
  parse.js              EN + Banglish intent parsing (hubs, budget, avoid, modes, student)
  ground.js             validates AI/route legs against the graph
  arrival.js            seeded Monte-Carlo travel times → P50/P90, on-time %, leave-by
  weather.js            Open-Meteo rain → predicted waterlogging, Dhaka Pulse, proactive nudge
  fareCoach.js          fair ranges, quote verdicts, bargaining scripts
js/state.js           the store: scenario + ledger + forecast + plan → cards for the renderers
js/{map,routes,alerts,fares,search,scenarioUi,chat,briefing,admin,demo,i18n,ui,events,main}.js
server.mjs            static host + GET /api/config + GET /api/weather + POST /api/chat
tests/run.mjs         112 assertions over js/core (npm test)
docs/ARCHITECTURE.md  formulas: routing cost function, fare rules, decay, flood model, grounding
DEMO_SCRIPT.md        the timed 4–5 minute demo + Q&A cheat sheet
ref/                  the competition brief and the scope/gap analysis (ref/scope.md)
```

Why client-side-first: the whole engine runs in the browser as ES modules, so the server stays a
thin proxy and the app deploys to any free static host (plus a Node host for the AI/weather
proxies). See `docs/ARCHITECTURE.md` for the formulas and the reasoning.

---

## 4. Environment (`.env`)

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Server-side key for `/api/chat`. Never sent to the browser. Optional. |
| `GEMINI_MODEL` | Primary model, e.g. `gemini-2.5-flash`. |
| `GEMINI_FALLBACK_MODELS` | Comma-separated models tried on `404` / `429` / `503`. |
| `GEMINI_THINKING_LEVEL` | `low` keeps thinking spend down (faster, no truncated answers). |
| `GEMINI_MAX_OUTPUT_TOKENS` | Thinking tokens count against this budget. |
| `GEMINI_TIMEOUT_MS` / `GEMINI_STREAM_TIMEOUT_MS` | Per-attempt and whole-stream timeouts. |
| `GEMINI_API_BASE` | Upstream API base — override for a gateway or a local mock. |
| `CARTO_API_KEY` | Optional public basemap key (Voyager tiles). OSM is the default. |
| `PORT` | Dev server port (default `8000`). |

`.env` is git-ignored; `.env.example` is the committed template. The Gemini key lives only in the
server process: the browser talks to `/api/chat`, never to Google. Rotate it in AI Studio if it is
ever pasted into a chat, ticket or commit.

The Gemini free tier allows ~20 requests per model per day; the server walks the fallback chain on
`429` and the chat falls back to a labelled local estimate if every model is exhausted.

---

## 5. API

| Route | Response |
|---|---|
| `GET /api/config` | `{ cartoKey, gemini: { enabled, model, streaming } }` — no secrets |
| `GET /api/weather` | Open-Meteo hourly rain/temperature for Dhaka (15-minute cache), or the labelled sample |
| `POST /api/chat` | `{ message, context, history }` → SSE stream |
| `POST /api/chat` with `{"stream":false}` | `{ reply, model }` — plain JSON, handy for scripted checks |

SSE frames:

```
data: {"type":"meta","model":"gemini-2.5-flash"}
data: {"type":"chunk","text":"The cheapest "}
data: {"type":"done","model":"gemini-2.5-flash","characters":103,"truncated":false}
```

Reasoning parts are dropped server-side, so internal thoughts never reach the browser.

---

## 6. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Blank page, `Failed to load module script` | You opened `index.html` via `file://`. ES modules need HTTP — run `node server.mjs` and use <http://localhost:8000>. |
| Header badge says `OFFLINE` | No `GEMINI_API_KEY` in `.env`, or the server was not restarted after editing it. Everything still works. |
| Chat answers "showing a local estimate" | Free-tier quota exhausted (`429`) or a bad key. The badge shows the model that answered when it works. |
| Map tiles missing | Tiles come from OpenStreetMap/CARTO; check connectivity. Routing, fares and the ledger are unaffected. |
| Port already in use | `PORT=8123 node server.mjs`. |
| Admin edits seem to persist after a reload | That is the feature — `Reset to demo seed` in the Admin tab clears the stored overrides. |

---

## 7. Deploying

Any free host works.

- **Static-only host** (Netlify, GitHub Pages, Cloudflare Pages, Vercel static): the app renders and
  runs fully offline — routing, fares, alerts, scenario simulation, arrival model and the local AI
  fallback all work. `/api/config` and `/api/weather` return 404, so the app labels itself offline
  and uses OSM tiles plus the bundled sample forecast.
- **Node host** (Render, Railway, Fly, a small VPS): run `node server.mjs`, set `GEMINI_API_KEY` in
  the host's environment, and both the AI dispatcher and live weather light up.

---

## 8. Honest limitations

- Demo data, deliberately labelled; not official fares or a live incident feed.
- The CMS is demo-grade (passphrase + `localStorage`), not server-authenticated.
- Connector fares (rickshaw/CNG/leguna) are modelled ranges from demo rules, not legal rates.
- The map is desktop-first: on phones the planner lives in the bottom sheet and the map stays
  full-screen; the fare calculator is a sidebar tool (`md:` and up).
- Offline mode is client-side (no service worker yet): the engine works with no network, but the
  page itself still needs to load once.
- Bonus tasks B1 (signboard photo → data) and B3 (ride-share board) are scoped in `ref/scope.md`
  and not built; B2 (audio briefing + offline card) is.
