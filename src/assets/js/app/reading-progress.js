function getScrollProgress() {
  const doc = document.documentElement;
  const scrollTop = window.scrollY || doc.scrollTop || document.body.scrollTop || 0;
  const scrollable = doc.scrollHeight - window.innerHeight;
  if (scrollable <= 1) return null;

  return Math.min(100, Math.max(0, Math.round((scrollTop / scrollable) * 100)));
}

let readingProgressFrame = 0;
let readingProgressObserver;
let readingProgressListening = false;

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
    observeReadingProgressLayout();
    return;
  }

  const bar = document.createElement("md-linear-progress");
  bar.className = "site-scroll-progress";
  bar.setAttribute("aria-label", "Progression de lecture");
  bar.setAttribute("max", "100");

  if (!readingProgressListening) {
    readingProgressListening = true;
    window.addEventListener("scroll", requestReadingProgressSync, { passive: true });
    window.addEventListener("resize", requestReadingProgressSync, { passive: true });
  }
  document.body.appendChild(bar);
  observeReadingProgressLayout();
  syncReadingProgress();
}

function syncScrollProgressBar(bar, progress = getScrollProgress()) {
  bar.hidden = progress === null;
  if (progress !== null) bar.setAttribute("value", String(progress));
}

function observeReadingProgressLayout() {
  readingProgressObserver?.disconnect();
  readingProgressObserver = new ResizeObserver(requestReadingProgressSync);
  readingProgressObserver.observe(document.documentElement);
  if (document.body) readingProgressObserver.observe(document.body);
}

export function removeReadingProgress() {
  readingProgressObserver?.disconnect();
  readingProgressObserver = undefined;
  document.querySelectorAll(".site-scroll-progress").forEach((element) => {
    element.remove();
  });
}
