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

  const bar = document.createElement("div");
  bar.className = "site-scroll-progress";
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-label", "Progression de lecture");
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", "100");
  bar.innerHTML = '<span class="site-scroll-progress-bar"></span>';

  window.addEventListener("scroll", requestReadingProgressSync, { passive: true });
  window.addEventListener("resize", requestReadingProgressSync, { passive: true });
  document.body.appendChild(bar);
  syncReadingProgress();
}

function syncScrollProgressBar(bar, progress = getScrollProgress()) {
  const fill = bar.querySelector(".site-scroll-progress-bar");

  bar.setAttribute("aria-valuenow", String(progress));
  fill?.style.setProperty("transform", `translate3d(0, 0, 0) scaleX(${progress / 100})`);
}

export function removeReadingProgress() {
  document.querySelectorAll(".site-scroll-progress").forEach((element) => {
    element.remove();
  });
}
