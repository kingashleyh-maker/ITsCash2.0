import test from "node:test";
import assert from "node:assert/strict";
import { defaults, normalizePreferences, loadPreferences, savePreferences, applyPreferences, PREFERENCES_KEY } from "../shared/scripts/preferences.js";

test("appearance preferences default safely when storage is absent, corrupt, or blocked", () => {
  for (const storage of [{ getItem: () => null }, { getItem: () => "{invalid" }, { getItem: () => { throw Error("Blocked"); } }]) {
    assert.deepEqual(loadPreferences(storage), defaults);
  }
  assert.deepEqual(normalizePreferences(null), defaults);
  assert.deepEqual(normalizePreferences({ theme: "unexpected", textSize: "tiny", reduceMotion: "true" }), defaults);
});
test("valid saved theme, text size, and motion choices survive reload without touching app records", () => {
  const settings = { ...defaults, theme: "dark", textSize: "large", reduceMotion: true, showMessages: false, showBadges: false };
  const storage = { getItem: key => { assert.equal(key, PREFERENCES_KEY); return JSON.stringify(settings); } };
  assert.deepEqual(loadPreferences(storage), settings);
});
test("explicit theme overrides the device and saved accessibility choices are applied immediately", () => {
  const oldDocument = globalThis.document;
  const oldMedia = globalThis.matchMedia;
  const dataset = {};
  globalThis.document = { documentElement: { dataset } };
  globalThis.matchMedia = () => ({ matches: true });
  let stored;
  try {
    savePreferences({ theme: "light", textSize: "large", reduceMotion: true }, {
      setItem: (key, value) => { assert.equal(key, PREFERENCES_KEY); stored = JSON.parse(value); }
    });
    assert.deepEqual(stored, { ...defaults, theme: "light", textSize: "large", reduceMotion: true });
    assert.deepEqual(dataset, { theme: "light", textSize: "large", reduceMotion: "true", notificationBadges: "true" });
    applyPreferences(defaults);
    assert.deepEqual(dataset, { theme: "dark", textSize: "standard", reduceMotion: "false", notificationBadges: "true" });
    globalThis.matchMedia = () => ({ matches: false });
    applyPreferences(defaults);
    assert.equal(dataset.theme, "light");
    applyPreferences({ theme: "dark" });
    assert.equal(dataset.theme, "dark");
    applyPreferences({ showBadges: false });
    assert.equal(dataset.notificationBadges, "false");
  } finally { globalThis.document = oldDocument; globalThis.matchMedia = oldMedia; }
});
