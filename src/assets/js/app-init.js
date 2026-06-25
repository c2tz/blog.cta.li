import PhotoSwipeLightbox from "photoswipe/lightbox";
import PhotoSwipe from "photoswipe";
import "photoswipe/style.css";

function hideSiteTooltip() {
  document.dispatchEvent(new CustomEvent("site:tooltip-hide"));
}

function getScrollProgress() {
  const doc = document.documentElement;
  const scrollTop = window.scrollY || doc.scrollTop || document.body.scrollTop || 0;
  const scrollable = Math.max(doc.scrollHeight - window.innerHeight, 1);

  return Math.min(100, Math.max(0, Math.round((scrollTop / scrollable) * 100)));
}

let readingProgressFrame = 0;

function requestReadingProgressSync() {
  if (readingProgressFrame) return;

  readingProgressFrame = requestAnimationFrame(() => {
    readingProgressFrame = 0;
    syncReadingProgress();
  });
}

function syncReadingProgress() {
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
      element.getAttribute("tabindex") === "0"
    ) {
      element.removeAttribute("tabindex");
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
          target?.scrollIntoView({ behavior: "smooth", block: "center" });
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
  bar.innerHTML = '<span class="site-scroll-progress-bar"></span>';

  window.addEventListener("scroll", requestReadingProgressSync, { passive: true });
  window.addEventListener("resize", requestReadingProgressSync, { passive: true });
  document.body.appendChild(bar);
  syncReadingProgress();
}

function syncScrollProgressBar(bar, progress = getScrollProgress()) {
  const fill = bar.querySelector(".site-scroll-progress-bar");

  bar.setAttribute("aria-valuenow", String(progress));
  fill?.style.setProperty("transform", `translate3d(0, 0, 0) scaleX(${progress / 100})`);
}

function removeReadingProgress() {
  document.querySelectorAll(".site-scroll-progress").forEach((element) => {
    element.remove();
  });
}

function wrapMarkdownImages() {
  document.querySelectorAll(".site-prose").forEach((container) => {
    container
      .querySelectorAll("img:not([data-no-lightbox])")
      .forEach((img) => {
        if (img.closest("header, footer, nav, [data-no-lightbox], a")) return;
        if (!img.src) return;
        const imageRect = img.getBoundingClientRect();
        const isPriorityImage =
          img.loading === "eager" ||
          img.getAttribute("fetchpriority") === "high" ||
          (imageRect.bottom >= -240 && imageRect.top <= window.innerHeight + 240);

        const initialSrc = img.currentSrc || img.src;
        const link = document.createElement("a");
        const setLightboxLabel = (src) => {
          const filename = fileNameFromURL(src);
          link.setAttribute("aria-label", `Agrandir l'image : ${filename}`);
          link.setAttribute("title", filename);
        };

        link.href = initialSrc;
        link.setAttribute("data-pswp-item", "");
        setLightboxLabel(initialSrc);

        link.addEventListener("keydown", (event) => {
          if (event.key !== " ") return;
          event.preventDefault();
          link.click();
        });
        link.addEventListener("click", hideSiteTooltip);

        const setSize = () => {
          const src = img.currentSrc || img.src;
          const width =
            img.naturalWidth || parseInt(img.getAttribute("width") || "0") || 1400;
          const height =
            img.naturalHeight || parseInt(img.getAttribute("height") || "0") || 933;
          link.href = src;
          link.setAttribute("data-pswp-width", String(width));
          link.setAttribute("data-pswp-height", String(height));
          setLightboxLabel(src);
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

function revealBlogImage(img) {
  if (img.dataset.imageRevealState === "revealed") return;

  const finishReveal = () => {
    if (img.dataset.imageRevealState === "revealed") return;
    img.dataset.imageRevealState = "revealed";
    img.classList.remove("is-blog-image-pending");
    img.classList.add("is-blog-image-revealed");
  };

  if (!img.complete) {
    img.addEventListener(
      "load",
      () => {
        img.decode?.().catch(() => {}).finally(finishReveal);
      },
      { once: true },
    );
    img.addEventListener("error", finishReveal, { once: true });
    return;
  }

  if (!img.naturalWidth) {
    finishReveal();
    return;
  }

  img.decode?.().catch(() => {}).finally(finishReveal);
}

function initBlogImageReveal() {
  const images = document.querySelectorAll(
    ".site-prose img:not([data-no-image-reveal])",
  );
  if (!images.length) return;

  const observer =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries, imageObserver) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              imageObserver.unobserve(entry.target);
              revealBlogImage(entry.target);
            });
          },
          { rootMargin: "240px 0px" },
        )
      : null;

  images.forEach((img) => {
    if (img.dataset.imageRevealState) return;

    img.dataset.imageRevealState = "pending";
    img.classList.add("blog-image-reveal", "is-blog-image-pending");

    if (observer) observer.observe(img);
    else revealBlogImage(img);
  });
}

function fileNameFromURL(url) {
  try {
    const parsed = new URL(url, location.href);
    const sourceUrl = parsed.searchParams.get("href");
    if (sourceUrl && parsed.pathname.endsWith("/_image")) {
      return fileNameFromURL(sourceUrl);
    }

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

function dispatchPhotoSwipeShareResult(message) {
  document.dispatchEvent(
    new CustomEvent("site:photo-swipe-share-result", { detail: { message } }),
  );
}

async function getPhotoSwipeShareFile(url) {
  const parsed = new URL(url, location.href);
  const response = await fetch(parsed.href, {
    cache: "force-cache",
    credentials: parsed.origin === location.origin ? "same-origin" : "omit",
    mode: "cors",
  });
  if (!response.ok) throw new Error(`image_share_${response.status}`);

  const blob = await response.blob();
  return new File([blob], fileNameFromURL(parsed.href), {
    type: blob.type || "image/jpeg",
  });
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.inset = "0 auto auto 0";
  textarea.style.width = "1px";
  textarea.style.height = "1px";
  textarea.style.opacity = "0";

  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  try {
    return document.execCommand("copy");
  } finally {
    textarea.remove();
    window.getSelection()?.removeAllRanges();
  }
}

async function sharePhotoSwipeImage(src) {
  const url = new URL(src, location.href).href;

  if (navigator.share) {
    try {
      const file = await getPhotoSwipeShareFile(url).catch(() => null);
      const fileShareData = file ? { files: [file], title: document.title } : null;

      if (fileShareData && navigator.canShare?.(fileShareData)) {
        await navigator.share(fileShareData);
      } else {
        await navigator.share({ title: document.title, url });
      }
      dispatchPhotoSwipeShareResult("Image partagée");
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }

  try {
    const copied = await copyTextToClipboard(url);
    if (!copied) throw new Error("copy_failed");
    dispatchPhotoSwipeShareResult("Lien copié");
  } catch {
    dispatchPhotoSwipeShareResult("Copie impossible");
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

function getPhotoSwipeToolbarRoot() {
  return document.querySelector(
    'astro-island[component-export="PhotoSwipeToolbarComponent"], site-photo-swipe-toolbar',
  );
}

function getLightboxViewportSize() {
  const viewport = window.visualViewport;
  const scale = Math.max(1, viewport?.scale || 1);

  return {
    x: Math.max(1, Math.round((viewport?.width ?? document.documentElement.clientWidth) * scale)),
    y: Math.max(1, Math.round((viewport?.height ?? window.innerHeight) * scale)),
  };
}

function getDisabledPhotoSwipeZoomLevel(zoomLevel) {
  return zoomLevel.initial || zoomLevel.fit || 1;
}

function getLightboxSystemZoomInverseScale() {
  return 1 / Math.max(1, window.visualViewport?.scale || 1);
}

function setLightboxControlScale(element) {
  element.style.setProperty(
    "--photo-swipe-system-zoom-inverse-scale",
    `${getLightboxSystemZoomInverseScale()}`,
  );
}

function resetLightboxControlScale(element) {
  element.style.removeProperty("--photo-swipe-system-zoom-inverse-scale");
}

function initLightboxVisualViewport(pswp) {
  let frame = 0;
  let controlFrame = 0;
  let lastPhotoSwipeViewportSize = getLightboxViewportSize();

  const applyControlScale = () => {
    if (pswp.element) setLightboxControlScale(pswp.element);

    const toolbar = getPhotoSwipeToolbarRoot();
    if (toolbar instanceof HTMLElement) setLightboxControlScale(toolbar);
  };

  const requestControlScale = () => {
    if (controlFrame) return;

    controlFrame = requestAnimationFrame(() => {
      controlFrame = 0;
      applyControlScale();
    });
  };

  const requestPhotoSwipeResize = () => {
    if (frame) return;

    frame = requestAnimationFrame(() => {
      frame = 0;

      const viewportSize = getLightboxViewportSize();
      const layoutChanged =
        viewportSize.x !== lastPhotoSwipeViewportSize.x ||
        viewportSize.y !== lastPhotoSwipeViewportSize.y;

      if (layoutChanged) {
        lastPhotoSwipeViewportSize = viewportSize;
        pswp.updateSize?.(true);
      }

      dispatchPhotoSwipeState(pswp);
    });
  };

  applyControlScale();
  pswp.on("firstUpdate", applyControlScale);
  pswp.on("bindEvents", applyControlScale);

  window.addEventListener("resize", requestPhotoSwipeResize, { passive: true });
  window.visualViewport?.addEventListener("resize", requestControlScale, { passive: true });

  pswp.on("destroy", () => {
    if (frame) cancelAnimationFrame(frame);
    if (controlFrame) cancelAnimationFrame(controlFrame);
    window.removeEventListener("resize", requestPhotoSwipeResize);
    window.visualViewport?.removeEventListener("resize", requestControlScale);

    if (pswp.element) resetLightboxControlScale(pswp.element);

    const toolbar = getPhotoSwipeToolbarRoot();
    if (toolbar instanceof HTMLElement) resetLightboxControlScale(toolbar);
  });
}

function isVisibleFocusableElement(element) {
  return (
    element instanceof HTMLElement &&
    element.tabIndex >= 0 &&
    !element.hidden &&
    element.getAttribute("aria-hidden") !== "true" &&
    Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length)
  );
}

function getPhotoSwipeFocusableElements(pswp) {
  const selector = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
  ].join(",");
  const roots = [getPhotoSwipeToolbarRoot(), pswp.element].filter(Boolean);
  const elements = roots.flatMap((root) => Array.from(root.querySelectorAll(selector)));

  return [...new Set(elements)].filter(isVisibleFocusableElement);
}

function initLightboxFocusTrap(pswp) {
  const returnFocusTarget =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const focusControl = (reverse = false) => {
    const elements = getPhotoSwipeFocusableElements(pswp);
    if (!elements.length) {
      pswp.element?.focus({ preventScroll: true });
      return;
    }

    const activeIndex = elements.indexOf(document.activeElement);
    const nextIndex =
      activeIndex === -1
        ? reverse
          ? elements.length - 1
          : 0
        : (activeIndex + (reverse ? -1 : 1) + elements.length) % elements.length;

    elements[nextIndex].focus({ preventScroll: true });
  };

  const isInsideLightboxFocusScope = (target) => {
    if (!(target instanceof Node)) return false;
    const toolbar = getPhotoSwipeToolbarRoot();
    return Boolean(pswp.element?.contains(target) || toolbar?.contains(target));
  };

  const handleFocusIn = (event) => {
    if (isInsideLightboxFocusScope(event.target)) return;
    requestAnimationFrame(() => focusControl(false));
  };

  pswp.on("keydown", (event) => {
    const originalEvent = event.originalEvent;
    if (
      originalEvent.key !== "Tab" ||
      originalEvent.altKey ||
      originalEvent.ctrlKey ||
      originalEvent.metaKey
    ) {
      return;
    }

    event.preventDefault();
    originalEvent.preventDefault();
    focusControl(originalEvent.shiftKey);
  });

  pswp.on("bindEvents", () => {
    document.addEventListener("focusin", handleFocusIn, true);
    if (!pswp.options.initialPointerPos) requestAnimationFrame(() => focusControl(false));
  });

  pswp.on("destroy", () => {
    document.removeEventListener("focusin", handleFocusIn, true);
    if (returnFocusTarget?.isConnected) {
      requestAnimationFrame(() => returnFocusTarget.focus({ preventScroll: true }));
    }
  });
}

function initLightboxSystemZoomPassThrough(pswp) {
  const isInsideLightbox = (target) => {
    if (!(target instanceof Node)) return false;
    const toolbar = getPhotoSwipeToolbarRoot();
    return Boolean(pswp.element?.contains(target) || toolbar?.contains(target));
  };

  const passSystemZoomGesture = (event) => {
    if (!isInsideLightbox(event.target)) return;

    event.stopPropagation();
    event.stopImmediatePropagation?.();
  };

  const onWheel = (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    passSystemZoomGesture(event);
  };

  const allowNativeMultitouch = (prevent, event) => {
    if (
      event?.touches?.length > 1 ||
      event?.ctrlKey ||
      event?.metaKey ||
      (event?.pointerType === "touch" && pswp.gestures?._numActivePoints > 1)
    ) {
      return false;
    }

    return prevent;
  };

  pswp.addFilter("preventPointerEvent", allowNativeMultitouch);
  document.addEventListener("wheel", onWheel, { capture: true, passive: false });
  document.addEventListener("gesturestart", passSystemZoomGesture, { capture: true, passive: false });
  document.addEventListener("gesturechange", passSystemZoomGesture, { capture: true, passive: false });
  document.addEventListener("gestureend", passSystemZoomGesture, { capture: true, passive: false });

  const cleanup = () => {
    pswp.removeFilter("preventPointerEvent", allowNativeMultitouch);
    document.removeEventListener("wheel", onWheel, true);
    document.removeEventListener("gesturestart", passSystemZoomGesture, true);
    document.removeEventListener("gesturechange", passSystemZoomGesture, true);
    document.removeEventListener("gestureend", passSystemZoomGesture, true);
  };

  pswp.on("close", cleanup);
  pswp.on("destroy", cleanup);
}

function initLightboxPhotoSwipeZoomDisable(pswp) {
  const lockZoomLevels = ({ zoomLevels }) => {
    const lockedZoom = getDisabledPhotoSwipeZoomLevel(zoomLevels);
    zoomLevels.secondary = lockedZoom;
    zoomLevels.max = lockedZoom;
    zoomLevels.min = lockedZoom;
  };

  const blockInternalMultitouchZoom = (event) => {
    const originalEvent = event.originalEvent;
    if (
      originalEvent?.touches?.length > 1 ||
      (originalEvent?.pointerType === "touch" && pswp.gestures?._numActivePoints > 1)
    ) {
      event.preventDefault();
    }
  };

  const blockKeyboardZoom = (event) => {
    const originalEvent = event.originalEvent;
    if (originalEvent?.key?.toLowerCase() !== "z") return;

    event.preventDefault();
    originalEvent.preventDefault();
  };

  pswp.on("zoomLevelsUpdate", lockZoomLevels);
  pswp.on("pointerMove", blockInternalMultitouchZoom);
  pswp.on("keydown", blockKeyboardZoom);
}

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
  icon.textContent = "close";

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

function restoreInlineStyle(element, property, value) {
  const cssProperty = property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

  if (value) {
    element.style[property] = value;
  } else {
    element.style.removeProperty(cssProperty);
  }
}

function clearLightboxScrollLock() {
  if (document.documentElement.classList.contains("consent-visible")) return;

  [document.documentElement, document.body].forEach((element) => {
    if (element.style.overflow === "hidden") element.style.removeProperty("overflow");
    if (element.style.touchAction === "none") element.style.removeProperty("touch-action");
  });
}

function initLightboxPageScrollRestore(pswp) {
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;
  const htmlOverflow = document.documentElement.style.overflow;
  const htmlTouchAction = document.documentElement.style.touchAction;
  const bodyOverflow = document.body.style.overflow;
  const bodyTouchAction = document.body.style.touchAction;
  let isClosing = false;
  let userScrolledAfterClose = false;
  let cleanupFallback = 0;

  const markUserScrollIntent = () => {
    if (isClosing) userScrolledAfterClose = true;
  };

  const markUserScrollKeyIntent = (event) => {
    if (
      ![
        " ",
        "ArrowDown",
        "ArrowUp",
        "End",
        "Home",
        "PageDown",
        "PageUp",
      ].includes(event.key)
    ) {
      return;
    }

    markUserScrollIntent();
  };

  const restorePageStyles = () => {
    restoreInlineStyle(document.documentElement, "overflow", htmlOverflow);
    restoreInlineStyle(document.documentElement, "touchAction", htmlTouchAction);
    restoreInlineStyle(document.body, "overflow", bodyOverflow);
    restoreInlineStyle(document.body, "touchAction", bodyTouchAction);
    clearLightboxScrollLock();
  };

  const restoreScroll = () => {
    if (userScrolledAfterClose) return;

    if (
      Math.abs(window.scrollX - scrollX) > 1 ||
      Math.abs(window.scrollY - scrollY) > 1
    ) {
      window.scrollTo(scrollX, scrollY);
    }
  };

  const scheduleFallbackCleanup = () => {
    window.clearTimeout(cleanupFallback);
    cleanupFallback = window.setTimeout(restorePageStyles, 600);
  };

  window.addEventListener("wheel", markUserScrollIntent, { capture: true, passive: true });
  window.addEventListener("touchmove", markUserScrollIntent, { capture: true, passive: true });
  window.addEventListener("keydown", markUserScrollKeyIntent, true);

  pswp.on("close", () => {
    isClosing = true;
    restoreScroll();
    scheduleFallbackCleanup();
  });

  pswp.on("destroy", () => {
    window.clearTimeout(cleanupFallback);
    window.removeEventListener("wheel", markUserScrollIntent, true);
    window.removeEventListener("touchmove", markUserScrollIntent, true);
    window.removeEventListener("keydown", markUserScrollKeyIntent, true);

    restorePageStyles();
    restoreScroll();
    requestAnimationFrame(() => {
      restorePageStyles();
      restoreScroll();
    });
  });
}

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
    new CustomEvent("site:photo-swipe-state", {
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

document.addEventListener("site:photo-swipe-action", async (event) => {
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

  initLightboxVisualViewport(pswp);
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
  initSiteTooltips();
  initLightbox();
  initBlogImageReveal();
  if (document.body?.dataset.readingProgress === "off") {
    removeReadingProgress();
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
