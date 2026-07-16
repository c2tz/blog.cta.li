import { createGiscusThemeUrl } from "@/assets/js/app/giscus-theme.js";
import {
  parseVersionedState,
  readCookieValue,
  serializeCookie,
} from "@/assets/js/app/site-persistence.js";
import {
  SITE_COOKIE_NAMES,
  SITE_EVENTS,
  SITE_LOADING_INDICATOR_DELAY_MS,
  SITE_STORAGE_KEYS,
} from "@/lib/site-contracts";

type MaterialButton = HTMLElement & { disabled: boolean };
type CookieConsentWindow = Window & {
  cookieConsent?: {
    acceptedService(service: string, category: string): boolean;
    isCategoryAccepted(category: string): boolean;
  };
};
const GISCUS_ORIGIN = "https://giscus.app";
const GISCUS_LOAD_TIMEOUT_MS = 30_000;

const acceptedPreviously = () => {
  try {
    const value = localStorage.getItem(SITE_STORAGE_KEYS.giscusCommentsEnabled);
    const parsed = parseVersionedState(value);
    if (parsed?.accepted === true) return true;
    if (value === "true" || value === "accepted") return true;
  } catch {}
  return readCookieValue(document.cookie, SITE_COOKIE_NAMES.giscusCommentsEnabled) === "accepted";
};
const rememberAcceptance = () => {
  const state = { accepted: true, updatedAt: new Date().toISOString(), version: 1 };
  try {
    localStorage.setItem(SITE_STORAGE_KEYS.giscusCommentsEnabled, JSON.stringify(state));
  } catch {}
  document.cookie = serializeCookie(SITE_COOKIE_NAMES.giscusCommentsEnabled, "accepted");
};
const optionalServicesAllowed = () => {
  try {
    const cookieConsent = (window as CookieConsentWindow).cookieConsent;
    return Boolean(
      cookieConsent?.acceptedService("giscus", "functionality") ||
      cookieConsent?.isCategoryAccepted("functionality"),
    );
  } catch {
    return false;
  }
};
function enhanceGiscus(root: HTMLElement) {
  if (root.dataset.enhanced === "true") return;
  root.dataset.enhanced = "true";
  const accept = root.querySelector<MaterialButton>("[data-giscus-accept]");
  const privacy = root.querySelector<HTMLElement>("[data-giscus-privacy]");
  const panel = root.querySelector<HTMLElement>("[data-giscus-panel]");
  const progress = root.querySelector<HTMLElement>("[data-giscus-progress]");
  const error = root.querySelector<HTMLElement>("[data-giscus-error]");
  const frame = root.querySelector<HTMLElement>("[data-giscus-frame]");
  if (!accept || !privacy || !panel || !progress || !error || !frame) return;

  const configured = root.dataset.configured === "true";
  let accepted = acceptedPreviously();
  let allowed = false;
  let loaded = false;
  let loading = false;
  let revealTimer = 0;
  let frameLoadTimer = 0;
  let themeAnimationFrame = 0;
  let loadGeneration = 0;
  let reloadRequested = false;
  let frameObserver: MutationObserver | null = null;
  let observedIframe: HTMLIFrameElement | null = null;

  const stopFrameWatch = () => {
    frameObserver?.disconnect();
    frameObserver = null;
    if (frameLoadTimer) window.clearTimeout(frameLoadTimer);
    frameLoadTimer = 0;
    observedIframe?.removeEventListener("load", handleFrameLoaded);
    observedIframe = null;
  };
  const endLoading = () => {
    loading = false;
    panel.setAttribute("aria-busy", "false");
    if (revealTimer) clearTimeout(revealTimer);
    revealTimer = 0;
    progress.removeAttribute("data-loading-active");
    progress.setAttribute("aria-hidden", "true");
  };
  const postTheme = () => {
    themeAnimationFrame = 0;
    if (!loaded) return;
    const iframe = frame.querySelector<HTMLIFrameElement>("iframe.giscus-frame");
    if (!iframe?.src) return;
    try {
      if (new URL(iframe.src).origin !== GISCUS_ORIGIN) return;
    } catch {
      return;
    }
    iframe.contentWindow?.postMessage(
      { giscus: { setConfig: { theme: createGiscusThemeUrl() } } },
      GISCUS_ORIGIN,
    );
  };
  const scheduleThemeUpdate = () => {
    if (themeAnimationFrame) cancelAnimationFrame(themeAnimationFrame);
    themeAnimationFrame = requestAnimationFrame(postTheme);
  };
  const unload = () => {
    const hadThirdPartyRuntime =
      loading || loaded || Boolean(frame.querySelector("script, iframe"));
    loadGeneration += 1;
    if (hadThirdPartyRuntime) window.stop();
    stopFrameWatch();
    if (themeAnimationFrame) cancelAnimationFrame(themeAnimationFrame);
    themeAnimationFrame = 0;
    endLoading();
    loaded = false;
    error.hidden = true;
    frame.replaceChildren();
    panel.hidden = true;
    // Detaching an external script cannot revoke code that already ran and
    // Chromium may still evaluate an in-flight response. Reload into the
    // consent-free bootstrap state whenever Giscus reached the document.
    if (hadThirdPartyRuntime && !reloadRequested) {
      reloadRequested = true;
      window.location.reload();
    }
  };
  function handleFrameLoaded() {
    if (!loading) return;
    loaded = true;
    stopFrameWatch();
    endLoading();
    scheduleThemeUpdate();
  }
  const observeGiscusFrame = () => {
    const iframe = frame.querySelector<HTMLIFrameElement>("iframe.giscus-frame");
    if (!iframe || iframe === observedIframe) return;

    observedIframe?.removeEventListener("load", handleFrameLoaded);
    observedIframe = iframe;
    iframe.setAttribute("aria-label", "Commentaires");
    iframe.removeAttribute("title");
    iframe.addEventListener("load", handleFrameLoaded, { once: true });
  };
  const beginFrameWatch = () => {
    stopFrameWatch();
    frameObserver = new MutationObserver(observeGiscusFrame);
    frameObserver.observe(frame, { childList: true, subtree: true });
    observeGiscusFrame();
    frameLoadTimer = window.setTimeout(() => {
      if (!loading) return;
      loaded = false;
      error.hidden = false;
      stopFrameWatch();
      endLoading();
    }, GISCUS_LOAD_TIMEOUT_MS);
  };
  const load = () => {
    if (!configured || !accepted || !allowed || loaded || loading || reloadRequested) return;
    const generation = ++loadGeneration;
    panel.hidden = false;
    error.hidden = true;
    loading = true;
    panel.setAttribute("aria-busy", "true");
    frame.replaceChildren();
    beginFrameWatch();
    revealTimer = window.setTimeout(() => {
      revealTimer = 0;
      if (loading) {
        progress.setAttribute("aria-hidden", "false");
        progress.setAttribute("data-loading-active", "");
      }
    }, SITE_LOADING_INDICATOR_DELAY_MS);

    const script = document.createElement("script");
    script.src = `${GISCUS_ORIGIN}/client.js`;
    script.async = true;
    script.crossOrigin = "anonymous";
    for (const [name, value] of [
      ["repo", root.dataset.repo],
      ["repo-id", root.dataset.repoId],
      ["category", root.dataset.category],
      ["category-id", root.dataset.categoryId],
      ["mapping", root.dataset.mapping],
      ["strict", root.dataset.strict],
      ["reactions-enabled", root.dataset.reactionsEnabled],
      ["emit-metadata", root.dataset.emitMetadata],
      ["input-position", root.dataset.inputPosition],
      ["lang", root.dataset.lang],
    ]) {
      script.setAttribute(`data-${name}`, value ?? "");
    }
    script.setAttribute("data-theme", createGiscusThemeUrl());
    script.addEventListener(
      "load",
      () => {
        if (generation === loadGeneration && !reloadRequested) {
          script.dataset.siteServiceLoaded = "true";
        }
      },
      { once: true },
    );
    script.addEventListener("error", () => {
      if (generation !== loadGeneration || reloadRequested) return;
      loaded = false;
      error.hidden = false;
      stopFrameWatch();
      endLoading();
    });
    frame.append(script);
  };
  const syncConsent = () => {
    allowed = optionalServicesAllowed();
    privacy.hidden = allowed;
    accept.disabled = !configured || accepted || !allowed;
    if (!allowed) {
      unload();
    } else if (accepted) {
      setTimeout(load);
    }
  };

  accept.addEventListener("click", () => {
    if (!configured || accepted || !allowed) return;
    rememberAcceptance();
    accepted = true;
    accept.disabled = true;
    setTimeout(load);
  });
  document.addEventListener(SITE_EVENTS.consentChange, syncConsent);
  document.addEventListener(SITE_EVENTS.materialDynamicColorChange, scheduleThemeUpdate);
  new MutationObserver(scheduleThemeUpdate).observe(document.documentElement, {
    attributeFilter: ["data-theme"],
    attributes: true,
  });
  syncConsent();
}

const init = () =>
  document.querySelectorAll<HTMLElement>("[data-giscus-comments]").forEach(enhanceGiscus);
init();
document.addEventListener("astro:page-load", init);
