

You are my senior full-stack engineer and hackathon teammate. We are competing in the **IAIT National IT Fest 2026 (INIF) Hackathon, Smart City theme**, with a hard time limit of **5 hours 40 minutes** from now. We must build **DhakaPath: Live Urban Transit & Route Intelligence**, a fully working, deployed, demo-ready app that is polished enough to win. Work autonomously, make decisions yourself, and only stop to ask me if something is truly blocking (e.g. I must paste an API key).

## 0. Hard rules (never break)

1. **100% free stack.** No paid APIs, no credit-card services, no Google Maps. Maps = **Leaflet + OpenStreetMap tiles** (no key). AI = **Google Gemini API free tier (Google AI Studio key)** via server-side calls only. Key lives in `.env` as `GEMINI_API_KEY` and is never sent to the browser or committed.
2. **The app must work even if Gemini is down, rate-limited, or has no key.** Every AI feature needs a deterministic fallback (rule-based Banglish/English parser, template-based chat replies). Show a small "AI: online / fallback mode" badge in the UI. This protects the live demo.
3. **The AI never invents data.** All routes, fares and stations come from the transit graph in the database. The LLM only (a) parses intent into structured JSON, (b) phrases explanations, (c) reads images for the OCR bonus. All routing and fare math is deterministic code, and every AI output is grounded and validated (Part 4).
4. Gemini model name must be configurable via `GEMINI_MODEL` env var. Before coding the AI layer, check the current Gemini API docs (WebFetch/WebSearch) for the current free-tier model names and SDK (`@google/genai`), and implement a fallback chain of 2 models plus the rule-based fallback.
5. Commit to git early and often with clear messages (the judges want a GitHub repo with source developed during the session). Do not leave the app in a broken state between phases; always keep `npm run dev` working.
6. Seed data is **realistic demo data**. Label it clearly as such in the README and in an "About data" modal. Do not claim it is official.

## 2. Domain model (SQLite tables; adapt as needed)

- `hubs` (id, name, name_bn, lat, lng, zone, landmark_note, status: normal|congested|blocked|flooded)
- `transit_links` (id, mode: bus|metro|leguna|rickshaw|cng|walk, route_name e.g. "Bus: Bikalpa", from_hub, to_hub, distance_km, base_time_min, base_fare_bdt, student_eligible bool, boarding_landmark, alighting_landmark, frequency_min, active)
- `fare_rules` (mode, per_km, min_fare, student_discount_pct, student_min_fare, surge_rain_mult, surge_rush_mult, metered bool). **Fare math reads from this table, not hardcoded constants.**
- `alerts` (id, type: waterlogging|construction|gridlock|blockade, hub_id or link_id, severity 1-5, description, reporter, created_at, last_verified_at, confirmations, resolutions, status: active|resolved|expired|flagged, confidence_score)
- `reports_log` / `rideshare_posts` / `chat_sessions` as needed.

### Seed data (must be rich enough to make search interesting)

- **14 hubs** with real-ish coordinates: Motijheel (23.7330, 90.4172), Banasree (23.7632, 90.4327), Malibagh (23.7489, 90.4141), Shahbagh (23.7385, 90.3958), Farmgate (23.7561, 90.3872), Science Lab (23.7395, 90.3836), Dhanmondi (23.7461, 90.3742), Mohammadpur (23.7662, 90.3589), Mirpur (Mirpur-10: 23.8069, 90.3687), Agargaon (23.7780, 90.3800), Mohakhali (23.7776, 90.4050), Badda (23.7806, 90.4262), Uttara (23.8759, 90.3795), Jatrabari (23.7104, 90.4350). Add Bangla names and a boarding-landmark note per hub.
- **MRT-6 metro line** as sequential stations Uttara North → … → Mirpur-10 → Agargaon → Farmgate → Shahbagh → Motijheel (and further if currently open; check quickly with a web search and note the date). Metro links between consecutive stations with distance-based fares; map metro stations to the nearest hub.
- **~10 bus routes** (e.g. Uttara–Farmgate–Motijheel style corridors, Mirpur–Mohammadpur–Science Lab–Motijheel, Banasree–Malibagh–Motijheel, Jatrabari–Motijheel, Badda–Mohakhali–Farmgate, etc.), **2 leguna routes**, **connector rickshaw/CNG segments** between hubs and metro stations (short, metered=false, range fares), plus **walking legs** (<=800 m, cost 0).
- Graph must be **connected with multiple alternative paths** between most hub pairs, so detours and re-ranking are meaningful.
- ~8 pre-seeded alerts at various ages and severities so the decay and corroboration features are visible on first load.

## 3. Features to build, mapped to the judging parts

### Part 1: Transit & Street-Status CMS
- Two sections: **Transit Network** and **Street Alerts**.
- Public browse: filter/search by mode, hub, student-eligible, status. Cards show mode, origin to destination, base BDT fare, student half-pass eligibility, est. time, boarding landmark.
- Admin area (simple password via `ADMIN_PASSWORD` env, default shown in README; no paid auth): CRUD on hubs, links, fare rules, boarding notes; moderate alerts (approve/resolve/flag/delete); fare-chart editor.
- Any commuter can submit an alert (form with map picker) without logging in.

### Part 2: Intelligent multi-constraint trip search
- **Natural-language search box** accepting English and Banglish, e.g. "Mirpur theke Motijheel under 60 taka student", "avoid Farmgate, fastest to Uttara", "Banasree to Dhanmondi minimum transfer", "Shahbag jabo metro diye".
- Pipeline: (1) Gemini structured-output parse into `{origin, destination, max_budget, student, avoid_hubs[], avoid_modes[], prefer: cost|time|transfers, depart_time/rush, weather}` → (2) **zod-validate**; unknown hubs resolved via fuzzy matching against hub names/aliases (Bangla + Banglish spellings) → (3) deterministic multi-criteria router.
- **Rule-based fallback parser** (regex/keywords/fuzzy match for Banglish tokens like theke, jabo, jete, taka, kom, druto, bhir, brishti, bondho) giving the same JSON shape.
- **Router:** k-shortest paths / label-setting search over the multi-modal graph with transfer penalties; return top 3-5 options, rank by cost/time/transfers (user-selectable and parse-driven), tag options as "Cheapest / Fastest / Fewest transfers". Respect avoid-hubs, budget, blocked links.
- Each leg shows: mode, from/to, fare, time, **boarding and alighting landmark instructions** ("Board at Farmgate Metro pillar-12 side, get off at Shahbagh, exit towards TSC") — bonus-grade detail.
- Map shows the chosen route as colored polylines per mode, hub status markers, and alert markers.

### Part 3: Dynamic fare estimation & disruption rerouting
- **Fare breakdown per leg and total**: regular vs student. Bus: 50% student discount with **10 BDT floor**; metro/rickshaw/CNG: student pass **not** applicable (driven by `fare_rules`, explain in UI with a small "why?" tooltip). Non-metered connectors show a **range** (baseline vs rush vs rain surge), e.g. "৳40–60 (rain surge ৳60–90)".
- **Scenario Simulation panel**: toggles/controls for (a) heavy rain + pick affected zones, (b) peak office rush hour, (c) blocked intersection/hub (click a hub). Applying them sets hub/link status, applies surge multipliers and time multipliers, then **automatically recomputes the selected trip**, highlights **broken segments in red**, and shows a **detour plan** with a before/after comparison (time Δ, cost Δ, transfers Δ). Include a "Reset scenario" button and a live "Active disruptions" banner.

### Part 4: Report validation & output grounding
- **Route grounding validator:** every AI-suggested route/chat answer is parsed back into leg objects and verified against the DB (route exists, station exists, adjacent, fare within rule bounds). Ungrounded items are removed or corrected and the UI shows a "✔ Verified against transit graph" badge (and in the chat, a collapsible "grounding report"). Write tests that feed it fake hallucinated routes.
- **Crowd corroboration & decay:** users can 👍 Confirm / ✔ Resolved on alerts. `confidence_score` rises with confirmations, **decays exponentially with time since last verification** (e.g. half-life by alert type: waterlogging 2h, gridlock 45m, construction 24h); below threshold → "stale" (downgraded, greyed), then auto-**expired**. Show a freshness bar and "last verified X min ago". Router weights alerts by confidence.
- **Sanity checks (rule-based):** reject/flag fare submissions outside plausible bounds for mode & distance; flag contradictory reports (e.g. "blocked" and "clear" on the same hub within minutes, severity 5 with no description, duplicate spam from the same session, hub that doesn't exist); flagged items go to an admin queue and **do not affect routing** until approved. Surface the reason ("Flagged: fare ৳500 for a 2 km rickshaw ride").

### Part 5: Conversational commute assistant (English + Banglish)
- Chat UI (floating panel plus full-page mode) with **session context** (server keeps last N turns + slots like current origin/destination/student flag).
- Capabilities via **function-calling/tool-use** wired to the same deterministic services: `search_routes`, `compare_fares`, `submit_alert` (through natural conversation, with a confirm step and sanity checks), `get_alternate_route` (avoid hub X), `explain_fare_rule`, `explain_alert_reliability`, `list_active_alerts`.
- Follow-ups like "what about student?", "ar kono option nai?", "why is that alert flagged?" must work using context.
- Replies show structured result cards (route cards with "Show on map" buttons), not just text.
- Quick-reply chips for the demo; fallback rule-based dialog manager when Gemini is unavailable.

### Bonus tasks (do all three, in this priority order)
1. **Audio/visual route briefing:** "Briefing" button on a route → concise spoken summary via `speechSynthesis` (English or Bangla voice if available, with a language toggle) + **downloadable offline summary card** (Canvas to PNG, high contrast, low-battery friendly: legs, fares, landmarks, active alerts, timestamp).
2. **Commuter ride-share board & fare-split bot:** per-hub community board; post "I want to go to X from hub Y at time T"; others join; **bot auto-calculates per-person cost** (with surge, rounding to ৳5) and posts it in the thread; sanity checks apply.
3. **Signboard/notice digitization:** upload a photo (bus signboard, fare chart, handwritten note) → Gemini vision extracts structured JSON → **editable preview table** → admin/user confirms → inserted into the DB after grounding + sanity validation. Must degrade gracefully (clear error + manual entry form) if the API fails.

## 4. UX and polish (this is what wins on demo day)

- Beautiful, consistent design: distinctive brand ("DhakaPath", a clean transit-map-inspired look with mode colors: bus, metro, leguna, rickshaw), good typography, smooth transitions, skeleton loaders, empty states, toasts. No default-template look.
- Main layout: map in the center, left search/results panel, right/bottom tabs (Alerts, Simulate, Chat). On mobile: bottom sheet.
- Language toggle **EN / বাংলা** for UI labels.
- A **"Demo mode" button** that loads a ready scenario (e.g. Mirpur → Motijheel, student, then triggers rain at Farmgate and shows the detour) so the live demo is one click and reproducible.
- Accessibility basics: labels, contrast, keyboard focus.
- Fast: no needless re-renders; API responses under ~300 ms for non-AI endpoints.

## 5. Process: how to work

1. **First 10 minutes:** do NOT code yet. Produce a short `PLAN.md` (architecture diagram in Mermaid, API list, DB schema, phase checklist with times). Then start.
2. Build in these phases; after each, run tests, run the app, commit, and tick the checklist in `PLAN.md`:
   - **P1 (0:00–0:30)** scaffold, DB schema, seed data, health check, base layout.
   - **P2 (0:30–1:30)** graph + router + fare engine + tests (the heart; it must be correct).
   - **P3 (1:30–2:20)** Transit/Alerts CMS, admin, alert submission, decay/corroboration, sanity checks.
   - **P4 (2:20–3:10)** map UI, route results with legs/landmarks, fare breakdown, scenario simulation and detours.
   - **P5 (3:10–4:00)** Gemini layer: NL parse + fallback, chat assistant with tools, grounding validator.
   - **P6 (4:00–4:40)** bonuses (audio/card, ride-share bot, signboard OCR).
   - **P7 (4:40–5:20)** polish, bug sweep, a11y, mobile, deploy, README, architecture doc.
   - **P8 (5:20–5:40)** demo rehearsal, freeze, tag `v1.0`. No new features after 5:20.
3. Use subagents/parallel work where it saves time (e.g. one agent writes tests/seed data while you build UI), but keep the main branch always runnable.
4. If a feature will not fit in time, cut scope on the *bonus* items, never on Parts 1–5 or on stability.
5. Test with real flows yourself (run the server, call the endpoints, check the UI via the dev server) before claiming something is done. Fix bugs found; don't just report them.

## 6. Deliverables checklist

- Working app, deployed online (free host) **and** runnable locally with the documented commands.
- GitHub-ready repo: clean structure, `.env.example`, `.gitignore`, `README.md` (what it is, features per Part, setup in under 5 commands, env vars, how to get a free Gemini key, deploy steps, data disclaimer, admin password, demo script), `docs/ARCHITECTURE.md` (system architecture, routing logic with cost function, fare engine rules, AI components and the grounding strategy, decay formula, limitations), screenshots folder.
- `DEMO_SCRIPT.md`: a **4–5 minute** timed demo script + 2-minute Q&A cheat sheet (likely questions: "how do you stop hallucinations?", "what if Gemini is down?", "how do you handle fake reports?", "how is the fare computed?", "how does it scale?") with crisp answers.
- Seed + reset scripts (`npm run seed`, `npm run reset-demo`).

## 7. Definition of done

I can open the app, type "Mirpur theke Motijheel student, 60 takar moddhe", see 3 ranked multi-leg options with landmarks and student vs regular fares on the map, click "Rain at Farmgate" and watch the route break and a detour appear with new time/cost, report a waterlogging alert through the chat, see a fake ₹ fare get flagged, watch an old alert decay, play the audio briefing, download the offline card, and do all of it with the Gemini key removed (fallback mode) without errors.

Start now: write `PLAN.md`, then begin Phase 1. Tell me only when you need the Gemini key (I'll put it in `.env`) or when a phase is complete.
