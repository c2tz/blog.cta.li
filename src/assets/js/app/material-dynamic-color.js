import { MATERIAL_DYNAMIC_COLOR_ROLES, SITE_EVENTS, SITE_STORAGE_KEYS } from "@/lib/site-contracts";
import { parseJsonValue } from "./site-persistence.js";

const PALETTE_VERSION = 1;
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function normalizeColor(value) {
  return typeof value === "string" && HEX_COLOR_PATTERN.test(value) ? value.toUpperCase() : null;
}

function normalizeScheme(value) {
  if (!value || typeof value !== "object") return null;

  const scheme = {};
  for (const role of MATERIAL_DYNAMIC_COLOR_ROLES) {
    const color = normalizeColor(value[role]);
    if (!color) return null;
    scheme[role] = color;
  }

  return scheme;
}

function normalizeMaterialDynamicColorPalette(value) {
  let candidate = value;
  if (typeof candidate === "string") {
    candidate = parseJsonValue(candidate);
  }

  if (!candidate || typeof candidate !== "object" || candidate.version !== PALETTE_VERSION) {
    return null;
  }

  const sourceColor = normalizeColor(candidate.sourceColor);
  const light = normalizeScheme(candidate.schemes?.light);
  const dark = normalizeScheme(candidate.schemes?.dark);
  if (!sourceColor || !light || !dark) return null;

  return {
    version: PALETTE_VERSION,
    imageId:
      typeof candidate.imageId === "string" || typeof candidate.imageId === "number"
        ? String(candidate.imageId)
        : null,
    imageUrl: typeof candidate.imageUrl === "string" ? candidate.imageUrl : "",
    sourceColor,
    updatedAt:
      typeof candidate.updatedAt === "string" ? candidate.updatedAt : new Date().toISOString(),
    schemes: { light, dark },
  };
}

export function readMaterialDynamicColorEnabled() {
  try {
    return localStorage.getItem(SITE_STORAGE_KEYS.materialDynamicColorEnabled) === "true";
  } catch {
    return false;
  }
}

export function readMaterialDynamicColorPalette() {
  try {
    return normalizeMaterialDynamicColorPalette(
      localStorage.getItem(SITE_STORAGE_KEYS.materialDynamicColorPalette),
    );
  } catch {
    return null;
  }
}

function clearMaterialDynamicColorProperties(root) {
  root.style.removeProperty("--md-source-color");
  root.style.removeProperty("--home-hero-initial-on-image");
  root.style.removeProperty("--home-hero-initial-on-image-muted");
  for (const role of MATERIAL_DYNAMIC_COLOR_ROLES) {
    root.style.removeProperty(`--md-sys-color-${role}`);
  }
}

export function syncMaterialDynamicColor({ palette: paletteInput } = {}) {
  const root = document.documentElement;
  const palette =
    paletteInput === undefined
      ? readMaterialDynamicColorPalette()
      : normalizeMaterialDynamicColorPalette(paletteInput);
  const enabled = readMaterialDynamicColorEnabled();
  const detailed = root.dataset.homeDetailView === "true";
  const theme = root.dataset.theme === "dark" ? "dark" : "light";
  const active = Boolean(enabled && detailed && palette);

  clearMaterialDynamicColorProperties(root);
  root.toggleAttribute("data-material-dynamic-color-preference", enabled);

  if (active && palette) {
    root.dataset.materialDynamicColor = "true";
    root.dataset.materialDynamicColorSource = palette.sourceColor;
    root.style.setProperty("--md-source-color", palette.sourceColor);
    root.style.setProperty("--home-hero-initial-on-image", palette.schemes.dark.primary);
    root.style.setProperty("--home-hero-initial-on-image-muted", palette.schemes.dark.secondary);
    for (const role of MATERIAL_DYNAMIC_COLOR_ROLES) {
      root.style.setProperty(`--md-sys-color-${role}`, palette.schemes[theme][role]);
    }
  } else {
    delete root.dataset.materialDynamicColor;
    delete root.dataset.materialDynamicColorSource;
  }

  const state = {
    active,
    detailed,
    enabled,
    imageId: palette?.imageId ?? null,
    paletteAvailable: Boolean(palette),
    sourceColor: palette?.sourceColor ?? null,
    theme,
  };
  document.dispatchEvent(
    new CustomEvent(SITE_EVENTS.materialDynamicColorChange, { detail: state }),
  );
  return state;
}

export function setMaterialDynamicColorEnabled(enabled) {
  try {
    localStorage.setItem(SITE_STORAGE_KEYS.materialDynamicColorEnabled, enabled ? "true" : "false");
  } catch {}
  return syncMaterialDynamicColor();
}

export function storeMaterialDynamicColorPalette(value) {
  const palette = normalizeMaterialDynamicColorPalette(value);
  if (!palette) return null;

  try {
    localStorage.setItem(SITE_STORAGE_KEYS.materialDynamicColorPalette, JSON.stringify(palette));
  } catch {}
  syncMaterialDynamicColor({ palette });
  return palette;
}

export function isMaterialDynamicColorActive() {
  return document.documentElement.dataset.materialDynamicColor === "true";
}
