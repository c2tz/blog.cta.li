import PhotoSwipeLightbox from "photoswipe/lightbox";
import PhotoSwipe from "photoswipe";

import { SITE_EVENTS } from "@/lib/site-contracts";
import { wrapMarkdownImages } from "../blog-images.js";
import { fileNameFromURL } from "../url.js";
import { downloadViaFetch, sharePhotoSwipeImage } from "./share.js";
import { LIGHTBOX_CLOSE_DURATION, LIGHTBOX_OPEN_DURATION, initLightboxMotion } from "./motion.js";
import { initLightboxPageScrollRestore } from "./scroll-restore.js";
import { initLightboxRadiusState } from "./thumb-state.js";
import {
  getDisabledPhotoSwipeZoomLevel,
  getLightboxViewportSize,
  initLightboxFocusTrap,
  initLightboxSystemZoomPassThrough,
  initLightboxPhotoSwipeZoomDisable,
  initLightboxVisualViewport,
} from "./viewport.js";

const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const lightbox = new PhotoSwipeLightbox({
  gallery: ".site-prose",
  children: "a[data-pswp-item]",
  pswpModule: PhotoSwipe,
  getViewportSizeFn: getLightboxViewportSize,
  mainClass: "pswp--system-zoom",
  initialZoomLevel: "fit",
  secondaryZoomLevel: getDisabledPhotoSwipeZoomLevel,
  maxZoomLevel: getDisabledPhotoSwipeZoomLevel,
  wheelToZoom: false,
  zoom: false,
  close: false,
  counter: false,
  arrowPrev: false,
  arrowNext: false,
  allowPanToNext: true,
  pinchToClose: false,
  closeOnVerticalDrag: true,
  imageClickAction: false,
  bgClickAction: false,
  tapAction: false,
  doubleTapAction: false,
  trapFocus: false,
  showHideAnimationType: "fade",
  showAnimationDuration: prefersReducedMotion ? 0 : LIGHTBOX_OPEN_DURATION,
  hideAnimationDuration: prefersReducedMotion ? 0 : LIGHTBOX_CLOSE_DURATION,
  easing: "cubic-bezier(0.2, 0, 0, 1)",
  bgOpacity: 0.68,
  arrowPrevTitle: "Image précédente",
  arrowNextTitle: "Image suivante",
  closeTitle: "Fermer",
});

let activePhotoSwipe = null;
let activePhotoSwipeLoading = false;
let activePhotoSwipeClosing = false;
let activePhotoSwipeFullscreenRoot = null;
let activePhotoSwipeControlsVisible = true;

function getPhotoSwipeFullscreenRoot(pswp) {
  return pswp?.element || document.documentElement;
}

function getPhotoSwipeZoomState(pswp) {
  const slide = pswp?.currSlide;
  if (!slide?.isZoomable?.()) return { zoomable: false, zoomed: false };

  const initial = slide.zoomLevels?.initial ?? slide.zoomLevels?.fit ?? 1;
  const secondary = slide.zoomLevels?.secondary ?? initial;
  const current = slide.currZoomLevel ?? initial;
  const zoomable = Math.abs(secondary - initial) > 0.01;

  return {
    zoomable,
    zoomed: zoomable && current > initial + 0.01,
  };
}

async function exitPhotoSwipeFullscreen() {
  if (
    activePhotoSwipeFullscreenRoot &&
    document.fullscreenElement === activePhotoSwipeFullscreenRoot
  ) {
    try {
      await document.exitFullscreen?.();
    } catch {}
  }

  activePhotoSwipeFullscreenRoot = null;
}

function dispatchPhotoSwipeState(pswp, open = true) {
  const src = pswp?.currSlide?.data?.src;
  const source = typeof src === "string" ? src : "";
  const total = pswp?.getNumItems?.() ?? 0;
  const zoom = getPhotoSwipeZoomState(pswp);

  document.dispatchEvent(
    new CustomEvent(SITE_EVENTS.photoSwipeState, {
      detail: {
        open,
        src: source,
        fileName: source ? fileNameFromURL(source) : "",
        index: Math.min(total, Math.max(1, (pswp?.currIndex ?? 0) + 1)),
        total: Math.max(1, total),
        isFullscreen: open && Boolean(document.fullscreenElement),
        fullscreenAvailable: Boolean(document.fullscreenEnabled),
        zoomable: open && zoom.zoomable,
        zoomed: open && zoom.zoomed,
        loading: open && activePhotoSwipeLoading,
        closing: open && activePhotoSwipeClosing,
        controlsVisible: open && activePhotoSwipeControlsVisible,
      },
    }),
  );
}

function setPhotoSwipeControlsVisible(pswp, visible) {
  activePhotoSwipeControlsVisible = visible;
  pswp.element?.classList.toggle("pswp--controls-hidden", !visible);
  dispatchPhotoSwipeState(pswp);
}

function initPhotoSwipeControlsToggle(pswp) {
  const root = pswp.element;
  if (!root) return;

  let start = null;
  const activeTouchPointers = new Set();
  const interactiveSelector = [
    "a[href]",
    "button",
    "input",
    "select",
    "textarea",
    '[role="button"]',
    ".photo-swipe-fullscreen-close",
  ].join(",");

  const isInteractiveTarget = (target) =>
    target instanceof Element && Boolean(target.closest(interactiveSelector));

  const clearPointer = (event) => {
    if (event.pointerType === "touch") activeTouchPointers.delete(event.pointerId);
    if (start?.id === event.pointerId) start = null;
  };

  const handlePointerDown = (event) => {
    if (event.pointerType === "touch") activeTouchPointers.add(event.pointerId);

    if (isInteractiveTarget(event.target) || activeTouchPointers.size > 1) {
      start = null;
      return;
    }

    start = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      time: performance.now(),
    };
  };

  const handlePointerUp = (event) => {
    const wasMultitouch = event.pointerType === "touch" && activeTouchPointers.size > 1;
    if (event.pointerType === "touch") activeTouchPointers.delete(event.pointerId);

    if (
      !start ||
      start.id !== event.pointerId ||
      wasMultitouch ||
      isInteractiveTarget(event.target)
    ) {
      start = null;
      return;
    }

    const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    const elapsed = performance.now() - start.time;
    start = null;

    if (distance > 12 || elapsed > 650) return;
    setPhotoSwipeControlsVisible(pswp, !activePhotoSwipeControlsVisible);
  };

  root.addEventListener("pointerdown", handlePointerDown);
  root.addEventListener("pointerup", handlePointerUp);
  root.addEventListener("pointercancel", clearPointer);

  pswp.on("destroy", () => {
    root.removeEventListener("pointerdown", handlePointerDown);
    root.removeEventListener("pointerup", handlePointerUp);
    root.removeEventListener("pointercancel", clearPointer);
  });
}

document.addEventListener("fullscreenchange", () => {
  if (
    activePhotoSwipeFullscreenRoot &&
    document.fullscreenElement !== activePhotoSwipeFullscreenRoot
  ) {
    activePhotoSwipeFullscreenRoot = null;
  }

  if (activePhotoSwipe) dispatchPhotoSwipeState(activePhotoSwipe);
});

document.addEventListener(SITE_EVENTS.photoSwipeAction, async (event) => {
  const pswp = activePhotoSwipe;
  const action = event.detail?.action;
  if (!pswp || !action) return;

  if (action === "close") {
    await exitPhotoSwipeFullscreen();
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
    const root = getPhotoSwipeFullscreenRoot(pswp);
    try {
      if (document.fullscreenElement) {
        await exitPhotoSwipeFullscreen();
      } else {
        await root.requestFullscreen?.();
        if (document.fullscreenElement) {
          activePhotoSwipeFullscreenRoot = document.fullscreenElement;
        }
      }
    } catch {}
    dispatchPhotoSwipeState(pswp);
    return;
  }

  if (action === "zoom") {
    pswp.toggleZoom();
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

  initLightboxVisualViewport(pswp, () => dispatchPhotoSwipeState(pswp));
  initLightboxMotion(pswp);
  initLightboxRadiusState(pswp);
  initLightboxPageScrollRestore(pswp);
  initLightboxFocusTrap(pswp);
  initLightboxSystemZoomPassThrough(pswp);
  initLightboxPhotoSwipeZoomDisable(pswp);
  initPhotoSwipeControlsToggle(pswp);

  ui.uiElementsData = [];

  activePhotoSwipe = pswp;
  activePhotoSwipeClosing = false;
  setPhotoSwipeControlsVisible(pswp, true);
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
  pswp.on("zoomPanUpdate", syncToolbar);
  pswp.on("closingAnimationStart", () => {
    pswp.element?.style.setProperty("pointer-events", "none");
    activePhotoSwipeClosing = true;
    syncToolbar();
  });
  pswp.on("destroy", () => {
    void exitPhotoSwipeFullscreen();
    if (activePhotoSwipe === pswp) activePhotoSwipe = null;
    activePhotoSwipeLoading = false;
    activePhotoSwipeClosing = false;
    activePhotoSwipeControlsVisible = true;
    pswp.element?.style.removeProperty("pointer-events");
    dispatchPhotoSwipeState(pswp, false);
  });
});

let isLightboxInitialized = false;

export function initLightbox() {
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
