import { DOCUMENT } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  NgZone,
  ViewEncapsulation,
  inject,
} from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { MatProgressSpinner } from "@angular/material/progress-spinner";
import type { ImagePreviewDialogData, ImagePreviewItem } from "./image-preview-dialog.component";

type ImagePreviewDialogModule = typeof import("./image-preview-dialog.component");

const IMAGE_PREVIEW_DIALOG_ID = "site-image-preview-dialog";
const IMAGE_PREVIEW_LOADING_DIALOG_ID = "site-image-preview-loading-dialog";
const IMAGE_PREVIEW_LOAD_TIMEOUT_MS = 10_000;

function filenameFromURL(src: string, baseURI: string) {
  try {
    const url = new URL(src, baseURI);
    const sourceUrl = url.searchParams.get("href");
    if (sourceUrl && url.pathname.endsWith("/_image")) return filenameFromURL(sourceUrl, baseURI);

    return decodeURIComponent(url.pathname.split("/").filter(Boolean).at(-1) ?? "image");
  } catch {
    return "image";
  }
}

@Component({
  selector: "site-image-preview-loading-dialog",
  standalone: true,
  imports: [MatProgressSpinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <div
      class="site-image-preview-loading"
      role="status"
      aria-live="polite"
      aria-label="Chargement de l'image originale"
    >
      <mat-progress-spinner
        mode="indeterminate"
        diameter="44"
        aria-label="Chargement de l'image originale"
      />
      <span class="sr-only">Chargement de l'image originale</span>
    </div>
  `,
  styles: `
    .site-image-dialog-backdrop {
      background: color-mix(in srgb, var(--m3-scrim) 68%, transparent);
      -webkit-backdrop-filter: blur(2px);
      backdrop-filter: blur(2px);
    }

    .site-image-preview-loading-dialog-panel .mat-mdc-dialog-container,
    .site-image-preview-loading-dialog-panel .mat-mdc-dialog-surface {
      border-radius: var(--site-shape-large);
    }

    .site-image-preview-loading-dialog-panel .mat-mdc-dialog-surface {
      background: var(--m3-surface-container);
      color: var(--site-link);
      box-shadow: var(--mat-sys-level3, 0 6px 18px rgb(0 0 0 / 20%));
    }

    .site-image-preview-loading {
      display: grid;
      place-items: center;
      min-width: 6rem;
      min-height: 6rem;
      padding: 1rem;
      color: var(--site-link);
    }
  `,
})
class ImagePreviewLoadingDialogComponent {}

@Component({
  selector: "site-image-dialog-controller",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: "",
})
export class ImageDialogControllerComponent implements OnInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly dialog = inject(MatDialog);
  private readonly zone = inject(NgZone);
  private imagePreviewDialogModule?: Promise<ImagePreviewDialogModule>;

  ngOnInit() {
    if (typeof window === "undefined") return;

    this.zone.runOutsideAngular(() => {
      this.document.addEventListener("click", this.handleClick, true);
      this.document.addEventListener("keydown", this.handleKeydown, true);
    });
  }

  ngOnDestroy() {
    if (typeof window === "undefined") return;

    this.document.removeEventListener("click", this.handleClick, true);
    this.document.removeEventListener("keydown", this.handleKeydown, true);
  }

  private preload() {
    this.imagePreviewDialogModule ??= import("./image-preview-dialog.component").catch((error) => {
      this.imagePreviewDialogModule = undefined;
      throw error;
    });

    return this.imagePreviewDialogModule;
  }

  private readonly handleClick = (event: MouseEvent) => {
    const img = this.getDialogImage(event);
    if (!img) return;

    event.preventDefault();
    event.stopPropagation();
    this.zone.run(() => void this.openImage(img));
  };

  private readonly handleKeydown = (event: KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return;

    const img = this.getDialogImage(event);
    if (!img) return;

    event.preventDefault();
    event.stopPropagation();
    this.zone.run(() => void this.openImage(img));
  };

  private getDialogImage(event: Event) {
    if (!(event.target instanceof Element)) return null;

    const img = event.target.closest<HTMLImageElement>(".site-prose img");
    if (!img || !img.src) return null;
    if (img.closest("header, footer, nav, [data-no-image-dialog]")) return null;
    if (img.closest("a[href], button, input, select, textarea")) return null;

    return img;
  }

  private async openImage(img: HTMLImageElement) {
    if (
      this.dialog.openDialogs.some(
        (dialogRef) =>
          dialogRef.id === IMAGE_PREVIEW_DIALOG_ID ||
          dialogRef.id === IMAGE_PREVIEW_LOADING_DIALOG_ID,
      )
    ) {
      return;
    }

    const src = this.getImagePreviewSource(img);
    if (!src) return;

    const images = this.getImagePreviewCandidates(img);
    const items = images
      .map((candidate) => this.getImagePreviewItem(candidate))
      .filter((item): item is ImagePreviewItem => Boolean(item));
    const fallbackItem = this.getImagePreviewItem(img);
    const selectedItem = fallbackItem ?? {
      alt: img.alt,
      label: this.getImageLabel(img, src),
      src,
    };
    const initialIndex = Math.max(
      0,
      items.findIndex((item) => item.src === selectedItem.src),
    );
    const loadingRef = this.dialog.open(ImagePreviewLoadingDialogComponent, {
      id: IMAGE_PREVIEW_LOADING_DIALOG_ID,
      ariaLabel: "Chargement de l'image originale",
      autoFocus: false,
      backdropClass: "site-image-dialog-backdrop",
      disableClose: true,
      panelClass: "site-image-preview-loading-dialog-panel",
      restoreFocus: false,
    });

    const resolvedItems = items.length ? [...items] : [selectedItem];

    try {
      const [{ ImagePreviewDialogComponent }, loadedSelectedItem] = await Promise.all([
        this.preload(),
        this.preloadImagePreviewItem(selectedItem),
      ]);

      resolvedItems[initialIndex] = loadedSelectedItem;

      loadingRef.close();

      const data: ImagePreviewDialogData = {
        initialIndex,
        items: resolvedItems,
      };

      this.dialog.open(ImagePreviewDialogComponent, {
        id: IMAGE_PREVIEW_DIALOG_ID,
        ariaLabel: `Aperçu de l'image : ${loadedSelectedItem.label}`,
        autoFocus: false,
        backdropClass: "site-image-dialog-backdrop",
        data,
        maxHeight: "calc(100dvh - 2rem)",
        maxWidth: "calc(100vw - 2rem)",
        panelClass: "site-image-dialog-panel",
        restoreFocus: true,
      });
    } catch (error) {
      loadingRef.close();
      throw error;
    }
  }

  private getImagePreviewCandidates(activeImage: HTMLImageElement) {
    const container = activeImage.closest(".site-prose") ?? this.document;
    const images = [...container.querySelectorAll<HTMLImageElement>("img")].filter((img) => {
      if (!img.src) return false;
      if (img.closest("header, footer, nav, [data-no-image-dialog]")) return false;
      if (img.closest("a[href], button, input, select, textarea")) return false;
      return true;
    });

    return images.length ? images : [activeImage];
  }

  private getImagePreviewItem(img: HTMLImageElement): ImagePreviewItem | null {
    const src = this.getImagePreviewSource(img);
    if (!src) return null;

    return {
      alt: img.alt,
      height: img.naturalHeight || this.getNumericAttribute(img, "height"),
      label: this.getImageLabel(img, src),
      src,
      width: img.naturalWidth || this.getNumericAttribute(img, "width"),
    };
  }

  private getImagePreviewSource(img: HTMLImageElement) {
    return (
      img.dataset["imagePreviewSrc"]?.trim() ||
      this.getLargestSrcsetSource(img.getAttribute("srcset")) ||
      img.currentSrc ||
      img.src
    );
  }

  private getLargestSrcsetSource(srcset: string | null) {
    if (!srcset?.trim()) return null;

    let best: { score: number; src: string } | null = null;

    for (const candidate of srcset.split(",")) {
      const parts = candidate.trim().split(/\s+/);
      const src = parts[0];
      const descriptor = parts[1] ?? "";
      if (!src) continue;

      let score = 1;
      if (descriptor.endsWith("w")) {
        score = Number.parseInt(descriptor, 10);
      } else if (descriptor.endsWith("x")) {
        score = Number.parseFloat(descriptor) * 100_000;
      }

      if (!Number.isFinite(score) || score <= 0) continue;
      if (!best || score > best.score) best = { score, src };
    }

    return best?.src ?? null;
  }

  private preloadImagePreviewItem(item: ImagePreviewItem): Promise<ImagePreviewItem> {
    return new Promise((resolve) => {
      if (!item.src || typeof Image === "undefined") {
        resolve(item);
        return;
      }

      const image = new Image();
      let settled = false;
      const timeout = window.setTimeout(() => settle(item), IMAGE_PREVIEW_LOAD_TIMEOUT_MS);

      const settle = (nextItem: ImagePreviewItem) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        resolve(nextItem);
      };

      image.onload = () => {
        settle({
          ...item,
          height: image.naturalHeight || item.height,
          width: image.naturalWidth || item.width,
        });
      };
      image.onerror = () => settle(item);
      image.decoding = "async";
      image.src = item.src;

      if (image.complete && image.naturalWidth) {
        settle({
          ...item,
          height: image.naturalHeight || item.height,
          width: image.naturalWidth || item.width,
        });
      }
    });
  }

  private getImageLabel(img: HTMLImageElement, src: string) {
    return (
      img.alt.trim() ||
      img
        .getAttribute("aria-label")
        ?.replace(/^Agrandir l'image\s*:\s*/i, "")
        .trim() ||
      img.title.trim() ||
      filenameFromURL(src, this.document.baseURI)
    );
  }

  private getNumericAttribute(img: HTMLImageElement, attribute: "height" | "width") {
    const value = Number.parseInt(img.getAttribute(attribute) ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }
}
