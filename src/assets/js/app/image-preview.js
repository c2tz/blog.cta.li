import { SITE_EVENTS } from "@/lib/site-contracts";

const CHECK_ICON = "\uE5CA";
const FULLSCREEN_EXIT_ICON = "\uE5D1";
const FULLSCREEN_ICON = "\uE5D0";
const SHARE_ICON = "\uE157";
const ZOOM_IN_ICON = "\uE8FF";
const ZOOM_OUT_ICON = "\uE900";
const HISTORY_STATE_KEY = "__siteImageDialog";
const LOADING_INDICATOR_DELAY_MS = 200;
const SHARE_FEEDBACK_DURATION_MS = 2200;
const DOUBLE_TAP_DISTANCE = 34;
const DOUBLE_TAP_MS = 280;
const TAP_DISTANCE = 10;

let activeController;
let pageLoadListenerInstalled = false;

function fileNameFromURL(src, baseURI = document.baseURI) {
  try {
    const parsed = new URL(src, baseURI);
    const sourceUrl = parsed.searchParams.get("href");
    if (sourceUrl && parsed.pathname.endsWith("/_image")) {
      return fileNameFromURL(sourceUrl, baseURI);
    }

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
  document.body.appendChild(textarea);
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

class ImagePreviewController {
  constructor(dialog) {
    this.dialog = dialog;
    this.abortController = new AbortController();
    this.shell = requiredElement(dialog, "[data-image-dialog-shell]");
    this.content = requiredElement(dialog, "[data-image-dialog-content]");
    this.image = requiredElement(dialog, "[data-image-dialog-image]");
    this.toolbar = requiredElement(dialog, "[data-image-dialog-toolbar]");
    this.navigation = requiredElement(dialog, "[data-image-navigation]");
    this.status = requiredElement(dialog, "[data-image-status]");
    this.menu = requiredElement(dialog, "[data-image-dialog-menu]");
    this.menuTrigger = requiredElement(dialog, "[data-image-menu-trigger]");
    this.previousButton = requiredElement(dialog, "[data-image-previous]");
    this.nextButton = requiredElement(dialog, "[data-image-next]");
    this.closeButton = requiredElement(dialog, "[data-image-close]");
    this.fullscreenExitButton = requiredElement(dialog, "[data-image-fullscreen-exit]");
    this.downloadItem = requiredElement(dialog, "[data-image-download]");
    this.shareItem = requiredElement(dialog, "[data-image-share]");
    this.shareLabel = requiredElement(dialog, "[data-image-share-label]");
    this.shareIcon = requiredElement(this.shareItem, "md-icon");
    this.zoomItem = requiredElement(dialog, "[data-image-zoom]");
    this.zoomLabel = requiredElement(dialog, "[data-image-zoom-label]");
    this.zoomIcon = requiredElement(dialog, "[data-image-zoom-icon]");
    this.fullscreenItem = requiredElement(dialog, "[data-image-fullscreen]");
    this.fullscreenLabel = requiredElement(dialog, "[data-image-fullscreen-label]");
    this.fullscreenIcon = requiredElement(dialog, "[data-image-fullscreen-icon]");
    this.informationItem = requiredElement(dialog, "[data-image-information]");
    this.progress = requiredElement(dialog, "[data-image-operation-progress]");
    this.informationDialog = requiredElement(dialog, "[data-image-information-dialog]");
    this.informationCloseButton = requiredElement(dialog, "[data-image-information-close]");
    this.snackbar = requiredElement(dialog, "[data-image-dialog-snackbar]");
    this.infoFields = {
      created: requiredElement(dialog, "[data-image-info-created]"),
      dimensions: requiredElement(dialog, "[data-image-info-dimensions]"),
      modified: requiredElement(dialog, "[data-image-info-modified]"),
      name: requiredElement(dialog, "[data-image-info-name]"),
      size: requiredElement(dialog, "[data-image-info-size]"),
      type: requiredElement(dialog, "[data-image-info-type]"),
    };
    this.items = [];
    this.currentIndex = 0;
    this.activePointers = new Set();
    this.controlsVisible = true;
    this.zoomed = false;
    this.fullscreenFallback = false;
    this.imageOperation = null;
    this.menuState = "closed";
    this.menu.dataset.state = "closed";
    this.historyToken = null;
    this.historyEntryActive = false;
    this.isClosing = false;
    this.isOpen = false;
    this.informationRequest = 0;
    this.informationSizeTimer = undefined;
    this.bindEvents();
  }

  bindEvents() {
    const options = { signal: this.abortController.signal };

    document.addEventListener("click", this.handleDocumentClick, {
      ...options,
      capture: true,
    });
    document.addEventListener("keydown", this.handleDocumentKeydown, {
      ...options,
      capture: true,
    });
    document.addEventListener("fullscreenchange", this.handleFullscreenChange, options);
    document.addEventListener("webkitfullscreenchange", this.handleFullscreenChange, options);
    window.addEventListener("popstate", this.handlePopState, options);

    this.dialog.addEventListener("cancel", this.handleDialogCancel, options);
    this.dialog.addEventListener("closed", this.handleUnexpectedDialogClosed, options);
    this.shell.addEventListener("pointerdown", this.handlePointerDown, options);
    this.shell.addEventListener("pointermove", this.handlePointerMove, options);
    this.shell.addEventListener("pointerup", this.handlePointerUp, options);
    this.shell.addEventListener("pointercancel", this.handlePointerCancel, options);
    this.shell.addEventListener("lostpointercapture", this.handlePointerCancel, options);

    this.previousButton.addEventListener("click", () => this.previous(), options);
    this.nextButton.addEventListener("click", () => this.next(), options);
    this.closeButton.addEventListener("click", () => this.requestClose(), options);
    this.fullscreenExitButton.addEventListener(
      "click",
      () => void this.toggleFullscreen(),
      options,
    );
    this.menuTrigger.addEventListener("click", this.toggleMenu, options);
    this.menu.addEventListener("opening", this.handleMenuOpening, options);
    this.menu.addEventListener("opened", this.handleMenuOpened, options);
    this.menu.addEventListener("closing", this.handleMenuClosing, options);
    this.menu.addEventListener("closed", this.handleMenuClosed, options);
    this.downloadItem.addEventListener("click", () => void this.download(), options);
    this.shareItem.addEventListener("click", () => void this.share(), options);
    this.zoomItem.addEventListener("click", () => this.toggleZoom(), options);
    this.fullscreenItem.addEventListener("click", () => void this.toggleFullscreen(), options);
    this.informationItem.addEventListener("click", () => this.openInformation(), options);
    this.informationCloseButton.addEventListener(
      "click",
      () => void this.informationDialog.close(),
      options,
    );
    this.informationDialog.addEventListener("cancel", (event) => event.stopPropagation(), options);
    this.informationDialog.addEventListener(
      "closed",
      () => {
        this.setInformationDialogOpen(false);
        if (this.informationSizeTimer) window.clearTimeout(this.informationSizeTimer);
        this.informationSizeTimer = undefined;
        this.informationRequest += 1;
      },
      options,
    );
  }

  handleDocumentClick = (event) => {
    if (this.isOpen) return;

    const image = this.getDialogImage(event);
    if (!image) return;

    event.preventDefault();
    event.stopPropagation();
    this.open(image);
  };

  handleDocumentKeydown = (event) => {
    if (!this.isOpen) {
      if (event.key !== "Enter" && event.key !== " ") return;

      const image = this.getDialogImage(event);
      if (!image) return;

      event.preventDefault();
      event.stopPropagation();
      this.open(image);
      return;
    }

    if (
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      this.informationDialog.open
    ) {
      return;
    }

    if (
      event.target instanceof Element &&
      event.target.closest(
        "a, button, input, select, textarea, md-icon-button, md-filled-tonal-icon-button, md-menu, md-menu-item",
      )
    ) {
      return;
    }

    if (event.key === "ArrowLeft" && this.items.length > 1) {
      event.preventDefault();
      this.previous();
    } else if (event.key === "ArrowRight" && this.items.length > 1) {
      event.preventDefault();
      this.next();
    }
  };

  handleDialogCancel = (event) => {
    event.preventDefault();
    this.requestClose();
  };

  handleUnexpectedDialogClosed = () => {
    if (this.isOpen && !this.finishClosePromise) void this.finishClose(true);
  };

  handlePopState = (event) => {
    if (!this.isOpen || isHistoryMarker(event.state, this.historyToken)) return;

    this.historyEntryActive = false;
    void this.finishClose();
  };

  handleFullscreenChange = () => {
    const fullscreenElement = this.getFullscreenElement();
    const active = fullscreenElement === this.shell || this.fullscreenFallback;
    this.setFullscreenLayout(active);
  };

  toggleMenu = () => {
    this.hideTooltip();
    if (this.menuState === "closing") {
      this.reopenMenuAfterClose = true;
      return;
    }
    if (this.menu.open || this.menuState === "opening") {
      this.closeMenu();
      return;
    }

    this.openMenu();
  };

  handleMenuOpening = () => {
    this.menuState = "opening";
    this.menu.dataset.state = "opening";
  };

  handleMenuOpened = () => {
    this.menuState = "open";
    this.menu.dataset.state = "open";
  };

  handleMenuClosing = () => {
    this.menuState = "closing";
    this.menu.dataset.state = "closing";
  };

  handleMenuClosed = () => {
    this.menuState = "closed";
    this.menu.dataset.state = "closed";
    this.menuTrigger.setAttribute("aria-expanded", "false");
    if (this.reopenMenuAfterClose) {
      this.reopenMenuAfterClose = false;
      requestAnimationFrame(() => this.openMenu());
    }
  };

  handlePointerDown = (event) => {
    if (this.isInteractiveTarget(event.target)) return;
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
    this.shell.setPointerCapture?.(event.pointerId);
  };

  handlePointerMove = (event) => {
    if (this.activePointers.size > 1 && this.activePointers.has(event.pointerId)) {
      this.swipeStart = undefined;
    }
  };

  handlePointerUp = (event) => {
    const pointer = { x: event.clientX, y: event.clientY };
    const swipeStart = this.swipeStart;
    const wasMultiPointer = this.activePointers.size > 1;

    this.activePointers.delete(event.pointerId);
    this.swipeStart = undefined;
    if (this.shell.hasPointerCapture?.(event.pointerId)) {
      this.shell.releasePointerCapture(event.pointerId);
    }

    if (
      !swipeStart ||
      swipeStart.id !== event.pointerId ||
      wasMultiPointer ||
      this.isInteractiveTarget(event.target)
    ) {
      return;
    }

    const deltaX = event.clientX - swipeStart.x;
    const deltaY = event.clientY - swipeStart.y;
    const elapsed = Date.now() - swipeStart.time;
    const horizontalSwipe = Math.abs(deltaX) > 56 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25;

    if (horizontalSwipe && elapsed <= 900 && this.items.length > 1 && !this.zoomed) {
      if (deltaX < 0) this.next();
      else this.previous();
      return;
    }

    if (elapsed <= 360 && Math.abs(deltaX) <= TAP_DISTANCE && Math.abs(deltaY) <= TAP_DISTANCE) {
      this.handleTap(pointer);
    }
  };

  handlePointerCancel = (event) => {
    this.activePointers.delete(event.pointerId);
    if (this.activePointers.size === 0) this.swipeStart = undefined;
  };

  getDialogImage(event) {
    if (!(event.target instanceof Element)) return null;

    const image = event.target.closest(".site-prose img");
    if (!image?.src) return null;
    if (image.closest("header, footer, nav, [data-no-image-dialog]")) return null;
    if (image.closest("a[href], button, input, select, textarea")) return null;

    return image;
  }

  open(sourceImage) {
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
    this.shell.classList.remove("is-closing");
    this.setControlsVisible(true);
    this.setZoom(false);
    this.hideFeedback();
    this.renderCurrent();
    this.dialog.setAttribute("aria-label", `Aperçu de l’image : ${selectedItem.label}`);
    this.lockPageScroll();

    this.pushHistoryEntry();
    this.hideTooltip();
    void this.dialog
      .show()
      .then(() => {
        if (this.isOpen) this.shell.focus({ preventScroll: true });
      })
      .catch(() => void this.finishClose(true));
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
        ?.replace(/^Agrandir l'image\s*:\s*/i, "")
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

    this.setZoom(false);
    this.image.classList.remove("is-entering-next", "is-entering-previous");
    this.image.src = item.src;
    this.image.alt = item.alt || item.label;
    this.setOptionalNumericAttribute(this.image, "width", item.width);
    this.setOptionalNumericAttribute(this.image, "height", item.height);
    this.navigation.hidden = this.items.length <= 1;
    this.status.textContent =
      this.items.length > 1 ? `Image ${this.currentIndex + 1} sur ${this.items.length}` : "";

    if (motion) {
      requestAnimationFrame(() => {
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
    if (this.imageMotionTimer) window.clearTimeout(this.imageMotionTimer);
    this.renderCurrent(motion);
  }

  handleTap(pointer) {
    const now = Date.now();
    if (
      this.lastTap &&
      now - this.lastTap.time <= DOUBLE_TAP_MS &&
      distanceBetween(this.lastTap, pointer) <= DOUBLE_TAP_DISTANCE
    ) {
      this.clearTapTimer();
      this.lastTap = undefined;
      this.toggleZoom(pointer);
      this.setControlsVisible(true);
      return;
    }

    this.lastTap = { ...pointer, time: now };
    this.clearTapTimer();
    this.hideTooltip();
    this.setControlsVisible(!this.controlsVisible);
    this.tapTimer = window.setTimeout(() => {
      this.lastTap = undefined;
      this.tapTimer = undefined;
    }, DOUBLE_TAP_MS);
  }

  toggleZoom(pointer) {
    this.closeMenu();
    this.setZoom(!this.zoomed, pointer);
  }

  setZoom(zoomed, pointer) {
    this.zoomed = zoomed;
    this.shell.classList.toggle("is-zoomed", zoomed);
    this.zoomIcon.textContent = zoomed ? ZOOM_OUT_ICON : ZOOM_IN_ICON;
    this.zoomLabel.textContent = zoomed ? "Ajuster à l’écran" : "Taille réelle";
    this.content.setAttribute("aria-label", zoomed ? "Image à taille réelle" : "Image ajustée");

    if (!zoomed) {
      this.content.scrollTo({ left: 0, top: 0 });
      return;
    }

    const imageRect = this.image.getBoundingClientRect();
    const contentRect = this.content.getBoundingClientRect();
    const ratioX = pointer ? (pointer.x - imageRect.left) / Math.max(1, imageRect.width) : 0.5;
    const ratioY = pointer ? (pointer.y - imageRect.top) / Math.max(1, imageRect.height) : 0.5;

    requestAnimationFrame(() => {
      const targetX =
        ratioX * this.image.offsetWidth - (pointer?.x ?? contentRect.left) + contentRect.left;
      const targetY =
        ratioY * this.image.offsetHeight - (pointer?.y ?? contentRect.top) + contentRect.top;
      this.content.scrollTo({
        behavior: "instant",
        left: Math.max(0, targetX),
        top: Math.max(0, targetY),
      });
    });
  }

  setControlsVisible(visible) {
    this.controlsVisible = visible;
    const informationOpen = this.shell.classList.contains("has-information-dialog");
    this.shell.classList.toggle("has-visible-controls", visible);
    this.toolbar.classList.toggle("is-hidden", !visible);
    this.toolbar.setAttribute("aria-hidden", String(!visible || informationOpen));
    this.toolbar.toggleAttribute("inert", !visible || informationOpen);
    if (!visible) this.closeMenu();
  }

  setInformationDialogOpen(open) {
    this.shell.classList.toggle("has-information-dialog", open);
    this.toolbar.setAttribute("aria-hidden", String(open || !this.controlsVisible));
    this.toolbar.toggleAttribute("inert", open || !this.controlsVisible);
  }

  async toggleFullscreen() {
    this.closeMenu();
    this.hideTooltip();

    if (this.getFullscreenElement() === this.shell || this.fullscreenFallback) {
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
    const fullscreenElement = this.getFullscreenElement();
    if (fullscreenElement === this.shell) {
      try {
        if (document.exitFullscreen) await document.exitFullscreen();
        else await document.webkitExitFullscreen?.();
      } catch {}
    }

    this.fullscreenFallback = false;
    this.setFullscreenLayout(false);
  }

  getFullscreenElement() {
    return document.fullscreenElement ?? document.webkitFullscreenElement ?? null;
  }

  setFullscreenLayout(active) {
    this.dialog.classList.toggle("is-fullscreen-mode", active);
    this.shell.classList.toggle("is-fullscreen-mode", active);
    document.documentElement.classList.toggle("site-image-dialog-fullscreen-document", active);
    this.fullscreenIcon.textContent = active ? FULLSCREEN_EXIT_ICON : FULLSCREEN_ICON;
    this.fullscreenLabel.textContent = active ? "Quitter le plein écran" : "Plein écran";
    if (active) this.setControlsVisible(true);
  }

  openInformation() {
    this.closeMenu();
    this.hideTooltip();
    const item = this.items[this.currentIndex];
    if (!item || this.informationDialog.open) return;

    const width = this.image.naturalWidth || item.width;
    const height = this.image.naturalHeight || item.height;
    this.infoFields.name.textContent = item.alt?.trim() || item.label || fileNameFromURL(item.src);
    this.infoFields.type.textContent = imageTypeLabel(item.src);
    this.infoFields.size.textContent = "—";
    this.infoFields.dimensions.textContent =
      width && height ? `${width} × ${height} px` : "Indisponibles";
    this.infoFields.created.textContent = formatImageDate(item.createdAt);
    this.infoFields.modified.textContent = formatImageDate(item.lastModified);
    this.informationDialog.setAttribute("aria-label", `Informations sur l’image : ${item.label}`);
    this.setInformationDialogOpen(true);
    void this.informationDialog.show().catch(() => this.setInformationDialogOpen(false));
    const request = ++this.informationRequest;
    if (this.informationSizeTimer) window.clearTimeout(this.informationSizeTimer);
    this.informationSizeTimer = window.setTimeout(() => {
      this.informationSizeTimer = undefined;
      if (request === this.informationRequest && this.infoFields.size.textContent === "—") {
        this.infoFields.size.textContent = "Calcul…";
      }
    }, LOADING_INDICATOR_DELAY_MS);
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
    this.closeMenu();
    this.hideTooltip();
    if (!this.beginImageOperation("download")) return;

    const item = this.items[this.currentIndex];
    const filename = fileNameFromURL(item.src);
    try {
      const response = await fetch(item.src, { mode: "cors" });
      if (!response.ok) throw new Error(`image_download_${response.status}`);

      const blobUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl));
    } catch {
      const link = document.createElement("a");
      link.href = item.src;
      link.target = "_blank";
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      this.endImageOperation("download");
    }
  }

  async share() {
    this.closeMenu();
    this.hideTooltip();
    if (!this.beginImageOperation("share")) return;

    const item = this.items[this.currentIndex];
    const url = new URL(item.src, document.baseURI).href;
    try {
      if (navigator.share) {
        try {
          const file = await this.getShareFile(url).catch(() => null);
          const fileShareData = file ? { files: [file], title: document.title } : null;
          if (fileShareData && navigator.canShare?.(fileShareData)) {
            await navigator.share(fileShareData);
          } else {
            await navigator.share({ title: document.title, url });
          }

          this.setShareFeedback("Image partagée");
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
        }
      }

      try {
        if (!(await copyTextToClipboard(url))) throw new Error("copy_failed");
        this.setShareFeedback("Lien copié");
      } catch {
        this.setShareFeedback("Copie impossible");
      }
    } finally {
      this.endImageOperation("share");
    }
  }

  async getShareFile(url) {
    const response = await fetch(url, {
      cache: "force-cache",
      credentials: new URL(url).origin === location.origin ? "same-origin" : "omit",
      mode: "cors",
    });
    if (!response.ok) throw new Error(`image_share_${response.status}`);

    const blob = await response.blob();
    return new File([blob], fileNameFromURL(url), { type: blob.type || "image/jpeg" });
  }

  beginImageOperation(operation) {
    if (this.imageOperation) return false;

    this.imageOperation = operation;
    this.shell.setAttribute("aria-busy", "true");
    this.downloadItem.disabled = true;
    this.shareItem.disabled = true;
    this.progress.hidden = true;
    this.progress.setAttribute(
      "aria-label",
      operation === "download"
        ? "Téléchargement de l’image en cours"
        : "Préparation du partage en cours",
    );
    this.imageOperationIndicatorTimer = window.setTimeout(() => {
      this.imageOperationIndicatorTimer = undefined;
      if (this.imageOperation === operation) this.progress.hidden = false;
    }, LOADING_INDICATOR_DELAY_MS);
    return true;
  }

  endImageOperation(operation) {
    if (this.imageOperation !== operation) return;
    this.clearImageOperation();
  }

  clearImageOperation() {
    if (this.imageOperationIndicatorTimer !== undefined) {
      window.clearTimeout(this.imageOperationIndicatorTimer);
      this.imageOperationIndicatorTimer = undefined;
    }
    this.progress.hidden = true;
    this.shell.removeAttribute("aria-busy");
    this.downloadItem.disabled = false;
    this.shareItem.disabled = false;
    this.imageOperation = null;
  }

  setShareFeedback(message) {
    const copied = message === "Lien copié";
    this.shareLabel.textContent = message;
    this.shareIcon.textContent = copied ? CHECK_ICON : SHARE_ICON;
    this.snackbar.textContent = message;
    this.snackbar.hidden = false;
    if (this.shareLabelTimer) window.clearTimeout(this.shareLabelTimer);
    this.shareLabelTimer = window.setTimeout(() => {
      this.shareLabel.textContent = "Partager";
      this.shareIcon.textContent = SHARE_ICON;
      this.hideFeedback();
      this.shareLabelTimer = undefined;
    }, SHARE_FEEDBACK_DURATION_MS);
  }

  hideFeedback() {
    this.snackbar.hidden = true;
    this.snackbar.textContent = "";
  }

  beginCloseAnimation() {
    if (this.isClosing) return;
    this.isClosing = true;
    this.shell.classList.add("is-closing");
    this.setControlsVisible(false);
  }

  requestClose() {
    if (!this.isOpen || this.isClosing) return;

    this.beginCloseAnimation();
    this.hideTooltip();
    void this.exitFullscreen().finally(() => {
      if (this.historyEntryActive && isHistoryMarker(history.state, this.historyToken)) {
        history.back();
        this.historyCloseFallbackTimer = window.setTimeout(() => {
          this.historyEntryActive = false;
          void this.finishClose();
        }, 350);
      } else {
        void this.finishClose();
      }
    });
  }

  finishClose(alreadyClosed = false) {
    if (!this.isOpen) return Promise.resolve();
    if (this.finishClosePromise) return this.finishClosePromise;

    this.finishClosePromise = this.performFinishClose(alreadyClosed).finally(() => {
      this.finishClosePromise = undefined;
    });
    return this.finishClosePromise;
  }

  async performFinishClose(alreadyClosed) {
    if (!alreadyClosed) await this.dialog.close();

    if (this.historyCloseFallbackTimer) {
      window.clearTimeout(this.historyCloseFallbackTimer);
      this.historyCloseFallbackTimer = undefined;
    }
    this.historyEntryActive = false;
    this.historyToken = null;
    this.clearImageOperation();
    this.clearTapTimer();
    if (this.imageMotionTimer) window.clearTimeout(this.imageMotionTimer);
    if (this.shareLabelTimer) window.clearTimeout(this.shareLabelTimer);
    if (this.informationSizeTimer) window.clearTimeout(this.informationSizeTimer);
    this.informationSizeTimer = undefined;
    this.informationRequest += 1;
    await this.informationDialog.close();
    if (this.menu.open) this.menu.open = false;
    this.isOpen = false;
    this.isClosing = false;
    this.fullscreenFallback = false;
    this.setFullscreenLayout(false);
    this.unlockPageScroll();
    this.triggerImage?.focus({ preventScroll: true });
    this.restoreLockedScrollPosition();
    this.triggerImage = undefined;
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
    const body = document.body;
    this.lockedScroll = {
      href: location.href,
      x: window.scrollX,
      y: window.scrollY,
      styles: {
        left: body.style.left,
        overflow: body.style.overflow,
        position: body.style.position,
        top: body.style.top,
        width: body.style.width,
      },
    };
    body.style.position = "fixed";
    body.style.top = `${-this.lockedScroll.y}px`;
    body.style.left = `${-this.lockedScroll.x}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    document.documentElement.classList.add("site-image-dialog-open");
  }

  unlockPageScroll() {
    if (!this.lockedScroll) return;

    const body = document.body;
    body.style.position = this.lockedScroll.styles.position;
    body.style.top = this.lockedScroll.styles.top;
    body.style.left = this.lockedScroll.styles.left;
    body.style.width = this.lockedScroll.styles.width;
    body.style.overflow = this.lockedScroll.styles.overflow;
    document.documentElement.classList.remove("site-image-dialog-open");
  }

  restoreLockedScrollPosition() {
    const lockedScroll = this.lockedScroll;
    this.lockedScroll = undefined;
    if (!lockedScroll || location.href !== lockedScroll.href) return;

    window.scrollTo({ behavior: "instant", left: lockedScroll.x, top: lockedScroll.y });
  }

  closeMenu() {
    this.reopenMenuAfterClose = false;
    if (this.menu.open || this.menuState === "opening") {
      this.menuState = "closing";
      this.menu.dataset.state = "closing";
      this.menu.open = false;
    }
    this.menuTrigger.setAttribute("aria-expanded", "false");
  }

  openMenu() {
    this.menuState = "opening";
    this.menu.dataset.state = "opening";
    this.menu.open = true;
    this.menuTrigger.setAttribute("aria-expanded", "true");
  }

  clearTapTimer() {
    if (!this.tapTimer) return;
    window.clearTimeout(this.tapTimer);
    this.tapTimer = undefined;
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

  isInteractiveTarget(target) {
    return (
      target instanceof Element &&
      Boolean(
        target.closest(
          "a[href], button, input, select, textarea, dialog, [data-image-information-dialog], md-icon-button, md-filled-tonal-icon-button, md-menu-item, [role='button']",
        ),
      )
    );
  }

  destroy() {
    this.abortController.abort();
    if (this.informationSizeTimer) window.clearTimeout(this.informationSizeTimer);
    this.informationSizeTimer = undefined;
    if (this.isOpen) {
      this.dialog.quick = true;
      this.informationDialog.quick = true;
      void this.dialog.close();
      void this.informationDialog.close();
      this.isOpen = false;
      this.unlockPageScroll();
      this.restoreLockedScrollPosition();
    }
    void this.exitFullscreen();
  }
}

function initImagePreviewDialog() {
  const dialog = document.querySelector("[data-site-image-dialog]");
  if (!dialog) {
    activeController?.destroy();
    activeController = undefined;
    return;
  }
  if (activeController?.dialog === dialog) return;

  activeController?.destroy();
  activeController = new ImagePreviewController(dialog);
}

export function installImagePreviewDialog() {
  initImagePreviewDialog();
  if (pageLoadListenerInstalled) return;

  pageLoadListenerInstalled = true;
  document.addEventListener("astro:page-load", initImagePreviewDialog);
}
