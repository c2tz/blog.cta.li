export const SITE_EVENTS = Object.freeze({
  consentChange: "site:consent-change",
  explicitContentChange: "site:explicit-content-change",
  loadingEnd: "site:loading-end",
  loadingStart: "site:loading-start",
  photoSwipeAction: "site:photo-swipe-action",
  photoSwipeShareResult: "site:photo-swipe-share-result",
  photoSwipeState: "site:photo-swipe-state",
  tooltipHide: "site:tooltip-hide",
  konachanRatingChange: "konachan:rating-change",
  konachanRefreshRequest: "konachan:refresh-request",
  konachanRefreshState: "konachan:refresh-state",
});

export const SITE_STORAGE_KEYS = Object.freeze({
  cookieConsent: "ct-cookie-consent-v1",
  explicitContentAcknowledgement: "ct-explicit-content-ack-v1",
  homeKonachanBackgrounds: "home-konachan-backgrounds-v8",
  homeKonachanRatingPreference: "home-konachan-rating-preference-v1",
  ipGeolocation: "site-ip-geolocation-v2",
  themePreference: "site-theme-preference",
});

export const SITE_LEGACY_STORAGE_KEYS = Object.freeze({
  cookieConsent: "ct_cookie_consent_v1",
  homeKonachanBackgrounds: "home_konachan_backgrounds_v6",
  homeKonachanRatingPreference: "home_konachan_rating_preference_v1",
  ipGeolocation: "site_ip_geolocation_v2",
  themePreference: "site_theme_preference",
});

export const SITE_COOKIE_NAMES = Object.freeze({
  cookieConsent: "ct-cookie-consent",
  explicitContentAcknowledgement: "ct-explicit-content-ack",
  homeKonachanRatingPreference: "home-konachan-rating-preference",
});

export const SITE_LEGACY_COOKIE_NAMES = Object.freeze({
  cookieConsent: "ct_cookie_consent",
  homeKonachanRatingPreference: "home_konachan_rating_preference",
});

export const SITE_CACHE_NAMES = Object.freeze({
  homeKonachanBackgrounds: "home-konachan-backgrounds-v4",
});
