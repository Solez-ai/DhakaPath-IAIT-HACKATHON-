# DESIGN.md — DhakaPath Design System

> **How to use this file (paste to Claude Code):**
>
> "Read `DESIGN.md` completely. The app already exists and looks like generic AI output. Do NOT add features. Do this in order: (1) audit the current UI against Section 12 and write `docs/DESIGN_AUDIT.md` listing every violation; (2) install fonts and build tokens (Sections 3–6); (3) restyle every component per Section 8; (4) apply motion per Section 9; (5) run the Section 13 QA loop with Playwright screenshots at 375, 768 and 1440 px, in light and dark, and fix everything you find; (6) commit. Keep every existing feature working. Run the tests before each commit."

---

## 1. Design intent

DhakaPath should feel like **a piece of city infrastructure that someone carefully designed**, not like a SaaS template. Reference mood: metro wayfinding signage, printed transit maps, departure boards, a well-kept ledger. Warm paper, strong ink, one hot signal color. Confident, calm, dense where it matters, generous where it doesn't.

Three words: **Legible. Local. Alive.**

- **Legible:** a stressed commuter on a phone in bright sun can read it in two seconds. High contrast, big numerals, clear hierarchy.
- **Local:** Bangla is a first-class citizen, not a translation afterthought. Colors, tone and details feel Dhaka, not San Francisco.
- **Alive:** the city is moving, so the UI is too. Motion explains state changes (a route breaking, a detour appearing, an alert aging); it is never decoration.

## 2. Anti-"AI slop" rules (hard bans)

Never do any of the following. If you find one in the codebase, remove it.

1. No purple/indigo/blue-to-violet gradients. No gradient text. No gradient buttons. No "aurora" blobs or floating orbs.
2. No glassmorphism everywhere. Blur is allowed in at most one place (the map's floating control cluster), and subtle.
3. No emoji as icons or decoration (✨🚀🔥 etc.). Use a single icon set plus our custom mode glyphs (Section 8.1).
4. No "three identical rounded cards, each with an icon on top and centered text" layouts.
5. No centered hero with a big headline, subtitle and two buttons. This is an app, not a landing page; the map and search *are* the home screen.
6. No default Inter/Roboto/system-ui/Space Grotesk look. Use the fonts in Section 4.
7. No uniformly rounded-2xl everything, no pill-shaped everything, no drop shadows on everything. Use the radius and elevation system (Section 6).
8. No default Tailwind palette colors in the UI (`blue-500`, `gray-100`, …). Only design tokens.
9. No unstyled shadcn/Radix defaults. Primitives are fine for accessibility; every one must be fully re-skinned to this system.
10. No lorem ipsum, "Welcome to...", "Seamlessly", "Unlock", "Powerful", "Revolutionize", "Elevate", "Supercharge". Write real, specific microcopy (Section 11).
11. No generic spinners. Use content-shaped skeletons or the custom loaders (Section 9).
12. No decorative sparkle icon to mark AI features. AI is shown honestly through function (parsed-intent chips, verified badges), not branding.
13. No pure `#000` / `#fff` surfaces, no pure grey ramps. Everything is slightly warm (light) or green-black (dark).
14. No default Leaflet look: default blue pin, default zoom buttons, raw OSM colors. All restyled (Section 8.9).
15. No animation that blocks interaction, loops forever without purpose, or exceeds the duration budget (Section 9).

## 3. Color tokens

Define as CSS variables on `:root` and `[data-theme="dark"]`, mirrored into the Tailwind theme (`bg-paper`, `text-ink`, `border-line`, …). Provide `prefers-color-scheme` default plus a manual toggle that persists.

### Neutrals (warm)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | `#F5F2EA` | `#0E1311` | App background |
| `--surface` | `#FBF9F4` | `#151B18` | Cards, panels |
| `--surface-2` | `#EFEBE1` | `#1C2420` | Inset areas, table stripes |
| `--line` | `#DDD7C8` | `#26302B` | Hairlines, borders |
| `--line-strong` | `#C4BCA8` | `#36433C` | Inputs, dividers that matter |
| `--ink` | `#15191C` | `#ECE8DE` | Primary text |
| `--ink-2` | `#4A5157` | `#B4B2A8` | Secondary text |
| `--ink-3` | `#7A8087` | `#80857F` | Tertiary, placeholders (check contrast!) |

### Brand and semantic

| Token | Light | Dark | Use |
|---|---|---|---|
| `--signal` | `#C8401A` | `#F0653A` | Primary action, active route, brand accent (vermilion, rickshaw-art / signal-lamp feel) |
| `--signal-ink` | `#FFFFFF` | `#1A0A04` | Text on signal |
| `--signal-wash` | `#F6DDD3` | `#2B1710` | Soft backgrounds for signal |
| `--ok` | `#1F7A4D` | `#4FBF85` | Normal / verified / fresh |
| `--warn` | `#B97700` | `#E8A82E` | Congested / stale |
| `--danger` | `#B42318` | `#F2695E` | Blocked / broken segment / overcharge |
| `--water` | `#2F6DA3` | `#6BA6DD` | Waterlogging / rain / flood risk |

### Transport mode colors (used for lines, glyphs, chips; always paired with a glyph, never color alone)

| Mode | Token | Light | Dark | On-color |
|---|---|---|---|---|
| Metro (MRT-6) | `--m-metro` | `#0E6B4D` | `#3FBF93` | white / ink |
| Bus | `--m-bus` | `#D98E04` | `#F0B23A` | ink |
| Leguna | `--m-leguna` | `#137A86` | `#46BCCB` | white / ink |
| Rickshaw / CNG (connector) | `--m-connector` | `#8E3B6B` | `#D17BAE` | white / ink |
| Walk | `--m-walk` | `--ink-3` | `--ink-3` | dashed line |

Rules: Verify every text/background pair reaches **WCAG AA (4.5:1 body, 3:1 large/UI)** with a small script (`scripts/check-contrast.ts`) and fix tokens that fail. Surfaces use `--surface` with a 1px `--line` border by default; **borders over shadows**.

Subtle texture (optional, tasteful): a 3% opacity SVG paper-grain on `--paper`, and a faint 24px dotted "map grid" on empty states. Never on text-heavy areas.

## 4. Typography

Self-host with `@fontsource` / `@fontsource-variable` (works offline for the PWA, no Google Fonts request, fast). `font-display: swap`, preload the two most-used weights, subset where possible.

| Role | Latin | Bangla | Notes |
|---|---|---|---|
| Display / headings | **Schibsted Grotesk** 600–700 | **Anek Bangla** 600–700 | Tight, confident, signage-like |
| UI / body | **Hanken Grotesk** 400–600 | **Hind Siliguri** 400–600 | Neutral, very legible |
| Numerals: fares, times, distances, IDs | **Geist Mono** (or IBM Plex Mono) 500, `font-variant-numeric: tabular-nums` | Bangla digits via **Anek Bangla** when BN-numerals is on | Departure-board feel; numbers never jump width when animating |

Font stacks must put the Bangla family right after the Latin one so mixed text renders correctly; set `lang` attributes on elements so the browser picks glyphs properly.

### Type scale (fluid, 1.2 ratio, `clamp()` for headings)

`--t-xs 12/16` · `--t-sm 14/20` · `--t-base 16/24` · `--t-md 18/26` · `--t-lg 22/28` · `--t-xl 28/32` · `--t-2xl 36/40` · `--t-fare 40/44 (mono, bold)`

Rules:
- Bangla needs more line-height: multiply by ~1.15 for `[lang=bn]` and never use letter-spacing or italics on Bangla.
- Headings: tight tracking (-0.01em to -0.02em), `text-wrap: balance`. Body: `text-wrap: pretty`.
- Max 2 weights per screen region. Use size and color for hierarchy before using bold.
- ALL-CAPS only for tiny labels (`--t-xs`, +0.06em tracking), never for sentences.
- **Money always renders as `৳ 60`** with a thin space and mono numerals; ranges as `৳ 40–60`; strikethrough old fare in `--ink-3`.

## 5. Spacing, layout, grid

- 4px base scale: `4, 8, 12, 16, 24, 32, 48, 64`. No arbitrary values.
- Desktop (≥1100px): 3 zones: **left panel 400px** (search + results), **map fills the rest**, **right drawer 380px** (alerts/simulate/chat tabs, collapsible). Panels float on the map with 12px margins and 1px borders, not full-bleed sidebars.
- Tablet: left panel + map; drawer as overlay.
- Mobile (<768px): map full-screen with a **bottom sheet** (3 snap points: peek 96px / half / full) holding search and results; bottom tab bar (Plan · Alerts · Simulate · Chat · More) with 44px+ targets inside the thumb zone.
- Content max-width inside panels is fluid; admin/CMS pages use a 12-column grid, max 1200px.
- Information density: results are compact but breathable. Primary info (total fare, time, transfers) is scannable in one glance; details live behind progressive disclosure (expand a leg).

## 6. Radius, elevation, borders

- Radius: `--r-sm 6px` (inputs, chips, buttons) · `--r-md 10px` (cards) · `--r-lg 16px` (sheets, modals) · `--r-full` only for avatars, status dots, toggles. Nested radii follow the rule `inner = outer − padding`.
- Elevation (3 levels, layered, low-opacity, warm-tinted, not black):
  - `--e-0`: none, 1px `--line` border (default).
  - `--e-1`: `0 1px 2px rgb(40 30 10 / .06), 0 4px 12px rgb(40 30 10 / .05)` (floating panels).
  - `--e-2`: `0 8px 24px rgb(40 30 10 / .12), 0 2px 6px rgb(40 30 10 / .08)` (modals, sheets, popovers).
- Focus ring: 2px `--signal` + 2px `--paper` offset, always visible on keyboard focus.

## 7. Iconography

- One base set: **Phosphor Icons** (regular weight, duotone sparingly) or Lucide at 1.5px stroke, consistent 20px/24px sizes. Never mix sets.
- **Custom mode glyphs** (hand-built SVG, 24px, same stroke weight): metro train, bus, leguna, rickshaw, CNG, walking figure. Each sits in a mode-colored rounded-square "badge" like a signage plaque. Put them in `src/design/glyphs/`.
- **Brand mark:** wordmark "DhakaPath" in Schibsted Grotesk with a custom glyph where the "D" counter is formed by a route line with two station nodes; Bangla lockup "ঢাকাপথ". Generate the SVG logo, favicon, PWA icons (192/512, maskable) and an OG image.

## 8. Components (spec)

Build as a small internal library in `src/components/ui/` and a **`/design` styleguide route** (dev-only) that shows every component in every state, light and dark, EN and BN.

### 8.1 Signature: **Route Ribbon**
The hero component. A route is drawn like a metro line diagram: a vertical (mobile) or horizontal (desktop) colored line per leg using the mode color; **station nodes** are rings, **transfer nodes** are larger double rings; mode glyph plaque at the start of each leg; boarding/alighting landmark as small caption text beside the node; fare and time in mono at the leg's right edge; **walk legs are dashed**; a broken leg shows a red hazard hatch and a "broken" tag. Tapping a leg expands boarding instructions with a smooth height animation.

### 8.2 Intent-aware search bar
Command-bar style input (single field, large, `/` to focus, `⌘K`/`Ctrl K` to open). As the user types, **parsed-intent chips** appear beneath, live: `From Mirpur → To Motijheel`, `Student`, `≤ ৳60`, `Avoid Farmgate`, `Fastest`. Chips are editable/removable and are the visible proof the system "understood". Unknown tokens are underlined with "Did you mean…?" suggestions. Banglish examples cycle as the placeholder (typed-out effect, pauses on focus).

### 8.3 Result card
Compact row: tags (Cheapest / Fastest / Fewest transfers / Most reliable) as small label tabs, then a mini ribbon preview (colored segments proportional to time), then `৳` total (mono, large), time, transfers, on-time %. Selected card gets a 2px `--signal` left rail, not a full outline glow.

### 8.4 Fare breakdown ("ledger")
A receipt/ledger look: monospaced right-aligned amounts, dotted leaders from label to amount, a double rule above the total, regular and student columns side by side, student column shows strike-through and a small "50% off, min ৳10" tag, and a "why?" tooltip for modes where student pass doesn't apply. Surge ranges show a mini range bar (baseline to rain-surge).

### 8.5 Alert card
Left edge: severity stripe. Type glyph (water drop / cone / traffic / barrier), title, hub, description. **Freshness meter:** a thin segmented bar that drains as confidence decays (color shifts ok → warn → grey), with "verified 12 min ago". Actions: `Still there` / `Cleared` as two compact buttons with counters. Predicted alerts use a dashed border and a "Model" tag. Flagged alerts show a hatch pattern and the reason.

### 8.6 Scenario panel
Looks like a **control board**: physical-feeling toggle switches and a segmented selector (Clear / Rain / Heavy rain), "Peak rush" switch, "Block hub" picker, and a big "Reset" key. A live "Active disruptions" strip above the map lists current effects as removable tags. Before/after comparison is a two-column delta view with ▲/▼ and colored deltas (time, cost, transfers).

### 8.7 Chat
Not an iMessage clone. A "dispatch desk" look: assistant messages are left-aligned plain text blocks with a thin left rule; user messages are right-aligned in `--surface-2`; assistant answers embed **structured cards** (Route Ribbon mini, fare ledger, alert) with a "Show on map" action. Suggestion chips above the input. Typing indicator: three dots that travel along a tiny line like a bus moving between stops. Show the "Verified against transit graph" badge under grounded answers.

### 8.8 Buttons, inputs, chips, toggles, tabs, tooltips, toasts, modals, sheets
Rules in one place:
- Primary button: solid `--signal`, `--signal-ink` text, 40px height (48px on mobile), `--r-sm`. Secondary: 1px `--line-strong`, transparent. Ghost: text only. One primary per view.
- Inputs: 44px, 1px `--line-strong`, label above (never placeholder-only), inline validation messages in plain language.
- Tabs: sliding underline indicator (shared layout animation).
- Toasts: bottom-left desktop / top mobile, 4s, swipe to dismiss, can include Undo.
- Modals: only for destructive/confirm flows; sheets for everything else.

### 8.9 Map styling
- Tiles: keep OSM (free) but apply a **CSS filter** on the tile pane: `grayscale(.85) sepia(.15) contrast(.92) brightness(1.03)` in light; invert + hue-rotate tuned for dark. Result: calm, paper-like base so routes pop.
- Custom `divIcon` hub markers: ringed circle with the hub's status color, small label plate with name (EN/BN) that collapses at low zoom (progressive labelling).
- Route polylines: 6px mode-colored line with 2px paper casing; walk legs dashed; broken segment red with hatch and a pulsing end-cap; detour drawn in `--ok`.
- Custom zoom/locate controls matching the system; attribution kept small but present (required).
- Schematic fallback map (SVG node graph) uses the same line language, like a printed transit map with 45° angles.

### 8.10 Empty, loading, error states
- Each has a small custom SVG line illustration (route line, rickshaw, umbrella; consistent 2px stroke, monochrome with one `--signal` accent), a one-line honest message and one action.
- Skeletons mirror the real layout (ribbon-shaped skeleton for results).
- Errors say what happened and what to do; AI-offline state is calm ("Smart parsing is offline, using basic search. Everything still works.").

## 9. Motion (micro-animations)

Library: **Motion** (`motion` / framer-motion, free) for React layout/gestures and CSS for simple states. Animate **transform and opacity only** (plus `stroke-dashoffset`, `clip-path`); never layout-thrashing properties.

### Motion tokens
- Durations: `instant 90ms` · `fast 140ms` · `base 220ms` · `slow 320ms` · `signature 700–1200ms` (route draw only).
- Easings: `--ease-out: cubic-bezier(.22,1,.36,1)` (enter) · `--ease-in: cubic-bezier(.64,0,.78,0)` (exit) · `--ease-inout: cubic-bezier(.65,0,.35,1)` · spring `{ stiffness: 420, damping: 32 }` for toggles/sheets, `{ stiffness: 260, damping: 26 }` for cards.
- Stagger: 30–45ms between list items, max 8 items animated (rest appear instantly).
- Honor `prefers-reduced-motion`: replace movement with 120ms opacity fades; no parallax, no particles, no looping. Provide an in-app "Reduce motion" toggle too.

### Required micro-interactions (implement all, tasteful, consistent)
1. **Press feedback:** buttons/cards scale to 0.97 on press with fast ease-out; release springs back.
2. **Route draw-in:** selecting a result draws the polyline along its path (`stroke-dashoffset`), then station nodes pop sequentially; map `flyToBounds` with eased 800ms.
3. **Ribbon build:** legs of the Route Ribbon stagger in top-to-bottom; the line grows to meet each node.
4. **Fare roll:** totals animate with a **rolling odometer** per digit (tabular mono, 400ms) when values change (student toggle, surge, reroute); brief color flash green/red on decrease/increase.
5. **Student toggle:** the strike-through on the old fare draws left-to-right, the new amount slides in.
6. **Intent chips:** chips pop in with a tiny spring as the parser recognizes tokens; removed chips shrink out; recalculation triggers a thin progress line along the top of the search bar.
7. **Hub status change:** marker ring pulses once (expanding fade ring); blocked hubs get a slow 2s soft pulse until resolved.
8. **Broken segment:** on disruption, the affected polyline segment flickers twice, turns red with hatch, one subtle 4px shake on its card; then the **detour draws in** in green after a 250ms beat. Before/after deltas count up.
9. **Rain scenario:** very low-opacity canvas rain streaks over the map (≤ 40 particles, paused when tab hidden or reduced-motion), hub ripples at flooded zones, `--water` tinted vignette fades in. Toggle off fades out in 300ms.
10. **Scenario switches:** spring toggles with a tiny overshoot; the "Active disruptions" strip tags slide in/out with layout animation.
11. **Alert freshness:** the meter drains smoothly in real time (CSS animation tied to the decay formula); "Still there" press adds a ripple, counter ticks, and the meter refills with an ease-out sweep.
12. **Alert arrival:** new alerts slide in from the top of the list with a brief highlight wash that fades over 1.2s; the map marker drops in with a small bounce.
13. **Tabs:** shared-layout sliding underline; panel content crossfades with 8px vertical drift.
14. **Bottom sheet:** drag with velocity-aware snapping and rubber-band at the limits; backdrop dims map slightly (opacity only).
15. **Cards:** hover (desktop) lifts 2px with the e-1 shadow fade-in; focus-visible ring animates in.
16. **Expand/collapse:** height animations use measured heights, content fades in 60ms after expansion starts.
17. **Skeleton shimmer:** a slow diagonal light sweep (1.6s), disabled on reduced motion.
18. **Chat:** messages rise 8px + fade; the bus-between-stops typing indicator; structured cards in replies stagger in; "Show on map" press animates a connecting line from card to the map hub briefly.
19. **Verified badge:** on grounding success, the check mark draws itself (stroke animation, 300ms) next to a one-time soft ring.
20. **Toasts & success:** slide + fade; successful submit (report posted, ride joined) shows a small route-line "checkmark" stroke animation instead of a generic tick.
21. **Number-like data in alerts/pulse index:** "Dhaka Pulse" gauge needle/ring eases to new value; color blends between ok → warn → danger.
22. **Page/route transitions:** shared-element transition for card → detail (View Transitions API when available, else Motion layoutId), 220ms.
23. **Offline badge:** when connectivity drops, the badge slides down and the status dot goes amber; on reconnect it turns green, then retracts after 2s.
24. **Mobile haptics:** `navigator.vibrate(8)` on toggle/confirm when supported (feature-detected, respects reduce-motion).
25. **Cursor/hover details (desktop):** link underlines grow from the left; icon buttons show tooltips after 400ms; map hover on a route highlights its ribbon and vice versa (bi-directional linking).

Performance budget: 60fps on a mid-range Android; no animation JS blocking input; lazy-load heavy motion code; the rain canvas and map animation must not reduce map panning to < 50fps (test and cut if it does).

## 10. UX principles

- **Map-first, task-first.** The first screen is the map plus an obvious "Where to?" field. No marketing screen, no onboarding carousel. A 3-step skippable coach-mark tour only on first visit.
- **Progressive disclosure:** show total fare/time/transfers first; legs, landmarks, surge and reliability on demand.
- **Show system state honestly:** AI online/fallback, data freshness ("alerts updated 2 min ago"), predicted vs reported, verified vs unverified.
- **Forgiving input:** fuzzy hub matching, Banglish tolerance, undo on destructive actions, never lose the user's query on error.
- **Speed:** optimistic UI for confirms/reports, instant client-side routing (shared core), skeletons under 100ms, no layout shift (reserve space).
- **One-thumb mobile:** primary actions in the bottom 40% of the screen; sheets draggable; no hover-only affordances.
- **Keyboard & a11y:** full keyboard navigation, visible focus, ARIA for map controls and live regions (`aria-live="polite"` for alert updates), 44px targets, color never the only signal, screen-reader labels for all glyphs, Bangla `lang` attributes.
- **Bilingual by design:** EN/বাংলা switch in the top bar, persisted; layouts tested with longer Bangla strings; numerals toggle.
- **Consistency:** the same status always uses the same color+glyph+word everywhere (map, cards, chat, briefing card).

## 11. Voice and microcopy

Calm, direct, a little local warmth. Short sentences. No hype, no robotic filler, no exclamation marks except in rare success moments.

Examples (write all UI copy this way, in EN and BN):
- Search placeholder (cycling): `Mirpur theke Motijheel, student` · `Avoid Farmgate, fastest to Uttara` · `9 tar moddhe Shahbagh`
- Empty alerts: `No active reports nearby. Roads look clear. Spot something? Tell us.`
- AI offline: `Smart parsing is offline. Using basic search. Everything still works.`
- Flagged report: `Held for review: ৳500 looks too high for a 2 km rickshaw ride.`
- Stale alert: `Not re-confirmed for 2 hours. Treating this as old.`
- Fare coach: `Fair range ৳40–60. Start at ৳40.`
- Errors: `Couldn't reach the weather service. Showing the last forecast from 14:05.`
- Buttons are verbs: `Plan trip`, `Still there`, `Cleared`, `Report problem`, `Share route`, `Play briefing`.

## 12. Implementation checklist

- [ ] Tokens in `src/design/tokens.css` + Tailwind theme; delete unused default palette usage across the codebase (grep for `blue-`, `gray-`, `slate-`, `indigo-`, `purple-`, `violet-`, `gradient`).
- [ ] Fonts self-hosted, with Bangla pairing and mono numerals; verify the fonts actually load (no fallback flash in screenshots).
- [ ] Logo, favicon, PWA icons, OG image generated as SVG/PNG.
- [ ] Custom mode glyphs + icon set unified.
- [ ] All components in Section 8 built, themed, dark-mode correct, with focus/hover/active/disabled/loading/error states.
- [ ] `/design` styleguide route showing every component, state, theme, language.
- [ ] Map restyled (tile filter, markers, polylines, controls).
- [ ] All 25 micro-interactions implemented; reduced-motion verified.
- [ ] Contrast script passes AA on all token pairs.
- [ ] Empty/loading/error states are custom (no generic spinners).
- [ ] Copy rewritten per Section 11 in EN and BN.
- [ ] Remove every Section 2 violation.

## 13. QA loop ("don't ship slop")

Use Playwright (free) to automate; **look at the screenshots yourself and critique them like a harsh art director.**

1. Screenshot these views at **375, 768 and 1440 px**, light and dark, EN and BN: home/search, results with ribbon, fare ledger, alerts list, scenario active with broken route + detour, chat, admin CMS, ride-share board, empty states, error states.
2. For each screenshot, answer: *Does this look like a generic template? Is the hierarchy obvious in 2 seconds? Any default-looking control left? Any misaligned spacing (off the 4px scale)? Any text under 4.5:1 contrast? Any Bangla glyph clipping or awkward line breaks?* Fix, re-shoot, repeat until clean.
3. Record a short Playwright trace of the main demo flow and check animations for jank, overlong durations, and anything that blocks a click.
4. Run Lighthouse (local, free): target **Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, PWA installable.** Run `axe` checks for a11y.
5. Run the **Slop Audit**: grep the codebase and rendered DOM for the Section 2 banned patterns and list results in `docs/DESIGN_AUDIT.md` (before and after).
6. Final pass in a mobile device emulator (Pixel 7 + iPhone 14) with network throttled to "Fast 3G" to make sure skeletons, fonts and offline badge behave well.

## 14. Priority if time is short

1. Tokens + fonts + dark mode + logo (biggest "not AI" jump, ~30 min)
2. Route Ribbon + fare ledger + result cards
3. Map restyle (tile filter, custom markers, route draw-in)
4. Scenario motion (broken segment → detour), fare roll, alert freshness meter
5. Intent chips in the search bar
6. Chat restyle and remaining micro-interactions
7. Styleguide route and the full QA loop

Never trade stability for polish: after each step the app must still run and the tests must pass.
