import "@/assets/js/material-web/image-preview.js";
import {
  IMAGE_DIALOG_OPEN_ANIMATION,
  IMAGE_DIALOG_CLOSE_ANIMATION,
  INFORMATION_DIALOG_OPEN_ANIMATION,
  INFORMATION_DIALOG_CLOSE_ANIMATION,
  requiredElement,
  isHistoryMarker,
} from "./image-preview/support.js";
import { withImagePreviewGallery } from "./image-preview/gallery.js";
import { withImagePreviewGestures } from "./image-preview/gestures.js";
import { withImagePreviewInformation } from "./image-preview/information.js";
import { withImagePreviewLifecycle } from "./image-preview/lifecycle.js";
import { withImagePreviewViewport } from "./image-preview/viewport.js";
import { initMaterialMotion } from "./material-motion.js";
import { areSiteAnimationsEnabled } from "./site-motion.js";
import { SITE_EVENTS } from "@/lib/site-contracts";

let activeController;
let pendingDialog;
let pageLoadListenerInstalled = false;

const ImagePreviewControllerBase = withImagePreviewLifecycle(
  withImagePreviewInformation(
    withImagePreviewGallery(withImagePreviewGestures(withImagePreviewViewport(class {}))),
  ),
);

class ImagePreviewController extends ImagePreviewControllerBase {
  constructor(dialog) {
    super();
    this.dialog = dialog;
    this.abortController = new AbortController();
    this.shell = requiredElement(dialog, "[data-image-dialog-shell]");
    this.stage = requiredElement(dialog, "[data-image-dialog-stage]");
    this.image = requiredElement(dialog, "[data-image-dialog-image]");
    this.toolbar = requiredElement(dialog, "[data-image-dialog-toolbar]");
    this.informationButton = requiredElement(dialog, "[data-image-information]");
    this.closeButton = requiredElement(dialog, "[data-image-close]");
    this.status = requiredElement(dialog, "[data-image-status]");
    this.informationDialog = requiredElement(document, "[data-image-information-dialog]");
    this.informationCloseButton = requiredElement(
      this.informationDialog,
      "[data-image-information-close]",
    );
    this.downloadButton = requiredElement(this.informationDialog, "[data-image-download]");
    this.shareButton = requiredElement(this.informationDialog, "[data-image-share]");
    this.shareLabel = requiredElement(this.shareButton, "[data-image-share-label]");
    this.shareIcon = requiredElement(this.shareButton, "md-icon");
    this.actionStatus = requiredElement(this.informationDialog, "[data-image-action-status]");
    this.fullscreenButton = requiredElement(this.informationDialog, "[data-image-fullscreen]");
    this.fullscreenLabel = requiredElement(this.fullscreenButton, "[data-image-fullscreen-label]");
    this.fullscreenIcon = requiredElement(this.fullscreenButton, "md-icon");
    this.infoFields = {
      created: requiredElement(this.informationDialog, "[data-image-info-created]"),
      dimensions: requiredElement(this.informationDialog, "[data-image-info-dimensions]"),
      modified: requiredElement(this.informationDialog, "[data-image-info-modified]"),
      name: requiredElement(this.informationDialog, "[data-image-info-name]"),
      size: requiredElement(this.informationDialog, "[data-image-info-size]"),
      type: requiredElement(this.informationDialog, "[data-image-info-type]"),
    };

    this.items = [];
    this.currentIndex = 0;
    this.pendingIndex = undefined;
    this.activePointers = new Set();
    this.browserZoomed = false;

    this.controlsVisible = true;
    this.informationOpen = false;
    this.historyToken = null;
    this.historyEntryActive = false;
    this.isClosing = false;
    this.isOpen = false;
    this.restoreTriggerFocus = false;
    this.informationRequest = 0;
    this.fullscreenFallback = false;
    this.gestureOffsetX = 0;
    this.gestureOffsetY = 0;
    this.gestureScrimOpacity = undefined;
    this.swipeDismissActive = false;
    this.swipeDismissScrimOpacity = undefined;
    this.trackpadSwipeDelta = 0;
    this.trackpadSwipeLastTime = 0;
    this.trackpadSwipeLockedUntil = 0;
    this.nativeGestureActive = false;
    this.zoomGestureCooldownUntil = 0;
    this.renderRequest = 0;
    this.focusRequest = 0;
    this.pendingTabFocus = undefined;

    this.dialog.getOpenAnimation = () => IMAGE_DIALOG_OPEN_ANIMATION;
    this.dialog.getCloseAnimation = () => this.getDialogCloseAnimation();
    this.informationDialog.getOpenAnimation = () => INFORMATION_DIALOG_OPEN_ANIMATION;
    this.informationDialog.getCloseAnimation = () => INFORMATION_DIALOG_CLOSE_ANIMATION;
    this.syncMotionPreference();
    this.clearGestureScrim();
    this.syncBrowserZoomState();
    this.renderFullscreenState();
    this.bindEvents();
  }

  bindEvents() {
    const options = { signal: this.abortController.signal };

    document.addEventListener("click", this.handleDocumentClick, { ...options, capture: true });
    // Capture before Material Dialog's document-level focus trap so WebKit
    // cannot consume Tab before the two explicit toolbars have cycled it.
    window.addEventListener("keydown", this.handleDocumentKeydown, { ...options, capture: true });
    window.addEventListener("keyup", this.handleDocumentKeyup, { ...options, capture: true });
    window.addEventListener("pointerdown", this.handlePointerFocusIntent, {
      ...options,
      capture: true,
    });
    document.addEventListener("gesturestart", this.handleNativeGestureStart, {
      ...options,
      passive: true,
    });
    document.addEventListener("gestureend", this.handleNativeGestureEnd, {
      ...options,
      passive: true,
    });
    document.addEventListener("fullscreenchange", this.handleFullscreenChange, options);
    document.addEventListener("webkitfullscreenchange", this.handleFullscreenChange, options);
    window.addEventListener("popstate", this.handlePopState, options);
    document.addEventListener(SITE_EVENTS.motionChange, this.syncMotionPreference, options);

    this.dialog.addEventListener("opened", this.handleViewportChange, options);
    this.dialog.addEventListener("cancel", this.handleDialogCancel, options);
    this.dialog.addEventListener("closed", this.handleDialogClosed, options);
    this.dialog.addEventListener("keydown", this.handleDialogKeydown, options);
    this.stage.addEventListener("pointerdown", this.handlePointerDown, options);
    this.stage.addEventListener("pointermove", this.handlePointerMove, options);
    this.stage.addEventListener("pointerup", this.handlePointerUp, options);
    this.stage.addEventListener("pointercancel", this.handlePointerCancel, options);
    this.stage.addEventListener("lostpointercapture", this.handlePointerCancel, options);
    this.stage.addEventListener("dblclick", this.handleDoubleClick, { ...options, passive: true });
    this.stage.addEventListener("wheel", this.handleWheel, { ...options, passive: false });
    this.image.addEventListener("load", this.handleImageLoad, options);
    window.addEventListener("resize", this.handleViewportChange, options);
    window.visualViewport?.addEventListener("resize", this.handleViewportChange, options);
    window.visualViewport?.addEventListener("scroll", this.handleViewportChange, options);

    this.informationDialog.addEventListener("cancel", this.handleInformationCancel, options);
    this.informationDialog.addEventListener("closed", this.handleInformationClosed, options);
    this.informationButton.addEventListener("click", () => void this.openInformation(), options);
    this.closeButton.addEventListener(
      "click",
      (event) => {
        if (event.detail === 0) this.restoreTriggerFocus = true;
        this.requestClose("close-button");
      },
      options,
    );
    this.informationCloseButton.addEventListener(
      "click",
      () => void this.closeInformation(true),
      options,
    );
    this.downloadButton.addEventListener("click", () => void this.download(), options);
    this.shareButton.addEventListener("click", () => void this.share(), options);
    this.fullscreenButton.addEventListener(
      "click",
      () => void this.handleFullscreenAction(),
      options,
    );
  }

  syncMotionPreference = () => {
    if (!areSiteAnimationsEnabled()) this.cancelImageMotion();
    initMaterialMotion();
  };

  getDialogCloseAnimation() {
    if (!this.swipeDismissActive) return IMAGE_DIALOG_CLOSE_ANIMATION;

    return {
      dialog: [
        [[{ opacity: 1 }, { opacity: 1 }], { duration: 180, easing: "linear", fill: "both" }],
      ],
      scrim: [
        [
          [{ opacity: this.swipeDismissScrimOpacity }, { opacity: 0 }],
          { duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)", fill: "both" },
        ],
      ],
      content: [
        [
          [{ opacity: 1 }, { opacity: 0 }],
          { duration: 160, easing: "cubic-bezier(0.2, 0, 0, 1)", fill: "both" },
        ],
      ],
    };
  }

  handleDocumentClick = (event) => {
    if (this.isOpen) return;

    const image = this.getDialogImage(event);
    if (!image) return;

    void this.open(image, { restoreFocus: false });
  };

  handleDocumentKeydown = (event) => {
    if (this.isOpen) {
      if (event.key === "Tab" && !this.isClosing) {
        if (!this.informationOpen && !this.controlsVisible) this.setControlsVisible(true);
        this.cycleKeyboardFocus(
          event,
          this.informationOpen
            ? [
                this.informationCloseButton,
                this.downloadButton,
                this.shareButton,
                this.fullscreenButton,
              ]
            : [this.informationButton, this.closeButton],
        );
      }
      return;
    }

    if (event.key !== "Enter" && event.key !== " ") return;

    const image = this.getDialogImage(event);
    if (!image) return;

    event.preventDefault();
    event.stopPropagation();
    void this.open(image, { restoreFocus: true });
  };

  handleDocumentKeyup = (event) => {
    if (event.key !== "Tab") return;

    const control = this.pendingTabFocus;
    this.pendingTabFocus = undefined;
    if (!control || !this.isOpen || this.isClosing || !control.isConnected) return;

    event.preventDefault();
    this.focusControl(control);
  };

  handlePointerFocusIntent = () => {
    this.focusRequest += 1;
    this.pendingTabFocus = undefined;
  };

  handleDialogCancel = (event) => {
    event.preventDefault();
    if (this.informationOpen) {
      void this.closeInformation(true);
      return;
    }

    this.restoreTriggerFocus = true;
    this.requestClose("cancel");
  };

  handleDialogClosed = () => {
    this.finishClose();
  };

  handleInformationCancel = (event) => {
    event.preventDefault();
    void this.closeInformation(true);
  };

  handleInformationClosed = () => {
    this.finishInformationClose();
  };

  handlePopState = (event) => {
    if (!this.isOpen || isHistoryMarker(event.state, this.historyToken)) return;

    this.historyEntryActive = false;
    if (this.isClosing) return;
    this.requestClose("history");
  };

  handleDialogKeydown = (event) => {
    if (
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      this.informationOpen
    ) {
      return;
    }

    if (this.gestureNavigationBlocked()) return;

    if (this.items.length <= 1) return;

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      this.previous();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      this.next();
    }
  };

  focusControl(control) {
    const request = ++this.focusRequest;
    let settled = false;
    const apply = () => {
      const nativeControl = control.shadowRoot?.querySelector("button:not([disabled])");
      const target = nativeControl instanceof HTMLElement ? nativeControl : control;
      target.focus({ preventScroll: true });
      settled = this.controlHasFocus(control);
    };
    const retry = () => {
      if (
        settled ||
        request !== this.focusRequest ||
        !control.isConnected ||
        this.controlHasFocus(control)
      ) {
        return;
      }
      apply();
    };

    apply();
    queueMicrotask(retry);
    requestAnimationFrame(retry);
    window.setTimeout(retry);
    window.setTimeout(retry, 40);
  }

  controlHasFocus(control) {
    return (
      document.activeElement === control ||
      Boolean(control.shadowRoot?.activeElement) ||
      control.matches(":focus-within")
    );
  }

  cycleKeyboardFocus(event, candidates) {
    const controls = candidates.filter(
      (control) =>
        control.isConnected &&
        !control.hidden &&
        !control.hasAttribute("hidden") &&
        !control.hasAttribute("disabled") &&
        !control.closest('[inert], [aria-hidden="true"]'),
    );
    if (!controls.length) return;

    const path = event.composedPath();
    const currentIndex = controls.findIndex(
      (control) => path.includes(control) || this.controlHasFocus(control),
    );
    const nextIndex = event.shiftKey
      ? currentIndex <= 0
        ? controls.length - 1
        : currentIndex - 1
      : currentIndex < 0 || currentIndex >= controls.length - 1
        ? 0
        : currentIndex + 1;

    event.preventDefault();
    event.stopImmediatePropagation();
    this.pendingTabFocus = controls[nextIndex];
    // Material Dialog and WebKit both finish their native Tab processing after
    // keydown. Applying our explicit toolbar cycle on keyup avoids a second,
    // browser-driven focus move racing the shadow-root button focus.
  }
}

async function initImagePreviewDialog() {
  const dialog = document.querySelector("[data-site-image-dialog]");
  if (!dialog) {
    pendingDialog = undefined;
    activeController?.destroy();
    activeController = undefined;
    return;
  }
  if (activeController?.dialog === dialog) return activeController;
  if (pendingDialog === dialog) return undefined;

  pendingDialog = dialog;
  await customElements.whenDefined("md-dialog");
  if (pendingDialog !== dialog || !dialog.isConnected) return;

  activeController?.destroy();
  activeController = new ImagePreviewController(dialog);
  pendingDialog = undefined;
  return activeController;
}

export function installImagePreviewDialog() {
  const ready = initImagePreviewDialog();
  if (pageLoadListenerInstalled) return ready;

  pageLoadListenerInstalled = true;
  document.addEventListener("astro:page-load", () => void initImagePreviewDialog());
  return ready;
}

export async function openImagePreviewDialog(image, options) {
  await installImagePreviewDialog();
  return activeController?.open(image, options);
}
