import PhotoSwipeLightbox from "photoswipe/lightbox";
import PhotoSwipe from "photoswipe";
import "photoswipe/style.css";

const DYNAMIC_ANCHOR_OFFSET = 96;

let isDynamicAnchorInitialized = false;
let dynamicAnchorFrame = 0;
let activeHeadingLink = null;
let activeHeadingHash = "";
let dynamicAnchorHashPausedUntil = 0;

function hideSiteTooltip() {
  document.dispatchEvent(new CustomEvent("site:tooltip-hide"));
}

function padDatePart(value, length = 2) {
  return String(value).padStart(length, "0");
}

function formatCompactLocalDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";

  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absOffset = Math.abs(offsetMinutes);
  const timezone = `${sign}${padDatePart(Math.floor(absOffset / 60))}${padDatePart(
    absOffset % 60,
  )}`;

  return `${padDatePart(date.getFullYear(), 4)}${padDatePart(
    date.getMonth() + 1,
  )}${padDatePart(date.getDate())}T${padDatePart(date.getHours())}${padDatePart(
    date.getMinutes(),
  )}${padDatePart(date.getSeconds())}${timezone}`;
}

function initLocalDateTimes() {
  document.querySelectorAll("time[data-local-date-time]").forEach((time) => {
    const formatted = formatCompactLocalDateTime(time.dataset.localDateTime);
    if (!formatted) return;

    time.textContent = formatted;
    time.setAttribute("aria-label", formatted);
  });
}

function getScrollProgress() {
  const doc = document.documentElement;
  const scrollTop = window.scrollY || doc.scrollTop || document.body.scrollTop || 0;
  const scrollable = Math.max(doc.scrollHeight - window.innerHeight, 1);

  return Math.min(100, Math.max(0, Math.round((scrollTop / scrollable) * 100)));
}

let scrollUiFrame = 0;

function requestScrollUiSync() {
  if (scrollUiFrame) return;

  scrollUiFrame = requestAnimationFrame(() => {
    scrollUiFrame = 0;
    syncScrollUi();
  });
}

function syncScrollUi() {
  const progress = getScrollProgress();

  document
    .querySelectorAll(".site-scroll-progress")
    .forEach((bar) => syncScrollProgressBar(bar, progress));
}

function initSiteTooltips() {
  document.querySelectorAll("[title]").forEach((element) => {
    const title = element.getAttribute("title");
    if (!title) return;

    element.setAttribute("data-tooltip", title);
    element.removeAttribute("title");
    element.classList.add("site-tooltip");

    if (!element.hasAttribute("aria-label")) {
      element.setAttribute("aria-label", title);
    }

    if (
      !element.matches("a, button, input, select, textarea, summary") &&
      !element.hasAttribute("tabindex")
    ) {
      element.setAttribute("tabindex", "0");
    }
  });

  document.querySelectorAll("[data-footnote-backref]").forEach((backref) => {
    backref.setAttribute("aria-label", "Retour au contenu");
    backref.setAttribute("data-tooltip", "Retour au contenu");
    backref.classList.add("site-tooltip");

    if (!backref.dataset.footnoteEnhanced) {
      backref.dataset.footnoteEnhanced = "true";
      backref.addEventListener("click", () => {
        hideSiteTooltip();
        backref.blur?.();

        const hash = backref.getAttribute("href");
        if (!hash?.startsWith("#")) return;

        requestAnimationFrame(() => {
          const target = document.getElementById(decodeURIComponent(hash.slice(1)));
          if (target && !target.hasAttribute("tabindex")) {
            target.setAttribute("tabindex", "-1");
          }
          target?.scrollIntoView({ behavior: "smooth", block: "center" });
          target?.focus?.({ preventScroll: true });
        });
      });
    }
  });

  document.querySelectorAll(".site-prose a[href^='#user-content-fn-']").forEach((ref) => {
    if (ref.hasAttribute("data-footnote-backref")) return;

    ref.setAttribute("aria-label", "Voir l'explication");
    ref.setAttribute("data-tooltip", "Voir l'explication");
    ref.classList.add("site-tooltip", "footnote-ref-tooltip");
  });
}

function initScrollProgressBar() {
  if (document.body?.dataset.scrollProgressUi === "off") return;

  const existingBar = document.querySelector(".site-scroll-progress");
  if (existingBar) {
    syncScrollProgressBar(existingBar);
    return;
  }

  const bar = document.createElement("div");
  bar.className = "site-scroll-progress";
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-label", "Progression de lecture");
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", "100");
  bar.innerHTML = '<span class="site-scroll-progress__bar"></span>';

  window.addEventListener("scroll", requestScrollUiSync, { passive: true });
  window.addEventListener("resize", requestScrollUiSync, { passive: true });
  document.body.appendChild(bar);
  syncScrollUi();
}

function syncScrollProgressBar(bar, progress = getScrollProgress()) {
  const fill = bar.querySelector(".site-scroll-progress__bar");

  bar.setAttribute("aria-valuenow", String(progress));
  fill?.style.setProperty("transform", `translate3d(0, 0, 0) scaleX(${progress / 100})`);
}

function removeScrollUi() {
  document.querySelectorAll(".site-scroll-progress").forEach((element) => {
    element.remove();
  });
}

function getHeadingHashFromLink(link) {
  const hash = link.getAttribute("href");
  if (!hash?.startsWith("#") || hash === "#") return "";
  return hash;
}

function getDynamicAnchorEntries() {
  const postHeader = document.querySelector(".post-header");
  const prose = document.querySelector(".site-prose");
  if (!postHeader || !prose) return [];

  const entries = [];
  const resetHeading = postHeader.querySelector("[data-anchor-reset]");
  if (resetHeading) {
    entries.push({
      hash: "",
      heading: resetHeading,
      link: null,
      reset: true,
    });
  }

  prose
    .querySelectorAll(":is(h1, h2, h3, h4, h5, h6) > a.heading-link[href^='#']")
    .forEach((link) => {
      const hash = getHeadingHashFromLink(link);
      const heading = link.closest("h1, h2, h3, h4, h5, h6");
      if (!hash || !heading) return;

      entries.push({
        hash,
        heading,
        link,
        reset: false,
      });
    });

  return entries.sort((a, b) => {
    const aTop = a.heading.getBoundingClientRect().top + window.scrollY;
    const bTop = b.heading.getBoundingClientRect().top + window.scrollY;
    return aTop - bTop;
  });
}

function clearActiveHeading(managedHashes = new Set()) {
  activeHeadingLink?.classList.remove("is-anchor-active");
  activeHeadingLink?.removeAttribute("aria-current");
  activeHeadingLink = null;

  if (location.hash && (managedHashes.has(location.hash) || location.hash === activeHeadingHash)) {
    history.replaceState(null, "", `${location.pathname}${location.search}`);
  }

  activeHeadingHash = "";
}

function setActiveHeading(entry, { updateLocation = true } = {}) {
  if (activeHeadingLink && activeHeadingLink !== entry.link) {
    activeHeadingLink.classList.remove("is-anchor-active");
    activeHeadingLink.removeAttribute("aria-current");
  }

  activeHeadingLink = entry.link;
  activeHeadingHash = entry.hash;
  activeHeadingLink?.classList.add("is-anchor-active");
  activeHeadingLink?.setAttribute("aria-current", "location");

  if (updateLocation && location.hash !== entry.hash) {
    history.replaceState(null, "", entry.hash);
  }
}

function syncDynamicAnchors() {
  dynamicAnchorFrame = 0;

  const entries = getDynamicAnchorEntries();
  if (entries.length === 0) {
    clearActiveHeading();
    return;
  }

  const managedHashes = new Set(
    entries.filter((entry) => !entry.reset).map((entry) => entry.hash),
  );

  if (window.scrollY < 24) {
    clearActiveHeading(managedHashes);
    return;
  }

  let currentEntry = null;
  const viewportOffset = window.visualViewport?.offsetTop || 0;
  const activationLine = viewportOffset + DYNAMIC_ANCHOR_OFFSET;

  for (const entry of entries) {
    if (entry.heading.getBoundingClientRect().top <= activationLine) {
      currentEntry = entry;
    } else {
      break;
    }
  }

  if (!currentEntry || currentEntry.reset || !currentEntry.link) {
    clearActiveHeading(managedHashes);
    return;
  }

  const isPausedOnUnmanagedHash =
    Date.now() < dynamicAnchorHashPausedUntil &&
    location.hash &&
    !managedHashes.has(location.hash);

  setActiveHeading(currentEntry, { updateLocation: !isPausedOnUnmanagedHash });
}

function requestDynamicAnchorSync() {
  if (dynamicAnchorFrame) return;
  dynamicAnchorFrame = requestAnimationFrame(syncDynamicAnchors);
}

function initDynamicAnchors() {
  requestDynamicAnchorSync();
  if (isDynamicAnchorInitialized) return;

  isDynamicAnchorInitialized = true;

  document.addEventListener(
    "click",
    (event) => {
      const link = event.target?.closest?.("a[href^='#']");
      if (!link) return;

      hideSiteTooltip();
      const isHeadingLink =
        link.matches(".heading-link") &&
        Boolean(link.closest(".site-prose :is(h1, h2, h3, h4, h5, h6)"));

      dynamicAnchorHashPausedUntil = isHeadingLink ? 0 : Date.now() + 1600;

      if (event.detail > 0) {
        requestAnimationFrame(() => link.blur?.());
      }

      requestAnimationFrame(requestDynamicAnchorSync);
      window.setTimeout(requestDynamicAnchorSync, 420);
    },
    true,
  );

  window.addEventListener("scroll", requestDynamicAnchorSync, { passive: true });
  window.addEventListener("resize", requestDynamicAnchorSync, { passive: true });
  window.visualViewport?.addEventListener("resize", requestDynamicAnchorSync, {
    passive: true,
  });
  window.visualViewport?.addEventListener("scroll", requestDynamicAnchorSync, {
    passive: true,
  });
  window.addEventListener("hashchange", requestDynamicAnchorSync);
}

function wrapMarkdownImages() {
  document.querySelectorAll(".site-prose").forEach((container) => {
    let imageIndex = 0;

    container
      .querySelectorAll("img:not([data-no-lightbox])")
      .forEach((img) => {
        if (img.closest("header, footer, nav, [data-no-lightbox], a")) return;
        if (!img.src) return;
        const isPriorityImage =
          imageIndex === 0 ||
          img.loading === "eager" ||
          img.getAttribute("fetchpriority") === "high";
        imageIndex += 1;

        const link = document.createElement("a");
        link.href = img.src;
        link.tabIndex = 0;
        link.setAttribute("data-pswp-item", "");
        link.setAttribute(
          "aria-label",
          img.alt ? `Agrandir l'image : ${img.alt}` : `Agrandir l'image ${fileNameFromURL(img.src)}`,
        );

        link.addEventListener("keydown", (event) => {
          if (event.key !== " ") return;
          event.preventDefault();
          link.click();
        });
        link.addEventListener("click", hideSiteTooltip);

        const setSize = () => {
          const width =
            img.naturalWidth || parseInt(img.getAttribute("width") || "0") || 1400;
          const height =
            img.naturalHeight || parseInt(img.getAttribute("height") || "0") || 933;
          link.setAttribute("data-pswp-width", String(width));
          link.setAttribute("data-pswp-height", String(height));
        };

        if (img.complete) {
          setSize();
        } else {
          img.addEventListener("load", setSize, { once: true });
        }

        img.parentNode?.insertBefore(link, img);
        link.appendChild(img);
        img.decoding = "async";
        img.loading = isPriorityImage ? "eager" : "lazy";
        if (isPriorityImage) {
          img.fetchPriority = "high";
          img.setAttribute("fetchpriority", "high");
        }
      });
  });
}

function initKeyboardAccessibleTargets() {
  document.querySelectorAll("a[href]").forEach((link) => {
    if (!link.hasAttribute("tabindex")) link.setAttribute("tabindex", "0");
  });

  document.querySelectorAll("main :is(h1, h2, h3, h4, h5, h6)").forEach((heading) => {
    if (heading.closest("nav") || heading.querySelector("a[href]")) return;
    if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "0");
  });
}

function fileNameFromURL(url) {
  try {
    const parsed = new URL(url, location.href);
    return decodeURIComponent(parsed.pathname.split("/").pop() || "image");
  } catch {
    return "image";
  }
}

async function downloadViaFetch(url, filename) {
  const res = await fetch(url, { mode: "cors" });
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}

async function sharePhotoSwipeImage(src) {
  const url = new URL(src, location.href).href;
  const shareData = {
    title: document.title,
    url,
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    document.dispatchEvent(
      new CustomEvent("site:photoswipe-share-result", { detail: { copied: true } }),
    );
  } catch {
    window.open(url, "_blank", "noopener");
  }
}

function getSlideThumb(slide) {
  const source = slide?.data?.element;
  if (!source) return null;
  return source.matches?.("img") ? source : source.querySelector?.("img");
}

function syncThumbRadiusTransition(img, pswp) {
  if (!img) return;
  const duration = pswp.element
    ? getComputedStyle(pswp.element).getPropertyValue("--pswp-transition-duration").trim()
    : "";
  img.style.transitionDuration = duration || "";
  img.style.transitionTimingFunction = "cubic-bezier(0.4, 0, 0.22, 1)";
}

function cleanupThumbRadiusTransition(img) {
  if (!img) return;
  img.style.removeProperty("transition-duration");
  img.style.removeProperty("transition-timing-function");
}

function transitionThumbRadiusFlat(img, pswp) {
  if (!img) return;
  syncThumbRadiusTransition(img, pswp);
  img.getBoundingClientRect();
  img.classList.add("is-lightbox-radius-flat");
}

function hideThumbBehindLightbox(img, pswp) {
  if (!img) return;
  syncThumbRadiusTransition(img, pswp);
  img.getBoundingClientRect();
  img.classList.add("is-lightbox-thumb-hidden");
}

function revealThumbAfterClose(img, onDone) {
  if (!img) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      img.getBoundingClientRect();
      img.classList.remove("is-lightbox-thumb-hidden", "is-lightbox-thumb-fade");
      onDone?.();
    });
  });
}

function restoreThumbRadiusInstant(img) {
  if (!img) return;
  img.classList.add("is-lightbox-radius-instant");
  img.classList.remove("is-lightbox-radius-flat");
  cleanupThumbRadiusTransition(img);
  requestAnimationFrame(() => img.classList.remove("is-lightbox-radius-instant"));
}

function transitionPhotoSwipeImageRadius(pswp, radius) {
  pswp.element?.querySelectorAll(".pswp__img").forEach((img) => {
    img.classList.add("pswp__img--radius-transition");
    img.style.borderRadius = radius;
  });
}

function initLightboxRadiusTransition(pswp) {
  let thumb = null;
  const flatThumbs = new Set();
  const hiddenThumbs = new Set();

  const keepThumbFlat = (img) => {
    if (!img) return;
    flatThumbs.add(img);
    transitionThumbRadiusFlat(img, pswp);
  };

  const hideThumb = (img) => {
    if (!img) return;
    hiddenThumbs.add(img);
    hideThumbBehindLightbox(img, pswp);
  };

  const revealThumb = (img) => {
    if (!img) return;
    img.classList.remove("is-lightbox-thumb-hidden", "is-lightbox-thumb-fade");
    hiddenThumbs.delete(img);
  };

  const resetInactiveThumbs = (activeThumb) => {
    flatThumbs.forEach((img) => {
      if (img === activeThumb) return;
      restoreThumbRadiusInstant(img);
      revealThumb(img);
      flatThumbs.delete(img);
    });
  };

  pswp.on("contentAppendImage", ({ content }) => {
    const img = content?.element;
    if (!(img instanceof HTMLImageElement)) return;
    img.classList.add("pswp__img--radius-transition");
    img.style.borderRadius = "16px";
    requestAnimationFrame(() => {
      img.style.borderRadius = "0px";
    });
  });

  pswp.on("openingAnimationStart", () => {
    hideSiteTooltip();
    thumb = getSlideThumb(pswp.currSlide);
    hideThumb(thumb);
    keepThumbFlat(thumb);
    requestAnimationFrame(() => transitionPhotoSwipeImageRadius(pswp, "0px"));
  });

  pswp.on("closingAnimationStart", () => {
    hideSiteTooltip();
    thumb = getSlideThumb(pswp.currSlide) || thumb;
    resetInactiveThumbs(thumb);
    transitionPhotoSwipeImageRadius(pswp, "0px");
  });

  pswp.on("closingAnimationEnd", () => {
    cleanupThumbRadiusTransition(thumb);
    restoreThumbRadiusInstant(thumb);
    revealThumbAfterClose(thumb, () => hiddenThumbs.delete(thumb));
    flatThumbs.delete(thumb);
  });

  pswp.on("destroy", () => {
    hideSiteTooltip();
    flatThumbs.forEach((img) => {
      restoreThumbRadiusInstant(img);
    });
    flatThumbs.clear();
    hiddenThumbs.forEach((img) => revealThumb(img));
    hiddenThumbs.clear();
    cleanupThumbRadiusTransition(thumb);
    thumb?.classList.remove(
      "is-lightbox-radius-flat",
      "is-lightbox-radius-instant",
      "is-lightbox-thumb-hidden",
      "is-lightbox-thumb-fade",
    );
    thumb = null;
  });
}

function initLightboxZoomLock(pswp) {
  const root = pswp.element;
  if (!root) return;

  const preventGesture = (event) => {
    event.preventDefault();
  };
  const preventZoomWheel = (event) => {
    if (event.ctrlKey || event.metaKey) event.preventDefault();
  };

  root.addEventListener("wheel", preventZoomWheel, { passive: false });
  root.addEventListener("gesturestart", preventGesture, { passive: false });
  root.addEventListener("gesturechange", preventGesture, { passive: false });
  root.addEventListener("gestureend", preventGesture, { passive: false });
  pswp.on("destroy", () => {
    root.removeEventListener("wheel", preventZoomWheel);
    root.removeEventListener("gesturestart", preventGesture);
    root.removeEventListener("gesturechange", preventGesture);
    root.removeEventListener("gestureend", preventGesture);
  });
}

function initLightboxDesktopImageClickClose(pswp) {
  let cleanup = null;
  let imagePointer = null;
  const isMousePointer = (event) =>
    event.pointerType === "mouse" || event.type === "mousedown" || event.type === "mouseup";
  const isLightboxImage = (target) =>
    target instanceof Element && target.classList.contains("pswp__img");

  const onPointerDown = (event) => {
    if (event.button !== 0 || !isMousePointer(event) || !isLightboxImage(event.target)) {
      imagePointer = null;
      return;
    }

    imagePointer = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  };

  const onPointerUp = (event) => {
    if (!imagePointer || !isMousePointer(event) || !isLightboxImage(event.target)) {
      imagePointer = null;
      return;
    }

    const samePointer =
      event.pointerId === imagePointer.id || event.type === "mouseup";
    const moved =
      Math.abs(event.clientX - imagePointer.x) > 8 ||
      Math.abs(event.clientY - imagePointer.y) > 8;

    imagePointer = null;

    if (!samePointer || moved) return;

    event.preventDefault();
    event.stopPropagation();
    pswp.close();
  };

  const bind = () => {
    const root = pswp.element;
    if (!root || cleanup) return;

    root.addEventListener("mousedown", onPointerDown, true);
    root.addEventListener("pointerdown", onPointerDown, true);
    root.addEventListener("pointerup", onPointerUp, true);
    root.addEventListener("mouseup", onPointerUp, true);

    cleanup = () => {
      root.removeEventListener("mousedown", onPointerDown, true);
      root.removeEventListener("pointerdown", onPointerDown, true);
      root.removeEventListener("pointerup", onPointerUp, true);
      root.removeEventListener("mouseup", onPointerUp, true);
      imagePointer = null;
    };
  };

  bind();
  pswp.on("afterInit", bind);
  pswp.on("bindEvents", bind);
  pswp.on("destroy", () => {
    cleanup?.();
    cleanup = null;
  });
}

function removePhotoSwipeZoomUi(pswp) {
  const root = pswp.element;
  if (!root) return;

  root.classList.remove("pswp--zoom-allowed", "pswp--click-to-zoom", "pswp--zoomed-in");
  root
    .querySelectorAll(
      [
        ".pswp__button--zoom",
        ".pswp__button--zoom-in",
        ".pswp__button--zoom-out",
        "[aria-label='Zoom']",
        "[title='Zoom']",
      ].join(","),
    )
    .forEach((element) => element.remove());
}

const lightbox = new PhotoSwipeLightbox({
  gallery: ".site-prose",
  children: "a[data-pswp-item]",
  pswpModule: PhotoSwipe,
  mainClass: "pswp--system-zoom",
  initialZoomLevel: "fit",
  secondaryZoomLevel: "fit",
  maxZoomLevel: "fit",
  wheelToZoom: false,
  zoom: false,
  close: false,
  counter: false,
  arrowPrev: false,
  arrowNext: false,
  allowPanToNext: true,
  pinchToClose: false,
  closeOnVerticalDrag: true,
  imageClickAction: "close",
  doubleTapAction: false,
  arrowPrevTitle: "Image précédente",
  arrowNextTitle: "Image suivante",
  closeTitle: "Fermer",
});

let activePhotoSwipe = null;
let activePhotoSwipeLoading = false;

function dispatchPhotoSwipeState(pswp, open = true) {
  const src = pswp?.currSlide?.data?.src;
  const total = pswp?.getNumItems?.() ?? 0;

  document.dispatchEvent(
    new CustomEvent("site:photoswipe-state", {
      detail: {
        open,
        src: typeof src === "string" ? src : "",
        index: Math.min(total, Math.max(1, (pswp?.currIndex ?? 0) + 1)),
        total: Math.max(1, total),
        isFullscreen: Boolean(document.fullscreenElement),
        fullscreenAvailable: Boolean(document.fullscreenEnabled),
        loading: open && activePhotoSwipeLoading,
      },
    }),
  );
}

document.addEventListener("fullscreenchange", () => {
  if (activePhotoSwipe) dispatchPhotoSwipeState(activePhotoSwipe);
});

document.addEventListener("site:photoswipe-action", async (event) => {
  const pswp = activePhotoSwipe;
  const action = event.detail?.action;
  if (!pswp || !action) return;

  if (action === "close") {
    pswp.close();
    return;
  }

  if (action === "previous") {
    pswp.prev();
    return;
  }

  if (action === "next") {
    pswp.next();
    return;
  }

  if (action === "fullscreen") {
    const root = pswp.element || document.documentElement;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen?.();
      } else {
        await root.requestFullscreen?.();
      }
    } catch {}
    dispatchPhotoSwipeState(pswp);
    return;
  }

  const src = pswp.currSlide?.data?.src;
  if (!src) return;

  if (action === "download") {
    try {
      await downloadViaFetch(src, fileNameFromURL(src));
    } catch {
      window.open(src, "_blank", "noopener");
    }
    return;
  }

  if (action === "share") await sharePhotoSwipeImage(src);
});

lightbox.on("uiRegister", () => {
  const pswp = lightbox.pswp;
  const ui = pswp?.ui;
  if (!pswp || !ui) return;

  initLightboxRadiusTransition(pswp);
  initLightboxZoomLock(pswp);
  initLightboxDesktopImageClickClose(pswp);

  ui.uiElementsData = [];

  activePhotoSwipe = pswp;
  const syncToolbar = () => dispatchPhotoSwipeState(pswp);
  const setToolbarLoading = (loading) => {
    activePhotoSwipeLoading = loading;
    syncToolbar();
  };

  pswp.on("afterInit", () => {
    setToolbarLoading(Boolean(pswp.currSlide?.content?.isLoading?.()));
  });
  pswp.on("bindEvents", syncToolbar);
  pswp.on("change", () => {
    setToolbarLoading(Boolean(pswp.currSlide?.content?.isLoading?.()));
  });
  pswp.on("contentLoadImage", ({ content }) => {
    if (!content.slide || content.slide === pswp.currSlide) setToolbarLoading(true);
  });
  pswp.on("loadComplete", ({ slide }) => {
    if (slide === pswp.currSlide) setToolbarLoading(false);
  });
  pswp.on("loadError", ({ slide }) => {
    if (slide === pswp.currSlide) setToolbarLoading(false);
  });
  pswp.on("zoomPanUpdate", () => removePhotoSwipeZoomUi(pswp));
  pswp.on("destroy", () => {
    if (activePhotoSwipe === pswp) activePhotoSwipe = null;
    activePhotoSwipeLoading = false;
    dispatchPhotoSwipeState(pswp, false);
  });
});

let isLightboxInitialized = false;

function initLightbox() {
  wrapMarkdownImages();

  if (isLightboxInitialized) {
    try {
      lightbox.refresh();
    } catch {}
    return;
  }

  lightbox.init();
  isLightboxInitialized = true;
}

function initApp() {
  initLocalDateTimes();
  initSiteTooltips();
  initLightbox();
  initKeyboardAccessibleTargets();
  initDynamicAnchors();
  if (document.body?.dataset.scrollUi === "off") {
    removeScrollUi();
  } else {
    initScrollProgressBar();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp, { once: true });
} else {
  initApp();
}

addEventListener("astro:page-load", initApp);
