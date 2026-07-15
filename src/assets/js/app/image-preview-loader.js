let controllerPromise;
let controllerReady = false;
let installed = false;

function previewImageFromEvent(event) {
  const candidate = event.composedPath().find((node) => node instanceof HTMLImageElement);
  if (!candidate?.src || !candidate.closest(".site-prose")) return null;
  if (candidate.closest("header, footer, nav, [data-no-image-dialog]")) return null;
  if (candidate.closest("a[href], button, input, select, textarea")) return null;
  return candidate;
}

function removeWarmListeners() {
  document.removeEventListener("pointerover", warmController, true);
  document.removeEventListener("focusin", warmController, true);
}

function loadController() {
  controllerPromise ??= import("./image-preview.js")
    .then(async (controller) => {
      await controller.installImagePreviewDialog();
      controllerReady = true;
      removeWarmListeners();
      return controller;
    })
    .catch((error) => {
      controllerPromise = undefined;
      throw error;
    });
  return controllerPromise;
}

function warmController(event) {
  if (previewImageFromEvent(event)) void loadController().catch(() => undefined);
}

async function replayActivation(event) {
  if (controllerReady) return;

  const image = previewImageFromEvent(event);
  if (!image) return;
  if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;

  event.preventDefault();
  let controller;
  try {
    controller = await loadController();
  } catch {
    return;
  }
  if (!image.isConnected) return;
  await controller.openImagePreviewDialog(image, { restoreFocus: event.type === "keydown" });
}

export function installImagePreviewLoader() {
  if (installed) return;
  installed = true;
  document.addEventListener("pointerover", warmController, { capture: true, passive: true });
  document.addEventListener("focusin", warmController, true);
  document.addEventListener("click", (event) => void replayActivation(event), true);
  document.addEventListener("keydown", (event) => void replayActivation(event), true);
}
