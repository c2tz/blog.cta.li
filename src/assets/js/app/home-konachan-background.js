import {
  Hct,
  MaterialDynamicColors,
  SchemeTonalSpot,
  hexFromArgb,
  sourceColorFromImageBytes,
} from "@material/material-color-utilities";
import {
  isMaterialDynamicColorActive,
  storeMaterialDynamicColorPalette,
  syncMaterialDynamicColor,
} from "@/assets/js/app/material-dynamic-color";
import { withDeterministicMaterialSourceColorRandom } from "@/assets/js/app/material-source-color-random";
import { sourceColorFromImageBytesInWorker } from "@/assets/js/app/material-source-color-worker";
import { MATERIAL_DYNAMIC_COLOR_ROLES, SITE_EVENTS } from "@/lib/site-contracts";

const MATERIAL_DYNAMIC_COLORS = new MaterialDynamicColors();
const MATERIAL_DYNAMIC_SPEC_VERSION = "2021";
const MATERIAL_DYNAMIC_VARIANT = SchemeTonalSpot;

function readHomeKonachanConfig() {
  const element = document.getElementById("home-konachan-config");
  if (!element?.textContent) return null;

  try {
    return JSON.parse(element.textContent);
  } catch {
    return null;
  }
}

export function initHomeKonachanBackgroundFromDocument() {
  const options = readHomeKonachanConfig();
  if (!options?.konachanClientConfig) return;

  initHomeKonachanBackground(options);
}

export function initHomeKonachanBackground({ initialBackground = null, konachanClientConfig }) {
  const TARGET_SELECTOR = "[data-konachan-background]";
  const CREDIT_SELECTOR = "[data-konachan-credit]";
  const CREDIT_LINK_SELECTOR = "[data-konachan-credit-link]";
  const LANDING_SELECTOR = ".home-anime-landing";
  const STATUS_SELECTOR = "[data-konachan-status]";
  const MANIFEST_URL = new URL("/konachan-backgrounds.json?v=5", window.location.href).toString();
  const EXPLICIT_CONTENT_CHANGE_EVENT = konachanClientConfig.events.explicitContentChange;
  const EXPLICIT_CONTENT_COOKIE = konachanClientConfig.explicitContentCookieName;
  const EXPLICIT_CONTENT_KEY = konachanClientConfig.explicitContentStorageKey;
  const KONACHAN_CACHE_KEY = konachanClientConfig.storageKey;
  const KONACHAN_LEGACY_CACHE_KEY = konachanClientConfig.legacyStorageKey;
  const KONACHAN_RATING_COOKIE = konachanClientConfig.ratingCookieName;
  const KONACHAN_LEGACY_RATING_COOKIE = konachanClientConfig.legacyRatingCookieName;
  const KONACHAN_RATING_KEY = konachanClientConfig.ratingStorageKey;
  const KONACHAN_LEGACY_RATING_KEY = konachanClientConfig.legacyRatingStorageKey;
  const KONACHAN_CACHE_NAME = konachanClientConfig.cacheName;
  const KONACHAN_CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
  const KONACHAN_MANIFEST_RELOAD_MS = 24 * 60 * 60 * 1000;
  const INITIAL_BACKGROUND = initialBackground;
  const RATING_RANK = {
    safe: 0,
    questionable: 1,
    explicit: 2,
  };
  const state = {
    currentImage: null,
    currentUrl: "",
    dynamicTheme: null,
    dynamicThemeCache: new Map(),
    images: [],
    ratingPreference: "safe",
    refreshPromise: null,
    themeSyncReady: false,
  };

  const pickRandom = (items) => items[Math.floor(Math.random() * items.length)];
  const shuffle = (items) => {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[target]] = [copy[target], copy[index]];
    }
    return copy;
  };
  const unique = (items) => [...new Set(items.filter(Boolean))];

  function normalizeUrl(url) {
    if (!url) return "";
    if (url.startsWith("//")) return `https:${url}`;
    try {
      return new URL(url, window.location.href).toString();
    } catch {
      return "";
    }
  }

  function isSameOriginUrl(url) {
    try {
      return new URL(url, window.location.href).origin === window.location.origin;
    } catch {
      return false;
    }
  }

  function toCssUrl(url) {
    return `url("${url.replace(/["\\]/g, "\\$&")}")`;
  }

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

  function setBackgroundImage(target, url) {
    target.style.setProperty("--home-konachan-image", toCssUrl(url));
  }

  function preload(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve({ image, url });
      image.onerror = reject;
      image.src = url;
    });
  }

  function readStoredImages() {
    try {
      const current = localStorage.getItem(KONACHAN_CACHE_KEY);
      const cached = JSON.parse(current || "null");
      if (!cached?.storedAt || !Array.isArray(cached.images)) return null;
      if (Date.now() - cached.storedAt > KONACHAN_CACHE_TTL_MS) return null;
      return cached;
    } catch {
      return null;
    }
  }

  function writeStoredImages(images, currentImage) {
    try {
      localStorage.setItem(
        KONACHAN_CACHE_KEY,
        JSON.stringify({
          storedAt: Date.now(),
          images: images.slice(0, 96),
          currentImage: normalizeImage(currentImage),
        }),
      );
      localStorage.removeItem(KONACHAN_LEGACY_CACHE_KEY);
    } catch {}
  }

  function rememberLoadedImage(image, loadedUrl) {
    const normalizedImage = normalizeImage(image);
    if (!normalizedImage) return;

    const cachedImages = readStoredImages()?.images ?? [];
    const rememberedImage =
      typeof normalizedImage === "string"
        ? normalizeUrl(loadedUrl) || normalizedImage
        : {
            ...normalizedImage,
            url: normalizeUrl(loadedUrl) || normalizedImage.url,
          };
    writeStoredImages(mergeImages(rememberedImage, cachedImages), rememberedImage);
  }

  function readStoredCurrentImage() {
    const image = normalizeImage(readStoredImages()?.currentImage);
    return image && ratingAllowed(image) ? image : null;
  }

  async function readCachedJson(url) {
    if (!("caches" in window)) return null;

    try {
      const cache = await caches.open(KONACHAN_CACHE_NAME);
      const response = await cache.match(url);
      if (!response?.ok) return null;
      const text = await response.text();
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  async function cacheJsonResponse(url, text) {
    if (!("caches" in window)) return;

    try {
      const cache = await caches.open(KONACHAN_CACHE_NAME);
      await cache.put(
        url,
        new Response(text, {
          headers: {
            "content-type": "application/json; charset=utf-8",
          },
        }),
      );
    } catch {}
  }

  async function readManifestResponse(response) {
    if (!response.ok) throw new Error(`konachan_manifest_${response.status}`);

    const text = await response.text();
    const normalizedText = text.trim();

    if (!normalizedText.startsWith("{")) {
      throw new Error("konachan_manifest_not_json");
    }

    let manifest;
    try {
      manifest = JSON.parse(normalizedText);
    } catch {
      throw new Error("konachan_manifest_invalid_json");
    }

    await cacheJsonResponse(MANIFEST_URL, text);
    return Array.isArray(manifest.images) ? manifest.images : [];
  }

  async function readManifest({ cache = "no-cache" } = {}) {
    try {
      const response = await fetch(MANIFEST_URL, {
        credentials: "same-origin",
        cache,
      });

      const images = await readManifestResponse(response);
      if (images.length === 0) {
        console.warn("[Konachan] The deployed manifest contains no images.");
      }
      return images;
    } catch (error) {
      console.warn(
        "[Konachan] Unable to load the deployed manifest.",
        error instanceof Error ? error.message : error,
      );
      const cached = await readCachedJson(MANIFEST_URL);
      return Array.isArray(cached?.images) ? cached.images : [];
    }
  }

  function normalizeImage(image) {
    if (typeof image === "string") return image;
    if (!image || typeof image !== "object") return null;

    const url = normalizeUrl(image.url);
    const originalUrl = normalizeUrl(image.originalUrl || image.remoteUrl);
    const rating = normalizeRating(image.rating);
    if (!url && !originalUrl) return null;

    return {
      ...image,
      rating,
      url: url || originalUrl,
      originalUrl,
    };
  }

  function normalizeRating(value) {
    if (value === "explicit" || value === "e") return "explicit";
    if (value === "questionable" || value === "q" || value === "sensitive") {
      return "questionable";
    }

    return "safe";
  }

  function normalizeRatingPreference(value) {
    const rating = normalizeRating(value);
    return rating in RATING_RANK ? rating : "safe";
  }

  function readCookie(name) {
    if (!name) return null;

    const encodedName = `${encodeURIComponent(name)}=`;
    const cookie = document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(encodedName));

    if (!cookie) return null;

    try {
      return decodeURIComponent(cookie.slice(encodedName.length));
    } catch {
      return null;
    }
  }

  function readRatingPreference() {
    const restorePreference = (value) => {
      const preference = normalizeRatingPreference(value);
      return preference === "explicit" ? "safe" : preference;
    };

    try {
      return restorePreference(
        localStorage.getItem(KONACHAN_RATING_KEY) ||
          localStorage.getItem(KONACHAN_LEGACY_RATING_KEY) ||
          readCookie(KONACHAN_RATING_COOKIE) ||
          readCookie(KONACHAN_LEGACY_RATING_COOKIE),
      );
    } catch {
      return restorePreference(
        readCookie(KONACHAN_RATING_COOKIE) || readCookie(KONACHAN_LEGACY_RATING_COOKIE),
      );
    }
  }

  function explicitContentAcknowledged() {
    try {
      const stored = JSON.parse(localStorage.getItem(EXPLICIT_CONTENT_KEY) || "null");
      if (stored?.version === 1 && stored.acknowledged === true) return true;
    } catch {}

    return readCookie(EXPLICIT_CONTENT_COOKIE) === "acknowledged";
  }

  function mergeImages(...groups) {
    const byKey = new Map();

    for (const image of groups.flat().map(normalizeImage).filter(Boolean)) {
      const key =
        typeof image === "string" ? image : String(image.id || image.originalUrl || image.url);
      if (!byKey.has(key)) byKey.set(key, image);
    }

    return shuffle([...byKey.values()]);
  }

  function formatCredit(image) {
    if (!image) return "Voir la source";

    const parts = [];
    if (image.author) parts.push(image.author);
    if (image.id) parts.push(`#${image.id}`);

    return parts.length > 0 ? parts.join(" ") : "Voir la source";
  }

  function setCredit(image) {
    const credit = document.querySelector(CREDIT_SELECTOR);
    const link = document.querySelector(CREDIT_LINK_SELECTOR);
    if (!credit || !link) return;

    credit.hidden = false;

    if (!image?.source) {
      link.removeAttribute("data-tooltip");
      link.hidden = true;
      return;
    }

    link.href = image.source;
    link.textContent = formatCredit(image);
    link.removeAttribute("data-tooltip");
    link.hidden = false;
  }

  function imageCandidates(image) {
    if (typeof image === "string") {
      return unique([normalizeUrl(image)]).filter(isSameOriginUrl);
    }

    return unique([image?.url].map(normalizeUrl)).filter(isSameOriginUrl);
  }

  function imageThemeCandidates(image, loadedUrl) {
    const variantCandidates =
      typeof image === "object" && Array.isArray(image?.variants)
        ? image.variants
            .map((variant) => ({
              url: normalizeUrl(variant?.url),
              width: Number(variant?.width) || 0,
            }))
            .filter((variant) => variant.url)
            .sort(
              (left, right) =>
                Math.abs(left.width - 960) - Math.abs(right.width - 960) ||
                left.width - right.width,
            )
            .map((variant) => variant.url)
        : [];

    const canonicalUrl = typeof image === "string" ? image : image?.url;

    return unique([...variantCandidates, loadedUrl, normalizeUrl(canonicalUrl)])
      .map(normalizeUrl)
      .filter(isSameOriginUrl);
  }

  function imageThemeCacheKey(image, url) {
    if (typeof image === "object" && image?.id) return `konachan:${image.id}`;
    return normalizeUrl(url);
  }

  function ratingAllowed(image) {
    if (typeof image === "string") return true;
    return RATING_RANK[normalizeRating(image?.rating)] <= RATING_RANK[state.ratingPreference];
  }

  function allowedImages(images) {
    return images.filter(ratingAllowed);
  }

  function preferredImages(images) {
    return images.filter((image) => {
      if (typeof image === "string") return state.ratingPreference === "safe";

      return normalizeRating(image?.rating) === state.ratingPreference;
    });
  }

  function refreshCandidates(images) {
    const preferred = preferredImages(images);
    return preferred.length > 0 ? preferred : allowedImages(images);
  }

  function readLocalImagePool() {
    const cached = readStoredImages();
    if (cached?.images?.length) {
      state.images = mergeImages(state.images, cached.images);
    }

    return state.images;
  }

  function currentImage() {
    if (state.currentImage) return state.currentImage;

    const match = state.images.find((image) => imageCandidates(image).includes(state.currentUrl));
    state.currentImage = match || null;
    return state.currentImage;
  }

  function currentImageAllowed() {
    if (!state.currentUrl) return true;
    const image = currentImage();
    return image ? ratingAllowed(image) : true;
  }

  function clearBackground(target) {
    target.style.removeProperty("--home-konachan-image");
    target.dataset.loaded = "false";
    target.dataset.konachanCurrentUrl = "";
    clearDynamicHeroColor(target.closest(LANDING_SELECTOR));
    state.currentImage = null;
    state.currentUrl = "";
    state.dynamicTheme = null;
  }

  function syncExplicitContentState(landing, target) {
    const acknowledged = explicitContentAcknowledged();
    landing?.setAttribute("data-explicit-content", acknowledged ? "accepted" : "pending");

    if (!acknowledged) {
      clearBackground(target);
      setCredit(null);
    }

    return acknowledged;
  }

  async function refreshImagePool({ forceReload = false } = {}) {
    if (state.refreshPromise) return state.refreshPromise;

    state.refreshPromise = (async () => {
      const cached = forceReload ? null : readStoredImages();
      if (cached?.images?.length && state.images.length === 0) {
        state.images = mergeImages(cached.images);
      }

      const shouldReloadManifest =
        forceReload ||
        !cached?.images?.length ||
        Date.now() - (cached?.storedAt || 0) > KONACHAN_MANIFEST_RELOAD_MS;

      const freshImages = shouldReloadManifest
        ? await readManifest({ cache: forceReload ? "reload" : "no-cache" })
        : [];
      const merged = freshImages.length > 0 ? mergeImages(freshImages) : mergeImages(state.images);

      if (merged.length > 0) {
        state.images = merged;
      }

      return refreshCandidates(state.images);
    })().finally(() => {
      state.refreshPromise = null;
    });

    return state.refreshPromise;
  }

  async function setBackground(target, image) {
    const candidates = imageCandidates(image);
    if (candidates.length === 0) return false;

    let loadedUrl = "";
    let loadedImage = null;
    for (const candidate of candidates) {
      try {
        const loaded = await preload(candidate);
        loadedUrl = loaded.url;
        loadedImage = loaded.image;
        break;
      } catch (error) {
        console.warn(`[Konachan] Unable to preload ${candidate}.`, error);
      }
    }

    if (!loadedUrl) throw new Error("konachan_image_unavailable");

    setBackgroundImage(target, loadedUrl);
    target.dataset.loaded = "true";
    target.dataset.konachanCurrentUrl = loadedUrl;
    state.currentImage = image;
    state.currentUrl = loadedUrl;
    await applyDynamicHeroColor(target, image, loadedImage, loadedUrl);
    setCredit(typeof image === "string" ? null : image);
    rememberLoadedImage(image, loadedUrl);
    return true;
  }

  async function rotate(target) {
    const pool = refreshCandidates(state.images);
    const candidates = pool.filter((image) => !imageCandidates(image).includes(state.currentUrl));
    const selected = pickRandom(candidates.length > 0 ? candidates : pool);
    if (!selected) return false;

    try {
      return await setBackground(target, selected);
    } catch {
      state.images = state.images.filter((image) => image !== selected);
      const next = pickRandom(allowedImages(state.images));
      return next ? setBackground(target, next).catch(() => false) : false;
    }
  }

  function initKonachanBackground() {
    const target = document.querySelector(TARGET_SELECTOR);
    if (!target || !("style" in target) || target.dataset.ready === "true") return;

    target.dataset.ready = "true";
    initHomeDynamicThemeSync();
    state.ratingPreference = readRatingPreference();
    state.currentUrl = normalizeUrl(target.dataset.konachanCurrentUrl || INITIAL_BACKGROUND?.url);
    setCredit(INITIAL_BACKGROUND);
    const landing = target.closest(LANDING_SELECTOR);
    const status = document.querySelector(STATUS_SELECTOR);

    const setRefreshState = ({ busy, message }) => {
      if (status) status.textContent = message;
      landing?.setAttribute("aria-busy", String(busy));

      document.dispatchEvent(
        new CustomEvent(konachanClientConfig.events.refreshState, {
          detail: {
            busy,
            loaded: target.dataset.loaded === "true",
            status: message,
          },
        }),
      );
    };

    const refresh = async ({
      forceReload = false,
      rotateAfter = false,
      preferredImage = null,
    } = {}) => {
      if (!syncExplicitContentState(landing, target)) {
        setRefreshState({ busy: false, message: "Avertissement à confirmer" });
        return;
      }

      setRefreshState({ busy: true, message: "Chargement de l'image" });
      let message = "Image indisponible";

      try {
        await refreshImagePool({ forceReload });
        let changed = target.dataset.loaded === "true" && !rotateAfter;
        if (preferredImage && target.dataset.loaded !== "true") {
          try {
            changed = await setBackground(target, preferredImage);
          } catch {
            changed = false;
          }
        }
        if (!changed && (rotateAfter || target.dataset.loaded !== "true")) {
          changed = await rotate(target);
        }
        message = changed ? "Image mise à jour" : message;
      } catch {
        message = target.dataset.loaded === "true" ? "Image prête" : message;
      } finally {
        setRefreshState({ busy: false, message });
      }
    };

    const enforceRatingFilter = async () => {
      if (!syncExplicitContentState(landing, target)) {
        setRefreshState({ busy: false, message: "Avertissement à confirmer" });
        return;
      }

      if (target.dataset.loaded !== "true" || currentImageAllowed()) {
        setRefreshState({
          busy: false,
          message: target.dataset.loaded === "true" ? "Image prête" : "",
        });
        return;
      }

      setRefreshState({ busy: true, message: "Chargement d'une image autorisée" });
      let message = "Image indisponible";

      try {
        readLocalImagePool();
        const pool = refreshCandidates(state.images);
        const candidates = pool.filter(
          (image) => !imageCandidates(image).includes(state.currentUrl),
        );
        const selected = pickRandom(candidates.length > 0 ? candidates : pool);
        message = selected && (await setBackground(target, selected)) ? "Image autorisée" : message;
      } catch {
        message = target.dataset.loaded === "true" ? "Image prête" : message;
      } finally {
        setRefreshState({ busy: false, message });
      }
    };

    document.addEventListener(konachanClientConfig.events.refreshRequest, () => {
      refresh({ forceReload: true, rotateAfter: true });
    });

    document.addEventListener(konachanClientConfig.events.ratingChange, (event) => {
      state.ratingPreference = normalizeRatingPreference(
        event.detail?.ratingPreference ??
          (event.detail?.allowExplicit
            ? "explicit"
            : event.detail?.allowSensitive
              ? "questionable"
              : "safe"),
      );
      enforceRatingFilter();
    });

    document.addEventListener(EXPLICIT_CONTENT_CHANGE_EVENT, () => {
      if (syncExplicitContentState(landing, target)) {
        refresh({
          preferredImage: target.dataset.loaded !== "true" ? readStoredCurrentImage() : null,
          rotateAfter: target.dataset.loaded !== "true",
        });
      } else {
        setRefreshState({ busy: false, message: "Avertissement à confirmer" });
      }
    });

    if (syncExplicitContentState(landing, target)) {
      refresh({
        preferredImage: target.dataset.loaded !== "true" ? readStoredCurrentImage() : null,
        rotateAfter: target.dataset.loaded !== "true",
      });
    } else {
      setRefreshState({ busy: false, message: "Avertissement à confirmer" });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initKonachanBackground, { once: true });
  } else {
    initKonachanBackground();
  }

  addEventListener("astro:page-load", initKonachanBackground);
}
