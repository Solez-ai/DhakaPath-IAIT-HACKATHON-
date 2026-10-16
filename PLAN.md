# DhakaPath plan

## Phase checklist

1. Stabilize app shell and runtime safety
2. Validate dataset-backed route/fare engine and map state
3. Finish route selection + map leg expansion
4. Verify weather/admin/report flows
5. Keep browser and CLI checks green before handoff

## Current status

- Route engine and fare model are dataset-backed and already passing the smoke suite.
- Modal crash paths are hardened.
- The next priority is making the active route visually expand on the map and ensuring the first route is automatically selected for a coherent UI narrative.

## Notes

- The app remains a browser-first transit dashboard using Leaflet + OSM tiles.
- All route and fare outputs are computed from the transit graph, not hardcoded ad hoc values.
- The next validation step is the project test suite plus a quick route selection sanity check in the browser.
