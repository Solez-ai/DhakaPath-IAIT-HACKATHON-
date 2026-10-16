import { state } from './state.js';
import { toggleLanguage as toggleDictionary, currentLang, t } from './i18n.js';
import { renderAdmin } from './admin.js';

/* ===============================
   UI Theme & Language Controls
   =============================== */
export function toggleTheme() {
  const htmlEl = document.documentElement;
  const themeIcon = document.getElementById('themeIcon');

  if (state.theme === 'dark') {
    state.theme = 'light';
    htmlEl.removeAttribute('data-theme');
    if (themeIcon) themeIcon.className = 'fa-solid fa-moon text-xs';
  } else {
    state.theme = 'dark';
    htmlEl.setAttribute('data-theme', 'dark');
    if (themeIcon) themeIcon.className = 'fa-solid fa-sun text-xs text-warn';
  }
}

/* Real translation: the dictionary rewrites every annotated label, sets
   `lang` on the document (which is what loads the Bangla font stack and the
   looser line-height) and persists the choice. The admin panel is rendered from
   JS, so it is re-rendered to pick the new language up. */
export function toggleLanguage() {
  const lang = toggleDictionary();
  state.lang = lang;

  const label = document.getElementById('langLabel');
  if (label) label.innerText = lang === 'en' ? 'EN' : 'বাংলা';

  const button = document.getElementById('langToggleBtn');
  if (button) button.title = t('action.language', lang === 'bn' ? 'en' : 'bn');

  renderAdmin();
  return lang;
}

export { currentLang };

/* Mobile Sheet Drawer Toggle */
export function toggleMobileSheetState() {
  const sheet = document.getElementById('mobileBottomSheet');
  if (sheet.classList.contains('sheet-half')) {
    sheet.classList.remove('sheet-half');
    sheet.classList.add('sheet-full');
  } else {
    sheet.classList.remove('sheet-full');
    sheet.classList.add('sheet-half');
  }
}

/* Sidebar Tab Switching */
export function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('bg-surface', 'border-t', 'border-x', 'border-line', 'text-signal', 'font-bold');
    btn.classList.add('text-ink-2');
  });

  const activeBtn = document.getElementById(`tabBtn-${tab}`);
  if (activeBtn) {
    activeBtn.classList.add('bg-surface', 'border-t', 'border-x', 'border-line', 'text-signal', 'font-bold');
  }

  ['plan', 'alerts', 'ai', 'admin'].forEach(name => {
    const panel = document.getElementById(`tabContent-${name}`);
    if (panel) panel.classList.toggle('hidden', name !== tab);
  });
}

/* Modal Helper Functions */
export function openFAQModal() { document.getElementById('faqModal').classList.remove('hidden'); }
export function closeFAQModal() { document.getElementById('faqModal').classList.add('hidden'); }
export function openPrivacyModal() { document.getElementById('privacyModal').classList.remove('hidden'); }
export function closePrivacyModal() { document.getElementById('privacyModal').classList.add('hidden'); }
export function openShortcutsModal() { document.getElementById('shortcutsModal').classList.remove('hidden'); }
export function closeShortcutsModal() { document.getElementById('shortcutsModal').classList.add('hidden'); }
