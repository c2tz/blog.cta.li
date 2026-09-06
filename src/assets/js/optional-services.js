import { inject, pageview } from "@vercel/analytics";

const SPEED_SELECTOR = 'script[data-site-service="speed-insights"]';
const ANALYTICS_SRC = "/_vercel/insights/script.js";
const ANALYTICS_SELECTOR = `script[src="${ANALYTICS_SRC}"]`;
let reloadRequested = false;

function hasConsent(service) {
  try {
    return Boolean(window.cookieConsent?.acceptedService(service, "functionality"));
  } catch {
    return false;
  }
}

export function syncOptionalServices() {
  if (reloadRequested) return;
  const speedScript = document.querySelector(SPEED_SELECTOR);
  const analyticsScript = document.querySelector(ANALYTICS_SELECTOR);
  const speedAccepted = hasConsent("speed-insights");
  const analyticsAccepted = hasConsent("web-analytics");

  if ((speedScript && !speedAccepted) || (analyticsScript && !analyticsAccepted)) {
    // Stop in-flight scripts before removal. Reload also removes SDK listeners
    // and queues, so revoking consent stops subsequent transmissions.
    reloadRequested = true;
    window.stop();
    if (!speedAccepted) speedScript?.remove();
    if (!analyticsAccepted) analyticsScript?.remove();
    window.location.reload();
    return;
  }

  if (speedAccepted && document.body?.dataset.speedInsightsEnabled === "true" && !speedScript) {
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

  if (
    analyticsAccepted &&
    document.body?.dataset.webAnalyticsEnabled === "true" &&
    !analyticsScript
  ) {
    // Use the same SDK entrypoints as the Astro component, only after consent.
    inject({
      mode: "production",
      framework: "astro",
      disableAutoTrack: true,
      scriptSrc: ANALYTICS_SRC,
    });
    pageview({
      route: document.body.dataset.webAnalyticsRoute || window.location.pathname,
      path: window.location.pathname,
    });
  }
}
