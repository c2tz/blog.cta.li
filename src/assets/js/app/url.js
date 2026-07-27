export function fileNameFromURL(url, baseURI = location.href, { trailingSlash = "fallback" } = {}) {
  try {
    const parsed = new URL(url, baseURI);
    const sourceUrl = parsed.searchParams.get("href");
    if (sourceUrl && parsed.pathname.endsWith("/_image")) {
      return fileNameFromURL(sourceUrl, baseURI, { trailingSlash });
    }

    const pathSegments = parsed.pathname.split("/");
    const fileName =
      trailingSlash === "last-segment" ? pathSegments.filter(Boolean).at(-1) : pathSegments.at(-1);
    return decodeURIComponent(fileName || "image");
  } catch {
    return "image";
  }
}
