import { readLocal, writeLocal } from './persist.js';

/* ===============================
   Bilingual UI (EN / বাংলা)
   ===============================
   The brief makes Bangla a first-class language, not a translation afterthought.
   Every static label in index.html that carries `data-i18n="key"` resolves
   against this dictionary, so the whole chrome switches language and the
   document gets `lang="bn"` — which is what makes the Bangla font stack and the
   taller line-height apply automatically.

   Attribute variants:
     data-i18n="key"            → textContent
     data-i18n-placeholder="key"→ placeholder
     data-i18n-title="key"      → title (tooltips)
     data-i18n-aria="key"       → aria-label

   Generated cards stay EN-first on purpose: routing terms such as leg, transfer
   and MRT-6 station names are what riders read on signage. The chrome, panels
   and every action the user clicks are translated. */

export const STRINGS = {
  'app.tagline': { en: 'Dhaka Transit Network & Routing Ledger', bn: 'ঢাকা ট্রানজিট নেটওয়ার্ক ও রুট লেজার' },
  'action.report': { en: 'Report Issue', bn: 'রিপোর্ট করুন' },
  'action.demo': { en: 'Demo mode', bn: 'ডেমো মোড' },
  'action.about': { en: 'About data', bn: 'ডেটা সম্পর্কে' },
  'action.theme': { en: 'Toggle theme', bn: 'থিম বদলান' },
  'action.language': { en: 'Switch to Bangla', bn: 'Switch to English' },
  'action.close': { en: 'Close', bn: 'বন্ধ করুন' },
  'action.reset': { en: 'Reset', bn: 'রিসেট' },
  'action.refresh': { en: 'Refresh', bn: 'রিফ্রেশ' },
  'action.export': { en: 'Export JSON', bn: 'JSON এক্সপোর্ট' },
  'action.import': { en: 'Import JSON', bn: 'JSON ইমপোর্ট' },
  'action.save': { en: 'Save', bn: 'সেভ' },
  'action.unlock': { en: 'Unlock', bn: 'আনলক' },
  'action.plan': { en: 'Go', bn: 'খুঁজুন' },
  'tab.plan': { en: 'Route Planner', bn: 'রুট প্ল্যানার' },
  'tab.alerts': { en: 'Live Alerts', bn: 'লাইভ অ্যালার্ট' },
  'tab.ai': { en: 'Transit AI', bn: 'ট্রানজিট এআই' },
  'tab.admin': { en: 'Admin', bn: 'অ্যাডমিন' },
  'search.label': { en: 'Intent-Aware Search', bn: 'ইনটেন্ট-ভিত্তিক সার্চ' },
  'search.placeholder': { en: 'e.g. Mirpur to Motijheel, student fare...', bn: 'যেমন: মিরপুর থেকে মতিঝিল, স্টুডেন্ট ভাড়া...' },
  'mobile.search.placeholder': { en: 'Where to? (e.g. Uttara to Motijheel)', bn: 'কোথায় যাবেন? (যেমন: উত্তর থেকে মতিঝিল)' },
  'arriveBy.title': { en: 'Arrive-By Guarantee', bn: 'সময়ে পৌঁছানোর নিশ্চয়তা' },
  'conditions.title': { en: 'Live Conditions', bn: 'সর্বক্ষণের অবস্থা' },
  'conditions.subtitle': { en: 'One scenario drives every surface', bn: 'একটি সিনারিও সব জায়গায় কাজ করে' },
  'pulse.title': { en: 'Dhaka Pulse', bn: 'ঢাকা পালস' },
  'pulse.detail': { en: 'Rain, worst-hub risk, peak hour and live reports in one index.', bn: 'বৃষ্টি, ঝুঁকিপূর্ণ হাব, পিক আওয়ার ও লাইভ রিপোর্ট এক সূচকে।' },
  'forecast.label': { en: 'Forecast scrub', bn: 'পূর্বাভাস স্ক্রাব' },
  'routes.title': { en: 'AVAILABLE ROUTES', bn: 'উপলব্ধ রুট' },
  'fare.title': { en: 'Fare Calculator', bn: 'ভাড়া ক্যালকুলেটর' },
  'quote.title': { en: 'Fair Fare Coach', bn: 'ন্যায্য ভাড়া কোচ' },
  'alerts.title': { en: 'City Infrastructure Alerts', bn: 'নগর অবকাঠামো অ্যালার্ট' },
  'ingest.title': { en: 'Paste a post / say it', bn: 'পোস্ট পেস্ট করুন / বলুন' },
  'chat.placeholder': { en: 'Ask AI assistant...', bn: 'এআই সহকারীকে জিজ্ঞাসা করুন...' },
  'briefing.play': { en: 'Play briefing', bn: 'ব্রিফিং শুনুন' },
  'briefing.card': { en: 'Offline card', bn: 'অফলাইন কার্ড' },
  'incident.title': { en: 'Report City Incident', bn: 'নগর ঘটনা রিপোর্ট' },
  'incident.category': { en: 'Incident Category', bn: 'ঘটনার ধরন' },
  'incident.location': { en: 'Arbitrary Location or Landmark', bn: 'স্থান বা ল্যান্ডমার্ক' },
  'incident.details': { en: 'Details & Notes', bn: 'বিস্তারিত' },
  'incident.submit': { en: 'Submit Report', bn: 'রিপোর্ট জমা দিন' },
  'incident.cancel': { en: 'Cancel', bn: 'বাতিল' },
  'incident.detect': { en: 'Detect Current GPS', bn: 'বর্তমান জিপিএস' },
  'incident.hub': { en: 'Nearest hub in the transit graph', bn: 'গ্রাফের নিকটতম হাব' },
  'admin.title': { en: 'Transit & Street-Status CMS', bn: 'ট্রানজিট ও স্ট্রিট স্ট্যাটাস সিএমএস' },
  'admin.gate': { en: 'Admin passphrase', bn: 'অ্যাডমিন পাসফ্রেজ' },
  'footer.faq': { en: 'FAQ', bn: 'সাধারণ প্রশ্ন' },
  'footer.privacy': { en: 'Privacy', bn: 'প্রাইভেসি' },
  'footer.shortcuts': { en: 'Shortcuts', bn: 'শর্টকাট' }
};

export function currentLang() {
  return document.documentElement.lang === 'bn' ? 'bn' : 'en';
}

export function t(key, lang = currentLang()) {
  const entry = STRINGS[key];
  if (!entry) return key;
  return entry[lang] || entry.en;
}

/* Rewrite every annotated node. Called on boot and on each toggle. */
export function applyLanguage(lang = currentLang()) {
  const resolved = lang === 'bn' ? 'bn' : 'en';
  document.documentElement.lang = resolved;

  document.querySelectorAll('[data-i18n]').forEach(node => {
    const key = node.dataset.i18n;
    const value = STRINGS[key]?.[resolved];
    if (value) node.textContent = value;
  });

  const attrMap = { 'data-i18n-placeholder': 'placeholder', 'data-i18n-title': 'title', 'data-i18n-aria': 'aria-label' };
  Object.entries(attrMap).forEach(([dataAttr, attribute]) => {
    document.querySelectorAll(`[${dataAttr}]`).forEach(node => {
      const value = STRINGS[node.getAttribute(dataAttr)]?.[resolved];
      if (value) node.setAttribute(attribute, value);
    });
  });

  // Bangla needs slightly looser leading; the stylesheet keys off this class.
  document.documentElement.classList.toggle('lang-bn', resolved === 'bn');

  writeLocal('lang', resolved);
  return resolved;
}

export function initLanguage() {
  const stored = readLocal('lang', 'en');
  return applyLanguage(stored === 'bn' ? 'bn' : 'en');
}

export function toggleLanguage() {
  return applyLanguage(currentLang() === 'bn' ? 'en' : 'bn');
}
