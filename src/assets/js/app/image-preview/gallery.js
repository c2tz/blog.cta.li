import { GALLERY_MOTION_DURATION_MS, fileNameFromURL, decodeImageSource } from "./support.js";
import { areSiteAnimationsEnabled } from "../site-motion.js";

const waitForNextRender = () =>
  new Promise((resolve) => {
    // A timer alone may run before WebKit commits the current input/layout
    // update. Resume in a task after a rendering opportunity instead.
    requestAnimationFrame(() => window.setTimeout(resolve));
  });

export const withImagePreviewGallery = (Base) =>
  class extends Base {
    getDialogImage(event) {
      if (!(event.target instanceof Element)) return null;

      const image = event.target.closest(".site-prose img");
      if (!image?.src) return null;
      if (image.closest("header, footer, nav, [data-no-image-dialog]")) return null;
      if (image.closest("a[href], button, input, select, textarea")) return null;

      return image;
    }

    async open(sourceImage, { restoreFocus = false } = {}) {
      if (this.isOpen || this.dialog.open) return;

      const selectedItem = this.getImagePreviewItem(sourceImage);
      if (!selectedItem) return;

      this.items = this.getImagePreviewCandidates(sourceImage)
        .map((image) => this.getImagePreviewItem(image))
        .filter(Boolean);
      if (!this.items.length) this.items = [selectedItem];
      this.currentIndex = Math.max(
        0,
        this.items.findIndex((item) => item.src === selectedItem.src),
      );
      this.pendingIndex = undefined;
      this.browserZoomed = false;
      const richTooltip = sourceImage.closest("[data-site-rich-tooltip][id]");
      const richTooltipTrigger = richTooltip
        ? [...document.querySelectorAll("[data-rich-tooltip-trigger]")].find(
            (trigger) => trigger.dataset.richTooltipTrigger === richTooltip.id,
          )
        : null;
      const richTooltipWasOpen = Boolean(richTooltip?.matches(":popover-open"));
      this.triggerImage = restoreFocus && richTooltipTrigger ? richTooltipTrigger : sourceImage;
      this.restoreTriggerFocus = restoreFocus;
      this.isOpen = true;
      this.isClosing = false;
      if (richTooltipWasOpen) {
        // Let WebKit finish rendering the trusted activation before removing
        // the clicked popover or changing the page layout.
        await waitForNextRender();
        if (!this.isOpen || this.isClosing || !this.dialog.isConnected) {
          this.finishClose();
          return;
        }
      }
      this.finishInformationClose(false);
      this.setControlsVisible(true);
      await this.renderCurrent();
      // Release focus before hiding its popover. WebKit can stall between
      // top-layer updates when a focused descendant becomes hidden.
      if (richTooltipWasOpen) sourceImage.blur();
      this.hideTooltip(
        richTooltipTrigger && restoreFocus ? { suppressNextFocus: true } : undefined,
      );
      if (richTooltipWasOpen) {
        // Let top-layer removal render before locking the root and promoting
        // the Material dialog to a modal. Separate timers can share a frame.
        await waitForNextRender();
        if (!this.isOpen || this.isClosing || !this.dialog.isConnected) {
          this.finishClose();
          return;
        }
      }

      // Preserve the popover's scrolling context until its top-layer removal
      // has settled. Locking the root first can stall WebKit during that removal.
      this.lockPageScroll();
      const openingFocusAnchor = this.createOpeningFocusAnchor();
      try {
        const focusRequestBeforeShow = this.focusRequest;
        // Back must close the preview as soon as it becomes visible, including
        // while its opening animation or the information dialog is running.
        this.pushHistoryEntry();
        await this.dialog.show();
        if (this.isOpen && !this.isClosing && !this.dialog.open) {
          this.requestClose("open-cancelled");
          return;
        }
        if (this.isOpen && !this.isClosing && this.dialog.open) {
          // Do not overwrite a Tab move made while the opening animation was
          // still resolving. The Material dialog's autofocus already covers
          // the default close-button target during that interval.
          if (this.focusRequest === focusRequestBeforeShow) {
            this.focusControl(this.closeButton);
          }
        }
      } catch {
        this.requestClose("open-failed");
      } finally {
        openingFocusAnchor?.remove();
      }
    }

    getImagePreviewCandidates(activeImage) {
      const container =
        activeImage.closest("[data-site-rich-tooltip]") ??
        activeImage.closest(".site-prose") ??
        document;
      const images = [...container.querySelectorAll("img")].filter((image) => {
        if (!image.src) return false;
        if (image.closest("header, footer, nav, [data-no-image-dialog]")) return false;
        return !image.closest("a[href], button, input, select, textarea");
      });

      return images.length ? images : [activeImage];
    }

    getImagePreviewItem(image) {
      const src = image.currentSrc || image.src;
      if (!src) return null;

      return {
        alt: image.alt,
        createdAt: image.dataset.imageCreatedAt,
        height: image.naturalHeight || this.getNumericAttribute(image, "height"),
        label: this.getImageLabel(image, src),
        lastModified: image.dataset.imageModifiedAt,
        src,
        width: image.naturalWidth || this.getNumericAttribute(image, "width"),
      };
    }

    getImageLabel(image, src) {
      return (
        image.alt.trim() ||
        image
          .getAttribute("aria-label")
          ?.replace(/^Agrandir l['’]image\s*:\s*/i, "")
          .trim() ||
        image.title.trim() ||
        fileNameFromURL(src)
      );
    }

    getNumericAttribute(image, attribute) {
      const value = Number.parseInt(image.getAttribute(attribute) ?? "", 10);
      return Number.isFinite(value) && value > 0 ? value : undefined;
    }

    async renderCurrent(motion, index = this.currentIndex) {
      const normalizedIndex = ((index % this.items.length) + this.items.length) % this.items.length;
      const item = this.items[normalizedIndex];
      if (!item) return;
      const request = ++this.renderRequest;

      if (motion && !(await decodeImageSource(item.src))) {
        if (request === this.renderRequest) this.pendingIndex = undefined;
        return;
      }
      if (
        request !== this.renderRequest ||
        !this.isOpen ||
        this.isClosing ||
        (motion && this.gestureNavigationBlocked())
      ) {
        if (request === this.renderRequest) this.pendingIndex = undefined;
        return;
      }

      this.cancelImageMotion();
      this.resetView();
      if (!areSiteAnimationsEnabled()) motion = undefined;
      const outgoingImage = motion ? this.createOutgoingImage(motion) : null;
      this.currentIndex = normalizedIndex;
      this.pendingIndex = undefined;
      this.image.src = item.src;
      this.image.alt = item.alt || item.label;
      void this.prepareShareFile(item);
      this.dialog.setAttribute("aria-label", `Aperçu de l’image : ${item.label}`);
      this.setOptionalNumericAttribute(this.image, "width", item.width);
      this.setOptionalNumericAttribute(this.image, "height", item.height);
      this.status.textContent = `Image ${this.currentIndex + 1} sur ${this.items.length} : ${item.label}`;
      if (this.informationOpen) this.updateInformation();

      if (motion) {
        this.outgoingImage = outgoingImage;
        const expectedAnimationName = `site-image-dialog-enter-${motion}`;
        let startMotionTimer;
        let motionStarted = false;
        let motionStartedAt;
        const finishMotion = () => {
          if (this.imageMotionCleanup !== finishMotion) return;
          if (this.imageMotionFrame) cancelAnimationFrame(this.imageMotionFrame);
          this.imageMotionFrame = undefined;
          if (startMotionTimer) window.clearTimeout(startMotionTimer);
          startMotionTimer = undefined;
          this.image.removeEventListener("animationend", handleAnimationEnd);
          if (this.imageMotionTimer) window.clearTimeout(this.imageMotionTimer);
          this.image.classList.remove(`is-entering-${motion}`);
          this.outgoingImage?.remove();
          this.outgoingImage = undefined;
          this.imageMotionTimer = undefined;
          this.imageMotionCleanup = undefined;
        };
        const handleAnimationEnd = (event) => {
          // A delayed event from the previous gallery motion can arrive after
          // the next listener is installed on the same image in WebKit. The
          // name alone is not generation-specific when two consecutive
          // motions use the same direction, so never let an old event shorten
          // the current 320 ms transition.
          if (
            event.target !== this.image ||
            event.animationName !== expectedAnimationName ||
            motionStartedAt === undefined ||
            performance.now() - motionStartedAt < GALLERY_MOTION_DURATION_MS
          ) {
            return;
          }
          finishMotion();
        };
        const startMotion = () => {
          if (this.imageMotionCleanup !== finishMotion || motionStarted) return;
          motionStarted = true;
          if (this.imageMotionFrame) cancelAnimationFrame(this.imageMotionFrame);
          this.imageMotionFrame = undefined;
          if (startMotionTimer) window.clearTimeout(startMotionTimer);
          startMotionTimer = undefined;
          motionStartedAt = performance.now();
          this.image.classList.add(`is-entering-${motion}`);
          // Count cleanup from the actual animation start. A delayed WebKit
          // frame must not shorten the 320 ms transition.
          this.imageMotionTimer = window.setTimeout(finishMotion, GALLERY_MOTION_DURATION_MS + 100);
        };
        this.imageMotionCleanup = finishMotion;
        this.image.addEventListener("animationend", handleAnimationEnd);
        // WebKit can starve requestAnimationFrame while the Safari UI thread
        // is busy. Whichever callback runs first starts the same motion once.
        this.imageMotionFrame = requestAnimationFrame(startMotion);
        startMotionTimer = window.setTimeout(startMotion, 100);
      }

      this.preloadAdjacentImages();
    }

    createOutgoingImage(motion) {
      if (!this.image.src) return null;

      const outgoingImage = this.image.cloneNode(false);
      outgoingImage.removeAttribute("data-image-dialog-image");
      outgoingImage.removeAttribute("id");
      outgoingImage.setAttribute("aria-hidden", "true");
      outgoingImage.alt = "";
      outgoingImage.classList.add("site-image-dialog-image--outgoing", `is-leaving-${motion}`);
      this.stage.insertBefore(outgoingImage, this.image);
      return outgoingImage;
    }

    setOptionalNumericAttribute(element, name, value) {
      if (value) element.setAttribute(name, String(value));
      else element.removeAttribute(name);
    }

    previous() {
      this.goTo((this.pendingIndex ?? this.currentIndex) - 1, "previous");
    }

    next() {
      this.goTo((this.pendingIndex ?? this.currentIndex) + 1, "next");
    }

    goTo(index, motion) {
      if (this.items.length < 1 || this.gestureNavigationBlocked()) return;

      this.hideTooltip();
      this.setControlsVisible(true);
      this.pendingIndex = ((index % this.items.length) + this.items.length) % this.items.length;
      void this.renderCurrent(motion, this.pendingIndex);
    }
  };
