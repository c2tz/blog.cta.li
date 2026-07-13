export const pickRandom = (items) => items[Math.floor(Math.random() * items.length)];
export const shuffle = (items) => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
};
export const unique = (items) => [...new Set(items.filter(Boolean))];

export function normalizeUrl(url) {
  if (!url) return "";
  if (url.startsWith("//")) return `https:${url}`;
  try {
    return new URL(url, window.location.href).toString();
  } catch {
    return "";
  }
}

export function isSameOriginUrl(url) {
  try {
    return new URL(url, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

export function toCssUrl(url) {
  return `url("${url.replace(/["\\]/g, "\\$&")}")`;
}
