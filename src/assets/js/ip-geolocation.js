import {
  SITE_EVENTS,
  SITE_LEGACY_STORAGE_KEYS,
  SITE_STORAGE_KEYS,
} from "@/lib/site-contracts";

const CACHE_KEY = SITE_STORAGE_KEYS.ipGeolocation;
const LEGACY_CACHE_KEY = SITE_LEGACY_STORAGE_KEYS.ipGeolocation;
const CACHE_MAX_AGE_MS = 60 * 60 * 1000;
const MIN_REQUEST_INTERVAL_MS = 5000;

const PROVIDERS = [
  {
    name: "geojs",
    url: "https://get.geojs.io/v1/ip/geo.json",
    map: (data) => ({ ip: data.ip, countryName: data.country || "" }),
  },
  {
    name: "ipapi",
    url: "https://ipapi.co/json/",
    map: (data) => ({ ip: data.ip, countryName: data.country_name || "" }),
  },
  {
    name: "ipify",
    url: "https://api64.ipify.org?format=json",
    map: (data) => ({ ip: data.ip, countryName: "" }),
  },
];

let activeController;
let isRequestPending = false;
let lastRequestAt = 0;

function getElements() {
  return {
    wrapper: document.getElementById("ip-wrapper"),
    ip: document.getElementById("client-ip"),
    country: document.getElementById("client-country"),
  };
}

function hasConsent() {
  try {
    return Boolean(
      window.cookieConsent?.acceptedService("ipgeo", "functionality") ||
      window.cookieConsent?.isCategoryAccepted("functionality"),
    );
  } catch {
    return false;
  }
}

function setVisible(visible) {
  const { wrapper } = getElements();
  if (wrapper) wrapper.hidden = !visible;
}

function renderLocation(data) {
  const { ip, country } = getElements();
  if (!ip || !country) return;

  ip.textContent = data?.ip ?? "non détectée";
  country.textContent = data?.countryName ?? (data?.ip ? "Pays inconnu" : "—");
}

function readCache() {
  try {
    const current = localStorage.getItem(CACHE_KEY);
    const legacy = localStorage.getItem(LEGACY_CACHE_KEY);
    const cached = JSON.parse((current ?? legacy) || "null");
    if (!cached?.updatedAt || Date.now() - cached.updatedAt > CACHE_MAX_AGE_MS) {
      return null;
    }
    if (current === null && legacy !== null) {
      localStorage.setItem(CACHE_KEY, legacy);
      localStorage.removeItem(LEGACY_CACHE_KEY);
    }
    return cached;
  } catch {
    return null;
  }
}

function writeCache(data) {
  if (!data?.ip) return;

  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ ...data, updatedAt: Date.now() }),
    );
    localStorage.removeItem(LEGACY_CACHE_KEY);
  } catch {}
}

async function fetchLocation() {
  activeController?.abort();
  activeController = new AbortController();

  for (const provider of PROVIDERS) {
    try {
      const response = await fetch(provider.url, {
        signal: activeController.signal,
        credentials: "omit",
        cache: "no-store",
      });
      if (!response.ok) continue;

      const data = provider.map(await response.json());
      if (data.ip) return { ...data, provider: provider.name };
    } catch {}
  }

  throw new Error("ip-geolocation-unavailable");
}

async function refreshLocation() {
  if (
    isRequestPending ||
    Date.now() - lastRequestAt < MIN_REQUEST_INTERVAL_MS
  ) {
    return;
  }

  isRequestPending = true;
  lastRequestAt = Date.now();

  try {
    const data = await fetchLocation();
    writeCache(data);
    renderLocation(data);
  } catch {
    renderLocation({ ip: "non détectée", countryName: "Pays inconnu" });
  } finally {
    isRequestPending = false;
    activeController = undefined;
  }
}

function updateLocation() {
  if (!getElements().wrapper) return;

  if (!hasConsent()) {
    setVisible(false);
    renderLocation({ ip: "—", countryName: "—" });
    return;
  }

  setVisible(true);
  const cached = readCache();
  if (cached) renderLocation(cached);
  void refreshLocation();
}

function handleVisibilityChange() {
  if (document.visibilityState === "visible") updateLocation();
}

updateLocation();
document.addEventListener(SITE_EVENTS.consentChange, updateLocation);
document.addEventListener("visibilitychange", handleVisibilityChange);
window.addEventListener("online", updateLocation);
