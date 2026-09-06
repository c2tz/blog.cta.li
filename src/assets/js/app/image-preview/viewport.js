import { ZOOM_EPSILON, ZOOM_REST_EPSILON, ZOOM_GESTURE_COOLDOWN_MS, clamp } from "./support.js";

const viewportProperties = ["left", "top", "width", "height", "canvas-width", "canvas-height"];

export const withImagePreviewViewport = (Base) =>
  class extends Base {
    syncBrowserZoomState() {
      // DPR changes with page zoom and between monitors; only the visual
      // viewport identifies native pinch magnification without a layout reflow.
      const scale = window.visualViewport?.scale ?? 1;
      const threshold = this.browserZoomed ? ZOOM_REST_EPSILON : ZOOM_EPSILON;
      this.browserZoomed = scale > 1 + threshold;
      this.shell.toggleAttribute("data-browser-zoomed", this.browserZoomed);
      this.stage.toggleAttribute("data-browser-zoomed", this.browserZoomed);
      this.syncToolbarScale();
    }

    isBrowserZoomed() {
      return Boolean(this.browserZoomed);
    }

    syncToolbarScale() {
      // Preserve the original layout anchor; do not follow viewport panning.
      // Keep the controls' screen size stable during native image magnification.
      const inverseScale = 1 / Math.max(1, window.visualViewport?.scale ?? 1);
      this.toolbar.style.setProperty("--site-image-dialog-ui-scale", String(inverseScale));
    }

    createOpeningFocusAnchor() {
      const viewport = window.visualViewport;
      if (!viewport || !this.isBrowserZoomed()) return;
      // Native showModal autofocus would pan to the original, now off-screen
      // toolbar. Start inside the visible area; the normal focus handoff follows
      // with preventScroll once opening completes. This node is then removed.
      const anchor = document.createElement("span");
      anchor.className = "sr-only";
      anchor.dataset.imageInitialFocus = "";
      anchor.tabIndex = -1;
      anchor.autofocus = true;
      anchor.textContent = "Aperçu de l’image";
      anchor.style.position = "fixed";
      anchor.style.left = `${viewport.offsetLeft + viewport.width / 2}px`;
      anchor.style.top = `${viewport.offsetTop + viewport.height / 2}px`;
      this.shell.prepend(anchor);
      return anchor;
    }

    handleViewportChange = () => {
      const wasZoomed = this.isBrowserZoomed();
      this.syncBrowserZoomState();
      if (!this.isOpen || this.isClosing) return;
      const zoomed = this.isBrowserZoomed();
      if (zoomed !== wasZoomed) {
        this.renderRequest += 1;
        this.cancelPointerGesture();
        this.cancelImageMotion();
        if (!zoomed) {
          this.nativeGestureActive = false;
          this.zoomGestureCooldownUntil = performance.now() + ZOOM_GESTURE_COOLDOWN_MS;
          this.trackpadSwipeLockedUntil = this.zoomGestureCooldownUntil;
        }
        this.clearGesturePreview();
      }
      this.syncZoomViewport();
      this.trackpadSwipeDelta = 0;
    };

    syncZoomViewport() {
      if (!this.isBrowserZoomed()) {
        this.resetZoomViewport();
        return;
      }
      if (!this.dialog.open) return;
      const viewport = window.visualViewport;
      if (!viewport) return;
      const nativeDialog = this.dialog.shadowRoot.querySelector("dialog");
      const dialogRect = nativeDialog.getBoundingClientRect();
      const dialogStyle = getComputedStyle(nativeDialog);
      // Safari's client rects use visual coordinates while Chromium uses layout
      // coordinates. Resolve the origin from the native fixed dialog itself.
      const originX =
        dialogRect.left -
        (parseFloat(dialogStyle.left) || 0) -
        (parseFloat(dialogStyle.marginLeft) || 0);
      const originY =
        dialogRect.top -
        (parseFloat(dialogStyle.top) || 0) -
        (parseFloat(dialogStyle.marginTop) || 0);
      const shell = this.shell.getBoundingClientRect();
      const left = clamp(viewport.offsetLeft + originX - shell.left, 0, shell.width);
      const top = clamp(viewport.offsetTop + originY - shell.top, 0, shell.height);
      const width = Math.max(
        1,
        Math.min(shell.right, viewport.offsetLeft + originX + viewport.width) - shell.left - left,
      );
      const height = Math.max(
        1,
        Math.min(shell.bottom, viewport.offsetTop + originY + viewport.height) - shell.top - top,
      );
      const scale = viewport.scale;
      const previousScale = this.zoomViewport?.scale ?? 1;
      const scrollLeft =
        (this.stage.scrollLeft / previousScale + left - (this.zoomViewport?.left ?? 0)) * scale;
      const scrollTop =
        (this.stage.scrollTop / previousScale + top - (this.zoomViewport?.top ?? 0)) * scale;
      const values = {
        left,
        top,
        width: width * scale,
        height: height * scale,
        "canvas-width": this.shell.clientWidth * scale,
        "canvas-height": this.shell.clientHeight * scale,
      };
      for (const [name, value] of Object.entries(values)) {
        this.stage.style.setProperty(`--image-viewport-${name}`, `${value}px`);
      }
      this.stage.style.setProperty("--image-viewport-inverse-scale", String(1 / scale));
      // An inverse scale keeps native scroll units in screen pixels, avoiding
      // multiplied trackpad speed. Matching canvas dimensions preserve image size.
      // Overflow makes trackpad/touch panning real native element scrolling,
      // including on Safari where modal viewport panning can remain stationary.
      this.stage.scrollLeft = scrollLeft;
      this.stage.scrollTop = scrollTop;
      this.zoomViewport = { left, top, scale };
    }

    resetZoomViewport() {
      this.zoomViewport = undefined;
      for (const name of viewportProperties) {
        this.stage.style.removeProperty(`--image-viewport-${name}`);
      }
      this.stage.style.removeProperty("--image-viewport-inverse-scale");
      this.stage.scrollLeft = 0;
      this.stage.scrollTop = 0;
    }

    startImagePan(event) {
      this.hideTooltip();
      this.syncZoomViewport();
      this.activePointers.add(event.pointerId);
      try {
        this.stage.setPointerCapture(event.pointerId);
      } catch {}
      this.pointerGesture = {
        kind: "pan",
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        scrollLeft: this.stage.scrollLeft,
        scrollTop: this.stage.scrollTop,
      };
      this.stage.setAttribute("data-image-dragging", "");
      if (event.cancelable) event.preventDefault();
    }

    moveImagePan(event, gesture) {
      const scale = this.zoomViewport?.scale ?? 1;
      this.stage.scrollLeft = gesture.scrollLeft - (event.clientX - gesture.x) * scale;
      this.stage.scrollTop = gesture.scrollTop - (event.clientY - gesture.y) * scale;
      if (event.cancelable) event.preventDefault();
    }
  };
