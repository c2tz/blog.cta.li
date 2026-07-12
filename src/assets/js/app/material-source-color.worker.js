import { sourceColorFromImageBytes } from "@material/material-color-utilities";
import { withDeterministicMaterialSourceColorRandom } from "./material-source-color-random.js";

self.addEventListener(
  "message",
  (event) => {
    try {
      const { buffer, byteLength, byteOffset } = event.data ?? {};
      if (!(buffer instanceof ArrayBuffer)) {
        throw new TypeError("material_source_color_worker_invalid_buffer");
      }
      if (
        !Number.isInteger(byteOffset) ||
        !Number.isInteger(byteLength) ||
        byteOffset < 0 ||
        byteLength <= 0 ||
        byteLength % 4 !== 0 ||
        byteOffset + byteLength > buffer.byteLength
      ) {
        throw new RangeError("material_source_color_worker_invalid_view");
      }

      const bytes = new Uint8ClampedArray(buffer, byteOffset, byteLength);
      const sourceColor = withDeterministicMaterialSourceColorRandom(() =>
        sourceColorFromImageBytes(bytes),
      );
      self.postMessage({ sourceColor });
    } catch (error) {
      self.postMessage({
        error: error instanceof Error ? error.message : "material_source_color_worker_failed",
      });
    }
  },
  { once: true },
);
