import { initScrollProgressBar, removeReadingProgress } from "./app/reading-progress.js";
import { initSiteTooltips } from "./app/site-tooltips.js";
import { initSiteRichTooltips } from "./app/site-rich-tooltips.js";
import { initSiteContextPopovers } from "./app/site-context-popovers.js";

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
  initSiteRichTooltips();
  initSiteContextPopovers();
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
