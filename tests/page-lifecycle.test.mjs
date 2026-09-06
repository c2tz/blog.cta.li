import assert from "node:assert/strict";
import test from "node:test";

let moduleInstance = 0;

async function loadLifecycle(t) {
  const window = new EventTarget();
  const document = new EventTarget();
  const queuedErrors = [];
  t.mock.method(globalThis, "queueMicrotask", (callback) => queuedErrors.push(callback));

  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "window", { configurable: true, value: window });
  Object.defineProperty(globalThis, "document", { configurable: true, value: document });

  try {
    const url = new URL("../src/assets/js/app/page-lifecycle.js", import.meta.url);
    url.searchParams.set("test", String(++moduleInstance));
    const lifecycle = await import(url.href);
    return { ...lifecycle, document, queuedErrors, window };
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else delete globalThis.window;
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
    else delete globalThis.document;
  }
}

test("keeps import failures observable while the page is active", async (t) => {
  const { queuedErrors, rethrowPageLoadError } = await loadLifecycle(t);
  const error = new TypeError("Failed to fetch dynamically imported module");

  rethrowPageLoadError(error);

  assert.equal(queuedErrors.length, 1);
  assert.throws(queuedErrors[0], (thrown) => thrown === error);
});

test("ignores deliberate request cancellation even before a late initial pageshow", async (t) => {
  const { markPageUnloading, queuedErrors, rethrowPageLoadError, window } = await loadLifecycle(t);

  markPageUnloading();
  window.dispatchEvent(new Event("pageshow"));
  rethrowPageLoadError(new TypeError("Failed to fetch dynamically imported module"));

  assert.equal(queuedErrors.length, 0);
});

test("restores error reporting after BFCache and Astro page restoration", async (t) => {
  const { document, markPageUnloading, queuedErrors, rethrowPageLoadError, window } =
    await loadLifecycle(t);
  const error = new Error("The restored page still reports real errors");

  window.dispatchEvent(new Event("pagehide"));
  rethrowPageLoadError(error);
  assert.equal(queuedErrors.length, 0);

  const restored = new Event("pageshow");
  Object.defineProperty(restored, "persisted", { value: true });
  window.dispatchEvent(restored);
  rethrowPageLoadError(error);
  assert.equal(queuedErrors.length, 1);
  assert.throws(queuedErrors[0], (thrown) => thrown === error);

  markPageUnloading();
  document.dispatchEvent(new Event("astro:page-load"));
  rethrowPageLoadError(error);
  assert.equal(queuedErrors.length, 2);
  assert.throws(queuedErrors[1], (thrown) => thrown === error);
});
