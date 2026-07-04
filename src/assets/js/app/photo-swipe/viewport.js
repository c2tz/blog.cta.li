function getPhotoSwipeToolbarRoot() {
  return getPhotoSwipeToolbarRoots()[0] ?? null;
}

function getPhotoSwipeToolbarRoots() {
  return [
    document.querySelector("site-photo-swipe-toolbar"),
    document.querySelector('astro-island[component-export="PhotoSwipeToolbarComponent"]'),
  ].filter((element, index, elements) => element && elements.indexOf(element) === index);
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

function isSystemZoomActive() {
  return (window.visualViewport?.scale || 1) > 1.01;
}

export function initLightboxVisualViewport(pswp, syncPhotoSwipeState) {
  let frame = 0;
  let lastPhotoSwipeViewportSize = getLightboxViewportSize();

  const requestPhotoSwipeResize = () => {
    if (frame) return;

    frame = requestAnimationFrame(() => {
      frame = 0;

      if (!isSystemZoomActive()) {
        const viewportSize = getLightboxViewportSize();
        const layoutChanged =
          viewportSize.x !== lastPhotoSwipeViewportSize.x ||
          viewportSize.y !== lastPhotoSwipeViewportSize.y;

        if (layoutChanged) {
          lastPhotoSwipeViewportSize = viewportSize;
          pswp.updateSize?.(true);
        }
      }

      syncPhotoSwipeState?.();
    });
  };

  window.addEventListener("resize", requestPhotoSwipeResize, { passive: true });
  window.visualViewport?.addEventListener("resize", requestPhotoSwipeResize, { passive: true });

  pswp.on("destroy", () => {
    if (frame) cancelAnimationFrame(frame);
    window.removeEventListener("resize", requestPhotoSwipeResize);
    window.visualViewport?.removeEventListener("resize", requestPhotoSwipeResize);
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
  const roots = [...getPhotoSwipeToolbarRoots(), pswp.element].filter(Boolean);
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
    return Boolean(
      pswp.element?.contains(target) ||
      getPhotoSwipeToolbarRoots().some((toolbar) => toolbar.contains(target)),
    );
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
  const activeTouchPointers = new Set();

  const isInsideLightbox = (target) => {
    if (!(target instanceof Node)) return false;
    return Boolean(
      pswp.element?.contains(target) ||
      getPhotoSwipeToolbarRoots().some((toolbar) => toolbar.contains(target)),
    );
  };

  const trackTouchPointer = (event) => {
    if (event.pointerType !== "touch") return;

    if (event.type === "pointerdown") {
      if (isInsideLightbox(event.target)) activeTouchPointers.add(event.pointerId);
      return;
    }

    activeTouchPointers.delete(event.pointerId);
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
    if (!isInsideLightbox(event.target)) return prevent;

    if (event?.ctrlKey || event?.metaKey) {
      return false;
    }

    if (
      (event?.pointerType === "touch" && activeTouchPointers.size > 1) ||
      window.visualViewport?.scale > 1
    ) {
      return false;
    }

    return prevent;
  };

  pswp.addFilter("preventPointerEvent", allowNativeMultitouch);
  document.addEventListener("pointerdown", trackTouchPointer, { capture: true, passive: true });
  document.addEventListener("pointerup", trackTouchPointer, { capture: true, passive: true });
  document.addEventListener("pointercancel", trackTouchPointer, { capture: true, passive: true });
  document.addEventListener("wheel", onWheel, { capture: true, passive: false });
  document.addEventListener("gesturestart", passSystemZoomGesture, {
    capture: true,
    passive: false,
  });
  document.addEventListener("gesturechange", passSystemZoomGesture, {
    capture: true,
    passive: false,
  });
  document.addEventListener("gestureend", passSystemZoomGesture, { capture: true, passive: false });

  const cleanup = () => {
    pswp.removeFilter("preventPointerEvent", allowNativeMultitouch);
    document.removeEventListener("pointerdown", trackTouchPointer, true);
    document.removeEventListener("pointerup", trackTouchPointer, true);
    document.removeEventListener("pointercancel", trackTouchPointer, true);
    document.removeEventListener("wheel", onWheel, true);
    document.removeEventListener("gesturestart", passSystemZoomGesture, true);
    document.removeEventListener("gesturechange", passSystemZoomGesture, true);
    document.removeEventListener("gestureend", passSystemZoomGesture, true);
  };

  pswp.on("close", cleanup);
  pswp.on("destroy", cleanup);
}

export function initLightboxPhotoSwipeZoomDisable(pswp) {
  const disableContentZoom = () => false;

  const resetPhotoSwipeZoom = () => {
    const slide = pswp.currSlide;
    if (!slide?.zoomLevels) return;

    const initial = slide.zoomLevels.initial || slide.zoomLevels.fit || 1;
    slide.zoomLevels.secondary = initial;
    slide.zoomLevels.max = initial;

    if (Math.abs((slide.currZoomLevel || initial) - initial) > 0.01) {
      slide.zoomTo?.(initial, false, 0, true);
    }
  };

  const blockInternalZoom = (event) => {
    const originalEvent = event.originalEvent;
    if (
      pswp.gestures?._numActivePoints > 1 ||
      pswp.gestures?.isZooming ||
      originalEvent?.ctrlKey ||
      originalEvent?.metaKey
    ) {
      event.preventDefault();
    }
  };

  pswp.addFilter("isContentZoomable", disableContentZoom);
  pswp.on("afterInit", resetPhotoSwipeZoom);
  pswp.on("change", resetPhotoSwipeZoom);
  pswp.on("beforeZoomTo", blockInternalZoom);
  pswp.on("pointerMove", blockInternalZoom);

  const cleanup = () => {
    pswp.removeFilter("isContentZoomable", disableContentZoom);
  };

  pswp.on("destroy", cleanup);
}
