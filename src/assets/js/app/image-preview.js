import { SITE_EVENTS } from "@/lib/site-contracts";

const DOUBLE_TAP_DISTANCE = 34;
const DOUBLE_TAP_MS = 280;
const CHECK_ICON = "\uE5CA";
const FULLSCREEN_EXIT_ICON = "\uE5D1";
const FULLSCREEN_ICON = "\uE5D0";
const HISTORY_STATE_KEY = "__siteImageDialog";
const INFORMATION_LOADING_DELAY_MS = 200;
const SHARE_FEEDBACK_DURATION_MS = 2200;
const SHARE_ICON = "\uE80D";
const SWIPE_DISTANCE = 56;
const SWIPE_DURATION_MS = 900;
const TAP_DISTANCE = 10;
const TAP_DURATION_MS = 360;

let activeController;
let pendingDialog;
let pageLoadListenerInstalled = false;

const IMAGE_DIALOG_OPEN_ANIMATION = {
  dialog: [[[{ opacity: 0 }, { opacity: 1 }], { duration: 150, easing: "linear", fill: "both" }]],
  scrim: [[[{ opacity: 0 }, { opacity: 0.68 }], { duration: 240, easing: "linear", fill: "both" }]],
  content: [
    [
      [
        { opacity: 0, transform: "scale(0.985)" },
        { opacity: 1, transform: "scale(1)" },
      ],
      { duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)", fill: "both" },
    ],
  ],
};

const IMAGE_DIALOG_CLOSE_ANIMATION = {
  dialog: [[[{ opacity: 1 }, { opacity: 0 }], { duration: 75, easing: "linear", fill: "both" }]],
  scrim: [[[{ opacity: 0.68 }, { opacity: 0 }], { duration: 120, easing: "linear", fill: "both" }]],
  content: [[[{ opacity: 1 }, { opacity: 0 }], { duration: 75, easing: "linear", fill: "both" }]],
};

const INFORMATION_DIALOG_OPEN_ANIMATION = {
  dialog: [
    [
      [
        { opacity: 0, transform: "translateY(0.5rem) scale(0.98)" },
        { opacity: 1, transform: "translateY(0) scale(1)" },
      ],
      { duration: 240, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "both" },
    ],
  ],
  scrim: [[[{ opacity: 0 }, { opacity: 0.32 }], { duration: 180, easing: "linear", fill: "both" }]],
};

const INFORMATION_DIALOG_CLOSE_ANIMATION = {
  dialog: [
    [
      [
        { opacity: 1, transform: "translateY(0) scale(1)" },
        { opacity: 0, transform: "translateY(0.25rem) scale(0.99)" },
      ],
      { duration: 120, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "both" },
    ],
  ],
  scrim: [[[{ opacity: 0.32 }, { opacity: 0 }], { duration: 120, easing: "linear", fill: "both" }]],
};

function fileNameFromURL(src, baseURI = document.baseURI) {
  try {
    const parsed = new URL(src, baseURI);
    const sourceUrl = parsed.searchParams.get("href");
    if (sourceUrl && parsed.pathname.endsWith("/_image"))
      return fileNameFromURL(sourceUrl, baseURI);

    return decodeURIComponent(parsed.pathname.split("/").filter(Boolean).at(-1) ?? "image");
  } catch {
    return "image";
  }
}

function requiredElement(root, selector) {
  const element = root.querySelector(selector);
  if (!element) throw new Error(`Élément du lecteur d’images introuvable : ${selector}`);
  return element;
}

function distanceBetween(first, second) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function formatByteSize(bytes) {
  const exact = new Intl.NumberFormat("fr-FR").format(bytes);
  if (bytes < 1024) return `${exact} octet${bytes > 1 ? "s" : ""}`;

  const units = ["ko", "Mo", "Go"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)) - 1, units.length - 1);
  const value = bytes / 1024 ** (unitIndex + 1);
  const compact = new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: value >= 100 ? 0 : value >= 10 ? 1 : 2,
  }).format(value);

  return `${compact} ${units[unitIndex]} (${exact} octets)`;
}

function formatImageDate(value) {
  if (!value) return "Indisponible";

  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Indisponible";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

function imageTypeLabel(src, contentType) {
  const mimeSubtype = contentType?.match(/^image\/([^;]+)/i)?.[1];
  let format = mimeSubtype;

  try {
    const parsed = new URL(src, document.baseURI);
    format ||= parsed.searchParams.get("f") || undefined;
    format ||= fileNameFromURL(src).split(".").pop();
  } catch {}

  const labels = new Map([
    ["avif", "AVIF"],
    ["gif", "GIF"],
    ["jpeg", "JPEG"],
    ["jpg", "JPEG"],
    ["png", "PNG"],
    ["svg+xml", "SVG"],
    ["webp", "WebP"],
  ]);
  const normalized = format?.toLowerCase();

  return normalized ? `Image ${labels.get(normalized) ?? normalized.toUpperCase()}` : "Image";
}

function loadedResourceSize(src) {
  if (typeof performance === "undefined") return 0;

  const entry = performance.getEntriesByName(src, "resource").at(-1);
  return entry?.encodedBodySize || entry?.transferSize || 0;
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.inset = "0 auto auto 0";
  textarea.style.width = "1px";
  textarea.style.height = "1px";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  textarea.setSelectionRange(0, text.length);

  try {
    return document.execCommand("copy");
  } finally {
    textarea.remove();
    window.getSelection()?.removeAllRanges();
  }
}

function isHistoryMarker(state, token) {
  return Boolean(state && typeof state === "object" && state[HISTORY_STATE_KEY] === token);
}

function historyStateWithMarker(token) {
  const current = history.state;
  return {
    ...(current && typeof current === "object" ? current : {}),
    [HISTORY_STATE_KEY]: token,
  };
}

function restoreInlineStyle(style, property, value) {
  if (value) style.setProperty(property, value);
  else style.removeProperty(property);
}

class ImagePreviewController {
  constructor(dialog) {
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
    this.activePointers = new Set();
    this.controlsVisible = true;
    this.informationOpen = false;
    this.historyToken = null;
    this.historyEntryActive = false;
    this.isClosing = false;
    this.isOpen = false;
    this.informationRequest = 0;
    this.fullscreenFallback = false;
    this.motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");

    this.dialog.getOpenAnimation = () => IMAGE_DIALOG_OPEN_ANIMATION;
    this.dialog.getCloseAnimation = () => IMAGE_DIALOG_CLOSE_ANIMATION;
    this.informationDialog.getOpenAnimation = () => INFORMATION_DIALOG_OPEN_ANIMATION;
    this.informationDialog.getCloseAnimation = () => INFORMATION_DIALOG_CLOSE_ANIMATION;
    this.syncMotionPreference();
    this.renderFullscreenState();
    this.bindEvents();
  }

  bindEvents() {
    const options = { signal: this.abortController.signal };

    document.addEventListener("click", this.handleDocumentClick, { ...options, capture: true });
    document.addEventListener("keydown", this.handleDocumentKeydown, { ...options, capture: true });
    document.addEventListener("gesturestart", this.handleNativeGestureStart, {
      ...options,
      passive: true,
    });
    document.addEventListener("fullscreenchange", this.handleFullscreenChange, options);
    document.addEventListener("webkitfullscreenchange", this.handleFullscreenChange, options);
    window.addEventListener("popstate", this.handlePopState, options);
    this.motionPreference.addEventListener("change", this.syncMotionPreference, options);

    this.dialog.addEventListener("cancel", this.handleDialogCancel, options);
    this.dialog.addEventListener("closed", this.handleDialogClosed, options);
    this.dialog.addEventListener("keydown", this.handleDialogKeydown, options);
    this.stage.addEventListener("pointerdown", this.handlePointerDown, options);
    this.stage.addEventListener("pointermove", this.handlePointerMove, options);
    this.stage.addEventListener("pointerup", this.handlePointerUp, options);
    this.stage.addEventListener("pointercancel", this.handlePointerCancel, options);
    this.stage.addEventListener("lostpointercapture", this.handlePointerCancel, options);
    this.image.addEventListener("load", this.handleImageLoad, options);

    this.informationDialog.addEventListener("cancel", this.handleInformationCancel, options);
    this.informationDialog.addEventListener("closed", this.handleInformationClosed, options);
    this.informationButton.addEventListener("click", () => void this.openInformation(), options);
    this.closeButton.addEventListener("click", () => this.requestClose("close-button"), options);
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
    const reduce = this.motionPreference.matches;
    this.dialog.quick = reduce;
    this.informationDialog.quick = reduce;
  };

  handleDocumentClick = (event) => {
    if (this.isOpen) return;

    const image = this.getDialogImage(event);
    if (!image) return;

    event.preventDefault();
    event.stopPropagation();
    void this.open(image);
  };

  handleDocumentKeydown = (event) => {
    if (this.isOpen || (event.key !== "Enter" && event.key !== " ")) return;

    const image = this.getDialogImage(event);
    if (!image) return;

    event.preventDefault();
    event.stopPropagation();
    void this.open(image);
  };

  handleDialogCancel = (event) => {
    event.preventDefault();
    if (this.informationOpen) {
      void this.closeInformation(true);
      return;
    }

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
    void this.closeDialog("history");
  };

  handleDialogKeydown = (event) => {
    if (
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      this.informationOpen ||
      this.items.length <= 1
    ) {
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      this.previous();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      this.next();
    }
  };

  handlePointerDown = (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    this.hideTooltip();
    this.activePointers.add(event.pointerId);
    if (this.activePointers.size > 1) {
      this.swipeStart = undefined;
      return;
    }

    this.swipeStart = {
      id: event.pointerId,
      time: Date.now(),
      x: event.clientX,
      y: event.clientY,
    };
  };

  handlePointerMove = (event) => {
    if (this.activePointers.size > 1 && this.activePointers.has(event.pointerId)) {
      this.swipeStart = undefined;
    }
  };

  handlePointerUp = (event) => {
    const swipeStart = this.swipeStart;
    const wasMultiPointer = this.activePointers.size > 1;
    const pointer = { x: event.clientX, y: event.clientY };

    this.activePointers.delete(event.pointerId);
    this.swipeStart = undefined;
    if (!swipeStart || swipeStart.id !== event.pointerId || wasMultiPointer) return;

    const deltaX = event.clientX - swipeStart.x;
    const deltaY = event.clientY - swipeStart.y;
    const elapsed = Date.now() - swipeStart.time;
    const horizontalSwipe =
      Math.abs(deltaX) > SWIPE_DISTANCE && Math.abs(deltaX) > Math.abs(deltaY) * 1.25;

    if (horizontalSwipe && elapsed <= SWIPE_DURATION_MS && this.items.length > 1) {
      if (deltaX < 0) this.next();
      else this.previous();
      return;
    }

    if (
      elapsed <= TAP_DURATION_MS &&
      Math.abs(deltaX) <= TAP_DISTANCE &&
      Math.abs(deltaY) <= TAP_DISTANCE
    ) {
      this.handleTap(pointer);
    }
  };

  handlePointerCancel = (event) => {
    this.activePointers.delete(event.pointerId);
    if (this.activePointers.size === 0) this.swipeStart = undefined;
  };

  handleNativeGestureStart = () => {
    if (!this.isOpen) return;

    this.activePointers.clear();
    this.swipeStart = undefined;
    this.clearTapTimer();
    this.lastTap = undefined;
  };

  handleImageLoad = () => {
    if (this.informationOpen) this.updateInformation();
  };

  handleFullscreenChange = () => {
    const active = Boolean(this.getFullscreenElement()) || this.fullscreenFallback;
    this.setFullscreenLayout(active);
  };

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
    this.triggerImage = sourceImage;
    this.isOpen = true;
    this.isClosing = false;
    this.finishInformationClose(false);
    this.setControlsVisible(true);
    this.renderCurrent();
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

  renderCurrent(motion) {
    const item = this.items[this.currentIndex];
    if (!item) return;

    this.cancelImageMotion();
    this.image.src = item.src;
    this.image.alt = item.alt || item.label;
    this.dialog.setAttribute("aria-label", `Aperçu de l’image : ${item.label}`);
    this.setOptionalNumericAttribute(this.image, "width", item.width);
    this.setOptionalNumericAttribute(this.image, "height", item.height);
    this.status.textContent = `Image ${this.currentIndex + 1} sur ${this.items.length} : ${item.label}`;
    if (this.informationOpen) this.updateInformation();

    if (motion) {
      this.imageMotionFrame = requestAnimationFrame(() => {
        this.imageMotionFrame = undefined;
        this.image.classList.add(`is-entering-${motion}`);
        this.imageMotionTimer = window.setTimeout(() => {
          this.image.classList.remove(`is-entering-${motion}`);
          this.imageMotionTimer = undefined;
        }, 210);
      });
    }

    this.preloadAdjacentImages();
  }

  setOptionalNumericAttribute(element, name, value) {
    if (value) element.setAttribute(name, String(value));
    else element.removeAttribute(name);
  }

  previous() {
    this.goTo(this.currentIndex - 1, "previous");
  }

  next() {
    this.goTo(this.currentIndex + 1, "next");
  }

  goTo(index, motion) {
    if (this.items.length < 1) return;

    this.hideTooltip();
    this.setControlsVisible(true);
    this.currentIndex = ((index % this.items.length) + this.items.length) % this.items.length;
    this.renderCurrent(motion);
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

  async openInformation() {
    if (!this.isOpen || this.informationOpen || this.informationDialog.open) return;

    if (this.getFullscreenElement() || this.fullscreenFallback) await this.exitFullscreen();
    this.informationOpen = true;
    this.informationButton.setAttribute("aria-expanded", "true");
    this.updateInformation();
    try {
      await this.informationDialog.show();
    } catch {
      this.finishInformationClose(false);
    }
  }

  async closeInformation(restoreFocus = true, immediate = false) {
    if (!this.informationOpen && !this.informationDialog.open) return;

    this.restoreInformationFocus = restoreFocus;
    this.informationRequest += 1;
    if (this.informationSizeTimer) window.clearTimeout(this.informationSizeTimer);
    this.informationSizeTimer = undefined;

    if (!this.informationDialog.open) {
      this.finishInformationClose(restoreFocus);
      return;
    }

    const previousQuick = this.informationDialog.quick;
    if (immediate) this.informationDialog.quick = true;
    try {
      await this.informationDialog.close("close");
    } finally {
      if (immediate) this.informationDialog.quick = previousQuick;
    }
  }

  finishInformationClose(restoreFocus = this.restoreInformationFocus) {
    this.informationOpen = false;
    this.restoreInformationFocus = false;
    this.informationButton.setAttribute("aria-expanded", "false");
    this.resetShareFeedback();
    if (restoreFocus && this.isOpen && this.dialog.open) {
      requestAnimationFrame(() => this.informationButton.focus({ preventScroll: true }));
    }
  }

  updateInformation() {
    const item = this.items[this.currentIndex];
    if (!item || !this.informationOpen) return;

    const width = this.image.naturalWidth || item.width;
    const height = this.image.naturalHeight || item.height;
    this.infoFields.name.textContent = item.alt?.trim() || item.label || fileNameFromURL(item.src);
    this.infoFields.type.textContent = imageTypeLabel(item.src);
    this.infoFields.size.textContent = "—";
    this.infoFields.dimensions.textContent =
      width && height ? `${width} × ${height} px` : "Indisponibles";
    this.infoFields.created.textContent = formatImageDate(item.createdAt);
    this.infoFields.modified.textContent = formatImageDate(item.lastModified);

    const request = ++this.informationRequest;
    if (this.informationSizeTimer) window.clearTimeout(this.informationSizeTimer);
    this.informationSizeTimer = window.setTimeout(() => {
      this.informationSizeTimer = undefined;
      if (request === this.informationRequest && this.infoFields.size.textContent === "—") {
        this.infoFields.size.textContent = "Calcul…";
      }
    }, INFORMATION_LOADING_DELAY_MS);
    void this.resolveFileInformation(item, request);
  }

  async resolveFileInformation(item, request) {
    const resourceUrl = new URL(item.src, document.baseURI).href;
    let bytes = loadedResourceSize(resourceUrl);

    if (!bytes) {
      try {
        const response = await fetch(resourceUrl, {
          cache: "force-cache",
          credentials: new URL(resourceUrl).origin === location.origin ? "same-origin" : "omit",
          method: "HEAD",
          mode: "cors",
        });
        if (response.ok) {
          const contentLength = Number.parseInt(response.headers.get("content-length") ?? "", 10);
          if (Number.isFinite(contentLength) && contentLength > 0) bytes = contentLength;
          if (request === this.informationRequest) {
            this.infoFields.type.textContent = imageTypeLabel(
              resourceUrl,
              response.headers.get("content-type"),
            );
          }
        }
      } catch {}
    }

    if (request === this.informationRequest) {
      if (this.informationSizeTimer) window.clearTimeout(this.informationSizeTimer);
      this.informationSizeTimer = undefined;
      this.infoFields.size.textContent = bytes ? formatByteSize(bytes) : "Indisponible";
    }
  }

  async download() {
    this.hideTooltip();
    const item = this.items[this.currentIndex];
    if (!item) return;

    const filename = fileNameFromURL(item.src);
    try {
      const response = await fetch(item.src, { mode: "cors" });
      if (!response.ok) throw new Error(`image_download_${response.status}`);

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(item.src, "_blank", "noopener");
    }
  }

  async share() {
    this.hideTooltip();
    const item = this.items[this.currentIndex];
    if (!item) return;

    const url = new URL(item.src, document.baseURI).href;
    if (navigator.share) {
      try {
        await navigator.share({ title: item.label || document.title, url });
        this.setShareFeedback("Image partagée", true);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      const copied = await copyTextToClipboard(url);
      if (!copied) throw new Error("copy_failed");
      this.setShareFeedback("Lien copié", true);
    } catch {
      this.setShareFeedback("Copie impossible", false);
    }
  }

  setShareFeedback(message, success) {
    if (this.shareFeedbackTimer) window.clearTimeout(this.shareFeedbackTimer);
    this.shareIcon.textContent = success ? CHECK_ICON : SHARE_ICON;
    this.shareLabel.textContent = message;
    this.shareButton.setAttribute("aria-label", message);
    this.actionStatus.textContent = message;
    this.shareFeedbackTimer = window.setTimeout(
      () => this.resetShareFeedback(),
      SHARE_FEEDBACK_DURATION_MS,
    );
  }

  resetShareFeedback() {
    if (this.shareFeedbackTimer) window.clearTimeout(this.shareFeedbackTimer);
    this.shareFeedbackTimer = undefined;
    this.shareIcon.textContent = SHARE_ICON;
    this.shareLabel.textContent = "Partager";
    this.shareButton.setAttribute("aria-label", "Partager");
    this.actionStatus.textContent = "";
  }

  async handleFullscreenAction() {
    // Keep the fullscreen request in the originating user-activation task.
    await this.closeInformation(false, true);
    await this.toggleFullscreen();
  }

  async toggleFullscreen() {
    this.hideTooltip();
    if (this.getFullscreenElement() || this.fullscreenFallback) {
      await this.exitFullscreen();
      return;
    }

    this.setFullscreenLayout(true);
    try {
      if (this.shell.requestFullscreen) {
        await this.shell.requestFullscreen();
      } else if (this.shell.webkitRequestFullscreen) {
        await this.shell.webkitRequestFullscreen();
      } else {
        throw new Error("fullscreen_unavailable");
      }
    } catch {
      this.fullscreenFallback = true;
      this.setFullscreenLayout(true);
    }
  }

  async exitFullscreen() {
    if (!this.getFullscreenElement()) {
      this.fullscreenFallback = false;
      this.setFullscreenLayout(false);
      return;
    }

    try {
      if (document.exitFullscreen) await document.exitFullscreen();
      else await document.webkitExitFullscreen?.();
    } catch {}

    this.fullscreenFallback = false;
    this.setFullscreenLayout(false);
  }

  getFullscreenElement() {
    return document.fullscreenElement ?? document.webkitFullscreenElement ?? null;
  }

  isFullscreenSupported() {
    return Boolean(
      (document.fullscreenEnabled && this.shell.requestFullscreen) ||
      (document.webkitFullscreenEnabled && this.shell.webkitRequestFullscreen),
    );
  }

  setFullscreenLayout(active) {
    this.shell.classList.toggle("is-fullscreen-mode", active);
    document.documentElement.classList.toggle("site-image-dialog-fullscreen", active);
    if (active) this.setControlsVisible(true);
    this.renderFullscreenState(active);
  }

  renderFullscreenState(active = Boolean(this.getFullscreenElement()) || this.fullscreenFallback) {
    this.fullscreenButton.hidden = !this.isFullscreenSupported();
    this.fullscreenLabel.textContent = active ? "Quitter le plein écran" : "Plein écran";
    this.fullscreenIcon.textContent = active ? FULLSCREEN_EXIT_ICON : FULLSCREEN_ICON;
  }

  requestClose(reason) {
    if (!this.isOpen || this.isClosing) return;

    this.isClosing = true;
    this.setControlsVisible(false, true);
    this.hideTooltip();
    if (this.historyEntryActive && isHistoryMarker(history.state, this.historyToken)) {
      history.back();
      this.historyCloseFallbackTimer = window.setTimeout(() => {
        this.historyEntryActive = false;
        void this.closeDialog(reason);
      }, 500);
      return;
    }

    void this.closeDialog(reason);
  }

  async closeDialog(reason) {
    if (!this.isOpen) return;
    if (this.informationOpen || this.informationDialog.open) {
      await this.closeInformation(false, true);
    }
    await this.exitFullscreen();
    if (!this.dialog.open) {
      this.finishClose();
      return;
    }

    await this.dialog.close(reason);
  }

  finishClose() {
    if (!this.isOpen && !this.lockedScroll) return;

    if (this.historyCloseFallbackTimer) {
      window.clearTimeout(this.historyCloseFallbackTimer);
      this.historyCloseFallbackTimer = undefined;
    }
    this.historyEntryActive = false;
    this.historyToken = null;
    this.cancelImageMotion();
    this.clearTapTimer();
    this.lastTap = undefined;
    this.activePointers.clear();
    this.swipeStart = undefined;
    this.status.textContent = "";
    this.isOpen = false;
    this.isClosing = false;
    this.fullscreenFallback = false;
    this.setFullscreenLayout(false);
    this.finishInformationClose(false);
    this.setControlsVisible(true);
    this.unlockPageScroll();
    this.triggerImage?.focus({ preventScroll: true });
    this.restoreLockedScrollPosition();
    this.triggerImage = undefined;
  }

  cancelImageMotion() {
    if (this.imageMotionFrame) cancelAnimationFrame(this.imageMotionFrame);
    if (this.imageMotionTimer) window.clearTimeout(this.imageMotionTimer);
    this.imageMotionFrame = undefined;
    this.imageMotionTimer = undefined;
    this.image.classList.remove("is-entering-next", "is-entering-previous");
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

  hideTooltip() {
    document.dispatchEvent(new CustomEvent(SITE_EVENTS.tooltipHide));
  }

  destroy() {
    this.abortController.abort();
    this.cancelImageMotion();
    this.clearTapTimer();
    if (this.informationSizeTimer) window.clearTimeout(this.informationSizeTimer);
    this.informationSizeTimer = undefined;
    this.resetShareFeedback();
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
}

async function initImagePreviewDialog() {
  const dialog = document.querySelector("[data-site-image-dialog]");
  if (!dialog) {
    pendingDialog = undefined;
    activeController?.destroy();
    activeController = undefined;
    return;
  }
  if (activeController?.dialog === dialog || pendingDialog === dialog) return;

  pendingDialog = dialog;
  await customElements.whenDefined("md-dialog");
  if (pendingDialog !== dialog || !dialog.isConnected) return;

  activeController?.destroy();
  activeController = new ImagePreviewController(dialog);
  pendingDialog = undefined;
}

export function installImagePreviewDialog() {
  void initImagePreviewDialog();
  if (pageLoadListenerInstalled) return;

  pageLoadListenerInstalled = true;
  document.addEventListener("astro:page-load", () => void initImagePreviewDialog());
}
