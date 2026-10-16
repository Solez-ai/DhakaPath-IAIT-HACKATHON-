import { handleSearchInput, executeSearch } from './search.js';
import { selectRoute, toggleStudentPass } from './routes.js';
import {
  openIncidentModal,
  closeIncidentModal,
  selectIncidentCategory,
  detectUserLocationForIncident,
  submitIncidentReport,
  refreshAlerts,
  confirmAlertById,
  resolveAlertById,
  ingestPost,
  voiceReport
} from './alerts.js';
import { sendChatMessage } from './chat.js';
import { compareFares, swapFareEndpoints, syncFareInputs, renderFareTable, checkQuoteFromPanel, speakScript } from './fares.js';
import { centerOnUserLocation, toggleMapLayers } from './map.js';
import { handleConditionAction } from './scenarioUi.js';
import { ADMIN_ACTIONS, handleAdminAction, handleAdminChange } from './admin.js';
import { runDemo, openAbout, closeAbout } from './demo.js';
import { playBriefing, downloadSummaryCard } from './briefing.js';
import {
  toggleTheme,
  toggleLanguage,
  toggleMobileSheetState,
  switchTab,
  openFAQModal,
  closeFAQModal,
  openPrivacyModal,
  closePrivacyModal,
  openShortcutsModal,
  closeShortcutsModal
} from './ui.js';

/* Declarative action table: markup only names the action via data-action. */
const CLICK_ACTIONS = {
  'open-incident': openIncidentModal,
  'close-incident': closeIncidentModal,
  'select-category': el => selectIncidentCategory(el, el.dataset.category),
  'detect-location': detectUserLocationForIncident,
  'submit-incident': submitIncidentReport,
  'refresh-alerts': refreshAlerts,
  'confirm-alert': el => confirmAlertById(el.dataset.alertId),
  'resolve-alert': el => resolveAlertById(el.dataset.alertId),
  'ingest-post': ingestPost,
  'voice-report': voiceReport,
  'toggle-language': toggleLanguage,
  'toggle-theme': toggleTheme,
  'switch-tab': el => switchTab(el.dataset.tab),
  // A search also drives the fare dropdowns, so both panels describe one trip
  'execute-search': () => { executeSearch(); syncFareInputs(); renderFareTable(); },
  'compare-fares': compareFares,
  'swap-fare-endpoints': swapFareEndpoints,
  'check-quote': checkQuoteFromPanel,
  'speak-script': speakScript,
  'select-route': el => selectRoute(el.dataset.routeId),
  'toggle-map-layers': toggleMapLayers,
  'center-location': centerOnUserLocation,
  'toggle-sheet': toggleMobileSheetState,
  'send-chat': sendChatMessage,
  'run-demo': runDemo,
  'open-about': openAbout,
  'close-about': closeAbout,
  'play-briefing': playBriefing,
  'download-card': downloadSummaryCard,
  'open-faq': openFAQModal,
  'close-faq': closeFAQModal,
  'open-privacy': openPrivacyModal,
  'close-privacy': closePrivacyModal,
  'open-shortcuts': openShortcutsModal,
  'close-shortcuts': closeShortcutsModal
};

/* Live Conditions panel (rain, rush, closures, forecast hour, arrive-by). */
const CONDITION_ACTIONS = [
  'set-rain',
  'toggle-rush',
  'toggle-blocked-hub',
  'clear-scenario',
  'use-live-weather',
  'set-forecast-hour',
  'set-deadline',
  'clear-deadline'
];

const INPUT_ACTIONS = {
  'search-input': el => handleSearchInput(el.value)
};

const CHANGE_ACTIONS = {
  'student-pass': () => { toggleStudentPass(); renderFareTable(); },
  'fare-endpoint': compareFares
};

function findAction(event) {
  return event.target instanceof Element ? event.target.closest('[data-action]') : null;
}

function isTypingTarget(target) {
  if (!(target instanceof HTMLElement)) return false;
  return /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable;
}

function handleKeydown(event) {
  const isCommandK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';

  if (isCommandK || (event.key === '/' && !isTypingTarget(event.target))) {
    event.preventDefault();
    document.getElementById('searchInput')?.focus();
    return;
  }

  if (event.key !== 'Enter') return;

  if (event.target.id === 'searchInput' || event.target.id === 'mobileSearchInput') {
    event.preventDefault();
    executeSearch();
    syncFareInputs();
    renderFareTable();
    return;
  }

  if (event.target.id === 'chatInput') {
    event.preventDefault();
    sendChatMessage();
    return;
  }

  if (event.target.id === 'quoteAmount') {
    event.preventDefault();
    checkQuoteFromPanel();
    return;
  }

  if (event.target.id === 'adminPassphrase') {
    event.preventDefault();
    handleAdminAction('admin-unlock', event.target);
    return;
  }

  if (event.target.id === 'postInput') {
    event.preventDefault();
    ingestPost();
  }
}

export function bindAppEvents() {
  document.addEventListener('click', event => {
    const trigger = findAction(event);
    if (!trigger) return;
    const action = trigger.dataset.action;

    if (CONDITION_ACTIONS.includes(action)) {
      event.preventDefault();
      handleConditionAction(action, trigger);
      return;
    }

    if (ADMIN_ACTIONS.includes(action)) {
      event.preventDefault();
      handleAdminAction(action, trigger);
      return;
    }

    const handler = CLICK_ACTIONS[action];
    if (!handler) return;
    event.preventDefault();
    handler(trigger);
  });

  document.addEventListener('input', event => {
    const trigger = findAction(event);
    if (!trigger) return;

    const action = trigger.dataset.action;
    if (CONDITION_ACTIONS.includes(action) && (action === 'set-forecast-hour' || action === 'set-deadline')) {
      handleConditionAction(action, trigger);
      return;
    }

    if (ADMIN_ACTIONS.includes(action)) {
      handleAdminChange(action, trigger);
      return;
    }

    const handler = INPUT_ACTIONS[action];
    if (handler) handler(trigger);
  });

  document.addEventListener('change', event => {
    const trigger = findAction(event);
    if (!trigger) return;
    const action = trigger.dataset.action;

    if (CONDITION_ACTIONS.includes(action) && action === 'toggle-rush') {
      handleConditionAction(action, trigger);
      return;
    }

    if (ADMIN_ACTIONS.includes(action)) {
      handleAdminChange(action, trigger);
      return;
    }

    const handler = CHANGE_ACTIONS[action];
    if (handler) handler(trigger);
  });

  document.addEventListener('keydown', handleKeydown);
}
