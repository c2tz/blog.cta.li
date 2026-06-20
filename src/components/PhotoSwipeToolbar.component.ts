import {
  ChangeDetectionStrategy,
  Component,
  signal,
} from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";

interface PhotoSwipeToolbarState {
  open?: boolean;
  src?: string;
  index?: number;
  total?: number;
  isFullscreen?: boolean;
  fullscreenAvailable?: boolean;
  loading?: boolean;
}

type PhotoSwipeAction =
  | "close"
  | "download"
  | "fullscreen"
  | "next"
  | "previous"
  | "share";

@Component({
  selector: "site-photoswipe-toolbar",
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[class.is-open]": "open()",
    "[attr.aria-hidden]": "open() ? null : 'true'",
  },
  template: `
    @if (open()) {
      <div class="site-pswp-toolbar" role="toolbar" aria-label="Commandes de l'image">
        <span class="site-pswp-counter" aria-live="polite">{{ index() }} / {{ total() }}</span>

        <span class="site-pswp-toolbar__actions">
          @if (fullscreenAvailable()) {
            <button
              matIconButton
              type="button"
              class="site-pswp-button site-icon-button"
              [attr.aria-label]="fullscreenLabel()"
              [matTooltip]="fullscreenLabel()"
              matTooltipPosition="below"
              (click)="act('fullscreen')"
            >
              <mat-icon aria-hidden="true">{{ fullscreenIcon() }}</mat-icon>
            </button>
          }

          <a
            matIconButton
            class="site-pswp-button site-icon-button"
            [href]="src()"
            target="_blank"
            rel="noopener"
            aria-label="Ouvrir l'image"
            matTooltip="Ouvrir l'image"
            matTooltipPosition="below"
            (click)="hideTooltip()"
          >
            <mat-icon aria-hidden="true">&#xE8F4;</mat-icon>
          </a>

          <button
            matIconButton
            type="button"
            class="site-pswp-button site-icon-button"
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
            class="site-pswp-button site-icon-button"
            [attr.aria-label]="shareLabel()"
            [matTooltip]="shareLabel()"
            matTooltipPosition="below"
            (click)="share()"
          >
            <mat-icon aria-hidden="true">&#xE80D;</mat-icon>
          </button>

          <button
            matIconButton
            type="button"
            class="site-pswp-button site-icon-button"
            aria-label="Fermer"
            matTooltip="Fermer"
            matTooltipPosition="below"
            (click)="act('close')"
          >
            <mat-icon aria-hidden="true">&#xE5CD;</mat-icon>
          </button>
        </span>
      </div>

      @if (total() > 1) {
        <button
          matIconButton
          type="button"
          class="site-pswp-button site-icon-button site-pswp-nav site-pswp-nav--previous"
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
          class="site-pswp-button site-icon-button site-pswp-nav site-pswp-nav--next"
          aria-label="Image suivante"
          matTooltip="Image suivante"
          matTooltipPosition="left"
          (click)="act('next')"
        >
          <mat-icon aria-hidden="true">&#xE5C8;</mat-icon>
        </button>
      }

      @if (loading()) {
        <div class="site-pswp-loading" role="status" aria-live="polite">
          <mat-spinner diameter="48" strokeWidth="4" aria-hidden="true"></mat-spinner>
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

    .site-pswp-toolbar {
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
    }

    .site-pswp-toolbar__actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.25rem;
      height: 2.5rem;
      line-height: 0;
    }

    .site-pswp-counter {
      min-width: 4rem;
      padding: 0.45rem 0.625rem;
      border: 1px solid rgb(255 255 255 / 28%);
      border-radius: 1rem;
      background: rgb(0 0 0 / 68%);
      box-shadow: 0 1px 4px rgb(0 0 0 / 35%);
      font: 600 0.875rem/1 system-ui, sans-serif;
      font-variant-numeric: tabular-nums;
      text-align: center;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }

    .site-pswp-button.site-icon-button.mat-mdc-icon-button.mat-mdc-button-base {
      display: grid;
      align-self: center;
      flex: 0 0 2.5rem;
      place-items: center;
      width: 2.5rem;
      height: 2.5rem;
      min-width: 2.5rem;
      min-height: 2.5rem;
      padding: 0;
      margin: 0;
      border: 1px solid rgb(255 255 255 / 28%);
      background: rgb(0 0 0 / 68%);
      box-shadow: 0 1px 4px rgb(0 0 0 / 35%);
      line-height: 0;
      vertical-align: middle;
      color: #fff;
      opacity: 1;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      --mat-icon-button-icon-color: #fff;
      --mat-icon-button-state-layer-color: #fff;
      --mat-icon-button-ripple-color: rgb(255 255 255 / 24%);
    }

    .site-pswp-button.site-icon-button.mat-mdc-icon-button.mat-mdc-button-base:is(
        :hover,
        :focus-visible
      ) {
      border-color: rgb(255 255 255 / 62%);
      background: rgb(0 0 0 / 82%);
    }

    .site-pswp-button.site-icon-button.mat-mdc-icon-button.mat-mdc-button-base:focus-visible {
      outline: 2px solid #fff;
      outline-offset: 2px;
    }

    .site-pswp-button mat-icon {
      position: relative;
      z-index: 1;
      display: block;
      place-self: center;
      width: 24px;
      height: 24px;
      margin: 0;
      overflow: hidden;
      font-family: "Material Icons";
      font-size: 24px;
      font-style: normal;
      font-weight: 400;
      line-height: 24px;
      letter-spacing: 0;
      text-align: center;
      text-transform: none;
      white-space: nowrap;
      -webkit-font-smoothing: antialiased;
      filter: drop-shadow(0 1px 1px rgb(0 0 0 / 70%));
    }

    .site-pswp-nav {
      position: fixed;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: auto;
      color: #fff;
    }

    .site-pswp-nav--previous {
      left: 1rem;
    }

    .site-pswp-nav--next {
      right: 1rem;
    }

    .site-pswp-loading {
      position: fixed;
      inset: 50% auto auto 50%;
      z-index: 1;
      display: grid;
      place-items: center;
      pointer-events: none;
      transform: translate(-50%, -50%);
    }

    @media (max-width: 47.99rem) {
      .site-pswp-toolbar {
        gap: 0.25rem;
      }

      .site-pswp-counter {
        min-width: 2.75rem;
        padding-inline: 0.25rem;
      }

      .site-pswp-nav--previous {
        left: 0.5rem;
      }

      .site-pswp-nav--next {
        right: 0.5rem;
      }
    }
  `,
})
export class PhotoSwipeToolbarComponent implements OnInit, OnDestroy {
  readonly open = signal(false);
  readonly src = signal("");
  readonly index = signal(1);
  readonly total = signal(1);
  readonly isFullscreen = signal(false);
  readonly fullscreenAvailable = signal(false);
  readonly loading = signal(false);
  readonly shareLabel = signal("Partager");

  readonly fullscreenIcon = () =>
    this.isFullscreen() ? "\uE5D1" : "\uE5D0";
  readonly fullscreenLabel = () =>
    this.isFullscreen() ? "Quitter le plein écran" : "Plein écran";

  private shareLabelTimer = 0;

  private readonly handleState = (event: Event) => {
    const detail = (event as CustomEvent<PhotoSwipeToolbarState>).detail ?? {};

    if (typeof detail.open === "boolean") this.open.set(detail.open);
    if (typeof detail.src === "string") this.src.set(detail.src);
    if (typeof detail.index === "number") this.index.set(detail.index);
    if (typeof detail.total === "number") this.total.set(detail.total);
    if (typeof detail.isFullscreen === "boolean") this.isFullscreen.set(detail.isFullscreen);
    if (typeof detail.fullscreenAvailable === "boolean") {
      this.fullscreenAvailable.set(detail.fullscreenAvailable);
    }
    if (typeof detail.loading === "boolean") this.loading.set(detail.loading);
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
    document.addEventListener("site:photoswipe-state", this.handleState);
    document.addEventListener("site:photoswipe-share-result", this.handleShareResult);
  }

  ngOnDestroy() {
    if (typeof document === "undefined") return;
    document.removeEventListener("site:photoswipe-state", this.handleState);
    document.removeEventListener("site:photoswipe-share-result", this.handleShareResult);
    window.clearTimeout(this.shareLabelTimer);
  }

  act(action: PhotoSwipeAction) {
    this.hideTooltip();
    document.dispatchEvent(new CustomEvent("site:photoswipe-action", { detail: { action } }));
  }

  share() {
    this.act("share");
  }

  hideTooltip() {
    document.dispatchEvent(new CustomEvent("site:tooltip-hide"));
  }
}
