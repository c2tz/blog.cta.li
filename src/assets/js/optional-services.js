const SCRIPT_SELECTOR = 'script[data-site-service="speed-insights"]';
let reloadRequested = false;

function hasSpeedInsightsConsent() {
  try {
    return Boolean(window.cookieConsent?.acceptedService("speed-insights", "functionality"));
  } catch {
    return false;
  }
}

export function syncSpeedInsights() {
  const existingScript = document.querySelector(SCRIPT_SELECTOR);
  if (!hasSpeedInsightsConsent()) {
    if (!existingScript) return;

    // Chromium can still evaluate the response of an in-flight dynamic script
    // after the element is detached. Stop the current document load before
    // removing it, then reload into the consent-free bootstrap state.
    window.stop();
    existingScript.remove();
    if (!reloadRequested) {
      reloadRequested = true;
      window.location.reload();
    }
    return;
  }
  if (document.body?.dataset.speedInsightsEnabled !== "true" || existingScript) return;

  const script = document.createElement("script");
  script.defer = true;
  script.src = "/_vercel/speed-insights/script.js";
  script.dataset.siteService = "speed-insights";
  script.dataset.sdkn = "@vercel/speed-insights/astro";
  script.dataset.sdkv = document.body.dataset.speedInsightsVersion || "";
  script.dataset.route = document.body.dataset.speedInsightsRoute || "";
  script.addEventListener(
    "load",
    () => {
      script.dataset.siteServiceLoaded = "true";
    },
    { once: true },
  );
  document.body.append(script);
}
