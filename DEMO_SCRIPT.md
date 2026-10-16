# DEMO_SCRIPT.md — 4–5 minutes, plus 2 minutes of Q&A

Before you start: `node server.mjs`, open <http://localhost:8000>, full-screen the browser, and
click **Demo mode** once as a rehearsal. Reset with the *Reset* key in **Live Conditions** if a judge
asks you to run it again. Keep `npm test` output in a second tab — 112 green assertions is a strong
one-line answer to "does it actually work?".

Everything below is driven by the real app; nothing is scripted on a slide.

---

## 0:00–0:30 — Hook

> "Dhaka's transit problem isn't that we lack a map. It's that nobody can tell you whether you'll
> actually *arrive on time*, and nobody can tell you whether that rickshaw fare is fair. DhakaPath
> answers both — from a real link graph, not a hardcoded list."

Point at the header: **Dhaka Pulse** (city stress index from real rainfall), the **AI: model / offline**
badge, the data-disclaimer button. Say plainly: *"Demo data, labelled everywhere. Weather is live."*

## 0:30–1:30 — The search the brief asked for (Parts 2 + 3)

Type in the Planner search box, in Banglish:

```
Mirpur theke Motijheel student, 9 tar moddhe
```

- The **intent chips** appear as you type: `From Mirpur 10`, `To Motijheel`, `Student Half Pass` —
  *"that's the parser showing you what it understood, in Banglish, with no AI required."*
- Set the **Arrive-By** field to `09:00`. Options now carry **on-time %**, **P50/P90** and a
  **leave-by** time, from a seeded 2,000-run Monte-Carlo.
- Expand a card: per-leg **boarding and alighting landmarks** ("Board at Farmgate metro pillar-12
  side"), and the **fare ledger** with **regular vs student** side by side — ৳10 floor on buses,
  and a "why" line on modes where the half-pass does not apply.
- *"The metro is 6 minutes slower on average but 94% on time against 71% for the bus — that's a
  different answer from 'fastest route', and it's the one a commuter actually needs."*

Add a constraint live: `avoid Farmgate fastest to Uttara` → the plan changes and says why.

## 1:30–2:30 — Disruption simulation + rerouting (Part 3)

In **Live Conditions**:

1. Set rain to **Heavy**, flip **Peak rush**, then block **Farmgate** from the closures picker.
2. The affected legs turn **red/broken**, the map recolours the heat overlay, and the banner prints
   the **before/after deltas** (time, fare, transfers, options lost).
3. *"MRT-6 is on a viaduct, so street flooding never stops it. That's why the detour is 'take the
   metro', and it's computed — not a scripted alternative."*

Then click **Use live weather** — *"this is the actual Open-Meteo forecast for Dhaka right now"* —
and drag the **forecast scrub** slider across the afternoon: Jatrabari, Farmgate and Motijheel go
from Clear → Watch → Congested → Likely flooded. The **nudge card** names the peak hour and the
exposed corridor. Tap **Reset**.

## 2:30–3:15 — Trustworthy reports (Part 4)

**Live Alerts** tab → *Paste a post*:

```
Motijheel e pani jome gese, bus ashte deri hocche
```

- The same pipeline runs: parsed → **sanity-checked** → **de-duplicated** → tagged **Social post
  (unverified)** with a lower starting confidence. The verdict text says exactly what happened.
- Show an alert card's **freshness meter** draining, then click **Still there** — the confidence
  rises. Click **Cleared** — the routing weight drops to zero.
- Prove the hallucination guard is real: open the **Transit AI** tab and ask for a route via a
  station that does not exist. The answer is grounded: the *Verified against transit graph* badge
  only appears when the legs actually check out against the graph, and a bad fare or an unknown hub
  is rejected with a reason.
- *"Part 4 asks for validation, not just detection. Reports that fail a check go to the admin queue
  and do not touch routing until a human approves them."*

## 3:15–3:50 — Fair Fare Coach + admin

- In the fare panel, type what the driver asked: `150` for a 3 km rickshaw ride → **Overcharge**,
  with the fair band, a counter-offer and a **Bangla bargaining script** (play it — the browser
  speaks it, no API).
- Open the **Admin** tab, unlock with `dhakapath-admin`:
  - Change the bus length rate — *"every card, ledger, coach and chat answer moves, because there is
    only one fare table."* Reset it.
  - Take a bus corridor **out of service** and show the planner detour around it — that's Part 1
    CRUD feeding the router, not a mock.
  - Point at **Report moderation**: approve / hold / clear / delete, and the fact that held reports
    are excluded from routing. **Export JSON** hands the whole payload to a judge as a file.

## 3:50–4:30 — Bonus + resilience

- **Play briefing**: the selected plan is read aloud (legs, landmarks, fare, on-time odds, live
  disruptions) — hands-free, low-battery friendly.
- **Offline card**: download the PNG summary with the same content. *"No signal, no app, 8% battery,
  still have the plan."*
- Switch the language to **বাংলা** — the whole chrome, tabs, buttons and placeholders change and the
  Bangla font stack and line-height kick in; the choice persists.
- Kill the AI: rename the key in `.env`, restart, reload. The badge reads **OFFLINE**, the chat
  answers from the rule-based parser. *"The brief's rule is no AI, no excuses: everything still
  works."*

## 4:30–5:00 — Close

> "Three engines: a deterministic graph engine (routing, fares, reliability, weather risk), a
> crowd-report ledger with decay and sanity checks, and an LLM that is only allowed to parse intent
> and phrase answers — every claim it makes is re-validated against the graph. 100% free stack:
> Leaflet + OpenStreetMap, a zero-dependency Node server, and the Gemini free tier. 112 assertions
> cover the engine."

---

## Q&A cheat sheet (2 minutes)

**"How do you stop hallucinations?"**
The model never produces routes or fares — it gets a snapshot of the real graph as context and we
re-validate anything it says with `core/ground.js`: hub exists, a link of that mode connects those
two endpoints, consecutive legs connect, and any claimed fare is within 35% of the rule price.
Failures are dropped and reported. Everything is visible in the *Verified against transit graph*
badge. The UI's own plans pass the same validator.

**"What if Gemini is down or rate-limited?"**
The key is optional. The server walks a model fallback chain on 404/429/503; if all fail, the chat
uses the rule-based EN/Banglish parser and template replies, and the header badge says OFFLINE.
Nothing else in the app depends on the LLM at all.

**"How do you handle fake or stale reports?"**
Four layers: sanity checks (unknown hub/link, duplicate within 15 min → merged, spam from one
reporter, severity 5 with no description, contradictory "cleared", implausible fares) hold or reject
before routing; confidence decays exponentially (`0.5^(age/halfLife)`, per-type half-lives) → stale →
expired; crowd confirm/deny moves confidence and two confirmations promote a model prediction into a
report; and the admin queue can approve, hold, clear or delete with a logged reason.

**"How is the fare computed?"**
Per mode from one table: `min(maxFare, max(minFare, perKm × km) × surge)`, with a student discount
only where the rules grant one (buses: 50% with a ৳10 floor), negotiated ranges for rickshaw/CNG,
and **segment** pricing so ten metro hops are one MRT-6 journey fare with the ৳100 ceiling. Change
the table in the admin panel and every surface follows.

**"How does it scale?"**
The engine is pure, DOM-free ES modules over an in-memory graph: 32 hubs and 114 links now, and the
search is label-setting, so it is fine into the thousands of links. Server-side it is stateless
(static files + two proxies). The only O(route count × 2,000) step is the Monte-Carlo, which runs in
a few milliseconds and can move to a Web Worker.

**"Why not a real database / Google Maps?"**
The brief requires a 100% free, open stack and allows Leaflet + OSM. Client-side-first also means the
app deploys to any free static host and keeps working with no network and no keys.

**"Is the data real?"**
No — and we say so in the README and in the in-app *About data* modal. Coordinates, distances, fares,
headways and flood vulnerabilities are realistic estimates for the prototype. What is live is the
weather (Open-Meteo) and the map tiles (OpenStreetMap).
