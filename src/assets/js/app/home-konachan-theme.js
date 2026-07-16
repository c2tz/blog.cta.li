import {
  Hct,
  MaterialDynamicColors,
  SchemeTonalSpot,
  argbFromHex,
  hexFromArgb,
  sourceColorFromImageBytes,
} from "@material/material-color-utilities";
import {
  isMaterialDynamicColorActive,
  storeMaterialDynamicColorPalette,
  syncMaterialDynamicColor,
} from "./material-dynamic-color.js";
import { withDeterministicMaterialSourceColorRandom } from "./material-source-color-random.js";
import { sourceColorFromImageBytesInWorker } from "./material-source-color-worker.js";
import { MATERIAL_DYNAMIC_COLOR_ROLES, SITE_EVENTS } from "@/lib/site-contracts";

const MATERIAL_DYNAMIC_COLORS = new MaterialDynamicColors();
const MATERIAL_DYNAMIC_SPEC_VERSION = "2021";
const MATERIAL_DYNAMIC_VARIANT = SchemeTonalSpot;

export function createHomeKonachanThemeController({
  imageThemeCacheKey,
  imageThemeCandidates,
  landingSelector,
  preload,
  state,
}) {
  const LANDING_SELECTOR = landingSelector;
  const DYNAMIC_HERO_COLOR_PROPERTIES = [
    "--home-hero-on-image",
    "--home-hero-on-image-muted",
    "--home-hero-accent",
    "--home-hero-tonal-container",
    "--home-hero-tonal-label",
    "--home-hero-tonal-hover",
  ];
  const HOME_DYNAMIC_TOKEN_NAMES = MATERIAL_DYNAMIC_COLOR_ROLES;
  const HOME_DYNAMIC_ROLE_METHODS = {
    background: "background",
    error: "error",
    "error-container": "errorContainer",
    "inverse-on-surface": "inverseOnSurface",
    "inverse-primary": "inversePrimary",
    "inverse-surface": "inverseSurface",
    "on-background": "onBackground",
    "on-error": "onError",
    "on-error-container": "onErrorContainer",
    "on-primary": "onPrimary",
    "on-primary-container": "onPrimaryContainer",
    "on-primary-fixed": "onPrimaryFixed",
    "on-primary-fixed-variant": "onPrimaryFixedVariant",
    "on-secondary": "onSecondary",
    "on-secondary-container": "onSecondaryContainer",
    "on-secondary-fixed": "onSecondaryFixed",
    "on-secondary-fixed-variant": "onSecondaryFixedVariant",
    "on-surface": "onSurface",
    "on-surface-variant": "onSurfaceVariant",
    "on-tertiary": "onTertiary",
    "on-tertiary-container": "onTertiaryContainer",
    "on-tertiary-fixed": "onTertiaryFixed",
    "on-tertiary-fixed-variant": "onTertiaryFixedVariant",
    outline: "outline",
    "outline-variant": "outlineVariant",
    primary: "primary",
    "primary-container": "primaryContainer",
    "primary-fixed": "primaryFixed",
    "primary-fixed-dim": "primaryFixedDim",
    scrim: "scrim",
    secondary: "secondary",
    "secondary-container": "secondaryContainer",
    "secondary-fixed": "secondaryFixed",
    "secondary-fixed-dim": "secondaryFixedDim",
    shadow: "shadow",
    surface: "surface",
    "surface-bright": "surfaceBright",
    "surface-container": "surfaceContainer",
    "surface-container-high": "surfaceContainerHigh",
    "surface-container-highest": "surfaceContainerHighest",
    "surface-container-low": "surfaceContainerLow",
    "surface-container-lowest": "surfaceContainerLowest",
    "surface-dim": "surfaceDim",
    "surface-tint": "surfaceTint",
    "surface-variant": "surfaceVariant",
    tertiary: "tertiary",
    "tertiary-container": "tertiaryContainer",
    "tertiary-fixed": "tertiaryFixed",
    "tertiary-fixed-dim": "tertiaryFixedDim",
  };

  function cssColor(argb) {
    return hexFromArgb(argb);
  }

  function isDarkTheme() {
    return document.documentElement.dataset.theme === "dark";
  }

  function tokensFromTheme(theme, { dark }) {
    const scheme = dark ? theme.dark : theme.light;
    const tokens = {};

    for (const name of HOME_DYNAMIC_TOKEN_NAMES) {
      const method = HOME_DYNAMIC_ROLE_METHODS[name];
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

  function imageBytes(image) {
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context || width <= 0 || height <= 0) {
      throw new Error("konachan_dynamic_theme_canvas_unavailable");
    }

    canvas.width = width;
    canvas.height = height;
    context.drawImage(image, 0, 0, width, height);
    return context.getImageData(0, 0, width, height).data;
  }

  function deterministicMaterialSourceColorFromBytes(bytes) {
    return withDeterministicMaterialSourceColorRandom(() => sourceColorFromImageBytes(bytes));
  }

  async function deterministicMaterialSourceColor(image) {
    let bytes = imageBytes(image);

    try {
      return await sourceColorFromImageBytesInWorker(bytes);
    } catch {
      // A successful transfer detaches the main-thread buffer. Recreate the
      // exact full-resolution pixels only when the Worker cannot return them.
      if (bytes.byteLength === 0) bytes = imageBytes(image);
      return deterministicMaterialSourceColorFromBytes(bytes);
    }
  }

  async function createHomeDynamicTheme(image) {
    const sourceColor = await deterministicMaterialSourceColor(image);

    return createHomeDynamicThemeFromSourceColor(sourceColor);
  }

  function createHomeDynamicThemeFromSourceColor(sourceColor) {
    return {
      dark: createHomeDynamicScheme(sourceColor, { dark: true }),
      light: createHomeDynamicScheme(sourceColor, { dark: false }),
      sourceColor,
    };
  }

  async function createHomeDynamicThemeFromUrl(url) {
    const { image } = await preload(url);
    return createHomeDynamicTheme(image);
  }

  function applyHomeDynamicTokens(theme, image, loadedUrl) {
    const palette = storeMaterialDynamicColorPalette({
      version: 1,
      imageId: typeof image === "object" ? image?.id : null,
      imageUrl: loadedUrl,
      sourceColor: cssColor(theme.sourceColor),
      updatedAt: new Date().toISOString(),
      schemes: {
        dark: tokensFromTheme(theme, { dark: true }),
        light: tokensFromTheme(theme, { dark: false }),
      },
    });

    return palette ? tokensFromTheme(theme, { dark: isDarkTheme() }) : null;
  }

  function applyHeroDynamicTokens(landing, theme) {
    if (!landing) return;

    const tokens = tokensFromTheme(theme, { dark: true });
    landing.dataset.heroDynamicColor = "true";
    landing.style.setProperty("--home-hero-on-image", tokens.primary);
    landing.style.setProperty("--home-hero-on-image-muted", tokens.secondary);
    landing.style.setProperty("--home-hero-accent", tokens.primary);
    landing.style.setProperty("--home-hero-tonal-container", tokens["primary-container"]);
    landing.style.setProperty("--home-hero-tonal-label", tokens["on-primary-container"]);
    landing.style.setProperty("--home-hero-tonal-hover", tokens["primary-container"]);
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
      return null;
    }

    applyHeroDynamicTokens(landing, state.dynamicTheme);
    return tokensFromTheme(state.dynamicTheme, { dark: true });
  }

  function initHomeDynamicThemeSync() {
    if (state.themeSyncReady) return;

    state.themeSyncReady = true;
    document.addEventListener(SITE_EVENTS.materialDynamicColorChange, () => {
      syncDynamicHeroColor(document.querySelector(LANDING_SELECTOR));
    });
  }

  async function resolveHomeDynamicTheme(image, loadedImage, loadedUrl) {
    const precomputedSourceColor =
      typeof image === "object" && /^#[0-9a-f]{6}$/i.test(image?.sourceColor)
        ? image.sourceColor
        : null;
    const precomputedCacheKey = imageThemeCacheKey(image, loadedUrl);
    const precomputedCachedTheme = state.dynamicThemeCache.get(precomputedCacheKey);
    if (precomputedCachedTheme) return precomputedCachedTheme;
    if (precomputedSourceColor) {
      const theme = createHomeDynamicThemeFromSourceColor(argbFromHex(precomputedSourceColor));
      state.dynamicThemeCache.set(precomputedCacheKey, theme);
      return theme;
    }

    const candidates = imageThemeCandidates(image, loadedUrl);

    for (const candidate of candidates) {
      const cacheKey = imageThemeCacheKey(image, candidate);
      const cachedTheme = state.dynamicThemeCache.get(cacheKey);
      if (cachedTheme) return cachedTheme;

      try {
        const theme =
          candidate === loadedUrl && loadedImage
            ? await createHomeDynamicTheme(loadedImage)
            : await createHomeDynamicThemeFromUrl(candidate);

        state.dynamicThemeCache.set(cacheKey, theme);
        return theme;
      } catch (error) {
        console.warn(`[Konachan] Unable to extract Material color from ${candidate}.`, error);
      }
    }

    return null;
  }

  async function applyDynamicHeroColor(target, image, loadedImage, loadedUrl) {
    const landing = target.closest(LANDING_SELECTOR);
    if (!landing) return;

    try {
      const dynamicTheme = await resolveHomeDynamicTheme(image, loadedImage, loadedUrl);
      if (state.currentUrl !== loadedUrl) return;
      if (!dynamicTheme) throw new Error("konachan_dynamic_theme_unavailable");

      state.dynamicTheme = dynamicTheme;
      const tokens = applyHomeDynamicTokens(dynamicTheme, image, loadedUrl);
      if (!tokens) return;
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
