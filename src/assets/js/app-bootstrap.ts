import { schedulePostPaint } from "@/assets/js/app/post-paint";

let baseModulesPromise: Promise<unknown> | undefined;
let homeUiPromise: Promise<unknown> | undefined;
let litRuntimePromise: Promise<void> | undefined;

function yieldToBrowser() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

function loadLitRuntime() {
  litRuntimePromise ??= (async () => {
    await import("lit/html.js");
    await yieldToBrowser();
    await import("lit/decorators.js");
    await yieldToBrowser();
    await import("lit");
    await yieldToBrowser();
  })();
  return litRuntimePromise;
}

function loadBaseModules() {
  baseModulesPromise ??= Promise.all([
    import("@/assets/js/material-web.js"),
    import("@/assets/js/app-init.js"),
    import("@/assets/js/app/theme-switcher"),
    import("@/assets/js/app/cookie-consent-controls.js").then(({ defineCookieConsentControls }) =>
      defineCookieConsentControls(),
    ),
    import("@/assets/js/app/home-detail-toggle").then(({ initHomeDetailToggles }) =>
      initHomeDetailToggles(),
    ),
    import("@/assets/js/app/page-loading-indicator").then(({ initPageLoadingIndicators }) =>
      initPageLoadingIndicators(),
    ),
  ]);

  return baseModulesPromise;
}

function loadDeferredServices() {
  return Promise.all([
    import("@/assets/js/optional-services.js"),
    import("@/assets/js/ip-geolocation.js"),
  ]);
}

async function loadSearch() {
  if (!document.querySelector("[data-search-panel], [data-search-open]")) return;
  const { initSiteSearchPanels, initSiteSearchTriggers } =
    await import("@/assets/js/app/site-search.js");
  initSiteSearchPanels();
  initSiteSearchTriggers();
}

function loadHomeUi() {
  if (!document.querySelector("[data-konachan-background]")) return;
  homeUiPromise ??= Promise.all([
    import("@/assets/js/material-web/home.js"),
    import("@/assets/js/app/home-latest-posts-table"),
  ]);
  return homeUiPromise;
}

async function loadHomeEnhancements() {
  if (!document.querySelector("[data-konachan-background]")) return;
  const [, background, controls] = await Promise.all([
    loadHomeUi(),
    import("@/assets/js/app/home-konachan-background.js"),
    import("@/assets/js/app/home-konachan-controls.js"),
  ]);
  void controls.initHomeKonachanControlsFromDocument();
  background.initHomeKonachanBackgroundFromDocument();
}

async function bootstrapInteractivePage() {
  await loadLitRuntime();
  await Promise.all([loadBaseModules(), loadSearch(), loadHomeUi()]);

  const [{ initHomeDetailToggles }, { initPageLoadingIndicators }] = await Promise.all([
    import("@/assets/js/app/home-detail-toggle"),
    import("@/assets/js/app/page-loading-indicator"),
  ]);
  initHomeDetailToggles();
  initPageLoadingIndicators();
}

async function bootstrapPage() {
  await bootstrapInteractivePage();
  await Promise.all([loadDeferredServices(), loadHomeEnhancements()]);
  document.documentElement.dataset.appReady = "true";
}

function scheduleBootstrap() {
  delete document.documentElement.dataset.appReady;
  schedulePostPaint(bootstrapPage);
}

scheduleBootstrap();
document.addEventListener("astro:page-load", scheduleBootstrap);
