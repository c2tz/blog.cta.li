export const KONACHAN_API_ORIGINS = Object.freeze(["https://konachan.com", "https://konachan.net"]);
export const KONACHAN_API_CONCURRENCY = 6;
export const KONACHAN_MAX_API_RESPONSE_BYTES = 5 * 1024 * 1024;
export const KONACHAN_MAX_IMAGE_INPUT_BYTES = 25 * 1024 * 1024;
export const KONACHAN_MAX_INPUT_PIXELS = 50_000_000;

const KONACHAN_HOSTS = new Set(KONACHAN_API_ORIGINS.map((origin) => new URL(origin).hostname));
const KONACHAN_FETCH_ATTEMPTS = 3;
const KONACHAN_FETCH_TIMEOUT_MS = 30_000;
const KONACHAN_MAX_RETRY_DELAY_MS = 10_000;
const KONACHAN_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function createKonachanError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function isAllowedImageHostname(hostname) {
  return [...KONACHAN_HOSTS].some(
    (allowedHost) => hostname === allowedHost || hostname.endsWith(`.${allowedHost}`),
  );
}

export function validateKonachanUrl(input, resource = "image") {
  let url;

  try {
    url = new URL(input);
  } catch {
    throw createKonachanError("konachan_invalid_url", "Invalid Konachan URL.");
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    url.hash
  ) {
    throw createKonachanError(
      "konachan_invalid_url",
      `Rejected non-HTTPS or ambiguous Konachan URL: ${url.toString()}`,
    );
  }

  if (resource === "api") {
    if (!KONACHAN_API_ORIGINS.includes(url.origin) || url.pathname !== "/post.json") {
      throw createKonachanError(
        "konachan_invalid_api_url",
        `Rejected Konachan API URL: ${url.toString()}`,
      );
    }
  } else if (resource === "image") {
    if (!isAllowedImageHostname(url.hostname.toLowerCase())) {
      throw createKonachanError(
        "konachan_invalid_image_url",
        `Rejected Konachan image host: ${url.hostname}`,
      );
    }
  } else {
    throw createKonachanError(
      "konachan_invalid_resource",
      `Unknown Konachan resource type: ${resource}`,
    );
  }

  return url;
}

async function cancelResponse(response) {
  try {
    await response.body?.cancel();
  } catch {
    // The body may already be consumed or locked. Nothing else should read it here.
  }
}

function retryDelay(response, attempt) {
  const retryAfter = response?.headers.get("retry-after")?.trim();

  if (retryAfter) {
    const seconds = Number(retryAfter);
    const timestamp = Date.parse(retryAfter);
    const milliseconds = Number.isFinite(seconds)
      ? seconds * 1000
      : Number.isFinite(timestamp)
        ? timestamp - Date.now()
        : null;

    if (milliseconds !== null) {
      return Math.min(KONACHAN_MAX_RETRY_DELAY_MS, Math.max(0, milliseconds));
    }
  }

  return Math.min(KONACHAN_MAX_RETRY_DELAY_MS, 500 * 2 ** (attempt - 1));
}

function isRetryableStatus(status) {
  return status === 429 || (status >= 500 && status <= 599);
}

function defaultSleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function fetchWithoutRedirects(input, options) {
  const url = validateKonachanUrl(input, options.resource);
  const response = await options.fetchImpl(url, {
    headers: options.headers,
    redirect: "manual",
    signal: AbortSignal.timeout(options.timeoutMs),
  });

  if (response.status < 300 || response.status > 399) return response;

  await cancelResponse(response);
  throw createKonachanError(
    "konachan_redirect_rejected",
    `Rejected Konachan redirect response: ${response.status}`,
  );
}

export async function fetchKonachanResource(
  input,
  {
    resource = "image",
    accept = "*/*",
    headers = {},
    attempts = KONACHAN_FETCH_ATTEMPTS,
    timeoutMs = KONACHAN_FETCH_TIMEOUT_MS,
    fetchImpl = fetch,
    sleep = defaultSleep,
  } = {},
) {
  validateKonachanUrl(input, resource);

  const requestHeaders = {
    accept,
    "user-agent": "ct-blog-konachan-updater/1.0",
    ...headers,
  };

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchWithoutRedirects(input, {
        resource,
        headers: requestHeaders,
        timeoutMs,
        fetchImpl,
      });

      if (!isRetryableStatus(response.status) || attempt === attempts) {
        return response;
      }

      const delay = retryDelay(response, attempt);
      await cancelResponse(response);
      await sleep(delay);
    } catch (error) {
      if (String(error?.code ?? "").startsWith("konachan_") || attempt === attempts) {
        throw error;
      }

      await sleep(retryDelay(null, attempt));
    }
  }

  throw createKonachanError("konachan_fetch_failed", "Konachan fetch failed.");
}

function validateByteLimit(maxBytes) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new TypeError("maxBytes must be a positive safe integer.");
  }
}

export async function readResponseBodyLimited(response, maxBytes) {
  validateByteLimit(maxBytes);

  const contentLength = response.headers.get("content-length")?.trim();
  if (/^\d+$/.test(contentLength ?? "") && Number(contentLength) > maxBytes) {
    await cancelResponse(response);
    throw createKonachanError(
      "konachan_response_too_large",
      `Konachan response declared more than ${maxBytes} bytes.`,
    );
  }

  if (!response.body?.getReader) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maxBytes) {
      throw createKonachanError(
        "konachan_response_too_large",
        `Konachan response exceeded ${maxBytes} bytes.`,
      );
    }
    return bytes;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        throw createKonachanError(
          "konachan_response_too_large",
          `Konachan response exceeded ${maxBytes} bytes.`,
        );
      }
      chunks.push(value);
    }
  } catch (error) {
    try {
      await reader.cancel(error);
    } catch {
      // The stream may already have errored.
    }
    throw error;
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function responseMimeType(response) {
  return response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

export function assertKonachanImageMimeType(response) {
  const mimeType = responseMimeType(response);
  if (!KONACHAN_IMAGE_MIME_TYPES.has(mimeType)) {
    throw createKonachanError(
      "konachan_invalid_image_mime",
      `Rejected Konachan image MIME type: ${mimeType || "missing"}`,
    );
  }
  return mimeType;
}

export function assertKonachanJsonMimeType(response) {
  const mimeType = responseMimeType(response);
  if (mimeType !== "application/json") {
    throw createKonachanError(
      "konachan_invalid_json_mime",
      `Rejected Konachan API MIME type: ${mimeType || "missing"}`,
    );
  }
  return mimeType;
}

export async function mapWithConcurrency(values, concurrency, mapper) {
  const items = Array.from(values);
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new TypeError("concurrency must be a positive integer.");
  }

  const results = new Array(items.length);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}
