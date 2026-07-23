import { SITE_EVENTS, SITE_LEGACY_STORAGE_KEYS, SITE_STORAGE_KEYS } from "@/lib/site-contracts";

const API_URL = "https://api.ipapi.is";
const CACHE_KEY = SITE_STORAGE_KEYS.ipGeolocation;
const LEGACY_CACHE_KEYS = [SITE_LEGACY_STORAGE_KEYS.ipGeolocation, "site_ip_geolocation_v2"];
const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const MIN_REQUEST_INTERVAL_MS = 5000;

let activeController;
let isRequestPending = false;
let lastRequestAt = 0;

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function regionName(countryCode) {
  const normalizedCode = text(countryCode).toUpperCase();
  if (!normalizedCode) return "";

  try {
    return (
      new Intl.DisplayNames([document.documentElement.lang || "fr"], { type: "region" }).of(
        normalizedCode,
      ) || normalizedCode
    );
  } catch {
    return normalizedCode;
  }
}

function normalizeAsn(value) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/^AS/i, "");
  return /^\d+$/.test(normalized) ? `AS${normalized}` : "";
}

function mapResponse(data) {
  return {
    asn: normalizeAsn(data?.asn?.asn),
    countryCode: text(data?.location?.country_code).toUpperCase(),
    ip: text(data?.ip),
    organization: text(data?.asn?.org) || text(data?.company?.name),
    provider: "ipapi.is",
  };
}

function getElements() {
  return {
    country: document.getElementById("client-country"),
    ip: document.getElementById("client-ip"),
    locationDetails: document.getElementById("client-location-details"),
    network: document.getElementById("client-network"),
    wrapper: document.getElementById("ip-wrapper"),
  };
}

function consentApiReady() {
  return Boolean(window.cookieConsent);
}

function hasConsent() {
  try {
    return Boolean(window.cookieConsent?.acceptedService("ipgeo", "functionality"));
  } catch {
    return false;
  }
}

function setVisible(visible) {
  const { wrapper } = getElements();
  if (wrapper) wrapper.hidden = !visible;
}

function renderLocation(data) {
  const { country, ip, locationDetails, network } = getElements();
  if (!ip || !country || !locationDetails || !network) return;

  const localizedCountry = regionName(data?.countryCode);
  const networkParts = [text(data?.asn), text(data?.organization)].filter(Boolean);

  ip.textContent = text(data?.ip) || "non détectée";
  country.textContent = localizedCountry;
  network.textContent = `${localizedCountry && networkParts.length ? " · " : ""}${networkParts.join(" · ")}`;
  network.toggleAttribute("hidden", networkParts.length === 0);
  locationDetails.toggleAttribute("hidden", !localizedCountry && networkParts.length === 0);
}

function clearCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
    for (const key of LEGACY_CACHE_KEYS) localStorage.removeItem(key);
  } catch {}
}

function readCache() {
  try {
    const current = localStorage.getItem(CACHE_KEY);
    const legacy = LEGACY_CACHE_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
    const cached = JSON.parse((current ?? legacy) || "null");
    const isFresh =
      cached?.version === 3 &&
      text(cached.ip) &&
      Number.isFinite(cached.updatedAt) &&
      Date.now() - cached.updatedAt <= CACHE_MAX_AGE_MS;

    if (!isFresh) {
      if (current || legacy) clearCache();
      return null;
    }

    if (current === null && legacy !== undefined) {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
      for (const key of LEGACY_CACHE_KEYS) localStorage.removeItem(key);
    }
    return cached;
  } catch {
    return null;
  }
}

function writeCache(data) {
  if (!text(data?.ip)) return;

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, updatedAt: Date.now(), version: 3 }));
    for (const key of LEGACY_CACHE_KEYS) localStorage.removeItem(key);
  } catch {}
}

async function fetchLocation() {
  activeController?.abort();
  activeController = new AbortController();

  const response = await fetch(API_URL, {
    credentials: "omit",
    signal: activeController.signal,
  });
  if (!response.ok) throw new Error(`ip-geolocation-${response.status}`);

  const data = mapResponse(await response.json());
  if (!data.ip) throw new Error("ip-geolocation-invalid-response");
  return data;
}

async function refreshLocation() {
  if (isRequestPending || Date.now() - lastRequestAt < MIN_REQUEST_INTERVAL_MS) return;

  isRequestPending = true;
  lastRequestAt = Date.now();

  try {
    const data = await fetchLocation();
    if (!hasConsent()) return;
    writeCache(data);
    renderLocation(data);
  } catch (error) {
    if (error?.name !== "AbortError" && hasConsent()) renderLocation({ ip: "non détectée" });
  } finally {
    isRequestPending = false;
    activeController = undefined;
  }
}

export function updateLocation() {
  if (!getElements().wrapper) return;

  if (!hasConsent()) {
    activeController?.abort();
    setVisible(false);
    renderLocation({ ip: "—" });
    if (consentApiReady()) clearCache();
    return;
  }

  setVisible(true);
  const cached = readCache();
  if (cached) {
    renderLocation(cached);
    return;
  }
  void refreshLocation();
}

function handleVisibilityChange() {
  if (document.visibilityState === "visible") updateLocation();
}

updateLocation();
document.addEventListener(SITE_EVENTS.consentChange, updateLocation);
document.addEventListener("visibilitychange", handleVisibilityChange);
window.addEventListener("online", updateLocation);
