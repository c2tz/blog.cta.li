import { sourceColorFromImageBytes } from "@material/material-color-utilities";
import { withDeterministicMaterialSourceColorRandom } from "./material-source-color-random.js";

function imageBytes(image) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context || width <= 0 || height <= 0) {
    throw new Error("konachan_dynamic_theme_canvas_unavailable");
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);
  return context.getImageData(0, 0, width, height).data;
}

function deterministicMaterialSourceColorFromBytes(bytes) {
  return withDeterministicMaterialSourceColorRandom(() => sourceColorFromImageBytes(bytes));
}

export async function materialSourceColorFromImage(image) {
  let bytes = imageBytes(image);

  try {
    const { sourceColorFromImageBytesInWorker } = await import("./material-source-color-worker.js");
    return await sourceColorFromImageBytesInWorker(bytes);
  } catch {
    // A successful transfer detaches the main-thread buffer. Recreate the
    // exact full-resolution pixels only when the Worker cannot return them.
    if (bytes.byteLength === 0) bytes = imageBytes(image);
    return deterministicMaterialSourceColorFromBytes(bytes);
  }
}
