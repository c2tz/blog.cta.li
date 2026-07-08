import { DOCUMENT } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import {
  ImagePreviewDialogComponent,
  type ImagePreviewDialogData,
  type ImagePreviewItem,
} from "./image-preview-dialog.component";

const IMAGE_PREVIEW_DIALOG_ID = "site-image-preview-dialog";

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
  selector: "site-image-dialog-controller",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: "",
})
export class ImageDialogControllerComponent implements OnInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly dialog = inject(MatDialog);

  ngOnInit() {
    if (typeof window === "undefined") return;

    this.document.addEventListener("click", this.handleClick, true);
    this.document.addEventListener("keydown", this.handleKeydown, true);
  }

  ngOnDestroy() {
    if (typeof window === "undefined") return;

    this.document.removeEventListener("click", this.handleClick, true);
    this.document.removeEventListener("keydown", this.handleKeydown, true);
  }

  private readonly handleClick = (event: MouseEvent) => {
    const img = this.getDialogImage(event);
    if (!img) return;

    event.preventDefault();
    event.stopPropagation();
    this.openImage(img);
  };

  private readonly handleKeydown = (event: KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return;

    const img = this.getDialogImage(event);
    if (!img) return;

    event.preventDefault();
    event.stopPropagation();
    this.openImage(img);
  };

  private getDialogImage(event: Event) {
    if (!(event.target instanceof Element)) return null;

    const img = event.target.closest<HTMLImageElement>(".site-prose img");
    if (!img || !img.src) return null;
    if (img.closest("header, footer, nav, [data-no-image-dialog]")) return null;
    if (img.closest("a[href], button, input, select, textarea")) return null;

    return img;
  }

  private openImage(img: HTMLImageElement) {
    if (this.dialog.openDialogs.some((dialogRef) => dialogRef.id === IMAGE_PREVIEW_DIALOG_ID)) {
      return;
    }

    const src = img.currentSrc || img.src;
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
    const data: ImagePreviewDialogData = {
      initialIndex,
      items: items.length ? items : [selectedItem],
    };

    this.dialog.open(ImagePreviewDialogComponent, {
      id: IMAGE_PREVIEW_DIALOG_ID,
      ariaLabel: `Aperçu de l'image : ${selectedItem.label}`,
      autoFocus: false,
      backdropClass: "site-image-dialog-backdrop",
      data,
      maxHeight: "calc(100dvh - 2rem)",
      maxWidth: "calc(100vw - 2rem)",
      panelClass: "site-image-dialog-panel",
      restoreFocus: true,
    });
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
    const src = img.currentSrc || img.src;
    if (!src) return null;

    return {
      alt: img.alt,
      createdAt: img.dataset["imageCreatedAt"],
      height: img.naturalHeight || this.getNumericAttribute(img, "height"),
      label: this.getImageLabel(img, src),
      lastModified: img.dataset["imageModifiedAt"],
      src,
      width: img.naturalWidth || this.getNumericAttribute(img, "width"),
    };
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
