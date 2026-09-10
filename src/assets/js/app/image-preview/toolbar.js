const TOOLBAR_MARGIN = 8;
const TOOLBAR_KEYBOARD_STEP = 16;
const TOOLBAR_KEYBOARD_LARGE_STEP = 48;

export const withImagePreviewToolbar = (Base) =>
  class extends Base {
    isToolbarControlPointer(event) {
      const path = event.composedPath();
      return path.includes(this.informationButton) || path.includes(this.closeButton);
    }

    toolbarScale() {
      const scale = Number(
        this.toolbar.style.getPropertyValue("--site-image-dialog-ui-scale") || "1",
      );
      return Number.isFinite(scale) && scale > 0 ? scale : 1;
    }

    ensureToolbarPositioned() {
      if (this.toolbarPosition) return;

      const rect = this.toolbar.getBoundingClientRect();
      this.toolbarPosition = { left: rect.left, top: rect.top };
      this.toolbar.setAttribute("data-image-toolbar-positioned", "");
      this.toolbar.style.left = `${rect.left}px`;
      this.toolbar.style.top = `${rect.top}px`;
      this.toolbar.style.right = "auto";
    }

    clampToolbarPosition() {
      if (!this.toolbarPosition || !this.toolbar.hasAttribute("data-image-toolbar-positioned")) {
        return;
      }

      const viewport = window.visualViewport;
      const viewportWidth = viewport?.width ?? window.innerWidth;
      const viewportHeight = viewport?.height ?? window.innerHeight;
      const width = this.toolbar.offsetWidth;
      const height = this.toolbar.offsetHeight;
      const maxLeft = Math.max(TOOLBAR_MARGIN, viewportWidth - width - TOOLBAR_MARGIN);
      const maxTop = Math.max(TOOLBAR_MARGIN, viewportHeight - height - TOOLBAR_MARGIN);
      const left = Math.min(maxLeft, Math.max(TOOLBAR_MARGIN, this.toolbarPosition.left));
      const top = Math.min(maxTop, Math.max(TOOLBAR_MARGIN, this.toolbarPosition.top));

      this.toolbarPosition.left = left;
      this.toolbarPosition.top = top;
      this.toolbar.style.left = `${left}px`;
      this.toolbar.style.top = `${top}px`;
    }

    handleToolbarPointerDown = (event) => {
      if (
        !this.isOpen ||
        this.isClosing ||
        this.informationOpen ||
        this.isToolbarControlPointer(event) ||
        event.isPrimary === false ||
        (event.pointerType === "mouse" && event.button !== 0)
      ) {
        return;
      }

      this.ensureToolbarPositioned();
      this.toolbarDrag = {
        id: event.pointerId,
        startLeft: this.toolbarPosition.left,
        startTop: this.toolbarPosition.top,
        startX: event.clientX,
        startY: event.clientY,
      };
      this.toolbar.setAttribute("data-image-toolbar-dragging", "");
      try {
        this.toolbar.setPointerCapture(event.pointerId);
      } catch {}
      if (event.cancelable) event.preventDefault();
    };

    handleToolbarPointerMove = (event) => {
      const drag = this.toolbarDrag;
      if (!drag || drag.id !== event.pointerId) return;

      const scale = this.toolbarScale();
      this.toolbarPosition.left = drag.startLeft + (event.clientX - drag.startX) / scale;
      this.toolbarPosition.top = drag.startTop + (event.clientY - drag.startY) / scale;
      this.clampToolbarPosition();
      if (event.cancelable) event.preventDefault();
    };

    finishToolbarDrag = (event) => {
      if (!this.toolbarDrag || (event && event.pointerId !== this.toolbarDrag.id)) return;

      const pointerId = this.toolbarDrag.id;
      this.toolbarDrag = undefined;
      this.toolbar.removeAttribute("data-image-toolbar-dragging");
      try {
        if (this.toolbar.hasPointerCapture(pointerId)) {
          this.toolbar.releasePointerCapture(pointerId);
        }
      } catch {}
    };

    handleToolbarPointerUp = (event) => {
      this.finishToolbarDrag(event);
    };

    handleToolbarPointerCancel = (event) => {
      this.finishToolbarDrag(event);
    };

    handleToolbarKeydown = (event) => {
      if (
        !this.isOpen ||
        this.isClosing ||
        this.informationOpen ||
        !event.altKey ||
        event.ctrlKey ||
        event.metaKey
      ) {
        return;
      }

      const directions = {
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
      };
      const direction = directions[event.key];
      if (!direction) return;

      this.ensureToolbarPositioned();
      const step = event.shiftKey ? TOOLBAR_KEYBOARD_LARGE_STEP : TOOLBAR_KEYBOARD_STEP;
      const scale = this.toolbarScale();
      this.toolbarPosition.left += (direction[0] * step) / scale;
      this.toolbarPosition.top += (direction[1] * step) / scale;
      this.clampToolbarPosition();
      event.preventDefault();
      event.stopPropagation();
    };

    cancelToolbarDrag() {
      this.finishToolbarDrag();
    }

    resetToolbarPosition() {
      this.cancelToolbarDrag();
      this.toolbarPosition = undefined;
      this.toolbar.removeAttribute("data-image-toolbar-positioned");
      this.toolbar.style.removeProperty("left");
      this.toolbar.style.removeProperty("top");
      this.toolbar.style.removeProperty("right");
      this.toolbar.removeAttribute("data-image-toolbar-dragging");
    }
  };
