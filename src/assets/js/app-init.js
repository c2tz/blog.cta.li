import { initScrollProgressBar, removeReadingProgress } from "./app/reading-progress.js";
import { initSiteTooltips } from "./app/site-tooltips.js";

const RICH_TOOLTIP_SELECTOR = "[data-rich-tooltip-trigger]";
const CONTEXT_POPOVER_SELECTOR = [
  "[data-context-popover-trigger]",
  ".site-prose a[href^='#user-content-fn-']:not([data-footnote-backref])",
].join(",");

let richTooltipsPromise;
let contextPopoversPromise;

async function initRichTooltipsWhenNeeded() {
  if (!document.querySelector(RICH_TOOLTIP_SELECTOR)) return;

  richTooltipsPromise ??= import("./app/site-rich-tooltips.js").catch((error) => {
    richTooltipsPromise = undefined;
    throw error;
  });
  const { initSiteRichTooltips } = await richTooltipsPromise;
  initSiteRichTooltips();
}

async function initContextPopoversWhenNeeded() {
  if (!document.querySelector(CONTEXT_POPOVER_SELECTOR)) return;

  contextPopoversPromise ??= import("./app/site-context-popovers.js").catch((error) => {
    contextPopoversPromise = undefined;
    throw error;
  });
  const { initSiteContextPopovers } = await contextPopoversPromise;
  initSiteContextPopovers();
}

function initConditionalEnhancements() {
  void Promise.all([initRichTooltipsWhenNeeded(), initContextPopoversWhenNeeded()]).catch(
    (error) => {
      queueMicrotask(() => {
        throw error;
      });
    },
  );
}

function syncDetailViewBodyState() {
  if (!document.body) return;

  if (document.documentElement.dataset.homeDetailView === "true") {
    document.body.dataset.homeDetailView = "true";
  } else {
    delete document.body.dataset.homeDetailView;
  }
}

async function initProseImageEnhancements() {
  const hasProseImage = document.querySelector(".site-prose img");
  if (!hasProseImage) return;

  const { prepareBlogImageDialogs } = await import("./app/blog-images.js");
  prepareBlogImageDialogs();
}

function initApp() {
  syncDetailViewBodyState();
  initSiteTooltips();
  initConditionalEnhancements();
  void initProseImageEnhancements();
  if (document.body?.dataset.readingProgress === "off") {
    removeReadingProgress();
  } else {
    initScrollProgressBar();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp, { once: true });
} else {
  initApp();
}

addEventListener("astro:page-load", initApp);
