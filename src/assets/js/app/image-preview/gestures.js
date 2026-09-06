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

      // Once the browser owns the zoomed visual viewport, it must also own
      // panning and smart-zoom/double-click gestures. The lightbox only keeps
      // observing that state so gallery navigation stays disabled until 100%.
      this.syncBrowserZoomState();
      // A fresh pointer interaction also releases a missing Safari gestureend
      // when a tiny pinch never crossed the zoom threshold.
      if (event.pointerType === "mouse" || (event.isPrimary && this.activePointers.size === 0)) {
        this.nativeGestureActive = false;
      }
      if (this.isBrowserZoomed()) {
        // Safari can hand a pinch to its compositor without sending gestureend.
        // A fresh mouse press is a new interaction, not part of that pinch.
        if (event.pointerType === "mouse") {
          this.startImagePan(event);
        }
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
      if (event.pointerType === "mouse" && event.cancelable) event.preventDefault();
    };

    handlePointerMove = (event) => {
      if (!this.activePointers.has(event.pointerId)) return;

      const gesture = this.pointerGesture;
      if (!gesture || gesture.id !== event.pointerId) return;
      if (gesture.kind === "pan") {
        this.moveImagePan(event, gesture);
        return;
      }
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

      if (event.pointerType === "mouse" && event.cancelable) event.preventDefault();
      if (gesture.axis === "horizontal" && this.items.length > 1) {
        this.applyGesturePreview(deltaX, 0);
      } else if (gesture.axis === "vertical") {
        this.applyGesturePreview(0, deltaY);
      }
    };

    handlePointerUp = (event) => {
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
      if (!gesture || gesture.id !== event.pointerId || gesture.kind === "pan") return;
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
      // pointerup already finishes the gesture. Its subsequent lost capture
      // must not settle the image or restore the scrim during dismissal.
      if (!this.activePointers.delete(event.pointerId) || this.isClosing) return;
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

      this.syncBrowserZoomState();
      if (event.ctrlKey) {
        this.trackpadSwipeDelta = 0;
        requestAnimationFrame(this.handleViewportChange);
        window.setTimeout(this.handleViewportChange, 120);
        return;
      }

      if (this.isBrowserZoomed()) {
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

    handleImageLoad = () => {
      if (this.informationOpen) this.updateInformation();
    };

    handleFullscreenChange = () => {
      const active = Boolean(this.getFullscreenElement()) || this.fullscreenFallback;
      this.setFullscreenLayout(active);
      requestAnimationFrame(this.handleViewportChange);
    };

    gestureNavigationBlocked() {
      return (
        this.nativeGestureActive ||
        this.isBrowserZoomed() ||
        performance.now() < this.zoomGestureCooldownUntil
      );
    }

    applyViewTransform() {
      if (this.isBrowserZoomed()) {
        this.image.style.removeProperty("opacity");
        this.image.style.removeProperty("transform");
        this.clearGestureScrim();
        return;
      }

      const x = this.gestureOffsetX;
      const y = this.gestureOffsetY;
      const transformed = Math.abs(x) > 0.1 || Math.abs(y) > 0.1;

      if (transformed) {
        this.image.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      } else {
        this.image.style.removeProperty("transform");
      }

      const distance = Math.hypot(this.gestureOffsetX, this.gestureOffsetY);
      if (distance > 0.1) {
        const verticalGesture = Math.abs(this.gestureOffsetY) > Math.abs(this.gestureOffsetX);
        if (verticalGesture) {
          const stageRect = this.stage.getBoundingClientRect();
          // The same image displacement must produce the same fade, regardless
          // of where the user grabbed it or the direction of dismissal.
          const fittedHeight = Math.min(
            stageRect.height,
            (stageRect.width * (this.image.naturalHeight || 1)) / (this.image.naturalWidth || 1),
          );
          const availableDistance = Math.max(
            DISMISS_DISTANCE,
            (stageRect.height + fittedHeight) / 2,
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

      // A drag may begin before the opening fade completes. It takes ownership
      // of opacity immediately instead of competing with a filling animation.
      scrim.getAnimations().forEach((animation) => animation.cancel());
      scrim.style.transition = settling ? "opacity 180ms cubic-bezier(0.2, 0, 0, 1)" : "none";
      scrim.style.opacity = String(opacity);
    }

    clearGestureScrim() {
      const scrim = this.getDialogScrim();
      if (scrim instanceof HTMLElement) {
        // Material renders its scrim outside the native top layer. Keep page
        // controls (including consent and scroll-to-top) beneath this backdrop.
        scrim.style.zIndex = "10001";
        scrim.style.opacity = String(IMAGE_DIALOG_SCRIM_OPACITY);
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
      this.resetZoomViewport();
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
      this.stage.removeAttribute("data-image-dragging");
    }

    handleDoubleClick = () => {
      if (!this.isOpen || this.isClosing || this.informationOpen) return;

      // Do not cancel the event: Safari smart zoom and every other browser's
      // native double-click/tap policy remain authoritative.
      this.setControlsVisible(true);
    };

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
      if (!visible) {
        this.focusRequest += 1;
        this.pendingTabFocus = undefined;
      }
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
