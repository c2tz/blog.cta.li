const SITE_COOKIE_MAX_AGE_SECONDS = 31_536_000;

export function readCookieValue(cookieHeader, name) {
  if (!name) return null;

  const prefix = `${encodeURIComponent(name)}=`;
  const cookie = String(cookieHeader ?? "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  if (!cookie) return null;

  try {
    return decodeURIComponent(cookie.slice(prefix.length));
  } catch {
    return null;
  }
}

export function serializeCookie(
  name,
  value,
  { maxAgeSeconds = SITE_COOKIE_MAX_AGE_SECONDS, path = "/", sameSite = "Lax" } = {},
) {
  return [
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    `Max-Age=${Math.trunc(maxAgeSeconds)}`,
    `Path=${path}`,
    `SameSite=${sameSite}`,
  ].join("; ");
}

export function parseJsonValue(value) {
  if (typeof value !== "string" || value.length === 0) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function parseVersionedState(value, version = 1) {
  const state = parseJsonValue(value);
  return state && typeof state === "object" && !Array.isArray(state) && state.version === version
    ? state
    : null;
}

export function firstNormalizedValue(values, normalize, fallback = null) {
  for (const value of values) {
    const normalized = normalize(value);
    if (normalized !== null && normalized !== undefined) return normalized;
  }

  return fallback;
}
