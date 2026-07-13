import {
  DOUBLE_TAP_DISTANCE,
  DOUBLE_TAP_MS,
  IMAGE_DIALOG_SCRIM_OPACITY,
  DRAG_AXIS_LOCK_DISTANCE,
  DISMISS_DISTANCE,
  DISMISS_FADE_END_RATIO,
  DISMISS_FADE_START_RATIO,
  DISMISS_IMAGE_OPACITY_REDUCTION,
  DISMISS_SCRIM_OPACITY_REDUCTION,
  DISMISS_VELOCITY,
  SWIPE_DISTANCE,
  SWIPE_DURATION_MS,
  SWIPE_VELOCITY,
  TAP_DISTANCE,
  TAP_DURATION_MS,
  TRACKPAD_SWIPE_DISTANCE,
  TRACKPAD_SWIPE_LOCK_MS,
  TRACKPAD_SWIPE_RESET_MS,
  ZOOM_GESTURE_COOLDOWN_MS,
  ZOOM_EPSILON,
  distanceBetween,
  clamp,
} from "./support.js";

export const withImagePreviewGestures = (Base) =>
  class extends Base {
    handlePointerDown = (event) => {
      if (
        !this.isOpen ||
        this.isClosing ||
        this.informationOpen ||
        (event.pointerType === "mouse" && event.button !== 0)
      ) {
        return;
      }

      if (this.isBrowserZoomed()) {
        if (event.pointerType !== "mouse") return;

        this.hideTooltip();
        this.activePointers.add(event.pointerId);
        this.zoomPanGesture = {
          id: event.pointerId,
          startPanX: this.zoomPanX,
          startPanY: this.zoomPanY,
          x: event.clientX,
          y: event.clientY,
        };
        this.stage.setAttribute("data-image-dragging", "");
        try {
          this.stage.setPointerCapture(event.pointerId);
        } catch {}
        if (event.cancelable) event.preventDefault();
        return;
      }

      if (this.gestureNavigationBlocked()) return;

      this.hideTooltip();
      this.activePointers.add(event.pointerId);
      if (event.pointerType === "mouse") {
        try {
          this.stage.setPointerCapture(event.pointerId);
        } catch {}
      }

      if (this.activePointers.size > 1) {
        this.hadMultiPointerGesture = true;
        this.pointerGesture = undefined;
        this.clearGesturePreview();
        this.stage.removeAttribute("data-image-dragging");
        return;
      }

      this.hadMultiPointerGesture = false;
      this.pointerGesture = {
        axis: null,
        id: event.pointerId,
        time: Date.now(),
        x: event.clientX,
        y: event.clientY,
      };
      this.stage.setAttribute("data-image-dragging", "");
      if (event.cancelable) event.preventDefault();
    };

    handlePointerMove = (event) => {
      if (!this.activePointers.has(event.pointerId)) return;

      const zoomPanGesture = this.zoomPanGesture;
      if (zoomPanGesture?.id === event.pointerId) {
        if (!this.isBrowserZoomed()) {
          this.cancelPointerGesture();
          return;
        }

        this.setZoomPan(
          zoomPanGesture.startPanX + event.clientX - zoomPanGesture.x,
          zoomPanGesture.startPanY + event.clientY - zoomPanGesture.y,
        );
        if (event.cancelable) event.preventDefault();
        return;
      }

      const gesture = this.pointerGesture;
      if (!gesture || gesture.id !== event.pointerId) return;
      if (this.gestureNavigationBlocked()) {
        this.cancelPointerGesture();
        return;
      }
      const deltaX = event.clientX - gesture.x;
      const deltaY = event.clientY - gesture.y;

      if (!gesture.axis && Math.hypot(deltaX, deltaY) >= DRAG_AXIS_LOCK_DISTANCE) {
        gesture.axis = Math.abs(deltaX) >= Math.abs(deltaY) ? "horizontal" : "vertical";
      }
      if (!gesture.axis) return;

      if (event.cancelable) event.preventDefault();
      if (gesture.axis === "horizontal" && this.items.length > 1) {
        this.applyGesturePreview(deltaX, 0);
      } else if (gesture.axis === "vertical") {
        this.applyGesturePreview(0, deltaY);
      }
    };

    handlePointerUp = (event) => {
      if (this.zoomPanGesture?.id === event.pointerId) {
        this.activePointers.delete(event.pointerId);
        this.zoomPanGesture = undefined;
        this.stage.removeAttribute("data-image-dragging");
        try {
          this.stage.releasePointerCapture(event.pointerId);
        } catch {}
        if (event.cancelable) event.preventDefault();
        return;
      }

      const gesture = this.pointerGesture;
      const wasMultiPointer = this.hadMultiPointerGesture || this.activePointers.size > 1;
      const pointer = { x: event.clientX, y: event.clientY };

      this.activePointers.delete(event.pointerId);
      try {
        this.stage.releasePointerCapture(event.pointerId);
      } catch {}

      if (wasMultiPointer) {
        if (this.activePointers.size === 0) {
          this.hadMultiPointerGesture = false;
          this.pointerGesture = undefined;
          this.stage.removeAttribute("data-image-dragging");
        }
        return;
      }

      this.pointerGesture = undefined;
      this.stage.removeAttribute("data-image-dragging");
      if (!gesture || gesture.id !== event.pointerId) return;
      if (this.gestureNavigationBlocked()) {
        this.clearGesturePreview();
        return;
      }

      const deltaX = event.clientX - gesture.x;
      const deltaY = event.clientY - gesture.y;
      const elapsed = Math.max(1, Date.now() - gesture.time);

      const axis =
        gesture.axis ??
        (Math.hypot(deltaX, deltaY) >= DRAG_AXIS_LOCK_DISTANCE
          ? Math.abs(deltaX) >= Math.abs(deltaY)
            ? "horizontal"
            : "vertical"
          : null);
      const horizontalSwipe =
        axis === "horizontal" &&
        this.items.length > 1 &&
        elapsed <= SWIPE_DURATION_MS &&
        (Math.abs(deltaX) > SWIPE_DISTANCE ||
          (Math.abs(deltaX) > TAP_DISTANCE * 2 && Math.abs(deltaX) / elapsed > SWIPE_VELOCITY));

      if (horizontalSwipe) {
        this.clearGesturePreview();
        if (deltaX < 0) this.next();
        else this.previous();
        return;
      }

      const verticalDismiss =
        axis === "vertical" &&
        (Math.abs(deltaY) > DISMISS_DISTANCE ||
          (Math.abs(deltaY) > TAP_DISTANCE * 4 && Math.abs(deltaY) / elapsed > DISMISS_VELOCITY));
      if (verticalDismiss) {
        this.swipeDismissActive = true;
        this.swipeDismissScrimOpacity = this.gestureScrimOpacity ?? IMAGE_DIALOG_SCRIM_OPACITY;
        this.requestClose(deltaY < 0 ? "swipe-up" : "swipe-down");
        return;
      }

      if (
        elapsed <= TAP_DURATION_MS &&
        Math.abs(deltaX) <= TAP_DISTANCE &&
        Math.abs(deltaY) <= TAP_DISTANCE
      ) {
        this.clearGesturePreview();
        this.handleTap(pointer);
      } else {
        this.settleGesturePreview();
      }
    };

    handlePointerCancel = (event) => {
      if (this.zoomPanGesture?.id === event.pointerId) {
        this.activePointers.delete(event.pointerId);
        this.zoomPanGesture = undefined;
        this.stage.removeAttribute("data-image-dragging");
        return;
      }

      this.activePointers.delete(event.pointerId);
      if (this.activePointers.size > 0) return;

      this.hadMultiPointerGesture = false;
      this.pointerGesture = undefined;
      this.stage.removeAttribute("data-image-dragging");
      this.settleGesturePreview();
    };

    handleNativeGestureStart = () => {
      if (!this.isOpen) return;

      this.nativeGestureActive = true;
      this.renderRequest += 1;
      this.cancelPointerGesture();
      this.cancelImageMotion();
      this.clearGesturePreview();
      this.clearTapTimer();
      this.lastTap = undefined;
      this.trackpadSwipeDelta = 0;
    };

    handleNativeGestureEnd = () => {
      if (!this.isOpen) return;

      this.nativeGestureActive = false;
      this.zoomGestureCooldownUntil = performance.now() + ZOOM_GESTURE_COOLDOWN_MS;
      requestAnimationFrame(this.handleViewportChange);
      window.setTimeout(this.handleViewportChange, ZOOM_GESTURE_COOLDOWN_MS);
    };

    handleWheel = (event) => {
      if (!this.isOpen || this.isClosing || this.informationOpen) return;

      if (event.ctrlKey) {
        this.trackpadSwipeDelta = 0;
        requestAnimationFrame(this.handleViewportChange);
        window.setTimeout(this.handleViewportChange, 120);
        return;
      }

      if (this.isBrowserZoomed()) {
        if (event.cancelable) event.preventDefault();
        this.trackpadSwipeDelta = 0;
        return;
      }

      if (this.gestureNavigationBlocked()) {
        this.trackpadSwipeDelta = 0;
        return;
      }

      if (this.items.length <= 1 || Math.abs(event.deltaX) <= Math.abs(event.deltaY) * 1.1) return;

      event.preventDefault();
      const now = performance.now();
      if (now - this.trackpadSwipeLastTime > TRACKPAD_SWIPE_RESET_MS) {
        this.trackpadSwipeDelta = 0;
      }
      this.trackpadSwipeLastTime = now;
      if (now < this.trackpadSwipeLockedUntil) return;

      this.trackpadSwipeDelta += event.deltaX;
      if (Math.abs(this.trackpadSwipeDelta) < TRACKPAD_SWIPE_DISTANCE) return;

      const direction = Math.sign(this.trackpadSwipeDelta);
      this.trackpadSwipeDelta = 0;
      this.trackpadSwipeLockedUntil = now + TRACKPAD_SWIPE_LOCK_MS;
      if (direction > 0) this.next();
      else this.previous();
    };

    handleViewportChange = () => {
      const wasZoomed = this.isBrowserZoomed();
      this.syncBrowserZoomState();
      const zoomed = this.isBrowserZoomed();

      if (zoomed) {
        if (!wasZoomed) {
          this.renderRequest += 1;
          this.cancelPointerGesture();
          this.cancelImageMotion();
          this.clearGesturePreview();
        }
        this.clampZoomPan();
        this.applyViewTransform();
        this.trackpadSwipeDelta = 0;
        return;
      }

      if (wasZoomed) {
        this.nativeGestureActive = false;
        this.zoomGestureCooldownUntil = performance.now() + ZOOM_GESTURE_COOLDOWN_MS;
        this.cancelPointerGesture();
        this.cancelImageMotion();
        this.clearGesturePreview();
        this.image.style.removeProperty("opacity");
        this.image.style.removeProperty("transform");
        this.trackpadSwipeDelta = 0;
        this.trackpadSwipeLockedUntil = this.zoomGestureCooldownUntil;
      }
    };

    handleImageLoad = () => {
      if (this.isBrowserZoomed()) {
        this.clampZoomPan();
        this.applyViewTransform();
      }
      if (this.informationOpen) this.updateInformation();
    };

    handleFullscreenChange = () => {
      const active = Boolean(this.getFullscreenElement()) || this.fullscreenFallback;
      this.setFullscreenLayout(active);
      requestAnimationFrame(this.handleViewportChange);
    };

    syncBrowserZoomState() {
      const pageZoomScale = (window.devicePixelRatio || 1) / this.browserZoomBaselineDpr;
      this.browserZoomScale = Math.max(1, window.visualViewport?.scale ?? 1, pageZoomScale);
      const zoomed = this.isBrowserZoomed();
      if (zoomed) {
        this.clampZoomPan();
      } else {
        this.zoomPanX = 0;
        this.zoomPanY = 0;
      }
      this.stage.toggleAttribute("data-browser-zoomed", zoomed);
    }

    isBrowserZoomed() {
      return this.browserZoomScale > 1 + ZOOM_EPSILON;
    }

    gestureNavigationBlocked() {
      return (
        this.nativeGestureActive ||
        this.isBrowserZoomed() ||
        performance.now() < this.zoomGestureCooldownUntil
      );
    }

    zoomPanBounds() {
      if (!this.isBrowserZoomed()) return { x: 0, y: 0 };

      const rect = this.stage.getBoundingClientRect();
      const hiddenRatio = 1 - 1 / this.browserZoomScale;
      return {
        x: Math.max(0, (rect.width * hiddenRatio) / 2),
        y: Math.max(0, (rect.height * hiddenRatio) / 2),
      };
    }

    clampZoomPan() {
      const bounds = this.zoomPanBounds();
      this.zoomPanX = clamp(this.zoomPanX, -bounds.x, bounds.x);
      this.zoomPanY = clamp(this.zoomPanY, -bounds.y, bounds.y);
    }

    setZoomPan(x, y) {
      this.zoomPanX = x;
      this.zoomPanY = y;
      this.clampZoomPan();
      this.applyViewTransform();
    }

    applyViewTransform() {
      const zoomed = this.isBrowserZoomed();
      const x = zoomed ? this.zoomPanX : this.gestureOffsetX;
      const y = zoomed ? this.zoomPanY : this.gestureOffsetY;
      const transformed = Math.abs(x) > 0.1 || Math.abs(y) > 0.1;

      if (transformed) {
        this.image.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      } else {
        this.image.style.removeProperty("transform");
      }

      if (zoomed) {
        this.image.style.removeProperty("opacity");
        this.clearGestureScrim();
        this.stage.setAttribute("data-browser-zoomed", "");
        return;
      }

      const distance = Math.hypot(this.gestureOffsetX, this.gestureOffsetY);
      if (distance > 0.1) {
        const verticalGesture = Math.abs(this.gestureOffsetY) > Math.abs(this.gestureOffsetX);
        if (verticalGesture) {
          const stageRect = this.stage.getBoundingClientRect();
          const gestureStartY = this.pointerGesture?.y ?? stageRect.top + stageRect.height / 2;
          const availableDistance = Math.max(
            DISMISS_DISTANCE * 2,
            this.gestureOffsetY >= 0
              ? stageRect.bottom - gestureStartY
              : gestureStartY - stageRect.top,
          );
          const fadeStart = availableDistance * DISMISS_FADE_START_RATIO;
          const fadeEnd = availableDistance * DISMISS_FADE_END_RATIO;
          const linearProgress = clamp(
            (Math.abs(this.gestureOffsetY) - fadeStart) / (fadeEnd - fadeStart),
            0,
            1,
          );
          const progress = linearProgress * linearProgress * (3 - 2 * linearProgress);

          if (progress > 0) {
            const imageOpacity = 1 - progress * DISMISS_IMAGE_OPACITY_REDUCTION;
            const scrimOpacity =
              IMAGE_DIALOG_SCRIM_OPACITY * (1 - progress * DISMISS_SCRIM_OPACITY_REDUCTION);
            this.image.style.opacity = String(imageOpacity);
            this.gestureScrimOpacity = scrimOpacity;
            this.setGestureScrimOpacity(scrimOpacity);
          } else {
            this.image.style.removeProperty("opacity");
            this.clearGestureScrim();
          }
        } else {
          this.image.style.removeProperty("opacity");
        }
      } else {
        this.image.style.removeProperty("opacity");
      }

      this.stage.toggleAttribute("data-browser-zoomed", this.isBrowserZoomed());
    }

    applyGesturePreview(x, y) {
      this.gestureOffsetX = x;
      this.gestureOffsetY = y;
      this.applyViewTransform();
    }

    getDialogScrim() {
      return this.dialog.shadowRoot?.querySelector(".scrim");
    }

    setGestureScrimOpacity(opacity, settling = false) {
      const scrim = this.getDialogScrim();
      if (!(scrim instanceof HTMLElement)) return;

      scrim.style.transition = settling ? "opacity 180ms cubic-bezier(0.2, 0, 0, 1)" : "none";
      scrim.style.opacity = String(opacity);
    }

    clearGestureScrim() {
      const scrim = this.getDialogScrim();
      if (scrim instanceof HTMLElement) {
        scrim.style.removeProperty("opacity");
        scrim.style.removeProperty("transition");
      }
      this.gestureScrimOpacity = undefined;
    }

    clearGesturePreview() {
      if (this.gestureSettleTimer) window.clearTimeout(this.gestureSettleTimer);
      this.gestureSettleTimer = undefined;
      this.image.classList.remove("is-gesture-settling");
      this.gestureOffsetX = 0;
      this.gestureOffsetY = 0;
      this.applyViewTransform();
      this.clearGestureScrim();
    }

    settleGesturePreview() {
      if (Math.abs(this.gestureOffsetX) <= 0.1 && Math.abs(this.gestureOffsetY) <= 0.1) return;

      if (this.gestureSettleTimer) window.clearTimeout(this.gestureSettleTimer);
      const restoreScrim = this.gestureScrimOpacity !== undefined;
      this.image.classList.add("is-gesture-settling");
      if (restoreScrim) this.setGestureScrimOpacity(IMAGE_DIALOG_SCRIM_OPACITY, true);
      this.gestureOffsetX = 0;
      this.gestureOffsetY = 0;
      this.applyViewTransform();
      this.gestureSettleTimer = window.setTimeout(() => {
        this.gestureSettleTimer = undefined;
        this.image.classList.remove("is-gesture-settling");
        if (restoreScrim) this.clearGestureScrim();
      }, 200);
    }

    resetView() {
      if (this.gestureSettleTimer) window.clearTimeout(this.gestureSettleTimer);
      this.gestureSettleTimer = undefined;
      this.gestureOffsetX = 0;
      this.gestureOffsetY = 0;
      this.zoomPanX = 0;
      this.zoomPanY = 0;
      this.zoomPanGesture = undefined;
      this.swipeDismissActive = false;
      this.swipeDismissScrimOpacity = undefined;
      this.image.classList.remove("is-gesture-settling");
      this.image.style.removeProperty("opacity");
      this.image.style.removeProperty("transform");
      this.stage.removeAttribute("data-image-dragging");
      this.clearGestureScrim();
      this.syncBrowserZoomState();
    }

    cancelPointerGesture() {
      for (const pointerId of this.activePointers) {
        try {
          if (this.stage.hasPointerCapture(pointerId)) this.stage.releasePointerCapture(pointerId);
        } catch {}
      }
      this.activePointers.clear();
      this.hadMultiPointerGesture = false;
      this.pointerGesture = undefined;
      this.zoomPanGesture = undefined;
      this.stage.removeAttribute("data-image-dragging");
    }

    handleTap(pointer) {
      const now = Date.now();
      const lastTap = this.lastTap;

      if (
        lastTap &&
        now - lastTap.time <= DOUBLE_TAP_MS &&
        distanceBetween(lastTap, pointer) <= DOUBLE_TAP_DISTANCE
      ) {
        this.clearTapTimer();
        this.lastTap = undefined;
        this.setControlsVisible(true);
        return;
      }

      this.lastTap = { ...pointer, time: now };
      this.clearTapTimer();
      this.setControlsVisible(!this.controlsVisible);
      this.tapTimer = window.setTimeout(() => {
        this.lastTap = undefined;
        this.tapTimer = undefined;
      }, DOUBLE_TAP_MS);
    }

    setControlsVisible(visible, closing = false) {
      this.controlsVisible = visible;
      this.toolbar.classList.toggle("is-hidden", !visible);
      this.toolbar.classList.toggle("is-closing", closing);
      this.toolbar.toggleAttribute("inert", !visible);
      if (visible) this.toolbar.removeAttribute("aria-hidden");
      else this.toolbar.setAttribute("aria-hidden", "true");
    }

    clearTapTimer() {
      if (this.tapTimer) window.clearTimeout(this.tapTimer);
      this.tapTimer = undefined;
    }
  };
