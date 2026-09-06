import { SITE_COOKIE_NAMES, SITE_EVENTS, SITE_STORAGE_KEYS } from "@/lib/site-contracts";
import { readCookieValue, serializeCookie } from "./site-persistence.js";

let initialized = false;

export function areSiteAnimationsEnabled() {
  return document.documentElement.dataset.motion === "on";
}

function readPreference() {
  let stored;
  try {
    stored = localStorage.getItem(SITE_STORAGE_KEYS.motionPreference);
  } catch {}
  return (stored ?? readCookieValue(document.cookie, SITE_COOKIE_NAMES.motionPreference)) === "on";
}

function applyPreference(enabled) {
  document.documentElement.dataset.motion = enabled ? "on" : "off";
  document.querySelectorAll("[data-motion-toggle] md-icon-button").forEach((button) => {
    button.selected = enabled;
    button.dataset.tooltip = enabled ? "Désactiver les animations" : "Activer les animations";
  });
  document.dispatchEvent(new CustomEvent(SITE_EVENTS.motionChange, { detail: { enabled } }));
}

export function initMotionToggles() {
  if (!initialized) {
    initialized = true;
    window.addEventListener("pageshow", () => applyPreference(readPreference()));
    window.addEventListener("storage", (event) => {
      if (event.key === null || event.key === SITE_STORAGE_KEYS.motionPreference) {
        applyPreference(readPreference());
      }
    });
  }
  document.querySelectorAll("[data-motion-toggle]").forEach((root) => {
    if (root.dataset.enhanced === "true") return;
    const button = root.querySelector("md-icon-button");
    if (!button) return;
    root.dataset.enhanced = "true";
    button.addEventListener("click", () => {
      const enabled = !areSiteAnimationsEnabled();
      const value = enabled ? "on" : "off";
      try {
        localStorage.setItem(SITE_STORAGE_KEYS.motionPreference, value);
      } catch {}
      document.cookie = serializeCookie(SITE_COOKIE_NAMES.motionPreference, value);
      applyPreference(enabled);
    });
  });
  applyPreference(readPreference());
}
