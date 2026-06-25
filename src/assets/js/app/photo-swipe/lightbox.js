import PhotoSwipeLightbox from "photoswipe/lightbox";
import PhotoSwipe from "photoswipe";

import { SITE_EVENTS } from "@/lib/site-contracts";
import { wrapMarkdownImages } from "../blog-images.js";
import { fileNameFromURL } from "../url.js";
import { downloadViaFetch, sharePhotoSwipeImage } from "./share.js";
import { initLightboxPageScrollRestore } from "./scroll-restore.js";
import { initLightboxRadiusTransition } from "./thumb-transition.js";
import {
  getDisabledPhotoSwipeZoomLevel,
  getLightboxViewportSize,
  initLightboxFocusTrap,
  initLightboxPhotoSwipeZoomDisable,
  initLightboxSystemZoomPassThrough,
  initLightboxVisualViewport,
} from "./viewport.js";

function initPhotoSwipeFullscreenClose(pswp) {
  const root = pswp.element;
  if (!root) return;

  const button = document.createElement("button");
  const icon = document.createElement("span");

  button.type = "button";
  button.className = "photo-swipe-fullscreen-close";
  button.hidden = true;
  button.setAttribute("aria-label", "Quitter le plein écran");
  button.setAttribute("title", "Quitter le plein écran");

  icon.className = "material-symbols-rounded photo-swipe-fullscreen-close-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = "\uE5CD";

  button.append(icon);
  root.append(button);

  const sync = () => {
    button.hidden = document.fullscreenElement !== root;
  };
  const exitFullscreen = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    await exitPhotoSwipeFullscreen();
    dispatchPhotoSwipeState(pswp);
  };
  const keepFullscreenEscapeInPreview = (event) => {
    if (event.key !== "Escape" || document.fullscreenElement !== root) return;

    event.stopPropagation();
    event.stopImmediatePropagation?.();
  };

  button.addEventListener("click", exitFullscreen);
  document.addEventListener("keydown", keepFullscreenEscapeInPreview, true);
  document.addEventListener("fullscreenchange", sync);
  sync();

  pswp.on("destroy", () => {
    button.removeEventListener("click", exitFullscreen);
    document.removeEventListener("keydown", keepFullscreenEscapeInPreview, true);
    document.removeEventListener("fullscreenchange", sync);
    button.remove();
  });
}

const lightbox = new PhotoSwipeLightbox({
  gallery: ".site-prose",
  children: "a[data-pswp-item]",
  pswpModule: PhotoSwipe,
  mainClass: "pswp--system-zoom",
  getViewportSizeFn: getLightboxViewportSize,
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
  bgOpacity: 0.74,
  arrowPrevTitle: "Image précédente",
  arrowNextTitle: "Image suivante",
  closeTitle: "Fermer",
});

let activePhotoSwipe = null;
let activePhotoSwipeLoading = false;
let activePhotoSwipeClosing = false;
let activePhotoSwipeFullscreenRoot = null;

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
  if (activePhotoSwipeFullscreenRoot && document.fullscreenElement === activePhotoSwipeFullscreenRoot) {
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
      },
    }),
  );
}

document.addEventListener("fullscreenchange", () => {
  if (activePhotoSwipeFullscreenRoot && document.fullscreenElement !== activePhotoSwipeFullscreenRoot) {
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
  initLightboxPhotoSwipeZoomDisable(pswp);
  initLightboxRadiusTransition(pswp);
  initLightboxPageScrollRestore(pswp);
  initLightboxFocusTrap(pswp);
  initLightboxSystemZoomPassThrough(pswp);
  initPhotoSwipeFullscreenClose(pswp);

  ui.uiElementsData = [];

  activePhotoSwipe = pswp;
  activePhotoSwipeClosing = false;
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
