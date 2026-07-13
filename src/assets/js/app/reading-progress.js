function getScrollProgress() {
  const scroller = document.scrollingElement ?? document.documentElement;
  const scrollTop = window.scrollY || scroller.scrollTop || 0;
  const scrollable = scroller.scrollHeight - scroller.clientHeight;
  if (scrollable <= 1) return null;

  return Math.min(1, Math.max(0, scrollTop / scrollable));
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
    prepareScrollProgressBar(existingBar);
    syncScrollProgressBar(existingBar);
    observeReadingProgressLayout();
    return;
  }

  const bar = document.createElement("md-linear-progress");
  bar.className = "site-scroll-progress";
  bar.setAttribute("aria-label", "Progression de lecture");
  bar.setAttribute("max", "1");
  prepareScrollProgressBar(bar);

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
  if (progress === null) return;

  bar.max = 1;
  bar.value = progress;
}

async function prepareScrollProgressBar(bar) {
  bar.setAttribute("max", "1");
  await customElements.whenDefined("md-linear-progress");
  await bar.updateComplete;
  if (!bar.isConnected) return;

  bar.shadowRoot?.querySelectorAll(".bar, .inactive-track").forEach((indicator) => {
    indicator.style.setProperty("transition", "none", "important");
  });
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
