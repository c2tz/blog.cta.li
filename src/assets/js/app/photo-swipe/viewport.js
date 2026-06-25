function getPhotoSwipeToolbarRoot() {
  return document.querySelector(
    'astro-island[component-export="PhotoSwipeToolbarComponent"], site-photo-swipe-toolbar',
  );
}

export function getLightboxViewportSize() {
  const viewport = window.visualViewport;
  const scale = Math.max(1, viewport?.scale || 1);

  return {
    x: Math.max(1, Math.round((viewport?.width ?? document.documentElement.clientWidth) * scale)),
    y: Math.max(1, Math.round((viewport?.height ?? window.innerHeight) * scale)),
  };
}

export function getDisabledPhotoSwipeZoomLevel(zoomLevel) {
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

export function initLightboxVisualViewport(pswp, syncPhotoSwipeState) {
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

      syncPhotoSwipeState?.();
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

export function initLightboxFocusTrap(pswp) {
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

export function initLightboxSystemZoomPassThrough(pswp) {
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

export function initLightboxPhotoSwipeZoomDisable(pswp) {
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
