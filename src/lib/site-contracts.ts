export const SITE_EVENTS = Object.freeze({
  consentChange: "site:consent-change",
  explicitContentChange: "site:explicit-content-change",
  homeDetailViewChange: "home:detail-view-change",
  materialDynamicColorChange: "site:material-dynamic-color-change",
  loadingEnd: "site:loading-end",
  loadingStart: "site:loading-start",
  tooltipHide: "site:tooltip-hide",
  konachanRatingChange: "konachan:rating-change",
  konachanRefreshRequest: "konachan:refresh-request",
  konachanRefreshState: "konachan:refresh-state",
});

// Material does not prescribe a reveal delay. This site-level threshold keeps
// indeterminate indicators from flashing during operations that finish quickly.
export const SITE_LOADING_INDICATOR_DELAY_MS = 200;

export const SITE_STORAGE_KEYS = Object.freeze({
  cookieConsent: "ct-cookie-consent-v1",
  explicitContentAcknowledgement: "ct-explicit-content-ack-v1",
  homeDetailView: "home-detail-view-v1",
  homeKonachanBackgrounds: "home-konachan-backgrounds-v8",
  homeKonachanRatingPreference: "home-konachan-rating-preference-v1",
  ipGeolocation: "site-ip-geolocation-v3",
  giscusCommentsEnabled: "site-giscus-comments-enabled-v1",
  materialDynamicColorEnabled: "site-material-dynamic-color-enabled-v1",
  materialDynamicColorPalette: "site-material-dynamic-color-palette-v1",
  themePreference: "site-theme-preference",
});

export const MATERIAL_DYNAMIC_COLOR_ROLES = Object.freeze([
  "background",
  "error",
  "error-container",
  "inverse-on-surface",
  "inverse-primary",
  "inverse-surface",
  "on-background",
  "on-error",
  "on-error-container",
  "on-primary",
  "on-primary-container",
  "on-primary-fixed",
  "on-primary-fixed-variant",
  "on-secondary",
  "on-secondary-container",
  "on-secondary-fixed",
  "on-secondary-fixed-variant",
  "on-surface",
  "on-surface-variant",
  "on-tertiary",
  "on-tertiary-container",
  "on-tertiary-fixed",
  "on-tertiary-fixed-variant",
  "outline",
  "outline-variant",
  "primary",
  "primary-container",
  "primary-fixed",
  "primary-fixed-dim",
  "scrim",
  "secondary",
  "secondary-container",
  "secondary-fixed",
  "secondary-fixed-dim",
  "shadow",
  "surface",
  "surface-bright",
  "surface-container",
  "surface-container-high",
  "surface-container-highest",
  "surface-container-low",
  "surface-container-lowest",
  "surface-dim",
  "surface-tint",
  "surface-variant",
  "tertiary",
  "tertiary-container",
  "tertiary-fixed",
  "tertiary-fixed-dim",
] as const);

export const SITE_LEGACY_STORAGE_KEYS = Object.freeze({
  cookieConsent: "ct_cookie_consent_v1",
  homeDetailView: "home_detail_view_v1",
  homeKonachanBackgrounds: "home_konachan_backgrounds_v6",
  homeKonachanRatingPreference: "home_konachan_rating_preference_v1",
  ipGeolocation: "site-ip-geolocation-v2",
  themePreference: "site_theme_preference",
});

export const SITE_COOKIE_NAMES = Object.freeze({
  cookieConsent: "ct-cookie-consent",
  explicitContentAcknowledgement: "ct-explicit-content-ack",
  giscusCommentsEnabled: "site-giscus-comments-enabled",
  homeDetailView: "home-detail-view",
  homeKonachanRatingPreference: "home-konachan-rating-preference",
});

export const SITE_LEGACY_COOKIE_NAMES = Object.freeze({
  cookieConsent: "ct_cookie_consent",
  homeDetailView: "home_detail_view",
  homeKonachanRatingPreference: "home_konachan_rating_preference",
});

export const SITE_CACHE_NAMES = Object.freeze({
  homeKonachanBackgrounds: "home-konachan-backgrounds-v4",
});
