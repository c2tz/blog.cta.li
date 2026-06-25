import { initScrollProgressBar, removeReadingProgress } from "./app/reading-progress.js";
import { initSiteTooltips } from "./app/site-tooltips.js";

async function initProseImageEnhancements() {
  const hasProseImage = document.querySelector(".site-prose img");
  const hasLightboxCandidate = document.querySelector(
    ".site-prose img:not([data-no-lightbox]), .site-prose a[data-pswp-item]",
  );

  if (!hasProseImage && !hasLightboxCandidate) return;

  if (hasLightboxCandidate) {
    const [{ initLightbox }, { initBlogImageReveal }] = await Promise.all([
      import("./app/photo-swipe/lightbox.js"),
      import("./app/blog-images.js"),
    ]);
    initLightbox();
    initBlogImageReveal();
    return;
  }

  const { initBlogImageReveal } = await import("./app/blog-images.js");
  initBlogImageReveal();
}

function initApp() {
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
