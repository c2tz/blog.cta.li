const VERCEL_PREVIEW_ORIGIN_PATTERN =
  /^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.vercel\.app\/?$/i;

/**
 * Accept one HTTPS origin below vercel.app and nothing else. Keeping the input
 * to an origin prevents an event payload from selecting an arbitrary path,
 * port, credential, query, fragment, or look-alike hostname.
 */
export function parseVercelPreviewUrl(value) {
  if (typeof value !== "string" || !VERCEL_PREVIEW_ORIGIN_PATTERN.test(value)) {
    throw new TypeError(
      "VERCEL_PREVIEW_URL must be an HTTPS origin matching https://<deployment>.vercel.app/.",
    );
  }

  const url = new URL(value);

  if (
    url.protocol !== "https:" ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== "" ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.hash !== ""
  ) {
    throw new TypeError("VERCEL_PREVIEW_URL must contain only a trusted Vercel HTTPS origin.");
  }

  return url;
}
