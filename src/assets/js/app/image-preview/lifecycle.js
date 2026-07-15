import { SITE_EVENTS } from "@/lib/site-contracts";
import { isHistoryMarker, historyStateWithMarker, restoreInlineStyle } from "./support.js";

export const withImagePreviewLifecycle = (Base) =>
  class extends Base {
    requestClose(reason) {
      if (!this.isOpen || this.isClosing) return;
      if (reason.startsWith("swipe-") && this.gestureNavigationBlocked()) return;

      this.renderRequest += 1;
      this.pendingIndex = undefined;
      this.cancelImageMotion();

      if (!reason.startsWith("swipe-")) {
        this.swipeDismissActive = false;
        this.swipeDismissScrimOpacity = undefined;
        this.clearGestureScrim();
      }

      this.isClosing = true;
      this.setControlsVisible(false, true);
      this.hideTooltip();
      const shouldRestoreHistory =
        this.historyEntryActive && isHistoryMarker(history.state, this.historyToken);
      const closing = this.closeDialog(reason);
      if (shouldRestoreHistory) history.back();
      void closing;
    }

    async closeDialog(reason) {
      if (!this.isOpen) return;
      if (this.informationOpen || this.informationDialog.open) {
        await this.closeInformation(false, true);
      }
      if (this.getFullscreenElement() || this.fullscreenFallback) {
        await this.exitFullscreen();
      } else {
        this.setFullscreenLayout(false);
      }
      if (!this.dialog.open) {
        this.finishClose();
        return;
      }

      await this.dialog.close(reason);
    }

    finishClose() {
      if (!this.isOpen && !this.lockedScroll) return;

      this.historyEntryActive = false;
      this.historyToken = null;
      this.renderRequest += 1;
      this.pendingIndex = undefined;
      this.cancelImageMotion();
      this.clearTapTimer();
      this.lastTap = undefined;
      this.activePointers.clear();
      this.hadMultiPointerGesture = false;
      this.pointerGesture = undefined;
      this.trackpadSwipeDelta = 0;
      this.nativeGestureActive = false;
      this.zoomGestureCooldownUntil = 0;
      this.resetView();
      this.status.textContent = "";
      this.isOpen = false;
      this.isClosing = false;
      this.fullscreenFallback = false;
      this.setFullscreenLayout(false);
      this.finishInformationClose(false);
      this.setControlsVisible(true);
      this.unlockPageScroll();
      if (this.restoreTriggerFocus) this.triggerImage?.focus({ preventScroll: true });
      else this.triggerImage?.blur();
      this.restoreTriggerFocus = false;
      this.hideTooltip();
      this.restoreLockedScrollPosition();
      this.triggerImage = undefined;
    }

    cancelImageMotion() {
      if (this.imageMotionFrame) cancelAnimationFrame(this.imageMotionFrame);
      if (this.imageMotionCleanup) this.imageMotionCleanup();
      else if (this.imageMotionTimer) window.clearTimeout(this.imageMotionTimer);
      if (this.gestureSettleTimer) window.clearTimeout(this.gestureSettleTimer);
      this.imageMotionFrame = undefined;
      this.imageMotionTimer = undefined;
      this.imageMotionCleanup = undefined;
      this.gestureSettleTimer = undefined;
      this.outgoingImage?.remove();
      this.outgoingImage = undefined;
      this.image.classList.remove(
        "is-entering-next",
        "is-entering-previous",
        "is-gesture-settling",
      );
    }

    pushHistoryEntry() {
      this.historyToken = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      try {
        history.pushState(historyStateWithMarker(this.historyToken), "", location.href);
        this.historyEntryActive = true;
      } catch {
        this.historyEntryActive = false;
      }
    }

    lockPageScroll() {
      const root = document.documentElement;
      const style = root.style;
      this.lockedScroll = {
        href: location.href,
        x: window.scrollX,
        y: window.scrollY,
        styles: {
          left: style.getPropertyValue("left"),
          overflowY: style.getPropertyValue("overflow-y"),
          position: style.getPropertyValue("position"),
          top: style.getPropertyValue("top"),
          width: style.getPropertyValue("width"),
        },
      };
      root.classList.add("site-image-dialog-open");
      style.setProperty("position", "fixed");
      style.setProperty("top", `${-this.lockedScroll.y}px`);
      style.setProperty("left", `${-this.lockedScroll.x}px`);
      style.setProperty("width", "100%");
      style.setProperty("overflow-y", "scroll");
    }

    unlockPageScroll() {
      const lockedScroll = this.lockedScroll;
      if (!lockedScroll) return;

      const root = document.documentElement;
      const style = root.style;
      root.classList.remove("site-image-dialog-open");
      restoreInlineStyle(style, "left", lockedScroll.styles.left);
      restoreInlineStyle(style, "overflow-y", lockedScroll.styles.overflowY);
      restoreInlineStyle(style, "position", lockedScroll.styles.position);
      restoreInlineStyle(style, "top", lockedScroll.styles.top);
      restoreInlineStyle(style, "width", lockedScroll.styles.width);
    }

    restoreLockedScrollPosition() {
      const lockedScroll = this.lockedScroll;
      this.lockedScroll = undefined;
      if (!lockedScroll || location.href !== lockedScroll.href) return;

      window.scrollTo(lockedScroll.x, lockedScroll.y);
    }

    preloadAdjacentImages() {
      if (this.items.length <= 1) return;

      for (const item of [
        this.items[(this.currentIndex + 1) % this.items.length],
        this.items[(this.currentIndex - 1 + this.items.length) % this.items.length],
      ]) {
        if (!item) continue;
        const image = new Image();
        image.src = item.src;
      }
    }

    hideTooltip(detail) {
      document.dispatchEvent(new CustomEvent(SITE_EVENTS.tooltipHide, { detail }));
    }

    destroy() {
      this.abortController.abort();
      this.cancelImageMotion();
      this.clearTapTimer();
      if (this.informationSizeTimer) window.clearTimeout(this.informationSizeTimer);
      this.informationSizeTimer = undefined;
      this.resetShareFeedback();
      this.resetView();
      const wasOpen = this.isOpen;
      this.isOpen = false;
      if (this.informationDialog.open) {
        this.informationDialog.quick = true;
        void this.informationDialog.close("destroy");
      }
      if (this.dialog.open) {
        this.dialog.quick = true;
        void this.dialog.close("destroy");
      }
      if (this.getFullscreenElement() || this.fullscreenFallback) void this.exitFullscreen();
      if (wasOpen || this.lockedScroll) {
        this.unlockPageScroll();
        this.restoreLockedScrollPosition();
      }
    }
  };
