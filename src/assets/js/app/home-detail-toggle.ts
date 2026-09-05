import {
  SITE_COOKIE_NAMES,
  SITE_EVENTS,
  SITE_LEGACY_COOKIE_NAMES,
  SITE_LEGACY_STORAGE_KEYS,
  SITE_STORAGE_KEYS,
} from "@/lib/site-contracts";
import {
  firstNormalizedValue,
  readCookieValue,
  serializeCookie,
} from "@/assets/js/app/site-persistence.js";

const normalize = (value: string | null) => {
  if (value === "true" || value === "detailed") return true;
  if (value === "false" || value === "compact") return false;
  return null;
};

function enhanceDetailToggle(root: HTMLElement) {
  if (root.dataset.enhanced === "true") return;
  root.dataset.enhanced = "true";
  const button = root.querySelector<HTMLElement & { selected: boolean }>("md-icon-button");
  if (!button) return;

  const candidates = [
    (() => {
      try {
        return localStorage.getItem(SITE_STORAGE_KEYS.homeDetailView);
      } catch {
        return null;
      }
    })(),
    (() => {
      try {
        return localStorage.getItem(SITE_LEGACY_STORAGE_KEYS.homeDetailView);
      } catch {
        return null;
      }
    })(),
    readCookieValue(document.cookie, SITE_COOKIE_NAMES.homeDetailView),
    readCookieValue(document.cookie, SITE_LEGACY_COOKIE_NAMES.homeDetailView),
  ];
  let detailed = firstNormalizedValue(candidates, normalize) ?? false;

  const persist = () => {
    const value = detailed ? "true" : "false";
    try {
      localStorage.setItem(SITE_STORAGE_KEYS.homeDetailView, value);
      localStorage.removeItem(SITE_LEGACY_STORAGE_KEYS.homeDetailView);
    } catch {}
    document.cookie = serializeCookie(SITE_COOKIE_NAMES.homeDetailView, value);
    document.cookie = serializeCookie(SITE_LEGACY_COOKIE_NAMES.homeDetailView, "", {
      maxAgeSeconds: 0,
    });
  };

  const apply = () => {
    button.selected = detailed;
    button.dataset.tooltip = detailed ? "Passer en mode simple" : "Passer en mode détaillé";
    if (detailed) {
      document.documentElement.dataset.homeDetailView = "true";
      document.body.dataset.homeDetailView = "true";
    } else {
      delete document.documentElement.dataset.homeDetailView;
      delete document.body.dataset.homeDetailView;
    }
    document.dispatchEvent(
      new CustomEvent(SITE_EVENTS.homeDetailViewChange, { detail: { detailed } }),
    );
  };

  button.addEventListener("click", () => {
    detailed = !detailed;
    persist();
    apply();
  });
  persist();
  apply();
}

export function initHomeDetailToggles() {
  document.querySelectorAll<HTMLElement>("[data-home-detail-toggle]").forEach(enhanceDetailToggle);
}
