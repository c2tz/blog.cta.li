let pageIsUnloading = false;

export function markPageUnloading() {
  pageIsUnloading = true;
}

export function isPageUnloading() {
  return pageIsUnloading;
}

export function rethrowPageLoadError(error) {
  if (pageIsUnloading) return;
  queueMicrotask(() => {
    throw error;
  });
}

window.addEventListener("pagehide", markPageUnloading);
window.addEventListener("pageshow", (event) => {
  // A delayed initial pageshow must not undo an intentional stop-and-reload.
  if (event.persisted) pageIsUnloading = false;
});
document.addEventListener("astro:page-load", () => {
  pageIsUnloading = false;
});
