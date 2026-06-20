import {
  ChangeDetectionStrategy,
  Component,
  signal,
} from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";

interface PhotoSwipeToolbarState {
  open?: boolean;
  src?: string;
  index?: number;
  total?: number;
  isFullscreen?: boolean;
  fullscreenAvailable?: boolean;
}

type PhotoSwipeAction =
  | "close"
  | "download"
  | "fullscreen"
  | "next"
  | "previous"
  | "share";

const ICON_PATHS = {
  close:
    "m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z",
  download:
    "M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z",
  enterFullscreen:
    "M120-120v-200h80v120h120v80H120Zm520 0v-80h120v-120h80v200H640ZM120-640v-200h200v80H200v120h-80Zm640 0v-120H640v-80h200v200h-80Z",
  exitFullscreen:
    "m136-80-56-56 264-264H160v-80h320v320h-80v-184L136-80Zm344-400v-320h80v184l264-264 56 56-264 264h184v80H480Z",
  next: "m647-440-224 224 57 56 320-320-320-320-57 56 224 224H160v80h487Z",
  open:
    "M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-146 0-266-81.5T40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200Zm0-300Zm0 220q113 0 207.5-59.5T832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280Z",
  previous: "M313-440h487v-80H313l224-224-57-56-320 320 320 320 57-56-224-224Z",
  share:
    "M440-280H280q-83 0-141.5-58.5T80-480q0-83 58.5-141.5T280-680h160v80H280q-50 0-85 35t-35 85q0 50 35 85t85 35h160v80Zm-120-160v-80h320v80H320Zm200 160v-80h160q50 0 85-35t35-85q0-50-35-85t-85-35H520v-80h160q83 0 141.5 58.5T880-480q0 83-58.5 141.5T680-280H520Z",
} as const;

@Component({
  selector: "site-photoswipe-toolbar",
  standalone: true,
  imports: [MatButtonModule],
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
              class="site-pswp-button site-icon-button site-tooltip"
              [attr.aria-label]="fullscreenLabel()"
              [attr.data-tooltip]="fullscreenLabel()"
              data-tooltip-placement="bottom"
              (click)="act('fullscreen')"
            >
              <svg matButtonIcon aria-hidden="true" viewBox="0 -960 960 960" focusable="false">
                <path [attr.d]="fullscreenIcon()"></path>
              </svg>
            </button>
          }

          <a
            matIconButton
            class="site-pswp-button site-icon-button site-tooltip"
            [href]="src()"
            target="_blank"
            rel="noopener"
            aria-label="Ouvrir l'image"
            data-tooltip="Ouvrir l'image"
            data-tooltip-placement="bottom"
            (click)="hideTooltip()"
          >
            <svg matButtonIcon aria-hidden="true" viewBox="0 -960 960 960" focusable="false">
              <path [attr.d]="icons.open"></path>
            </svg>
          </a>

          <button
            matIconButton
            type="button"
            class="site-pswp-button site-icon-button site-tooltip"
            aria-label="Télécharger"
            data-tooltip="Télécharger"
            data-tooltip-placement="bottom"
            (click)="act('download')"
          >
            <svg matButtonIcon aria-hidden="true" viewBox="0 -960 960 960" focusable="false">
              <path [attr.d]="icons.download"></path>
            </svg>
          </button>

          <button
            matIconButton
            type="button"
            class="site-pswp-button site-icon-button site-tooltip"
            [attr.aria-label]="shareLabel()"
            [attr.data-tooltip]="shareLabel()"
            data-tooltip-placement="bottom"
            (click)="share()"
          >
            <svg matButtonIcon aria-hidden="true" viewBox="0 -960 960 960" focusable="false">
              <path [attr.d]="icons.share"></path>
            </svg>
          </button>

          <button
            matIconButton
            type="button"
            class="site-pswp-button site-icon-button site-tooltip"
            aria-label="Fermer"
            data-tooltip="Fermer"
            data-tooltip-placement="bottom"
            (click)="act('close')"
          >
            <svg matButtonIcon aria-hidden="true" viewBox="0 -960 960 960" focusable="false">
              <path [attr.d]="icons.close"></path>
            </svg>
          </button>
        </span>
      </div>

      @if (total() > 1) {
        <button
          matIconButton
          type="button"
          class="site-pswp-button site-icon-button site-pswp-nav site-pswp-nav--previous site-tooltip"
          aria-label="Image précédente"
          data-tooltip="Image précédente"
          data-tooltip-placement="right"
          (click)="act('previous')"
        >
          <svg matButtonIcon aria-hidden="true" viewBox="0 -960 960 960" focusable="false">
            <path [attr.d]="icons.previous"></path>
          </svg>
        </button>

        <button
          matIconButton
          type="button"
          class="site-pswp-button site-icon-button site-pswp-nav site-pswp-nav--next site-tooltip"
          aria-label="Image suivante"
          data-tooltip="Image suivante"
          data-tooltip-placement="left"
          (click)="act('next')"
        >
          <svg matButtonIcon aria-hidden="true" viewBox="0 -960 960 960" focusable="false">
            <path [attr.d]="icons.next"></path>
          </svg>
        </button>
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
      align-self: center;
      flex: 0 0 2.5rem;
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

    .site-pswp-button svg {
      display: block;
      flex: 0 0 1.5rem;
      width: 1.5rem;
      height: 1.5rem;
      margin: 0;
      fill: currentColor;
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
  readonly icons = ICON_PATHS;
  readonly open = signal(false);
  readonly src = signal("");
  readonly index = signal(1);
  readonly total = signal(1);
  readonly isFullscreen = signal(false);
  readonly fullscreenAvailable = signal(false);
  readonly shareLabel = signal("Partager");

  readonly fullscreenIcon = () =>
    this.isFullscreen() ? this.icons.exitFullscreen : this.icons.enterFullscreen;
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
  };

  private readonly handleShareResult = (event: Event) => {
    const copied = Boolean((event as CustomEvent<{ copied?: boolean }>).detail?.copied);
    if (!copied) return;

    this.shareLabel.set("Lien copié");
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
