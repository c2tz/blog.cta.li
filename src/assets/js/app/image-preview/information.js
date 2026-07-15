import { copyTextToClipboard } from "../clipboard.js";
import {
  CHECK_ICON,
  FULLSCREEN_EXIT_ICON,
  FULLSCREEN_ICON,
  INFORMATION_LOADING_DELAY_MS,
  SHARE_FEEDBACK_DURATION_MS,
  SHARE_ICON,
  fileNameFromURL,
  formatByteSize,
  formatImageDate,
  imageTypeLabel,
  loadedResourceSize,
} from "./support.js";

function isAbortError(error) {
  return Boolean(error && typeof error === "object" && error.name === "AbortError");
}

async function getShareFile(url) {
  const parsed = new URL(url, document.baseURI);
  const response = await fetch(parsed.href, {
    cache: "force-cache",
    credentials: parsed.origin === location.origin ? "same-origin" : "omit",
    mode: "cors",
  });
  if (!response.ok) throw new Error(`image_share_${response.status}`);

  const blob = await response.blob();
  return new File([blob], fileNameFromURL(parsed.href), {
    type: blob.type || "image/jpeg",
  });
}

export const withImagePreviewInformation = (Base) =>
  class extends Base {
    async openInformation() {
      if (!this.isOpen || this.informationOpen || this.informationDialog.open) return;

      if (this.getFullscreenElement() || this.fullscreenFallback) await this.exitFullscreen();
      this.informationOpen = true;
      this.informationButton.setAttribute("aria-expanded", "true");
      this.updateInformation();
      try {
        const focusRequestBeforeShow = this.focusRequest;
        await this.informationDialog.show();
        if (this.informationOpen && this.informationDialog.open) {
          if (this.focusRequest === focusRequestBeforeShow) {
            this.focusControl(this.informationCloseButton);
          }
        }
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
        requestAnimationFrame(() => {
          this.focusControl(this.informationButton);
          this.hideTooltip();
        });
      }
    }

    updateInformation() {
      const item = this.items[this.currentIndex];
      if (!item || !this.informationOpen) return;

      void this.prepareShareFile(item);

      const width = this.image.naturalWidth || item.width;
      const height = this.image.naturalHeight || item.height;
      this.infoFields.name.textContent =
        item.alt?.trim() || item.label || fileNameFromURL(item.src);
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

    prepareShareFile(item) {
      if (!item) return Promise.resolve();

      const url = new URL(item.src, document.baseURI).href;
      if (this.shareFileUrl === url && this.shareFilePromise) return this.shareFilePromise;

      this.shareFileUrl = url;
      this.shareFile = undefined;
      this.shareButton.removeAttribute("data-share-file-ready");
      const pending = getShareFile(url)
        .then((file) => {
          if (this.shareFileUrl !== url || this.shareFilePromise !== pending) return;
          this.shareFile = file;
          this.shareButton.setAttribute("data-share-file-ready", "true");
        })
        .catch(() => undefined);
      this.shareFilePromise = pending;
      return pending;
    }

    async resolveFileInformation(item, request) {
      const resourceUrl = new URL(item.src, document.baseURI).href;
      let bytes = loadedResourceSize(resourceUrl);

      if (!bytes && this.shareFileUrl === resourceUrl && this.shareFilePromise) {
        await this.shareFilePromise;
        if (request !== this.informationRequest) return;
        if (this.shareFileUrl === resourceUrl && this.shareFile) {
          bytes = this.shareFile.size;
          this.infoFields.type.textContent = imageTypeLabel(resourceUrl, this.shareFile.type);
        }
      }

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
      const title = item.label || document.title;
      if (navigator.share) {
        let nativeShareData = { title, url };
        const file = this.shareFileUrl === url ? this.shareFile : undefined;
        if (file) {
          const fileShareData = { files: [file], title };
          try {
            if (navigator.canShare?.({ files: fileShareData.files })) {
              nativeShareData = fileShareData;
            }
          } catch {}
        }

        try {
          // Web Share consumes transient activation on the first invocation.
          // Select the best payload up front instead of attempting an
          // unreliable second native share after a rejection.
          await navigator.share(nativeShareData);
          this.setShareFeedback("Image partagée", true);
          return;
        } catch (error) {
          if (isAbortError(error)) return;
        }
      }

      return this.copyShareUrl(url);
    }

    async copyShareUrl(url) {
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
      // requestFullscreen() must run before the first await so Safari keeps the
      // transient activation created by the Material button click.
      const fullscreen = this.toggleFullscreen();
      const closeInformation = this.closeInformation(false, true);
      await Promise.all([fullscreen, closeInformation]);
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

    renderFullscreenState(
      active = Boolean(this.getFullscreenElement()) || this.fullscreenFallback,
    ) {
      this.fullscreenButton.hidden = !this.isFullscreenSupported();
      this.fullscreenLabel.textContent = active ? "Quitter le plein écran" : "Plein écran";
      this.fullscreenIcon.textContent = active ? FULLSCREEN_EXIT_ICON : FULLSCREEN_ICON;
    }
  };
