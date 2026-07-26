import {
  Hct,
  MaterialDynamicColors,
  SchemeTonalSpot,
  argbFromHex,
  hexFromArgb,
} from "@material/material-color-utilities";
import {
  isMaterialDynamicColorActive,
  storeMaterialDynamicColorPalette,
  syncMaterialDynamicColor,
} from "./material-dynamic-color.js";
import { MATERIAL_DYNAMIC_COLOR_ROLES, SITE_EVENTS } from "@/lib/site-contracts";

const MATERIAL_DYNAMIC_COLORS = new MaterialDynamicColors();
const MATERIAL_DYNAMIC_SPEC_VERSION = "2021";
const MATERIAL_DYNAMIC_VARIANT = SchemeTonalSpot;
const MATERIAL_DYNAMIC_COLOR_METHODS = MATERIAL_DYNAMIC_COLOR_ROLES.map((name) => [
  name,
  name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()),
]);

export function createHomeKonachanThemeController({ imageThemeCacheKey, landingSelector, state }) {
  const LANDING_SELECTOR = landingSelector;
  const DYNAMIC_HERO_COLOR_PROPERTIES = ["--home-hero-on-image", "--home-hero-on-image-muted"];

  function cssColor(argb) {
    return hexFromArgb(argb);
  }

  function tokensFromTheme(theme, { dark }) {
    const scheme = dark ? theme.dark : theme.light;
    const tokens = {};

    for (const [name, method] of MATERIAL_DYNAMIC_COLOR_METHODS) {
      tokens[name] = cssColor(scheme.getArgb(MATERIAL_DYNAMIC_COLORS[method]()));
    }

    return tokens;
  }

  function createHomeDynamicScheme(sourceColor, { dark }) {
    return new MATERIAL_DYNAMIC_VARIANT(
      Hct.fromInt(sourceColor),
      dark,
      0,
      MATERIAL_DYNAMIC_SPEC_VERSION,
    );
  }

  function createHomeDynamicThemeFromSourceColor(sourceColor) {
    return {
      dark: createHomeDynamicScheme(sourceColor, { dark: true }),
      light: createHomeDynamicScheme(sourceColor, { dark: false }),
      sourceColor,
    };
  }

  function applyHomeDynamicTokens(theme, image, loadedUrl) {
    return Boolean(
      storeMaterialDynamicColorPalette({
        version: 1,
        imageId: typeof image === "object" ? image?.id : null,
        imageUrl: loadedUrl,
        sourceColor: cssColor(theme.sourceColor),
        updatedAt: new Date().toISOString(),
        schemes: {
          dark: tokensFromTheme(theme, { dark: true }),
          light: tokensFromTheme(theme, { dark: false }),
        },
      }),
    );
  }

  function applyHeroDynamicTokens(landing, theme) {
    if (!landing) return;

    const primary = cssColor(theme.dark.getArgb(MATERIAL_DYNAMIC_COLORS.primary()));
    const secondary = cssColor(theme.dark.getArgb(MATERIAL_DYNAMIC_COLORS.secondary()));
    landing.dataset.heroDynamicColor = "true";
    landing.style.setProperty("--home-hero-on-image", primary);
    landing.style.setProperty("--home-hero-on-image-muted", secondary);
  }

  function clearDynamicHeroColor(landing) {
    if (!landing) return;

    delete landing.dataset.heroDynamicColor;
    for (const property of DYNAMIC_HERO_COLOR_PROPERTIES) {
      landing.style.removeProperty(property);
    }
  }

  function syncDynamicHeroColor(landing) {
    if (!state.dynamicTheme || !isMaterialDynamicColorActive()) {
      clearDynamicHeroColor(landing);
      return;
    }

    applyHeroDynamicTokens(landing, state.dynamicTheme);
  }

  function initHomeDynamicThemeSync() {
    if (state.themeSyncReady) return;

    state.themeSyncReady = true;
    document.addEventListener(SITE_EVENTS.materialDynamicColorChange, () => {
      syncDynamicHeroColor(document.querySelector(LANDING_SELECTOR));
    });
  }

  function resolveHomeDynamicTheme(image, loadedUrl) {
    const precomputedSourceColor =
      typeof image === "object" && /^#[0-9a-f]{6}$/i.test(image?.sourceColor)
        ? image.sourceColor
        : null;
    if (!precomputedSourceColor) return null;

    const cacheKey = imageThemeCacheKey(image, loadedUrl);
    const cachedTheme = state.dynamicThemeCache.get(cacheKey);
    if (cachedTheme) return cachedTheme;

    const theme = createHomeDynamicThemeFromSourceColor(argbFromHex(precomputedSourceColor));
    state.dynamicThemeCache.set(cacheKey, theme);
    return theme;
  }

  function applyDynamicHeroColor(target, image, loadedUrl) {
    const landing = target.closest(LANDING_SELECTOR);
    if (!landing) return;

    try {
      const dynamicTheme = resolveHomeDynamicTheme(image, loadedUrl);
      if (state.currentUrl !== loadedUrl) return;
      if (!dynamicTheme) throw new Error("konachan_dynamic_theme_unavailable");

      state.dynamicTheme = dynamicTheme;
      if (!applyHomeDynamicTokens(dynamicTheme, image, loadedUrl)) return;
      syncDynamicHeroColor(landing);
    } catch {
      state.dynamicTheme = null;
      syncMaterialDynamicColor();
      clearDynamicHeroColor(landing);
    }
  }

  return {
    applyDynamicHeroColor,
    clearDynamicHeroColor,
    initHomeDynamicThemeSync,
  };
}
