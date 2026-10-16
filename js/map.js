import { state, mapContext } from './state.js';
import { getEnv } from './env.js';
import { LINKS, HUB_BY_ID, FARE_RULES, MODE_COLORS } from './core/network.js';

/* ===============================
   Map rendering
   ===============================
   Everything on the basemap is derived from the core network: every hub and link
   in Map Data, plus the selected route and any disruption layer. */

const DEFAULT_VIEW = { center: [90.4074, 23.7809], zoom: 11.5, bearing: -14, pitch: 42 };
const MODE_HEX = {
  metro: '#006747',
  bus: '#D98E04',
  walk: '#7A8087',
  default: '#64748b'
};

const STATUS_COLORS = {
  normal: '#22B07D',
  ok: '#22B07D',
  watch: '#F59E0B',
  congested: '#F59E0B',
  flooded: '#0EA5E9',
  blocked: '#EF4444'
};

function mapStyleUrl() {
  return 'https://tiles.openfreemap.org/styles/liberty';
}

function asHex(color) {
  if (!color) return MODE_HEX.default;
  const value = String(color).trim();
  if (value.startsWith('#')) return value;
  if (value.startsWith('var(')) {
    const key = value.match(/--([a-z-]+)/i)?.[1];
    if (key === 'm-metro') return MODE_HEX.metro;
    if (key === 'm-bus') return MODE_HEX.bus;
    if (key === 'm-walk') return MODE_HEX.walk;
  }
  return MODE_HEX.default;
}

function lineCoordinatesFromLink(link) {
  if (!link) return null;
  const geometry = Array.isArray(link.geometry) && link.geometry.length > 1 ? link.geometry : null;
  if (geometry) {
    const points = geometry.map(([lat, lng]) => [Number(lng), Number(lat)]);
    return points.filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
  }

  const from = HUB_BY_ID.get(link.from);
  const to = HUB_BY_ID.get(link.to);
  if (!from || !to) return null;
  return [[from.lng, from.lat], [to.lng, to.lat]];
}

function routeGeoJson(card) {
  const features = card.plan.legs.map(leg => {
    const from = HUB_BY_ID.get(leg.from);
    const to = HUB_BY_ID.get(leg.to);
    const link = LINK_BY_ID.get(leg.linkId)
      || LINK_BY_ID.get(`${leg.lineId}:${leg.from}>${leg.to}`)
      || LINK_BY_ID.get(`${leg.lineId}:${leg.to}>${leg.from}`)
      || LINK_BY_ID.get(`walk:${leg.from}>${leg.to}`)
      || LINK_BY_ID.get(`walk:${leg.to}>${leg.from}`);

    const coords = lineCoordinatesFromLink(link) || (from && to ? [[from.lng, from.lat], [to.lng, to.lat]] : null);
    if (!coords || coords.length < 2) return null;

    return {
      type: 'Feature',
      properties: {
        id: `${card.id}:${leg.from}>${leg.to}`,
        color: asHex(MODE_COLORS[leg.mode] || MODE_HEX.default),
        mode: leg.mode,
        name: `${from?.name || leg.from} → ${to?.name || leg.to}`
      },
      geometry: {
        type: 'LineString',
        coordinates: coords
      }
    };
  }).filter(Boolean);

  return { type: 'FeatureCollection', features };
}

function ensureMapSource(map, id, data) {
  if (!map || typeof map.getSource !== 'function' || typeof map.addSource !== 'function') return;
  const source = map.getSource(id);
  if (source) {
    if (typeof source.setData === 'function') source.setData(data);
    return;
  }
  map.addSource(id, { type: 'geojson', data });
}

function clearLayers(map, keys) {
  if (!map) return;

  ['route-source', 'route-glow', 'route-line', 'link-source', 'hub-source', 'risk-source'].forEach(id => {
    if (typeof map.getLayer === 'function' && map.getLayer(id)) map.removeLayer(id);
    if (typeof map.getSource === 'function' && map.getSource(id)) map.removeSource(id);
  });

  keys.forEach(key => {
    const value = mapContext[key];
    if (Array.isArray(value)) {
      value.forEach(layerId => {
        if (typeof map.getLayer === 'function' && map.getLayer(layerId)) map.removeLayer(layerId);
        if (typeof map.getSource === 'function' && map.getSource(layerId)) map.removeSource(layerId);
      });
      value.length = 0;
      return;
    }

    if (value instanceof Map) {
      value.forEach(layerId => {
        if (typeof map.getLayer === 'function' && map.getLayer(layerId)) map.removeLayer(layerId);
        if (typeof map.getSource === 'function' && map.getSource(layerId)) map.removeSource(layerId);
      });
      value.clear();
    }
  });
}

export function initMap() {
  if (typeof maplibregl === 'undefined') return;

  const map = new maplibregl.Map({
    container: 'map',
    style: mapStyleUrl(),
    center: DEFAULT_VIEW.center,
    zoom: DEFAULT_VIEW.zoom,
    pitch: DEFAULT_VIEW.pitch,
    bearing: DEFAULT_VIEW.bearing,
    antialias: true,
    attributionControl: true
  });

  mapContext.map = map;
  map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), 'top-right');
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }), 'bottom-left');

  map.once('load', () => {
    refreshMap();
  });
}

export function refreshMap() {
  const map = mapContext.map;
  if (!map) return;

  if (typeof maplibregl !== 'undefined' && typeof map.isStyleLoaded === 'function') {
    if (!map.isStyleLoaded()) {
      map.once('load', refreshMap);
      return;
    }

    const showFocusOnly = Boolean(state.selectedRouteId);
    clearLayers(map, ['linkLayers', 'riskLayers', 'hubMarkers', 'routeLayers', 'disruptedMarkers']);
    if (typeof map.getLayer === 'function') {
      if (map.getLayer('link-layer')) map.setLayoutProperty('link-layer', 'visibility', showFocusOnly ? 'none' : 'visible');
      if (map.getLayer('hub-layer')) map.setLayoutProperty('hub-layer', 'visibility', showFocusOnly ? 'none' : 'visible');
      if (map.getLayer('hub-disrupted-layer')) map.setLayoutProperty('hub-disrupted-layer', 'visibility', showFocusOnly ? 'none' : (state.showDisruptedHubs ? 'visible' : 'none'));
    }
    drawRiskHeat(map);
    drawLinks(map);
    drawRoute(map);
    drawHubs(map);
    updateLayerButton();
    return;
  }

  if (typeof L !== 'undefined') {
    const showFocusOnly = Boolean(state.selectedRouteId);
    clearLayers(map, ['linkLayers', 'riskLayers', 'hubMarkers', 'routeLayers', 'disruptedMarkers']);
    drawRiskHeatLegacy(map);
    drawLinksLegacy(map, showFocusOnly);
    drawRouteLegacy(map, showFocusOnly);
    drawHubsLegacy(map, showFocusOnly);
    updateLayerButton();
    return;
  }

  const showFocusOnly = Boolean(state.selectedRouteId);
  if (typeof map.removeLayer === 'function') {
    clearLayers(map, ['linkLayers', 'riskLayers', 'hubMarkers', 'routeLayers', 'disruptedMarkers']);
  }
  if (typeof map.fitBounds === 'function' && state.routes?.length) {
    const route = state.routes.find(route => route.id === state.selectedRouteId) || state.routes[0];
    if (route?.plan?.legs?.length) {
      const points = [];
      route.plan.legs.forEach(leg => {
        const from = HUB_BY_ID.get(leg.from);
        const to = HUB_BY_ID.get(leg.to);
        if (from && to) {
          points.push([from.lat, from.lng], [to.lat, to.lng]);
        }
      });
      if (points.length) {
        map.fitBounds({ _southWest: { lat: Math.min(...points.map(p => p[0])), lng: Math.min(...points.map(p => p[1])) }, _northEast: { lat: Math.max(...points.map(p => p[0])), lng: Math.max(...points.map(p => p[1])) } });
      }
    }
  }
  mapContext.routeLayers.push('route-glow', 'route-line');
}

function drawRiskHeatLegacy(map) {
  state.hubs.forEach(hub => {
    const risk = hub.risk || 0;
    if (risk < 0.2) return;
    const circle = L.circle(hub.coords, {
      radius: 400 + risk * 1400,
      color: risk >= 0.75 ? 'var(--water)' : 'var(--warn)',
      opacity: 0.5,
      fillColor: risk >= 0.75 ? 'var(--water)' : 'var(--warn)',
      fillOpacity: 0.12 + risk * 0.3,
      interactive: false
    }).addTo(map);
    mapContext.riskLayers.push(circle);
  });
}

function drawLinksLegacy(map, showFocusOnly) {
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
      opacity: showFocusOnly ? 0 : (isMetro ? 0.9 : 0.4),
      dashArray: entry.mode === 'walk' ? '4, 5' : null
    }).addTo(map);
    mapContext.linkLayers.push(line);
  });
}

function drawRouteLegacy(map, showFocusOnly) {
  const card = state.routes.find(route => route.id === state.selectedRouteId) || state.routes[0];
  if (!card?.plan) return;

  card.plan.legs.forEach(leg => {
    const from = HUB_BY_ID.get(leg.from);
    const to = HUB_BY_ID.get(leg.to);
    if (!from || !to) return;

    const coords = [[from.lat, from.lng], [to.lat, to.lng]];
    const glow = L.polyline(coords, {
      color: '#ffffff',
      weight: 13,
      opacity: showFocusOnly ? 0.28 : 0.28,
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
    mapContext.routeLayers.push(glow, line);
  });

  if (card.plan.legs.length) {
    const points = [];
    card.plan.legs.forEach(leg => {
      const from = HUB_BY_ID.get(leg.from);
      const to = HUB_BY_ID.get(leg.to);
      if (from && to) {
        points.push([from.lat, from.lng], [to.lat, to.lng]);
      }
    });
    if (points.length) {
      const bounds = L.latLngBounds(points).pad(0.45);
      map.fitBounds(bounds, { padding: [26, 26], maxZoom: 14, animate: true });
    }
  }
}

function drawHubsLegacy(map, showFocusOnly) {
  state.hubs.forEach(hub => {
    const color = STATUS_COLORS[hub.status] || 'var(--signal)';
    const marker = L.marker(hub.coords, { icon: L.divIcon({ html: `<div class="custom-hub-marker w-6 h-6" style="border-color: ${color}"><i class="fa-solid fa-diamond text-[8px]" style="color: ${color}"></i></div>`, className: '', iconSize: [24, 24] }) }).addTo(map);
    if (showFocusOnly && typeof marker.setOpacity === 'function') {
      marker.setOpacity(0);
    }
    mapContext.hubMarkers.set(hub.id, marker);
  });
}

function drawRiskHeat(map) {
  const features = state.hubs
    .filter(hub => (hub.risk || 0) >= 0.2)
    .map(hub => ({
      type: 'Feature',
      properties: {
        risk: Number(hub.risk || 0.2),
        color: '#0EA5E9'
      },
      geometry: {
        type: 'Point',
        coordinates: [hub.lng, hub.lat]
      }
    }));

  if (!features.length) return;

  ensureMapSource(map, 'risk-source', { type: 'FeatureCollection', features });
  if (!map.getLayer('risk-layer')) {
    map.addLayer({
      id: 'risk-layer',
      type: 'circle',
      source: 'risk-source',
      paint: {
        'circle-color': '#38BDF8',
        'circle-opacity': 0.18,
        'circle-radius': ['interpolate', ['linear'], ['get', 'risk'], 0.2, 18, 1, 42],
        'circle-stroke-width': 1,
        'circle-stroke-color': '#7DD3FC'
      }
    });
  }
  mapContext.riskLayers.push('risk-layer');
}

function drawLinks(map) {
  const seen = new Set();
  const features = [];

  LINKS.forEach(entry => {
    const pairKey = [entry.from, entry.to].sort().join('|') + entry.mode;
    if (seen.has(pairKey)) return;
    seen.add(pairKey);

    const geometry = lineCoordinatesFromLink(entry);
    if (!geometry || geometry.length < 2) return;

    const isMetro = entry.mode === 'metro';
    features.push({
      type: 'Feature',
      properties: {
        id: entry.id,
        name: `${entry.routeName} · ${entry.km} km`,
        color: asHex(MODE_COLORS[entry.mode]),
        opacity: isMetro ? 0.9 : 0.5,
        width: isMetro ? 4.5 : entry.mode === 'bus' ? 2.6 : 1.6,
        mode: entry.mode
      },
      geometry: {
        type: 'LineString',
        coordinates: geometry
      }
    });
  });

  ensureMapSource(map, 'link-source', { type: 'FeatureCollection', features });
  if (!map.getLayer('link-layer')) {
    map.addLayer({
      id: 'link-layer',
      type: 'line',
      source: 'link-source',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['get', 'width'],
        'line-opacity': ['get', 'opacity']
      }
    });
  }
  mapContext.linkLayers.push('link-layer');
}

function drawRoute(map) {
  const card = state.routes.find(route => route.id === state.selectedRouteId) || state.routes[0];
  if (!card?.plan?.legs?.length) return;

  if (typeof map.getLayer === 'function') {
    if (map.getLayer('route-glow')) map.removeLayer('route-glow');
    if (map.getLayer('route-line')) map.removeLayer('route-line');
  }
  if (typeof map.getSource === 'function') {
    if (map.getSource('route-source')) map.removeSource('route-source');
  }

  const geojson = routeGeoJson(card);
  ensureMapSource(map, 'route-source', geojson);

  if (typeof map.getLayer === 'function') {
    map.addLayer({
      id: 'route-glow',
      type: 'line',
      source: 'route-source',
      paint: {
        'line-color': '#ffffff',
        'line-width': 14,
        'line-opacity': 0.36
      }
    });

    map.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route-source',
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 7,
        'line-opacity': 1,
        'line-gap-width': 0
      }
    });
  }

  mapContext.routeLayers = ['route-glow', 'route-line'];

  const points = [];
  card.plan.legs.forEach(leg => {
    const from = HUB_BY_ID.get(leg.from);
    const to = HUB_BY_ID.get(leg.to);
    if (!from || !to) return;
    points.push([from.lng, from.lat], [to.lng, to.lat]);
  });

  if (points.length) {
    const bounds = new maplibregl.LngLatBounds(points[0], points[0]);
    points.forEach(point => bounds.extend(point));
    map.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 1200 });
  }
}

function drawHubs(map) {
  const features = state.hubs.map(hub => ({
    type: 'Feature',
    properties: {
      id: hub.id,
      name: hub.name,
      status: hub.status || 'normal',
      color: STATUS_COLORS[hub.status] || STATUS_COLORS.normal,
      risk: Number(hub.risk || 0)
    },
    geometry: {
      type: 'Point',
      coordinates: [hub.lng, hub.lat]
    }
  }));

  ensureMapSource(map, 'hub-source', { type: 'FeatureCollection', features });

  if (typeof map.getLayer === 'function') {
    if (!map.getLayer('hub-layer')) {
      map.addLayer({
        id: 'hub-layer',
        type: 'circle',
        source: 'hub-source',
        paint: {
          'circle-radius': 7,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      });
    }

    if (!map.getLayer('hub-disrupted-layer')) {
      map.addLayer({
        id: 'hub-disrupted-layer',
        type: 'circle',
        source: 'hub-source',
        filter: ['in', ['get', 'status'], ['literal', ['watch', 'congested', 'flooded', 'blocked']]],
        paint: {
          'circle-radius': 8,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff'
        }
      });
    }
  }

  mapContext.hubMarkers.clear();
  state.hubs.forEach(hub => mapContext.hubMarkers.set(hub.id, `hub-${hub.id}`));

  if (!state.showDisruptedHubs) {
    map.setLayoutProperty('hub-disrupted-layer', 'visibility', 'none');
  } else {
    map.setLayoutProperty('hub-disrupted-layer', 'visibility', 'visible');
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
  if (map && map.getLayer('hub-disrupted-layer')) {
    map.setLayoutProperty('hub-disrupted-layer', 'visibility', state.showDisruptedHubs ? 'visible' : 'none');
  }
  updateLayerButton();
}

export function centerOnUserLocation() {
  const map = mapContext.map;
  if (!map) return;

  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      position => map.flyTo({ center: [position.coords.longitude, position.coords.latitude], zoom: 14, speed: 1.1, curve: 1.5 }, { duration: 1200 }),
      () => map.flyTo({ center: DEFAULT_VIEW.center, zoom: 12, speed: 1.1, curve: 1.5 })
    );
    return;
  }
  map.flyTo({ center: DEFAULT_VIEW.center, zoom: 12, speed: 1.1, curve: 1.5 });
}
