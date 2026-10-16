import { state, setScenario, toggleBlockedHub, applyLiveWeather, setWeatherHour, setForecast, refresh, planEndpoints, activeAlerts } from './state.js';
import { createScenario, describeScenario, scenarioActive, scenarioEffects, hubStatus } from './core/scenario.js';
import { networkRisk, corridorRisk, nudgeFor, SAMPLE_FORECAST } from './core/weather.js';
import { HUBS, HUB_BY_ID } from './core/network.js';
import { renderRoutes } from './routes.js';
import { renderAlerts } from './alerts.js';
import { refreshMap } from './map.js';
import { loadWeather } from './env.js';

/* ===============================
   Live Conditions controller
   ===============================
   One panel, one scenario object. Every control writes to state.scenario (or to
   the forecast hour) and then redraws the planner, the alert ledger and the map,
   so rain toggled here shows up in fares, times, probabilities and colours. */

const RAIN_BUTTONS = ['none', 'light', 'heavy'];

export function renderConditions() {
  renderRainButtons();
  renderRushToggle();
  renderBlockedHubs();
  renderForecast();
  renderPulse();
  renderScenarioBadge();
}

function renderRainButtons() {
  RAIN_BUTTONS.forEach(level => {
    const button = document.querySelector(`[data-action="set-rain"][data-rain="${level}"]`);
    if (!button) return;
    const active = state.scenario.rain === level;
    button.classList.toggle('border-signal', active);
    button.classList.toggle('bg-signal-wash', active);
    button.classList.toggle('text-signal', active);
    button.classList.toggle('font-semibold', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function renderRushToggle() {
  const toggle = document.getElementById('rushToggle');
  if (toggle) toggle.checked = Boolean(state.scenario.rush);
}

function renderBlockedHubs() {
  const select = document.getElementById('blockedHubSelect');
  if (select && !select.options.length) {
    select.innerHTML = HUBS.map(hub => `<option value="${hub.id}">${hub.name}</option>`).join('');
  }

  const chips = document.getElementById('blockedHubChips');
  if (!chips) return;

  if (!state.scenario.blockedHubs.length) {
    chips.innerHTML = '<span class="text-[10px] text-ink-3">No closures — the whole graph is open.</span>';
    return;
  }

  chips.innerHTML = state.scenario.blockedHubs.map(hubId => `
    <button data-action="toggle-blocked-hub" data-hub-id="${hubId}"
      class="text-[10px] px-1.5 py-0.5 rounded border border-line-strong bg-surface text-ink-2 hover:border-danger hover:text-danger flex items-center gap-1">
      <i class="fa-solid fa-ban text-danger"></i> ${HUB_BY_ID.get(hubId)?.name || hubId}
      <i class="fa-solid fa-xmark"></i>
    </button>`).join('');
}

/* The model reports ONE rainfall load for the city and, per bus corridor, that
   same load with the corridor's exposure attached. It deliberately does not
   rank streets against each other: the dataset has no drainage data that would
   justify it. Which corridor is actually under water comes from reports. */
function renderForecast() {
  const slider = document.getElementById('forecastHour');
  if (slider) slider.value = String(state.weatherHour);

  const risk = networkRisk(state.weather, { hour: state.weatherHour });
  const corridors = corridorRisk(state.weather, { hour: state.weatherHour }).corridors;
  const label = document.getElementById('forecastLabel');
  const readout = document.getElementById('forecastRisk');
  const nudge = document.getElementById('forecastNudge');
  const hourText = `${String(state.weatherHour).padStart(2, '0')}:00`;

  if (label) label.textContent = `${state.weather.label} · ${hourText}`;
  if (readout) readout.textContent = `${risk.rainLoad} mm/h → ${risk.label} (×${risk.factor})`;

  if (nudge) {
    nudge.innerHTML = [...corridors.values()].map(entry => `
      <span class="inline-flex items-center gap-1 me-2">
        <i class="fa-solid fa-circle text-[6px]" style="color: var(--water); opacity: ${0.35 + entry.value * 0.65}"></i>
        ${entry.routeName} ${Math.round(entry.value * 100)}% of saturation
      </span>`).join('') + '<span class="text-ink-3">MRT-6 runs on a viaduct and is not exposed.</span>';
  }
}

function renderPulse() {
  const score = document.getElementById('pulseScore');
  const band = document.getElementById('pulseBand');
  const arc = document.getElementById('pulseArc');
  const detail = document.getElementById('pulseDetail');
  const pulse = state.pulse;

  if (score) score.textContent = pulse.score;
  if (band) {
    band.textContent = pulse.band;
    band.className = `font-mono text-[10px] px-1.5 py-0.5 rounded bg-surface border border-line ${pulse.score >= 70 ? 'text-danger' : pulse.score >= 45 ? 'text-warn' : 'text-ok'}`;
  }
  if (arc) {
    const circumference = 97.4;
    arc.setAttribute('stroke-dashoffset', String(circumference * (1 - pulse.score / 100)));
    arc.setAttribute('stroke', pulse.score >= 70 ? 'var(--danger)' : pulse.score >= 45 ? 'var(--warn)' : 'var(--ok)');
  }
  if (detail) {
    detail.textContent = `Rain load ${pulse.rainLoad} mm/h (${Math.round(pulse.rain * 100)}% of saturation)${pulse.peak ? ' · peak hour' : ''} · ${activeAlerts().length} live report(s).`;
  }
}

function renderScenarioBadge() {
  const badge = document.getElementById('scenarioBadge');
  if (!badge) return;
  badge.textContent = scenarioActive(state.scenario)
    ? describeScenario(state.scenario).replace('Scenario active — ', '').replace('.', '')
    : 'normal conditions';
  badge.classList.toggle('text-warn', scenarioActive(state.scenario));
}

/* Redraw everything that depends on the scenario/weather. */
export function redrawAll() {
  renderConditions();
  renderRoutes();
  renderAlerts();
  refreshMap();
}

export async function initConditions() {
  renderConditions();

  // Forecast first (live when the proxy has a network, bundled sample otherwise)
  const forecast = await loadWeather();
  setForecast(forecast);
  refresh();
  redrawAll();

  const panel = document.getElementById('forecastLabel');
  if (panel && forecast.degraded) {
    panel.title = 'Live forecast unavailable — using the bundled sample and labelling it as such.';
  }
}

/* data-action handlers, dispatched from events.js */
export function handleConditionAction(action, element) {
  switch (action) {
    case 'set-rain':
      setScenario({ rain: element.dataset.rain });
      redrawAll();
      return true;
    case 'toggle-rush':
      setScenario({ rush: Boolean(element.checked) });
      redrawAll();
      return true;
    case 'toggle-blocked-hub': {
      const hubId = element.dataset.hubId || document.getElementById('blockedHubSelect')?.value;
      if (hubId) toggleBlockedHub(hubId);
      redrawAll();
      return true;
    }
    case 'clear-scenario':
      state.useLiveWeather = false;
      setScenario(createScenario());
      redrawAll();
      return true;
    case 'use-live-weather': {
      applyLiveWeather();
      redrawAll();
      return true;
    }
    case 'set-forecast-hour':
      setWeatherHour(Number(element.value));
      redrawAll();
      return true;
    case 'set-deadline': {
      state.deadline = element.value || '';
      renderRoutes();
      return true;
    }
    case 'clear-deadline': {
      state.deadline = '';
      const input = document.getElementById('deadlineInput');
      if (input) input.value = '';
      renderRoutes();
      return true;
    }
    default:
      return false;
  }
}

export { scenarioEffects, hubStatus, nudgeFor, planEndpoints, SAMPLE_FORECAST };
