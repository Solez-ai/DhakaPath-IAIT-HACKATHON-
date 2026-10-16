import { state, mapContext } from './state.js';
import { getEnv } from './env.js';
import { LINKS, HUB_BY_ID, FARE_RULES, MODE_COLORS } from './core/network.js';

/* ===============================
   Map rendering
   ===============================
   Everything on the basemap is derived from the core network: 32 hubs, every
   link in the graph, the chosen route and a waterlogging heat layer. No place
   name is hardcoded here. */

const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const STATUS_COLORS = {
  normal: 'var(--ok)',
  ok: 'var(--ok)',
  watch: 'var(--warn)',
  congested: 'var(--warn)',
  flooded: 'var(--water)',
  blocked: 'var(--danger)'
};

const DEFAULT_VIEW = { center: [23.7809, 90.4074], zoom: 12 };

function basemapLayer() {
  const key = getEnv().cartoKey;
  if (key) {
    return {
      url: `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${encodeURIComponent(key)}`,
      attribution: `${OSM_ATTRIBUTION} &copy; <a href="https://carto.com/attributions">CARTO</a>`
    };
  }
  return { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: OSM_ATTRIBUTION };
}

export function initMap() {
  if (typeof L === 'undefined') return;

  const map = L.map('map', { zoomControl: false }).setView(DEFAULT_VIEW.center, DEFAULT_VIEW.zoom);
  mapContext.map = map;

  const basemap = basemapLayer();
  L.tileLayer(basemap.url, { attribution: basemap.attribution, maxZoom: 19 }).addTo(map);

  refreshMap();
}

/* Redraw every derived layer. Called after any scenario, alert or route change. */
export function refreshMap() {
  const map = mapContext.map;
  if (!map || typeof L === 'undefined') return;

  clearLayers(mapContext.map, ['linkLayers', 'riskLayers', 'hubMarkers', 'routeLayers', 'disruptedMarkers']);

  drawRiskHeat(map);
  drawLinks(map);
  drawRoute(map);
  drawHubs(map);
  updateLayerButton();
}

function clearLayers(map, keys) {
  keys.forEach(key => {
    const value = mapContext[key];
    if (value instanceof Map) {
      value.forEach(layer => map.removeLayer(layer));
      value.clear();
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(layer => map.removeLayer(layer));
      value.length = 0;
    }
  });
}

/* Waterlogging heat: one translucent circle per hub, radius scaled by risk. */
function drawRiskHeat(map) {
  state.hubs.forEach(hub => {
    const risk = hub.risk || 0;
    if (risk < 0.2) return;

    const circle = L.circle(hub.coords, {
      radius: 400 + risk * 1400,
      color: risk >= 0.75 ? 'var(--water)' : 'var(--warn)',
      weight: 1,
      opacity: 0.5,
      fillColor: risk >= 0.75 ? 'var(--water)' : 'var(--warn)',
      fillOpacity: 0.12 + risk * 0.3,
      interactive: false
    }).addTo(map);

    mapContext.riskLayers.push(circle);
  });
}

/* Every link in the graph, styled by mode. Metro draws as the heavy spine. */
function drawLinks(map) {
  const seen = new Set();

  LINKS.forEach(entry => {
    const pairKey = [entry.from, entry.to].sort().join('|') + entry.mode;
    if (seen.has(pairKey)) return;
    seen.add(pairKey);

    const from = HUB_BY_ID.get(entry.from);
    const to = HUB_BY_ID.get(entry.to);
    if (!from || !to) return;

    const isMetro = entry.mode === 'metro';
    const line = L.polyline([[from.lat, from.lng], [to.lat, to.lng]], {
      color: MODE_COLORS[entry.mode] || 'var(--ink-3)',
      weight: isMetro ? 4.5 : entry.mode === 'bus' ? 2.4 : 1.4,
      opacity: isMetro ? 0.9 : 0.4,
      dashArray: entry.mode === 'walk' ? '4, 5' : null
    }).addTo(map);

    line.bindTooltip(`${entry.routeName} · ${entry.km} km · ${FARE_RULES[entry.mode].label}`);

    // Broken/blocked links are the story during monsoon scenarios
    const status = state.hubs.find(hub => hub.id === entry.from)?.status;
    if (status === 'flooded') line.setStyle({ color: 'var(--danger)', opacity: 0.75, dashArray: '6, 6' });

    mapContext.linkLayers.push(line);
  });
}

function focusSelectedRoute(map, card) {
  if (!card?.plan?.legs?.length || typeof map.fitBounds !== 'function') return;

  const points = [];
  card.plan.legs.forEach(leg => {
    const from = HUB_BY_ID.get(leg.from);
    const to = HUB_BY_ID.get(leg.to);
    if (!from || !to) return;
    points.push([from.lat, from.lng], [to.lat, to.lng]);
  });

  if (!points.length) return;
  const bounds = L.latLngBounds(points).pad(0.45);
  map.fitBounds(bounds, { padding: [26, 26], maxZoom: 14, animate: true });
}

/* Highlight the legs of the selected option, one colour per leg. */
function drawRoute(map) {
  const card = state.routes.find(route => route.id === state.selectedRouteId) || state.routes[0];
  if (!card?.plan) return;

  if (state.selectedRouteId !== card.id) {
    state.selectedRouteId = card.id;
  }

  card.plan.legs.forEach(leg => {
    const from = HUB_BY_ID.get(leg.from);
    const to = HUB_BY_ID.get(leg.to);
    if (!from || !to) return;

    const coords = [[from.lat, from.lng], [to.lat, to.lng]];
    const glow = L.polyline(coords, {
      color: '#ffffff',
      weight: 13,
      opacity: 0.28,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);

    const line = L.polyline(coords, {
      color: MODE_COLORS[leg.mode],
      weight: 7,
      opacity: 0.98,
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(map);

    const popupHtml = `
      <div style="font-size:11px; line-height:1.4;">
        <strong>${card.title}</strong><br>
        ${from.name} → ${to.name}<br>
        <span style="color:${MODE_COLORS[leg.mode]}">${leg.mode.toUpperCase()}</span> · ${leg.km} km · ${leg.timeMin} min
      </div>`;

    line.bindPopup(popupHtml);
    line.bindTooltip(`${leg.mode}: ${from.name} → ${to.name} · ${leg.timeMin} min`);
    glow.bindTooltip(`${leg.mode}: ${from.name} → ${to.name}`);
    mapContext.routeLayers.push(glow, line);

    const startPoint = L.circleMarker([from.lat, from.lng], {
      radius: 5,
      color: 'var(--surface)',
      weight: 2,
      fillColor: MODE_COLORS[leg.mode],
      fillOpacity: 1
    }).addTo(map);
    startPoint.bindPopup(`<strong>${from.name}</strong><br>${leg.mode.toUpperCase()} boarding`);

    const endPoint = L.circleMarker([to.lat, to.lng], {
      radius: 5,
      color: 'var(--surface)',
      weight: 2,
      fillColor: MODE_COLORS[leg.mode],
      fillOpacity: 1
    }).addTo(map);
    endPoint.bindPopup(`<strong>${to.name}</strong><br>${leg.mode.toUpperCase()} alight`);
  });

  focusSelectedRoute(map, card);
}

function drawHubs(map) {
  state.hubs.forEach(hub => {
    const color = STATUS_COLORS[hub.status] || 'var(--signal)';
    const markerHtml = `<div class="custom-hub-marker w-6 h-6" style="border-color: ${color}">
      <i class="fa-solid fa-diamond text-[8px]" style="color: ${color}"></i>
    </div>`;

    const marker = L.marker(hub.coords, { icon: L.divIcon({ html: markerHtml, className: '', iconSize: [24, 24] }) }).addTo(map);
    marker.bindPopup(`
      <strong>${hub.name}</strong> <span class="text-ink-3">${hub.bn || ''}</span><br>
      ${hub.lines.join(' • ')}<br>
      Status: <strong>${hub.status.toUpperCase()}</strong><br>
      Monsoon risk: ${Math.round((hub.risk || 0) * 100)}%<br>
      <span class="text-ink-3">${hub.landmark}</span>
      ${hub.reports ? `<br><strong>${hub.reports}</strong> live report(s) here` : ''}`);

    // Warn / danger hubs belong to the toggleable overlay
    if (hub.status !== 'normal' && hub.status !== 'ok') mapContext.disruptedMarkers.push(marker);
    mapContext.hubMarkers.set(hub.id, marker);
  });

  if (!state.showDisruptedHubs) {
    mapContext.disruptedMarkers.forEach(marker => map.removeLayer(marker));
  }
}

function updateLayerButton() {
  if (typeof document === 'undefined') return;

  const button = document.getElementById('layerToggleBtn');
  const visible = state.showDisruptedHubs;
  if (button) {
    button.setAttribute('aria-pressed', String(visible));
    button.title = visible ? 'Hide disrupted hubs' : 'Show disrupted hubs';
    button.classList.toggle('border-signal', visible);
    button.classList.toggle('opacity-60', !visible);
  }

  const icon = document.getElementById('layerToggleIcon');
  if (icon) {
    icon.className = visible
      ? 'fa-solid fa-layer-group text-sm text-signal'
      : 'fa-solid fa-layer-group text-sm text-ink-3';
  }
}

export function toggleMapLayers() {
  state.showDisruptedHubs = !state.showDisruptedHubs;

  const map = mapContext.map;
  const markers = mapContext.disruptedMarkers;
  if (map) {
    markers.forEach(marker => {
      if (state.showDisruptedHubs && !map.hasLayer(marker)) marker.addTo(map);
      if (!state.showDisruptedHubs && map.hasLayer(marker)) map.removeLayer(marker);
    });
  }
  updateLayerButton();
}

export function centerOnUserLocation() {
  const map = mapContext.map;
  if (!map) return;

  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      position => map.flyTo([position.coords.latitude, position.coords.longitude], 14, { duration: 1 }),
      () => map.flyTo(DEFAULT_VIEW.center, 13)
    );
    return;
  }
  map.flyTo(DEFAULT_VIEW.center, 13);
}
