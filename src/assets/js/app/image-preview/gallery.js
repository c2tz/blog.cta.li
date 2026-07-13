import { GALLERY_MOTION_DURATION_MS, fileNameFromURL, decodeImageSource } from "./support.js";

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

    async open(sourceImage) {
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
      this.browserZoomBaselineDpr = Math.max(0.1, window.devicePixelRatio || 1);
      this.browserZoomScale = 1;
      this.triggerImage = sourceImage;
      this.isOpen = true;
      this.isClosing = false;
      this.finishInformationClose(false);
      this.setControlsVisible(true);
      await this.renderCurrent();
      this.lockPageScroll();
      this.hideTooltip();

      try {
        await this.dialog.show();
        if (this.isOpen && !this.isClosing && this.dialog.open) this.pushHistoryEntry();
      } catch {
        this.finishClose();
      }
    }

    getImagePreviewCandidates(activeImage) {
      const container = activeImage.closest(".site-prose") ?? document;
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
      const outgoingImage = motion ? this.createOutgoingImage(motion) : null;
      this.currentIndex = normalizedIndex;
      this.pendingIndex = undefined;
      this.image.src = item.src;
      this.image.alt = item.alt || item.label;
      this.dialog.setAttribute("aria-label", `Aperçu de l’image : ${item.label}`);
      this.setOptionalNumericAttribute(this.image, "width", item.width);
      this.setOptionalNumericAttribute(this.image, "height", item.height);
      this.status.textContent = `Image ${this.currentIndex + 1} sur ${this.items.length} : ${item.label}`;
      if (this.informationOpen) this.updateInformation();

      if (motion) {
        this.outgoingImage = outgoingImage;
        this.imageMotionFrame = requestAnimationFrame(() => {
          this.imageMotionFrame = undefined;
          this.image.classList.add(`is-entering-${motion}`);
          const finishMotion = () => {
            if (this.imageMotionCleanup !== finishMotion) return;
            this.image.removeEventListener("animationend", finishMotion);
            if (this.imageMotionTimer) window.clearTimeout(this.imageMotionTimer);
            this.image.classList.remove(`is-entering-${motion}`);
            this.outgoingImage?.remove();
            this.outgoingImage = undefined;
            this.imageMotionTimer = undefined;
            this.imageMotionCleanup = undefined;
          };
          this.imageMotionCleanup = finishMotion;
          this.image.addEventListener("animationend", finishMotion);
          this.imageMotionTimer = window.setTimeout(finishMotion, GALLERY_MOTION_DURATION_MS + 100);
        });
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
