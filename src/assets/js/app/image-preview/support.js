export const DOUBLE_TAP_DISTANCE = 34;
export const DOUBLE_TAP_MS = 280;
export const CHECK_ICON = "\uE5CA";
export const FULLSCREEN_EXIT_ICON = "\uE5D1";
export const FULLSCREEN_ICON = "\uE5D0";
export const GALLERY_MOTION_DURATION_MS = 320;
const HISTORY_STATE_KEY = "__siteImageDialog";
export const IMAGE_DIALOG_SCRIM_OPACITY = 0.68;
export const INFORMATION_LOADING_DELAY_MS = 200;
export const SHARE_FEEDBACK_DURATION_MS = 2200;
export const SHARE_ICON = "\uE80D";
export const DRAG_AXIS_LOCK_DISTANCE = 8;
export const DISMISS_DISTANCE = 84;
export const DISMISS_FADE_END_RATIO = 0.95;
export const DISMISS_FADE_START_RATIO = 0.6;
export const DISMISS_IMAGE_OPACITY_REDUCTION = 0.82;
export const DISMISS_SCRIM_OPACITY_REDUCTION = 0.55;
export const DISMISS_VELOCITY = 0.5;
export const SWIPE_DISTANCE = 56;
export const SWIPE_DURATION_MS = 900;
export const SWIPE_VELOCITY = 0.45;
export const TAP_DISTANCE = 10;
export const TAP_DURATION_MS = 360;
export const TRACKPAD_SWIPE_DISTANCE = 72;
export const TRACKPAD_SWIPE_LOCK_MS = 420;
export const TRACKPAD_SWIPE_RESET_MS = 180;
export const ZOOM_GESTURE_COOLDOWN_MS = 240;
export const ZOOM_EPSILON = 0.01;

export const IMAGE_DIALOG_OPEN_ANIMATION = {
  dialog: [[[{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: "linear", fill: "both" }]],
  scrim: [[[{ opacity: 0 }, { opacity: 0.68 }], { duration: 240, easing: "linear", fill: "both" }]],
  content: [
    [
      [
        { opacity: 0, transform: "scale(0.985)" },
        { opacity: 1, transform: "scale(1)" },
      ],
      { duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)", fill: "both" },
    ],
  ],
};

export const IMAGE_DIALOG_CLOSE_ANIMATION = {
  dialog: [[[{ opacity: 1 }, { opacity: 0 }], { duration: 75, easing: "linear", fill: "both" }]],
  scrim: [[[{ opacity: 0.68 }, { opacity: 0 }], { duration: 120, easing: "linear", fill: "both" }]],
  content: [[[{ opacity: 1 }, { opacity: 0 }], { duration: 75, easing: "linear", fill: "both" }]],
};

export const INFORMATION_DIALOG_OPEN_ANIMATION = {
  dialog: [
    [
      [
        { opacity: 0, transform: "translateY(0.5rem) scale(0.98)" },
        { opacity: 1, transform: "translateY(0) scale(1)" },
      ],
      { duration: 240, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "both" },
    ],
  ],
  scrim: [[[{ opacity: 0 }, { opacity: 0.32 }], { duration: 180, easing: "linear", fill: "both" }]],
};

export const INFORMATION_DIALOG_CLOSE_ANIMATION = {
  dialog: [
    [
      [
        { opacity: 1, transform: "translateY(0) scale(1)" },
        { opacity: 0, transform: "translateY(0.25rem) scale(0.99)" },
      ],
      { duration: 120, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "both" },
    ],
  ],
  scrim: [[[{ opacity: 0.32 }, { opacity: 0 }], { duration: 120, easing: "linear", fill: "both" }]],
};

export function fileNameFromURL(src, baseURI = document.baseURI) {
  try {
    const parsed = new URL(src, baseURI);
    const sourceUrl = parsed.searchParams.get("href");
    if (sourceUrl && parsed.pathname.endsWith("/_image")) {
      return fileNameFromURL(sourceUrl, baseURI);
    }

    return decodeURIComponent(parsed.pathname.split("/").filter(Boolean).at(-1) ?? "image");
  } catch {
    return "image";
  }
}

export function requiredElement(root, selector) {
  const element = root.querySelector(selector);
  if (!element) throw new Error(`Élément du lecteur d’images introuvable : ${selector}`);
  return element;
}

export function distanceBetween(first, second) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

export function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function formatByteSize(bytes) {
  const exact = new Intl.NumberFormat("fr-FR").format(bytes);
  if (bytes < 1024) return `${exact} octet${bytes > 1 ? "s" : ""}`;

  const units = ["ko", "Mo", "Go"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)) - 1, units.length - 1);
  const value = bytes / 1024 ** (unitIndex + 1);
  const compact = new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: value >= 100 ? 0 : value >= 10 ? 1 : 2,
  }).format(value);

  return `${compact} ${units[unitIndex]} (${exact} octets)`;
}

export function formatImageDate(value) {
  if (!value) return "Indisponible";

  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Indisponible";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

export function imageTypeLabel(src, contentType) {
  const mimeSubtype = contentType?.match(/^image\/([^;]+)/i)?.[1];
  let format = mimeSubtype;

  try {
    const parsed = new URL(src, document.baseURI);
    format ||= parsed.searchParams.get("f") || undefined;
    format ||= fileNameFromURL(src).split(".").pop();
  } catch {}

  const labels = new Map([
    ["avif", "AVIF"],
    ["gif", "GIF"],
    ["jpeg", "JPEG"],
    ["jpg", "JPEG"],
    ["png", "PNG"],
    ["svg+xml", "SVG"],
    ["webp", "WebP"],
  ]);
  const normalized = format?.toLowerCase();

  return normalized ? `Image ${labels.get(normalized) ?? normalized.toUpperCase()}` : "Image";
}

export function loadedResourceSize(src) {
  if (typeof performance === "undefined") return 0;

  const entry = performance.getEntriesByName(src, "resource").at(-1);
  return entry?.encodedBodySize || entry?.transferSize || 0;
}

export function isHistoryMarker(state, token) {
  return Boolean(state && typeof state === "object" && state[HISTORY_STATE_KEY] === token);
}

export function historyStateWithMarker(token) {
  const current = history.state;
  return {
    ...(current && typeof current === "object" ? current : {}),
    [HISTORY_STATE_KEY]: token,
  };
}

export function restoreInlineStyle(style, property, value) {
  if (value) style.setProperty(property, value);
  else style.removeProperty(property);
}

export function decodeImageSource(src) {
  return new Promise((resolve) => {
    const image = new Image();
    let settled = false;
    const finish = (loaded) => {
      if (settled) return;
      settled = true;
      resolve(loaded);
    };

    image.decoding = "async";
    image.onload = async () => {
      try {
        await image.decode?.();
      } catch {}
      finish(true);
    };
    image.onerror = () => finish(false);
    image.src = src;
    if (image.complete) queueMicrotask(() => finish(image.naturalWidth > 0));
  });
}
