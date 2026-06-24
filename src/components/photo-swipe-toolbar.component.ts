import {
  ChangeDetectionStrategy,
  Component,
  signal,
  viewChild,
  viewChildren,
} from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";
import { MatIconButton } from "@angular/material/button";
import { MatChip, MatChipSet } from "@angular/material/chips";
import { MatIcon } from "@angular/material/icon";
import { MatProgressSpinner } from "@angular/material/progress-spinner";
import { MatTooltip } from "@angular/material/tooltip";
import { SimulatedLoadingProgress } from "@/lib/simulated-loading-progress";

interface PhotoSwipeToolbarState {
  open?: boolean;
  src?: string;
  fileName?: string;
  index?: number;
  total?: number;
  isFullscreen?: boolean;
  fullscreenAvailable?: boolean;
  zoomed?: boolean;
  loading?: boolean;
  closing?: boolean;
}

type PhotoSwipeAction =
  | "close"
  | "download"
  | "fullscreen"
  | "next"
  | "previous"
  | "share"
  | "zoom";

@Component({
  selector: "site-photo-swipe-toolbar",
  standalone: true,
  imports: [
    MatIconButton,
    MatChip,
    MatChipSet,
    MatIcon,
    MatProgressSpinner,
    MatTooltip,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[class.is-open]": "open()",
    "[class.is-closing]": "closing()",
    "[class.is-fullscreen]": "isFullscreen()",
    "[attr.aria-hidden]": "open() ? null : 'true'",
  },
  template: `
    @if (open()) {
      <div class="photo-swipe-toolbar" role="toolbar" aria-label="Commandes de l'image">
        @if (!isFullscreen()) {
          <mat-chip-set class="photo-swipe-counter-set" aria-hidden="true">
            <mat-chip
              #counterTooltip="matTooltip"
              [matTooltip]="fileName()"
              matTooltipPosition="below"
              [matTooltipShowDelay]="120"
              [matTooltipHideDelay]="0"
              matTooltipTouchGestures="off"
              (mouseenter)="onCounterTooltipEnter()"
              (mouseleave)="onCounterTooltipLeave()"
            >
              {{ index() }} / {{ total() }}
            </mat-chip>
          </mat-chip-set>
          <span class="sr-only" role="status" aria-live="polite" aria-atomic="true">
            Image {{ index() }} sur {{ total() }}
          </span>
        }

        <span class="photo-swipe-toolbar-actions">
          @if (!isFullscreen() && fullscreenAvailable()) {
            <button
              matIconButton
              type="button"
              class="photo-swipe-button"
              [attr.aria-label]="fullscreenLabel()"
              [matTooltip]="fullscreenLabel()"
              matTooltipPosition="below"
              (click)="act('fullscreen')"
            >
              <mat-icon aria-hidden="true">{{ fullscreenIcon() }}</mat-icon>
            </button>
          }

          @if (!isFullscreen()) {
            <button
              matIconButton
              type="button"
              class="photo-swipe-button"
              [attr.aria-label]="zoomLabel()"
              [attr.aria-pressed]="zoomed()"
              [matTooltip]="zoomLabel()"
              matTooltipPosition="below"
              (click)="act('zoom')"
            >
              <mat-icon aria-hidden="true">{{ zoomIcon() }}</mat-icon>
            </button>

            <a
              matIconButton
              class="photo-swipe-button"
              [href]="src()"
              target="_blank"
              rel="noopener"
              aria-label="Ouvrir l'image"
              matTooltip="Ouvrir l'image"
              matTooltipPosition="below"
              (click)="hideTooltip()"
            >
              <mat-icon aria-hidden="true">&#xE89E;</mat-icon>
            </a>

            <button
              matIconButton
              type="button"
              class="photo-swipe-button"
              aria-label="Télécharger"
              matTooltip="Télécharger"
              matTooltipPosition="below"
              (click)="act('download')"
            >
              <mat-icon aria-hidden="true">&#xE2C4;</mat-icon>
            </button>

            <button
              matIconButton
              type="button"
              class="photo-swipe-button"
              [attr.aria-label]="shareLabel()"
              [matTooltip]="shareLabel()"
              matTooltipPosition="below"
              (click)="share()"
            >
              <mat-icon aria-hidden="true">link</mat-icon>
            </button>
          }

          <button
            matIconButton
            type="button"
            class="photo-swipe-button"
            aria-label="Fermer"
            matTooltip="Fermer"
            matTooltipPosition="below"
            (click)="act('close')"
          >
            <mat-icon aria-hidden="true">&#xE5CD;</mat-icon>
          </button>
        </span>
      </div>

      @if (!isFullscreen() && total() > 1) {
        <button
          matIconButton
          type="button"
          class="photo-swipe-button photo-swipe-nav photo-swipe-nav-previous"
          aria-label="Image précédente"
          matTooltip="Image précédente"
          matTooltipPosition="right"
          (click)="act('previous')"
        >
          <mat-icon aria-hidden="true">&#xE5C4;</mat-icon>
        </button>

        <button
          matIconButton
          type="button"
          class="photo-swipe-button photo-swipe-nav photo-swipe-nav-next"
          aria-label="Image suivante"
          matTooltip="Image suivante"
          matTooltipPosition="left"
          (click)="act('next')"
        >
          <mat-icon aria-hidden="true">&#xE5C8;</mat-icon>
        </button>
      }

      @if (loading()) {
        <div class="photo-swipe-loading" role="status" aria-live="polite">
          <mat-progress-spinner
            mode="indeterminate"
            diameter="48"
            strokeWidth="4"
            aria-label="Chargement de l'image"
          ></mat-progress-spinner>
          <span class="sr-only">Chargement de l'image</span>
        </div>
      }
    }
  `,
  styles: `
    :host {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 100010;
      pointer-events: none;
      color: #fff;
    }

    :host.is-open {
      display: block;
    }

    .photo-swipe-toolbar {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-sizing: border-box;
      width: 100%;
      height: calc(3.5rem + env(safe-area-inset-top, 0px));
      padding: 0.5rem;
      padding-top: calc(0.5rem + env(safe-area-inset-top, 0px));
      pointer-events: auto;
      color: #fff;
      opacity: 1;
      transform: translateY(0);
      transition:
        opacity 120ms cubic-bezier(0.4, 0, 1, 1),
        transform 120ms cubic-bezier(0.4, 0, 1, 1);
      animation: photo-swipe-toolbar-enter 180ms cubic-bezier(0, 0, 0.2, 1);
    }

    :host.is-fullscreen .photo-swipe-toolbar {
      justify-content: flex-end;
    }

    .photo-swipe-toolbar-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.25rem;
      height: 2.5rem;
      line-height: 0;
    }

    .photo-swipe-counter-set .mat-mdc-chip {
      background-color: rgb(0 0 0 / 32%);
      color: #fff;
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
    }

    .photo-swipe-button {
      background-color: rgb(0 0 0 / 32%);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
    }

    .photo-swipe-nav {
      position: fixed;
      top: 50%;
      z-index: 1;
      transform: translateY(-50%);
      pointer-events: auto;
      opacity: 1;
      transition:
        opacity 120ms cubic-bezier(0.4, 0, 1, 1),
        transform 120ms cubic-bezier(0.4, 0, 1, 1);
      animation: photo-swipe-nav-enter 180ms cubic-bezier(0, 0, 0.2, 1);
    }

    .photo-swipe-nav-previous {
      left: 1rem;
    }

    .photo-swipe-nav-next {
      right: 1rem;
    }

    .photo-swipe-loading {
      position: fixed;
      inset: 50% auto auto 50%;
      z-index: 1;
      display: grid;
      place-items: center;
      pointer-events: none;
      transform: translate(-50%, -50%);
      opacity: 1;
      transition: opacity 120ms cubic-bezier(0.4, 0, 1, 1);
    }

    :host.is-closing .photo-swipe-toolbar,
    :host.is-closing .photo-swipe-nav,
    :host.is-closing .photo-swipe-loading {
      pointer-events: none;
      opacity: 0;
    }

    :host.is-closing .photo-swipe-toolbar {
      transform: translateY(-0.25rem);
    }

    :host.is-closing .photo-swipe-nav {
      transform: translateY(-50%) scale(0.92);
    }

    @keyframes photo-swipe-toolbar-enter {
      from {
        opacity: 0;
        transform: translateY(-0.25rem);
      }
    }

    @keyframes photo-swipe-nav-enter {
      from {
        opacity: 0;
        transform: translateY(-50%) scale(0.92);
      }
    }

    @media (max-width: 47.99rem) {
      .photo-swipe-toolbar {
        gap: 0.25rem;
      }

      .photo-swipe-nav-previous {
        left: 0.5rem;
      }

      .photo-swipe-nav-next {
        right: 0.5rem;
      }
    }

    @media (prefers-contrast: more) {
      .photo-swipe-counter-set .mat-mdc-chip,
      .photo-swipe-button {
        background-color: rgb(0 0 0 / 58%);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .photo-swipe-toolbar,
      .photo-swipe-nav,
      .photo-swipe-loading {
        animation: none;
        transition-duration: 1ms;
      }
    }
  `,
})
export class PhotoSwipeToolbarComponent implements OnInit, OnDestroy {
  readonly open = signal(false);
  readonly src = signal("");
  readonly fileName = signal("image");
  readonly index = signal(1);
  readonly total = signal(1);
  readonly isFullscreen = signal(false);
  readonly fullscreenAvailable = signal(false);
  readonly zoomed = signal(false);
  readonly loading = signal(false);
  readonly closing = signal(false);
  readonly shareLabel = signal("Partager");
  private readonly loadingProgress = new SimulatedLoadingProgress();
  readonly progress = this.loadingProgress.value;
  private readonly counterTooltip = viewChild<MatTooltip>("counterTooltip");
  private readonly tooltips = viewChildren(MatTooltip);

  readonly fullscreenIcon = () => "\uF1CE";
  readonly fullscreenLabel = () => "Plein écran";
  readonly zoomIcon = () => "fit_screen";
  readonly zoomLabel = () =>
    this.zoomed() ? "Réinitialiser l'alignement" : "Aligner l'image";

  private shareLabelTimer = 0;
  private counterTooltipHovered = false;
  private counterTooltipFrame = 0;

  private readonly handleState = (event: Event) => {
    const detail = (event as CustomEvent<PhotoSwipeToolbarState>).detail ?? {};
    const previousFileName = this.fileName();

    if (typeof detail.open === "boolean") this.open.set(detail.open);
    if (typeof detail.src === "string") this.src.set(detail.src);
    if (typeof detail.fileName === "string") {
      this.fileName.set(detail.fileName || "image");
    }
    if (typeof detail.index === "number") this.index.set(detail.index);
    if (typeof detail.total === "number") this.total.set(detail.total);
    if (this.fileName() !== previousFileName) this.refreshCounterTooltip();
    if (typeof detail.isFullscreen === "boolean") this.isFullscreen.set(detail.isFullscreen);
    if (typeof detail.fullscreenAvailable === "boolean") {
      this.fullscreenAvailable.set(detail.fullscreenAvailable);
    }
    if (typeof detail.zoomed === "boolean") this.zoomed.set(detail.zoomed);
    if (typeof detail.loading === "boolean" && detail.loading !== this.loading()) {
      if (detail.loading) this.loadingProgress.start();
      else this.loadingProgress.complete();
      this.loading.set(detail.loading);
    }
    if (typeof detail.closing === "boolean") {
      this.closing.set(detail.closing);
      if (detail.closing) this.hideTooltip();
    }
  };

  private readonly handleShareResult = (event: Event) => {
    const message = (event as CustomEvent<{ message?: string }>).detail?.message;
    if (!message) return;

    this.shareLabel.set(message);
    window.clearTimeout(this.shareLabelTimer);
    this.shareLabelTimer = window.setTimeout(() => this.shareLabel.set("Partager"), 1400);
  };

  ngOnInit() {
    if (typeof document === "undefined") return;
    document.addEventListener("site:photo-swipe-state", this.handleState);
    document.addEventListener("site:photo-swipe-share-result", this.handleShareResult);
  }

  ngOnDestroy() {
    if (typeof document === "undefined") return;
    document.removeEventListener("site:photo-swipe-state", this.handleState);
    document.removeEventListener("site:photo-swipe-share-result", this.handleShareResult);
    window.clearTimeout(this.shareLabelTimer);
    this.clearCounterTooltipFrame();
    this.loadingProgress.destroy();
  }

  act(action: PhotoSwipeAction) {
    this.hideTooltip();
    document.dispatchEvent(new CustomEvent("site:photo-swipe-action", { detail: { action } }));
  }

  share() {
    this.act("share");
  }

  onCounterTooltipEnter() {
    this.counterTooltipHovered = true;
  }

  onCounterTooltipLeave() {
    this.counterTooltipHovered = false;
    this.clearCounterTooltipFrame();
  }

  hideTooltip() {
    this.clearCounterTooltipFrame();
    this.tooltips().forEach((tooltip) => tooltip.hide(0));
    document.dispatchEvent(new CustomEvent("site:tooltip-hide"));
  }

  private refreshCounterTooltip() {
    this.clearCounterTooltipFrame();
    const tooltip = this.counterTooltip();
    if (!tooltip) return;

    tooltip.hide(0);
    if (!this.open() || !this.counterTooltipHovered) return;

    this.counterTooltipFrame = requestAnimationFrame(() => {
      this.counterTooltipFrame = 0;
      this.counterTooltip()?.show(0);
    });
  }

  private clearCounterTooltipFrame() {
    if (!this.counterTooltipFrame) return;
    cancelAnimationFrame(this.counterTooltipFrame);
    this.counterTooltipFrame = 0;
  }
}
