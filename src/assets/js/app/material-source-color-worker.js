const MATERIAL_SOURCE_COLOR_WORKER_TIMEOUT_MS = 15_000;

function workerError(message, cause) {
  const error = new Error(message);
  if (cause !== undefined) error.cause = cause;
  return error;
}

export function sourceColorFromImageBytesInWorker(
  bytes,
  { timeoutMs = MATERIAL_SOURCE_COLOR_WORKER_TIMEOUT_MS } = {},
) {
  if (!(bytes instanceof Uint8ClampedArray) || bytes.byteLength === 0) {
    return Promise.reject(workerError("material_source_color_worker_invalid_bytes"));
  }
  if (!(bytes.buffer instanceof ArrayBuffer)) {
    return Promise.reject(workerError("material_source_color_worker_untransferable_bytes"));
  }
  if (typeof Worker !== "function") {
    return Promise.reject(workerError("material_source_color_worker_unavailable"));
  }

  let worker;
  try {
    worker = new Worker(new URL("./material-source-color.worker.js", import.meta.url), {
      name: "material-source-color",
      type: "module",
    });
  } catch (error) {
    return Promise.reject(workerError("material_source_color_worker_unavailable", error));
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let timeoutId;

    const settle = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      worker.terminate();
      callback(value);
    };

    worker.addEventListener(
      "message",
      (event) => {
        const { error, sourceColor } = event.data ?? {};
        if (Number.isInteger(sourceColor)) {
          settle(resolve, sourceColor);
          return;
        }

        settle(reject, workerError(error || "material_source_color_worker_invalid_response"));
      },
      { once: true },
    );
    worker.addEventListener(
      "messageerror",
      () => settle(reject, workerError("material_source_color_worker_message_error")),
      { once: true },
    );
    worker.addEventListener(
      "error",
      (event) => {
        event.preventDefault();
        settle(reject, workerError(event.message || "material_source_color_worker_load_error"));
      },
      { once: true },
    );

    timeoutId = setTimeout(
      () => settle(reject, workerError("material_source_color_worker_timeout")),
      timeoutMs,
    );

    try {
      const { buffer, byteLength, byteOffset } = bytes;
      worker.postMessage({ buffer, byteLength, byteOffset }, [buffer]);
    } catch (error) {
      settle(reject, workerError("material_source_color_worker_post_failed", error));
    }
  });
}
