/* ===============================
   Local persistence
   ===============================
   One namespaced wrapper over localStorage so the language choice, the admin
   overrides and the demo flag survive a reload. Every call is defensive:
   private-mode browsers and disabled storage must never break the app. */

const PREFIX = 'dhakapath.';

export function readLocal(key, fallback = null) {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeLocal(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeLocal(key) {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* storage unavailable — nothing to remove */
  }
}
