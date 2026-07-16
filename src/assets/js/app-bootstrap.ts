import { schedulePostPaint } from "@/assets/js/app/post-paint";
import { parseVersionedState, readCookieValue } from "@/assets/js/app/site-persistence.js";
import {
  SITE_COOKIE_NAMES,
  SITE_EVENTS,
  SITE_LEGACY_STORAGE_KEYS,
  SITE_STORAGE_KEYS,
} from "@/lib/site-contracts";

type BaseInitializers = {
  defineCookieConsentControls(): void;
  initHomeDetailToggles(): void;
  initPageLoadingIndicators(): void;
};

type SearchControllers = {
  initSiteSearchPanels(): void;
  initSiteSearchTriggers(): void;
};

let baseModulesPromise: Promise<BaseInitializers> | undefined;
let homeUiPromise: Promise<unknown> | undefined;
let searchModulePromise: Promise<SearchControllers> | undefined;
let consentServicesListenerInstalled = false;
let consentResyncInstalled = false;
let explicitContentListenerInstalled = false;
let pageIsUnloading = false;

type CookieConsentWindow = Window & {
  cookieConsent?: {
    acceptedService(service: string, category: string): boolean;
    isCategoryAccepted(category: string): boolean;
  };
};

async function loadBaseModules() {
  baseModulesPromise ??= Promise.all([
    import("@/assets/js/material-web.js"),
    import("@/assets/js/app-init.js"),
    import("@/assets/js/app/theme-switcher"),
    import("@/assets/js/app/cookie-consent-controls.js"),
    import("@/assets/js/app/home-detail-toggle"),
    import("@/assets/js/app/page-loading-indicator"),
  ])
    .then(([, , , consent, homeDetail, loadingIndicator]) => ({
      defineCookieConsentControls: consent.defineCookieConsentControls,
      initHomeDetailToggles: homeDetail.initHomeDetailToggles,
      initPageLoadingIndicators: loadingIndicator.initPageLoadingIndicators,
    }))
    .catch((error) => {
      baseModulesPromise = undefined;
      throw error;
    });

  const { defineCookieConsentControls, initHomeDetailToggles, initPageLoadingIndicators } =
    await baseModulesPromise;
  defineCookieConsentControls();
  initHomeDetailToggles();
  initPageLoadingIndicators();
}

function hasFunctionalityConsent(service: string) {
  try {
    const consent = (window as CookieConsentWindow).cookieConsent;
    return Boolean(
      consent?.acceptedService(service, "functionality") ||
      consent?.isCategoryAccepted("functionality"),
    );
  } catch {
    return false;
  }
}

function loadConsentServices() {
  const modules: Promise<unknown>[] = [];

  if (
    document.body?.dataset.speedInsightsEnabled === "true" &&
    hasFunctionalityConsent("speed-insights")
  ) {
    modules.push(
      import("@/assets/js/optional-services.js").then(({ syncSpeedInsights }) =>
        syncSpeedInsights(),
      ),
    );
  }

  if (document.querySelector("#ip-wrapper") && hasFunctionalityConsent("ipgeo")) {
    modules.push(
      import("@/assets/js/ip-geolocation.js").then(({ updateLocation }) => updateLocation()),
    );
  }

  return Promise.all(modules);
}

function armConsentServices() {
  void loadConsentServices().catch(() => undefined);
  if (consentServicesListenerInstalled) return;

  consentServicesListenerInstalled = true;
  document.addEventListener(
    SITE_EVENTS.consentChange,
    () => void loadConsentServices().catch(() => undefined),
  );
}

function dispatchConsentChange() {
  document.dispatchEvent(new Event(SITE_EVENTS.consentChange));
}

function armConsentResync() {
  if (consentResyncInstalled) return;
  consentResyncInstalled = true;

  window.addEventListener("pageshow", dispatchConsentChange);
  window.addEventListener("storage", (event) => {
    if (
      event.key === null ||
      event.key === SITE_STORAGE_KEYS.cookieConsent ||
      event.key === SITE_LEGACY_STORAGE_KEYS.cookieConsent
    ) {
      dispatchConsentChange();
    }
  });
}

function explicitContentAcknowledged() {
  try {
    const state = parseVersionedState(
      localStorage.getItem(SITE_STORAGE_KEYS.explicitContentAcknowledgement),
    );
    if (state?.acknowledged === true) return true;
  } catch {}

  return (
    readCookieValue(document.cookie, SITE_COOKIE_NAMES.explicitContentAcknowledgement) ===
    "acknowledged"
  );
}

async function loadSearchControllers() {
  searchModulePromise ??= import("@/assets/js/app/site-search.js").catch((error) => {
    searchModulePromise = undefined;
    throw error;
  });
  const { initSiteSearchPanels, initSiteSearchTriggers } = await searchModulePromise;
  initSiteSearchPanels();
  initSiteSearchTriggers();
}

function armSearch() {
  const eagerPanel = document.querySelector('[data-site-search-panel]:not([data-deferred="true"])');
  if (eagerPanel) void loadSearchControllers().catch(() => undefined);

  document.querySelectorAll<HTMLElement>("[data-site-search-trigger]").forEach((root) => {
    if (root.dataset.searchLoaderArmed === "true") return;

    const button = root.querySelector<HTMLElement>("[data-search-open]");
    if (!button) return;

    root.dataset.searchLoaderArmed = "true";
    const warm = () => void loadSearchControllers().catch(() => undefined);
    button.addEventListener("pointerenter", warm, { once: true, passive: true });
    button.addEventListener("focus", warm, { once: true });
    button.addEventListener("click", async (event) => {
      if (root.dataset.searchEnhanced === "true") return;

      event.preventDefault();
      try {
        await loadSearchControllers();
        button.click();
      } catch {
        root.dataset.searchLoaderArmed = "error";
      }
    });
  });
}

function loadHomeUi() {
  if (!document.querySelector("[data-konachan-background]")) return;
  homeUiPromise ??= Promise.all([
    import("@/assets/js/material-web/home.js"),
    import("@/assets/js/app/home-latest-posts-table"),
  ]).catch((error) => {
    homeUiPromise = undefined;
    throw error;
  });
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

function armHomeEnhancements() {
  if (!document.querySelector("[data-konachan-background]")) return;
  if (explicitContentAcknowledged()) return loadHomeEnhancements();
  if (explicitContentListenerInstalled) return;

  explicitContentListenerInstalled = true;
  document.addEventListener(SITE_EVENTS.explicitContentChange, () => {
    void loadHomeEnhancements().catch(() => {
      document.documentElement.dataset.homeEnhancements = "error";
    });
  });
}

async function bootstrapInteractivePage() {
  armSearch();
  await Promise.all([loadBaseModules(), loadHomeUi()]);
}

async function bootstrapPage() {
  await bootstrapInteractivePage();
  armConsentServices();
  await armHomeEnhancements();
  document.documentElement.dataset.appReady = "true";
}

function scheduleBootstrap() {
  pageIsUnloading = false;
  delete document.documentElement.dataset.appReady;
  schedulePostPaint(() => {
    void bootstrapPage().catch((error) => {
      if (pageIsUnloading) return;
      document.documentElement.dataset.appReady = "error";
      queueMicrotask(() => {
        throw error;
      });
    });
  });
}

armConsentResync();
scheduleBootstrap();
window.addEventListener("pagehide", () => {
  pageIsUnloading = true;
});
document.addEventListener("astro:page-load", scheduleBootstrap);
