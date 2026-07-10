function getScrollProgress() {
  const doc = document.documentElement;
  const scrollTop = window.scrollY || doc.scrollTop || document.body.scrollTop || 0;
  const scrollable = Math.max(doc.scrollHeight - window.innerHeight, 1);

  return Math.min(100, Math.max(0, Math.round((scrollTop / scrollable) * 100)));
}

let readingProgressFrame = 0;

function requestReadingProgressSync() {
  if (readingProgressFrame) return;

  readingProgressFrame = requestAnimationFrame(() => {
    readingProgressFrame = 0;
    syncReadingProgress();
  });
}

function syncReadingProgress() {
  const progress = getScrollProgress();

  document
    .querySelectorAll(".site-scroll-progress")
    .forEach((bar) => syncScrollProgressBar(bar, progress));
}

export function initScrollProgressBar() {
  const existingBar = document.querySelector(".site-scroll-progress");
  if (existingBar) {
    syncScrollProgressBar(existingBar);
    return;
  }

  const bar = document.createElement("md-linear-progress");
  bar.className = "site-scroll-progress";
  bar.setAttribute("aria-label", "Progression de lecture");
  bar.setAttribute("max", "100");

  window.addEventListener("scroll", requestReadingProgressSync, { passive: true });
  window.addEventListener("resize", requestReadingProgressSync, { passive: true });
  document.body.appendChild(bar);
  syncReadingProgress();
}

function syncScrollProgressBar(bar, progress = getScrollProgress()) {
  bar.setAttribute("value", String(progress));
}

export function removeReadingProgress() {
  document.querySelectorAll(".site-scroll-progress").forEach((element) => {
    element.remove();
  });
}
