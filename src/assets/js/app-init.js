import { initScrollProgressBar, removeReadingProgress } from "./app/reading-progress.js";
import { initConsoleArt } from "./app/console-art.js";
import { initSiteTooltips } from "./app/site-tooltips.js";

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

  const { initBlogImageReveal, prepareBlogImageDialogs } = await import("./app/blog-images.js");
  prepareBlogImageDialogs();
  initBlogImageReveal();
}

function initApp() {
  initConsoleArt();
  syncDetailViewBodyState();
  initSiteTooltips();
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
