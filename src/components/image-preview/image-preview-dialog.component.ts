import { DOCUMENT } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  inject,
  signal,
  viewChild,
  viewChildren,
} from "@angular/core";
import type { ElementRef, OnDestroy, OnInit } from "@angular/core";
import { MatIconButton } from "@angular/material/button";
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { MatIcon } from "@angular/material/icon";
import { MatMenu, MatMenuItem, MatMenuTrigger } from "@angular/material/menu";
import { MatSnackBar } from "@angular/material/snack-bar";
import { MatToolbar } from "@angular/material/toolbar";
import { MatTooltip } from "@angular/material/tooltip";
import { SITE_EVENTS } from "@/lib/site-contracts";

export interface ImagePreviewItem {
  alt?: string;
  height?: number;
  label: string;
  src: string;
  width?: number;
}

export interface ImagePreviewDialogData {
  initialIndex?: number;
  items: ImagePreviewItem[];
}

interface SwipeStart {
  id: number;
  time: number;
  x: number;
  y: number;
}

interface PointerPosition {
  x: number;
  y: number;
}

type ImageMotion = "next" | "previous";

const CLOSE_ICON = "\uE5CD";
const DOWNLOAD_ICON = "\uE2C4";
const FULLSCREEN_EXIT_ICON = "\uE5D1";
const FULLSCREEN_ICON = "\uE5D0";
const MORE_ICON = "\uE5D4";
const NEXT_ICON = "\uE5C8";
const PREVIOUS_ICON = "\uE5C4";
const SHARE_ICON = "\uE157";
const DOUBLE_TAP_DISTANCE = 34;
const DOUBLE_TAP_MS = 280;
const TAP_DISTANCE = 10;

function fileNameFromURL(src: string, baseURI: string) {
  try {
    const parsed = new URL(src, baseURI);
    const sourceUrl = parsed.searchParams.get("href");
    if (sourceUrl && parsed.pathname.endsWith("/_image")) {
      return fileNameFromURL(sourceUrl, baseURI);
    }

    return decodeURIComponent(parsed.pathname.split("/").pop() || "image");
  } catch {
    return "image";
  }
}

function distanceBetween(first: PointerPosition, second: PointerPosition) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

async function copyTextToClipboard(text: string) {
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

@Component({
  selector: "site-image-preview-dialog",
  standalone: true,
  imports: [
    MatDialogModule,
    MatIcon,
    MatIconButton,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatToolbar,
    MatTooltip,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <section
      #dialogShell
      class="site-image-dialog-shell"
      [class.has-visible-controls]="controlsVisible()"
      [class.is-fullscreen-mode]="isFullscreen()"
      tabindex="-1"
      (pointerdown)="handlePointerDown($event)"
      (pointermove)="handlePointerMove($event)"
      (pointerup)="handlePointerUp($event)"
      (pointercancel)="handlePointerCancel($event)"
      (lostpointercapture)="handlePointerCancel($event)"
    >
      <mat-dialog-content class="site-image-dialog-content">
        <img
          class="site-image-dialog-image"
          [src]="current().src"
          [alt]="current().alt || current().label"
          [attr.width]="current().width || null"
          [attr.height]="current().height || null"
          [class.is-entering-next]="imageMotion() === 'next'"
          [class.is-entering-previous]="imageMotion() === 'previous'"
          decoding="async"
          draggable="false"
        />
      </mat-dialog-content>

      <mat-menu
        #imageMenu="matMenu"
        xPosition="before"
        yPosition="below"
        class="site-image-dialog-menu"
        aria-label="Options de l'image"
      >
        <button
          mat-menu-item
          type="button"
          class="site-image-dialog-menu-item"
          (click)="download()"
        >
          <mat-icon matMenuItemIcon aria-hidden="true">{{ downloadIcon }}</mat-icon>
          <span>Télécharger</span>
        </button>

        <button
          mat-menu-item
          type="button"
          class="site-image-dialog-menu-item"
          (click)="share($event)"
        >
          <mat-icon matMenuItemIcon aria-hidden="true">{{ shareIcon }}</mat-icon>
          <span>{{ shareLabel() }}</span>
        </button>

        @if (fullscreenAvailable()) {
          <button
            mat-menu-item
            type="button"
            class="site-image-dialog-menu-item"
            (click)="handleFullscreenClick()"
          >
            <mat-icon matMenuItemIcon aria-hidden="true">{{ fullscreenIcon() }}</mat-icon>
            <span>{{ fullscreenLabel() }}</span>
          </button>
        }
      </mat-menu>

      <mat-toolbar
        class="site-image-dialog-toolbar"
        [class.is-hidden]="!controlsVisible()"
        [attr.aria-hidden]="controlsVisible() ? null : 'true'"
        role="toolbar"
        aria-label="Commandes de l'image"
      >
        @if (canNavigate()) {
          <button
            matIconButton
            type="button"
            class="site-image-dialog-button"
            aria-label="Image précédente"
            matTooltip="Image précédente"
            matTooltipPosition="below"
            (click)="previous()"
          >
            <mat-icon aria-hidden="true">{{ previousIcon }}</mat-icon>
          </button>

          <button
            matIconButton
            type="button"
            class="site-image-dialog-button"
            aria-label="Image suivante"
            matTooltip="Image suivante"
            matTooltipPosition="below"
            (click)="next()"
          >
            <mat-icon aria-hidden="true">{{ nextIcon }}</mat-icon>
          </button>

          <span class="sr-only" role="status" aria-live="polite" aria-atomic="true">
            Image {{ displayIndex() }} sur {{ total() }}
          </span>
        }

        <button
          matIconButton
          type="button"
          class="site-image-dialog-button"
          [matMenuTriggerFor]="imageMenu"
          aria-label="Options de l'image"
          aria-haspopup="menu"
          matTooltip="Options"
          matTooltipPosition="below"
        >
          <mat-icon aria-hidden="true">{{ moreIcon }}</mat-icon>
        </button>

        <button
          matIconButton
          type="button"
          class="site-image-dialog-button"
          aria-label="Fermer"
          matTooltip="Fermer"
          matTooltipPosition="below"
          (click)="close()"
        >
          <mat-icon aria-hidden="true">{{ closeIcon }}</mat-icon>
        </button>
      </mat-toolbar>
    </section>
  `,
  styles: `
    .site-image-dialog-backdrop {
      background: color-mix(in srgb, var(--m3-scrim) 68%, transparent);
      -webkit-backdrop-filter: blur(2px);
      backdrop-filter: blur(2px);
    }

    .site-image-dialog-panel.cdk-overlay-pane {
      max-width: calc(100vw - 2rem) !important;
      max-height: calc(100dvh - 2rem) !important;
    }

    .site-image-dialog-panel-fullscreen.cdk-overlay-pane,
    :fullscreen .site-image-dialog-panel.cdk-overlay-pane {
      width: 100vw !important;
      height: 100dvh !important;
      max-width: 100vw !important;
      max-height: 100dvh !important;
    }

    .site-image-dialog-panel .mat-mdc-dialog-container,
    .site-image-dialog-panel .mat-mdc-dialog-surface {
      max-width: inherit;
      max-height: inherit;
      border-radius: var(--image-radius);
      overflow: visible;
    }

    .site-image-dialog-panel .mat-mdc-dialog-surface {
      background: transparent;
      color: var(--site-text);
      box-shadow: none;
    }

    .site-image-dialog-shell {
      --image-dialog-toolbar-height: 3.5rem;
      position: relative;
      display: grid;
      max-width: inherit;
      max-height: inherit;
      outline: none;
      background: transparent;
      touch-action: pan-y pinch-zoom;
      -webkit-user-select: none;
      user-select: none;
    }

    .site-image-dialog-shell.is-fullscreen-mode,
    .site-image-dialog-shell:fullscreen,
    :fullscreen .site-image-dialog-shell {
      width: 100vw;
      height: 100dvh;
      max-width: none;
      max-height: none;
      border-radius: 0;
      background: var(--m3-scrim);
    }

    .site-image-dialog-toolbar.mat-toolbar {
      --mat-toolbar-container-background-color: var(--m3-surface-container);
      --mat-toolbar-container-text-color: var(--site-muted);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      position: fixed;
      top: max(1rem, env(safe-area-inset-top, 0px));
      right: max(1rem, env(safe-area-inset-right, 0px));
      bottom: auto;
      left: auto;
      margin: 0;
      width: max-content;
      max-width: calc(100% - 1rem);
      min-height: var(--image-dialog-toolbar-height);
      height: var(--image-dialog-toolbar-height);
      max-height: var(--image-dialog-toolbar-height);
      border-radius: var(--site-shape-large);
      padding-inline: 0.75rem;
      overflow: hidden;
      background: var(--m3-surface-container);
      color: var(--site-muted);
      box-shadow: var(--mat-sys-level2, 0 3px 8px rgb(0 0 0 / 18%));
      transition:
        max-height 180ms var(--ease-out-3),
        opacity 160ms var(--ease-out-3),
        padding 180ms var(--ease-out-3),
        transform 160ms var(--ease-out-3);
      will-change: max-height, opacity, transform;
      z-index: 1;
    }

    .site-image-dialog-toolbar.mat-toolbar.is-hidden {
      min-height: 0;
      max-height: 0;
      height: 0;
      padding-block: 0;
      opacity: 0;
      pointer-events: none;
      transform: translateY(-0.45rem);
    }

    .site-image-dialog-button.mat-mdc-icon-button {
      --mat-icon-button-icon-color: var(--site-muted);
      --mat-icon-button-state-layer-color: var(--site-muted);
      color: var(--site-muted);
      touch-action: manipulation;
    }

    .site-image-dialog-panel .site-image-dialog-content.mat-mdc-dialog-content {
      display: grid;
      place-items: center;
      max-width: inherit;
      max-height: inherit;
      min-height: 0;
      margin: 0;
      padding: 0;
      overflow: hidden;
      touch-action: pan-y pinch-zoom;
    }

    .site-image-dialog-image {
      display: block;
      width: auto;
      max-width: calc(100vw - 2rem);
      height: auto;
      max-height: calc(100dvh - 2rem);
      object-fit: contain;
      background: var(--m3-surface-container-high);
      border-radius: var(--image-radius);
      box-shadow: var(--mat-sys-level4, 0 10px 28px rgb(0 0 0 / 22%));
      touch-action: pan-y pinch-zoom;
      -webkit-user-drag: none;
      user-select: none;
    }

    .site-image-dialog-image.is-entering-next {
      animation: site-image-dialog-enter-next 180ms var(--ease-out-3);
    }

    .site-image-dialog-image.is-entering-previous {
      animation: site-image-dialog-enter-previous 180ms var(--ease-out-3);
    }

    .site-image-dialog-shell:not(.has-visible-controls) .site-image-dialog-image {
      max-height: calc(100dvh - 2rem);
    }

    @keyframes site-image-dialog-enter-next {
      from {
        opacity: 0.72;
        translate: 0.85rem 0;
      }
      to {
        opacity: 1;
        translate: 0 0;
      }
    }

    @keyframes site-image-dialog-enter-previous {
      from {
        opacity: 0.72;
        translate: -0.85rem 0;
      }
      to {
        opacity: 1;
        translate: 0 0;
      }
    }

    .site-image-dialog-shell.is-fullscreen-mode .site-image-dialog-content.mat-mdc-dialog-content,
    .site-image-dialog-shell:fullscreen .site-image-dialog-content.mat-mdc-dialog-content,
    :fullscreen .site-image-dialog-content.mat-mdc-dialog-content {
      width: 100vw;
      height: 100dvh;
      max-width: none;
      max-height: none;
    }

    .site-image-dialog-shell.is-fullscreen-mode .site-image-dialog-image,
    .site-image-dialog-shell:fullscreen .site-image-dialog-image,
    :fullscreen .site-image-dialog-image {
      width: 100vw;
      max-width: 100vw;
      height: 100dvh;
      max-height: 100dvh;
      border-radius: 0;
      box-shadow: none;
    }

    .site-image-dialog-shell.is-fullscreen-mode:not(.has-visible-controls)
      .site-image-dialog-content.mat-mdc-dialog-content,
    .site-image-dialog-shell:fullscreen:not(.has-visible-controls)
      .site-image-dialog-content.mat-mdc-dialog-content,
    :fullscreen
      .site-image-dialog-shell:not(.has-visible-controls)
      .site-image-dialog-content.mat-mdc-dialog-content,
    .site-image-dialog-shell.is-fullscreen-mode:not(.has-visible-controls) .site-image-dialog-image,
    .site-image-dialog-shell:fullscreen:not(.has-visible-controls) .site-image-dialog-image,
    :fullscreen .site-image-dialog-shell:not(.has-visible-controls) .site-image-dialog-image {
      height: 100dvh;
      max-height: 100dvh;
    }

    .site-image-dialog-menu.mat-mdc-menu-panel {
      min-width: 14rem;
    }

    .site-image-dialog-menu-item.mat-mdc-menu-item {
      position: relative;
      min-height: 3.25rem;
      cursor: pointer;
      pointer-events: auto;
    }

    .site-image-dialog-menu-item.mat-mdc-menu-item .mat-icon {
      color: var(--site-muted);
    }

    @media (max-width: 720px), (pointer: coarse) {
      .site-image-dialog-shell {
        --image-dialog-toolbar-height: 3.25rem;
      }

      .site-image-dialog-panel.cdk-overlay-pane,
      .site-image-dialog-image {
        max-width: calc(
          100vw - 1rem - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)
        ) !important;
      }

      .site-image-dialog-toolbar.mat-toolbar {
        gap: 0.45rem;
        padding-inline: 0.5rem;
      }

      .site-image-dialog-image {
        max-height: calc(
          100dvh - 1rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)
        ) !important;
      }

      .site-image-dialog-shell:not(.has-visible-controls) .site-image-dialog-image {
        max-height: calc(
          100dvh - 1rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)
        ) !important;
      }

      .site-image-dialog-shell.is-fullscreen-mode .site-image-dialog-image,
      .site-image-dialog-shell:fullscreen .site-image-dialog-image,
      :fullscreen .site-image-dialog-image {
        width: 100vw;
        max-width: 100vw !important;
        height: 100dvh;
        max-height: 100dvh !important;
      }
    }
  `,
})
export class ImagePreviewDialogComponent implements OnInit, OnDestroy {
  private readonly data = inject<ImagePreviewDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ImagePreviewDialogComponent>);
  private readonly document = inject(DOCUMENT);
  private readonly snackBar = inject(MatSnackBar);
  private readonly shell = viewChild<ElementRef<HTMLElement>>("dialogShell");
  private readonly tooltips = viewChildren(MatTooltip);

  readonly closeIcon = CLOSE_ICON;
  readonly controlsVisible = signal(true);
  readonly downloadIcon = DOWNLOAD_ICON;
  readonly fullscreenIcon = computed(() =>
    this.isFullscreen() ? FULLSCREEN_EXIT_ICON : FULLSCREEN_ICON,
  );
  readonly moreIcon = MORE_ICON;
  readonly nextIcon = NEXT_ICON;
  readonly previousIcon = PREVIOUS_ICON;
  readonly shareIcon = SHARE_ICON;
  readonly shareLabel = signal("Partager");
  readonly isFullscreen = signal(false);
  readonly fullscreenAvailable = signal(
    typeof document !== "undefined" && Boolean(this.document.fullscreenEnabled),
  );
  readonly imageMotion = signal<ImageMotion | null>(null);
  readonly items = signal(this.normalizeItems(this.data.items));
  readonly currentIndex = signal(this.clampIndex(this.data.initialIndex ?? 0));
  readonly current = computed(() => this.items()[this.currentIndex()] ?? this.items()[0]);
  readonly displayIndex = computed(() => this.currentIndex() + 1);
  readonly total = computed(() => this.items().length);
  readonly canNavigate = computed(() => this.total() > 1);
  readonly fullscreenLabel = computed(() =>
    this.isFullscreen() ? "Quitter le plein écran" : "Plein écran",
  );

  private readonly activePointers = new Set<number>();
  private swipeStart?: SwipeStart;
  private fullscreenFallback = false;
  private imageMotionTimer?: number;
  private lastTap?: PointerPosition & { time: number };
  private shareLabelTimer?: number;
  private tapTimer?: number;

  private readonly handleFullscreenChange = () => {
    const fullscreenElement = this.document.fullscreenElement;
    this.isFullscreen.set(Boolean(fullscreenElement) || this.fullscreenFallback);

    if (!fullscreenElement && !this.fullscreenFallback) {
      this.restoreDialogSize();
    }
  };

  private readonly handleGlobalKeydown = (event: KeyboardEvent) => {
    if (
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      !this.canNavigate()
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

  ngOnInit() {
    if (typeof document === "undefined") return;

    this.document.addEventListener("fullscreenchange", this.handleFullscreenChange);
    this.document.addEventListener("keydown", this.handleGlobalKeydown);
    this.preloadAdjacentImages();
  }

  ngOnDestroy() {
    if (typeof document === "undefined") return;

    this.document.removeEventListener("fullscreenchange", this.handleFullscreenChange);
    this.document.removeEventListener("keydown", this.handleGlobalKeydown);
    if (this.imageMotionTimer) window.clearTimeout(this.imageMotionTimer);
    if (this.shareLabelTimer) window.clearTimeout(this.shareLabelTimer);
    this.clearTapTimer();
    this.hideTooltip();
    void this.exitFullscreen();
  }

  previous() {
    this.goTo(this.currentIndex() - 1, "previous");
  }

  next() {
    this.goTo(this.currentIndex() + 1, "next");
  }

  close() {
    this.hideTooltip();
    void this.exitFullscreen().finally(() => this.dialogRef.close());
  }

  async toggleFullscreen() {
    this.hideTooltip();

    if (this.document.fullscreenElement || this.fullscreenFallback) {
      await this.exitFullscreen();
      return;
    }

    try {
      const shell = this.shell()?.nativeElement;
      if (!shell?.requestFullscreen) throw new Error("fullscreen_unavailable");

      await shell.requestFullscreen({ navigationUI: "hide" });
    } catch {
      this.fullscreenFallback = true;
      this.isFullscreen.set(true);
      this.dialogRef.addPanelClass("site-image-dialog-panel-fullscreen");
      this.dialogRef.updateSize("100vw", "100dvh");
    }
  }

  async download() {
    this.hideTooltip();
    const item = this.current();
    const filename = fileNameFromURL(item.src, this.document.baseURI);

    try {
      const response = await fetch(item.src, { mode: "cors" });
      if (!response.ok) throw new Error(`image_download_${response.status}`);

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = this.document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      this.document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(item.src, "_blank", "noopener");
    }
  }

  handleFullscreenClick() {
    void this.toggleFullscreen();
  }

  async share(event?: MouseEvent) {
    event?.stopPropagation();
    this.hideTooltip();
    const item = this.current();
    const url = new URL(item.src, this.document.baseURI).href;

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
      const copied = await copyTextToClipboard(url);
      if (!copied) throw new Error("copy_failed");
      this.setShareFeedback("Lien copié");
    } catch {
      this.setShareFeedback("Copie impossible");
    }
  }

  handlePointerDown(event: PointerEvent) {
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
  }

  handlePointerMove(event: PointerEvent) {
    if (this.activePointers.size > 1 && this.activePointers.has(event.pointerId)) {
      this.swipeStart = undefined;
    }
  }

  handlePointerUp(event: PointerEvent) {
    const currentPointer = {
      x: event.clientX,
      y: event.clientY,
    };
    const swipeStart = this.swipeStart;
    const wasMultiPointer = this.activePointers.size > 1;

    this.activePointers.delete(event.pointerId);
    this.clearSwipe();

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
    const isHorizontalSwipe = Math.abs(deltaX) > 56 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25;

    if (isHorizontalSwipe && elapsed <= 900 && this.canNavigate()) {
      if (deltaX < 0) this.next();
      else this.previous();
      return;
    }

    if (elapsed <= 360 && Math.abs(deltaX) <= TAP_DISTANCE && Math.abs(deltaY) <= TAP_DISTANCE) {
      this.handleTap(currentPointer);
    }
  }

  clearSwipe() {
    this.swipeStart = undefined;
  }

  handlePointerCancel(event: PointerEvent) {
    this.activePointers.delete(event.pointerId);
    if (this.activePointers.size === 0) this.clearSwipe();
  }

  private goTo(index: number, motion: ImageMotion) {
    const total = this.total();
    if (total < 1) return;

    this.hideTooltip();
    this.controlsVisible.set(true);
    this.currentIndex.set(((index % total) + total) % total);
    this.playImageMotion(motion);
    this.preloadAdjacentImages();
  }

  private handleTap(pointer: PointerPosition) {
    const now = Date.now();
    const lastTap = this.lastTap;

    if (
      lastTap &&
      now - lastTap.time <= DOUBLE_TAP_MS &&
      distanceBetween(lastTap, pointer) <= DOUBLE_TAP_DISTANCE
    ) {
      this.clearTapTimer();
      this.lastTap = undefined;
      this.controlsVisible.set(true);
      return;
    }

    this.lastTap = {
      ...pointer,
      time: now,
    };
    this.clearTapTimer();
    this.hideTooltip();
    this.controlsVisible.update((visible) => !visible);
    this.tapTimer = window.setTimeout(() => {
      this.lastTap = undefined;
      this.tapTimer = undefined;
    }, DOUBLE_TAP_MS);
  }

  private playImageMotion(motion: ImageMotion) {
    if (this.imageMotionTimer) window.clearTimeout(this.imageMotionTimer);

    this.imageMotion.set(null);
    window.requestAnimationFrame(() => {
      this.imageMotion.set(motion);
      this.imageMotionTimer = window.setTimeout(() => {
        this.imageMotion.set(null);
        this.imageMotionTimer = undefined;
      }, 210);
    });
  }

  private clearTapTimer() {
    if (!this.tapTimer) return;

    window.clearTimeout(this.tapTimer);
    this.tapTimer = undefined;
  }

  private async exitFullscreen() {
    if (!this.document.fullscreenElement) {
      this.fullscreenFallback = false;
      this.isFullscreen.set(false);
      this.restoreDialogSize();
      return;
    }

    try {
      await this.document.exitFullscreen?.();
    } catch {}

    this.fullscreenFallback = false;
    this.isFullscreen.set(false);
    this.restoreDialogSize();
  }

  private restoreDialogSize() {
    this.dialogRef.removePanelClass("site-image-dialog-panel-fullscreen");
    this.dialogRef.updateSize("", "");
  }

  private hideTooltip() {
    this.tooltips().forEach((tooltip) => tooltip.hide(0));
    this.document.dispatchEvent(new CustomEvent(SITE_EVENTS.tooltipHide));
  }

  private setShareFeedback(message: string) {
    this.shareLabel.set(message);
    this.snackBar.open(message, undefined, {
      duration: 2200,
      horizontalPosition: "center",
      verticalPosition: "bottom",
    });
    if (this.shareLabelTimer) window.clearTimeout(this.shareLabelTimer);
    this.shareLabelTimer = window.setTimeout(() => this.shareLabel.set("Partager"), 1400);
  }

  private async getShareFile(url: string) {
    const response = await fetch(url, {
      cache: "force-cache",
      credentials: new URL(url).origin === location.origin ? "same-origin" : "omit",
      mode: "cors",
    });
    if (!response.ok) throw new Error(`image_share_${response.status}`);

    const blob = await response.blob();
    return new File([blob], fileNameFromURL(url, this.document.baseURI), {
      type: blob.type || "image/jpeg",
    });
  }

  private preloadAdjacentImages() {
    if (!this.canNavigate()) return;

    const items = this.items();
    const currentIndex = this.currentIndex();
    [
      items[(currentIndex + 1) % items.length],
      items[(currentIndex - 1 + items.length) % items.length],
    ]
      .filter(Boolean)
      .forEach((item) => {
        const image = new Image();
        image.src = item.src;
      });
  }

  private normalizeItems(items: ImagePreviewItem[]) {
    return items.length
      ? items
      : [
          {
            label: "image",
            src: "",
          },
        ];
  }

  private clampIndex(index: number) {
    const total = Math.max(1, this.normalizeItems(this.data.items).length);
    return Math.min(total - 1, Math.max(0, index));
  }

  private isInteractiveTarget(target: EventTarget | null) {
    return (
      target instanceof Element &&
      Boolean(target.closest("a[href], button, input, select, textarea, [role='button']"))
    );
  }
}
