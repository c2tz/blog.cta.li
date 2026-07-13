import {
  SITE_COOKIE_NAMES,
  SITE_EVENTS,
  SITE_LEGACY_COOKIE_NAMES,
  SITE_LEGACY_STORAGE_KEYS,
  SITE_STORAGE_KEYS,
} from "@/lib/site-contracts";

const readCookie = (name: string) => {
  const encodedName = `${encodeURIComponent(name)}=`;
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(encodedName));
  if (!cookie) return null;
  try {
    return decodeURIComponent(cookie.slice(encodedName.length));
  } catch {
    return null;
  }
};

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
    readCookie(SITE_COOKIE_NAMES.homeDetailView),
    readCookie(SITE_LEGACY_COOKIE_NAMES.homeDetailView),
  ];
  let detailed = candidates.map(normalize).find((value) => value !== null) ?? false;

  const persist = () => {
    const value = detailed ? "true" : "false";
    try {
      localStorage.setItem(SITE_STORAGE_KEYS.homeDetailView, value);
      localStorage.removeItem(SITE_LEGACY_STORAGE_KEYS.homeDetailView);
    } catch {}
    document.cookie = `${encodeURIComponent(SITE_COOKIE_NAMES.homeDetailView)}=${value}; Max-Age=31536000; Path=/; SameSite=Lax`;
    document.cookie = `${encodeURIComponent(SITE_LEGACY_COOKIE_NAMES.homeDetailView)}=; Max-Age=0; Path=/; SameSite=Lax`;
  };

  const apply = () => {
    button.selected = detailed;
    const label = detailed ? "Mode détaillé" : "Mode simple";
    button.dataset.tooltip = label;
    button.setAttribute("aria-label", label);
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
