import { SITE_EVENTS } from "@/lib/site-contracts";

const SCRIPT_SELECTOR = 'script[data-site-service="speed-insights"]';

function hasSpeedInsightsConsent() {
  try {
    return Boolean(
      window.cookieConsent?.acceptedService("speed-insights", "functionality") ||
      window.cookieConsent?.isCategoryAccepted("functionality"),
    );
  } catch {
    return false;
  }
}

function syncSpeedInsights() {
  if (document.body?.dataset.speedInsightsEnabled !== "true") return;
  if (!hasSpeedInsightsConsent() || document.querySelector(SCRIPT_SELECTOR)) return;

  const script = document.createElement("script");
  script.defer = true;
  script.src = "/_vercel/speed-insights/script.js";
  script.dataset.siteService = "speed-insights";
  script.dataset.sdkn = "@vercel/speed-insights/astro";
  script.dataset.sdkv = document.body.dataset.speedInsightsVersion || "";
  script.dataset.route = document.body.dataset.speedInsightsRoute || "";
  document.body.append(script);
}

syncSpeedInsights();
document.addEventListener(SITE_EVENTS.consentChange, syncSpeedInsights);
