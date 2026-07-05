import { DOCUMENT } from "@angular/common";
import { ChangeDetectionStrategy, Component, NgZone, inject } from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import type { ImagePreviewDialogData } from "./image-preview-dialog.component";

type ImagePreviewDialogModule = typeof import("./image-preview-dialog.component");

const IMAGE_PREVIEW_DIALOG_ID = "site-image-preview-dialog";

function filenameFromURL(src: string) {
  try {
    const url = new URL(src, document.baseURI);
    return decodeURIComponent(url.pathname.split("/").filter(Boolean).at(-1) ?? "image");
  } catch {
    return "image";
  }
}

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
    if (this.dialog.openDialogs.some((dialogRef) => dialogRef.id === IMAGE_PREVIEW_DIALOG_ID)) {
      return;
    }

    const src = img.currentSrc || img.src;
    if (!src) return;

    const { ImagePreviewDialogComponent } = await this.preload();
    const label = this.getImageLabel(img, src);
    const data: ImagePreviewDialogData = {
      alt: img.alt,
      height: img.naturalHeight || this.getNumericAttribute(img, "height"),
      label,
      src,
      width: img.naturalWidth || this.getNumericAttribute(img, "width"),
    };

    this.dialog.open(ImagePreviewDialogComponent, {
      id: IMAGE_PREVIEW_DIALOG_ID,
      ariaLabel: `Aperçu de l'image : ${label}`,
      autoFocus: false,
      backdropClass: "site-image-dialog-backdrop",
      data,
      maxHeight: "calc(100dvh - 2rem)",
      maxWidth: "calc(100vw - 2rem)",
      panelClass: "site-image-dialog-panel",
      restoreFocus: true,
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
      filenameFromURL(src)
    );
  }

  private getNumericAttribute(img: HTMLImageElement, attribute: "height" | "width") {
    const value = Number.parseInt(img.getAttribute(attribute) ?? "", 10);
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }
}
