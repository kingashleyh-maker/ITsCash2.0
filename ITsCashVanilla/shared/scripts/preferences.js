export const PREFERENCES_KEY = "itscash_preferences_v1";
export const defaults = { theme: "system", textSize: "standard", reduceMotion: false, showMessages: true, showBadges: true };

export function normalizePreferences(value = {}) {
  return {
    theme: ["light", "dark", "system"].includes(value?.theme) ? value.theme : defaults.theme,
    textSize: ["standard", "large"].includes(value?.textSize) ? value.textSize : defaults.textSize,
    reduceMotion: value?.reduceMotion === true,
    showMessages: value?.showMessages !== false,
    showBadges: value?.showBadges !== false
  };
}

export function loadPreferences(storage) {
  try { return normalizePreferences(JSON.parse((storage ?? globalThis.localStorage).getItem(PREFERENCES_KEY)) ?? {}); }
  catch { return { ...defaults }; }
}

export function applyPreferences(value = loadPreferences()) {
  const settings = normalizePreferences(value);
  const dark = settings.theme === "dark" || (settings.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.dataset.textSize = settings.textSize;
  document.documentElement.dataset.reduceMotion = String(settings.reduceMotion);
  document.documentElement.dataset.notificationBadges = String(settings.showBadges);
}

export function savePreferences(value, storage = localStorage) {
  const settings = normalizePreferences(value);
  storage.setItem(PREFERENCES_KEY, JSON.stringify(settings));
  applyPreferences(settings);
  return settings;
}

// Apply before the application waits for its SQL session, and track device/tab changes.
if (typeof document !== "undefined") {
  applyPreferences();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => applyPreferences());
  window.addEventListener("storage", event => {
    if (event.key === PREFERENCES_KEY || event.key === null) applyPreferences();
  });
}
