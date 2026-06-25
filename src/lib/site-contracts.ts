export const SITE_EVENTS = Object.freeze({
  consentChange: "site:consent-change",
  loadingEnd: "site:loading-end",
  loadingStart: "site:loading-start",
  photoSwipeAction: "site:photo-swipe-action",
  photoSwipeShareResult: "site:photo-swipe-share-result",
  photoSwipeState: "site:photo-swipe-state",
  tooltipHide: "site:tooltip-hide",
  konachanRefreshRequest: "konachan:refresh-request",
  konachanRefreshState: "konachan:refresh-state",
});

export const SITE_STORAGE_KEYS = Object.freeze({
  cookieConsent: "ct-cookie-consent-v1",
  homeKonachanBackgrounds: "home-konachan-backgrounds-v6",
  ipGeolocation: "site-ip-geolocation-v2",
  themePreference: "site-theme-preference",
});

export const SITE_LEGACY_STORAGE_KEYS = Object.freeze({
  cookieConsent: "ct_cookie_consent_v1",
  homeKonachanBackgrounds: "home_konachan_backgrounds_v6",
  ipGeolocation: "site_ip_geolocation_v2",
  themePreference: "site_theme_preference",
});

export const SITE_COOKIE_NAMES = Object.freeze({
  cookieConsent: "ct-cookie-consent",
});

export const SITE_LEGACY_COOKIE_NAMES = Object.freeze({
  cookieConsent: "ct_cookie_consent",
});

export const SITE_CACHE_NAMES = Object.freeze({
  homeKonachanBackgrounds: "home-konachan-backgrounds-v2",
});
