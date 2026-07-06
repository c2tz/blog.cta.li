import { DOCUMENT } from "@angular/common";
import { Overlay, OverlayContainer } from "@angular/cdk/overlay";
import type { OverlayRef } from "@angular/cdk/overlay";
import { CdkPortal } from "@angular/cdk/portal";
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
import type { AfterViewInit, OnDestroy, OnInit } from "@angular/core";
import { MatIconButton } from "@angular/material/button";
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from "@angular/material/dialog";
import { MatIcon } from "@angular/material/icon";
import { MatMenu, MatMenuItem, MatMenuTrigger } from "@angular/material/menu";
import { MatSnackBar } from "@angular/material/snack-bar";
import { MatToolbar } from "@angular/material/toolbar";
import { MatTooltip } from "@angular/material/tooltip";
import { SITE_EVENTS } from "@/lib/site-contracts";

export interface ImagePreviewItem {
  alt?: string;
  createdAt?: string;
  height?: number;
  label: string;
  lastModified?: string;
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

interface WebkitFullscreenDocument extends Document {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
}

interface WebkitFullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

type ImageMotion = "next" | "previous";

interface ImageInformationDialogData {
  createdAt?: string;
  height?: number;
  lastModified?: string;
  name: string;
  src: string;
  width?: number;
}

const CLOSE_ICON = "\uE5CD";
const CHECK_ICON = "\uE5CA";
const DOWNLOAD_ICON = "\uE2C4";
const FULLSCREEN_EXIT_ICON = "\uE5D1";
const FULLSCREEN_ICON = "\uE5D0";
const INFO_ICON = "\uE88E";
const MORE_ICON = "\uE5D4";
const NEXT_ICON = "\uE5C8";
const PREVIOUS_ICON = "\uE5C4";
const SHARE_ICON = "\uE157";
const SHARE_FEEDBACK_DURATION_MS = 2200;
const DOUBLE_TAP_DISTANCE = 34;
const DOUBLE_TAP_MS = 280;
const TAP_DISTANCE = 10;
const IMAGE_DIALOG_FULLSCREEN_HOST_CLASS = "site-image-dialog-fullscreen-host";
const IMAGE_DIALOG_FULLSCREEN_ACTIVE_CLASS = "is-fullscreen-active";
const IMAGE_DIALOG_FULLSCREEN_DOCUMENT_CLASS = "site-image-dialog-fullscreen-document";
const IMAGE_INFORMATION_DIALOG_ID = "site-image-information-dialog";

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

function formatByteSize(bytes: number) {
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

function formatImageDate(value?: string) {
  if (!value) return "Indisponible";

  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Indisponible";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

function imageTypeLabel(src: string, contentType?: string | null) {
  const mimeSubtype = contentType?.match(/^image\/([^;]+)/i)?.[1];
  let format = mimeSubtype;

  try {
    const parsed = new URL(src, document.baseURI);
    format ||= parsed.searchParams.get("f") || undefined;
    format ||= fileNameFromURL(src, document.baseURI).split(".").pop();
  } catch {}

  const normalized = format?.toLowerCase();
  const labels = new Map([
    ["avif", "AVIF"],
    ["gif", "GIF"],
    ["jpeg", "JPEG"],
    ["jpg", "JPEG"],
    ["png", "PNG"],
    ["svg+xml", "SVG"],
    ["webp", "WebP"],
  ]);

  return normalized ? `Image ${labels.get(normalized) ?? normalized.toUpperCase()}` : "Image";
}

function loadedResourceSize(src: string) {
  if (typeof performance === "undefined") return 0;

  const entries = performance.getEntriesByName(src, "resource") as PerformanceResourceTiming[];
  const entry = entries.at(-1);
  return entry?.encodedBodySize || entry?.transferSize || 0;
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
  selector: "site-image-information-dialog",
  standalone: true,
  imports: [MatDialogModule, MatIcon, MatIconButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <section class="site-image-information">
      <header class="site-image-information-header">
        <h2 mat-dialog-title>Informations sur l’image</h2>
        <button matIconButton mat-dialog-close type="button" aria-label="Fermer les informations">
          <mat-icon aria-hidden="true">{{ closeIcon }}</mat-icon>
        </button>
      </header>

      <mat-dialog-content>
        <dl class="site-image-information-list">
          <div>
            <dt>Nom</dt>
            <dd>{{ data.name }}</dd>
          </div>
          <div>
            <dt>Format affiché</dt>
            <dd>{{ typeLabel() }}</dd>
          </div>
          <div>
            <dt>Taille chargée</dt>
            <dd>{{ sizeLabel() }}</dd>
          </div>
          <div>
            <dt>Dimensions</dt>
            <dd>{{ dimensionsLabel }}</dd>
          </div>
          <div>
            <dt>Ajoutée le</dt>
            <dd>{{ createdLabel }}</dd>
          </div>
          <div>
            <dt>Modifiée le</dt>
            <dd>{{ modifiedLabel }}</dd>
          </div>
        </dl>
      </mat-dialog-content>
    </section>
  `,
  styles: `
    .site-image-information-dialog-panel .mat-mdc-dialog-container,
    .site-image-information-dialog-panel .mat-mdc-dialog-surface {
      border-radius: var(--site-shape-large);
    }

    .site-image-information-dialog-panel .mat-mdc-dialog-surface {
      background: var(--m3-surface-container);
      color: var(--site-text);
      box-shadow: var(--mat-sys-level3, 0 6px 18px rgb(0 0 0 / 20%));
    }

    .site-image-information {
      min-width: min(28rem, calc(100vw - 2rem));
      max-width: min(32rem, calc(100vw - 2rem));
    }

    .site-image-information-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding-inline: 1.5rem 0.75rem;
    }

    .site-image-information-header h2.mat-mdc-dialog-title {
      flex: 1;
      margin: 0;
      padding: 1.25rem 0 1rem;
      color: var(--site-text);
    }

    .site-image-information-header .mat-mdc-icon-button {
      color: var(--site-muted);
    }

    .site-image-information .mat-mdc-dialog-content {
      padding: 0 1.5rem 1.5rem;
    }

    .site-image-information-list {
      display: grid;
      gap: 0;
      margin: 0;
    }

    .site-image-information-list > div {
      display: grid;
      grid-template-columns: minmax(7rem, 0.55fr) minmax(0, 1fr);
      gap: 1rem;
      padding-block: 0.8rem;
      border-bottom: 1px solid var(--site-border);
    }

    .site-image-information-list > div:last-child {
      border-bottom: 0;
    }

    .site-image-information-list dt {
      color: var(--site-muted);
      font-weight: 500;
    }

    .site-image-information-list dd {
      min-width: 0;
      margin: 0;
      overflow-wrap: anywhere;
      color: var(--site-text);
    }

    @media (max-width: 520px) {
      .site-image-information-list > div {
        grid-template-columns: 1fr;
        gap: 0.25rem;
      }
    }
  `,
})
class ImageInformationDialogComponent implements OnInit {
  readonly data = inject<ImageInformationDialogData>(MAT_DIALOG_DATA);
  readonly closeIcon = CLOSE_ICON;
  readonly createdLabel = formatImageDate(this.data.createdAt);
  readonly dimensionsLabel =
    this.data.width && this.data.height
      ? `${this.data.width} × ${this.data.height} px`
      : "Indisponibles";
  readonly modifiedLabel = formatImageDate(this.data.lastModified);
  readonly sizeLabel = signal("Calcul…");
  readonly typeLabel = signal(imageTypeLabel(this.data.src));

  ngOnInit() {
    void this.resolveFileInformation();
  }

  private async resolveFileInformation() {
    const resourceUrl = new URL(this.data.src, document.baseURI).href;
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
          this.typeLabel.set(imageTypeLabel(resourceUrl, response.headers.get("content-type")));
        }
      } catch {}
    }

    this.sizeLabel.set(bytes ? formatByteSize(bytes) : "Indisponible");
  }
}

@Component({
  selector: "site-image-preview-dialog",
  standalone: true,
  imports: [
    MatDialogModule,
    CdkPortal,
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
          <mat-icon matMenuItemIcon aria-hidden="true">{{ shareActionIcon() }}</mat-icon>
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

        <button
          mat-menu-item
          type="button"
          class="site-image-dialog-menu-item"
          (click)="openInformation()"
        >
          <mat-icon matMenuItemIcon aria-hidden="true">{{ infoIcon }}</mat-icon>
          <span>Informations</span>
        </button>
      </mat-menu>

      <ng-template cdkPortal>
        <mat-toolbar
          class="site-image-dialog-toolbar"
          [class.is-hidden]="!controlsVisible()"
          [class.is-closing]="isClosing()"
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
            class="site-image-dialog-button site-image-dialog-fullscreen-exit-button"
            aria-label="Quitter le plein écran"
            matTooltip="Quitter le plein écran"
            matTooltipPosition="below"
            (click)="handleFullscreenClick()"
          >
            <mat-icon aria-hidden="true">{{ fullscreenExitIcon }}</mat-icon>
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
      </ng-template>
    </section>
  `,
  styles: `
    .site-image-dialog-backdrop {
      background: color-mix(in srgb, var(--m3-scrim) 68%, transparent);
      -webkit-backdrop-filter: blur(2px);
      backdrop-filter: blur(2px);
    }

    html.site-image-dialog-fullscreen-document,
    html.site-image-dialog-fullscreen-document body {
      background: #000;
    }

    html.site-image-dialog-fullscreen-document.cdk-global-scrollblock {
      overflow-y: hidden !important;
      scrollbar-gutter: auto;
    }

    html.site-image-dialog-fullscreen-document body {
      overflow-y: hidden;
    }

    .site-image-dialog-fullscreen-host {
      position: fixed;
      inset: 0;
      z-index: 1000;
      pointer-events: none;
    }

    .site-image-dialog-fullscreen-host:fullscreen,
    .site-image-dialog-fullscreen-host:-webkit-full-screen,
    .site-image-dialog-fullscreen-host.is-fullscreen-active {
      inset: 0 auto auto 0;
      width: 100vw;
      width: 100dvw;
      height: 100vh;
      height: 100dvh;
      background: #000;
    }

    .site-image-dialog-fullscreen-host:fullscreen > .cdk-overlay-container,
    .site-image-dialog-fullscreen-host:-webkit-full-screen > .cdk-overlay-container,
    .site-image-dialog-fullscreen-host.is-fullscreen-active > .cdk-overlay-container {
      position: absolute;
      inset: 0;
      display: block;
      width: 100%;
      height: 100%;
      background: #000;
    }

    .site-image-dialog-fullscreen-host.is-fullscreen-active .cdk-global-overlay-wrapper {
      inset: 0;
      width: 100%;
      height: 100%;
      background: #000;
    }

    .site-image-dialog-fullscreen-host.is-fullscreen-active
      .site-image-dialog-panel-fullscreen.cdk-overlay-pane {
      position: absolute !important;
      inset: 0 !important;
      width: 100vw !important;
      width: 100dvw !important;
      height: 100vh !important;
      height: 100dvh !important;
      max-width: 100vw !important;
      max-width: 100dvw !important;
      max-height: 100vh !important;
      max-height: 100dvh !important;
      margin: 0 !important;
      background: #000;
    }

    .site-image-dialog-fullscreen-host:fullscreen .site-image-dialog-backdrop,
    .site-image-dialog-fullscreen-host:-webkit-full-screen .site-image-dialog-backdrop,
    .site-image-dialog-fullscreen-host.is-fullscreen-active .site-image-dialog-backdrop {
      background: #000;
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
    }

    .site-image-dialog-panel.cdk-overlay-pane {
      max-width: calc(100vw - 2rem) !important;
      max-height: calc(100dvh - 2rem) !important;
    }

    .site-image-dialog-panel-fullscreen.cdk-overlay-pane,
    :fullscreen .site-image-dialog-panel.cdk-overlay-pane {
      width: 100vw !important;
      width: 100dvw !important;
      height: 100vh !important;
      height: 100dvh !important;
      max-width: 100vw !important;
      max-width: 100dvw !important;
      max-height: 100vh !important;
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
      width: 100dvw;
      height: 100vh;
      height: 100dvh;
      max-width: none;
      max-height: none;
      border-radius: 0;
      background: #000;
    }

    .site-image-dialog-toolbar.mat-toolbar {
      --image-dialog-toolbar-height: 3.5rem;
      --mat-toolbar-container-background-color: var(--m3-surface-container);
      --mat-toolbar-container-text-color: var(--site-muted);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1rem;
      position: static;
      margin: 0;
      width: max-content;
      max-width: calc(100vw - 2rem);
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
        opacity 160ms var(--ease-out-3),
        transform 160ms var(--ease-out-3);
      pointer-events: auto;
      will-change: opacity, transform;
      z-index: auto;
    }

    .site-image-dialog-toolbar-overlay.cdk-overlay-pane {
      position: fixed !important;
      top: max(1rem, env(safe-area-inset-top, 0px)) !important;
      right: max(1rem, env(safe-area-inset-right, 0px)) !important;
      bottom: auto !important;
      left: auto !important;
      width: max-content;
      max-width: calc(100vw - 2rem);
      height: auto;
      transform: none !important;
      pointer-events: auto;
      z-index: 1001;
    }

    .site-image-dialog-toolbar-host.cdk-global-overlay-wrapper {
      position: fixed !important;
      inset: 0 !important;
      display: block !important;
      width: 100% !important;
      height: 100% !important;
      pointer-events: none !important;
      z-index: 2147483647 !important;
    }

    .site-image-dialog-toolbar-host .site-image-dialog-toolbar-overlay.cdk-overlay-pane {
      pointer-events: auto;
      z-index: 2147483647;
    }

    .site-image-dialog-toolbar.mat-toolbar.is-hidden {
      opacity: 0;
      pointer-events: none;
      transform: translateY(-0.45rem);
    }

    .site-image-dialog-toolbar.mat-toolbar.is-closing {
      transition-duration: 75ms;
      transition-timing-function: linear;
    }

    .site-image-dialog-button.mat-mdc-icon-button {
      --mat-icon-button-icon-color: var(--site-muted);
      --mat-icon-button-state-layer-color: var(--site-muted);
      color: var(--site-muted);
      touch-action: manipulation;
    }

    .site-image-dialog-fullscreen-exit-button.mat-mdc-icon-button {
      display: none;
    }

    .site-image-dialog-shell.is-fullscreen-mode
      .site-image-dialog-fullscreen-exit-button.mat-mdc-icon-button,
    .site-image-dialog-fullscreen-host:fullscreen
      .site-image-dialog-fullscreen-exit-button.mat-mdc-icon-button,
    .site-image-dialog-fullscreen-host:-webkit-full-screen
      .site-image-dialog-fullscreen-exit-button.mat-mdc-icon-button,
    :fullscreen .site-image-dialog-fullscreen-exit-button.mat-mdc-icon-button {
      display: inline-flex;
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
      object-position: center center;
      background: var(--m3-surface-container-high);
      border-radius: 0;
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
    .site-image-dialog-fullscreen-host:fullscreen .site-image-dialog-content.mat-mdc-dialog-content,
    .site-image-dialog-fullscreen-host:-webkit-full-screen
      .site-image-dialog-content.mat-mdc-dialog-content,
    :fullscreen .site-image-dialog-content.mat-mdc-dialog-content {
      width: 100vw;
      width: 100dvw;
      height: 100vh;
      height: 100dvh;
      max-width: none;
      max-height: none;
      background: #000;
    }

    .site-image-dialog-shell.is-fullscreen-mode .site-image-dialog-image,
    .site-image-dialog-shell:fullscreen .site-image-dialog-image,
    .site-image-dialog-fullscreen-host:fullscreen .site-image-dialog-image,
    .site-image-dialog-fullscreen-host:-webkit-full-screen .site-image-dialog-image,
    :fullscreen .site-image-dialog-image {
      width: auto;
      max-width: 100vw;
      max-width: 100dvw;
      height: auto;
      max-height: 100vh;
      max-height: 100dvh;
      object-fit: contain;
      object-position: center center;
      background: #000;
      border-radius: 0;
      box-shadow: none;
    }

    .site-image-dialog-shell.is-fullscreen-mode:not(.has-visible-controls)
      .site-image-dialog-content.mat-mdc-dialog-content,
    .site-image-dialog-shell:fullscreen:not(.has-visible-controls)
      .site-image-dialog-content.mat-mdc-dialog-content,
    :fullscreen
      .site-image-dialog-shell:not(.has-visible-controls)
      .site-image-dialog-content.mat-mdc-dialog-content {
      height: 100%;
      max-height: 100%;
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
      .site-image-dialog-panel.cdk-overlay-pane,
      .site-image-dialog-image {
        max-width: calc(
          100vw - 1rem - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)
        ) !important;
      }

      .site-image-dialog-toolbar.mat-toolbar {
        --image-dialog-toolbar-height: 3.25rem;
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
      .site-image-dialog-fullscreen-host:fullscreen .site-image-dialog-image,
      .site-image-dialog-fullscreen-host:-webkit-full-screen .site-image-dialog-image,
      :fullscreen .site-image-dialog-image {
        width: auto;
        max-width: 100vw !important;
        max-width: 100dvw !important;
        height: auto;
        max-height: 100vh !important;
        max-height: 100dvh !important;
      }
    }
  `,
})
export class ImagePreviewDialogComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly data = inject<ImagePreviewDialogData>(MAT_DIALOG_DATA);
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef = inject(MatDialogRef<ImagePreviewDialogComponent>);
  private readonly document = inject(DOCUMENT);
  private readonly overlay = inject(Overlay);
  private readonly overlayContainer = inject(OverlayContainer);
  private readonly snackBar = inject(MatSnackBar);
  private readonly toolbarPortal = viewChild.required(CdkPortal);
  private readonly tooltips = viewChildren(MatTooltip);

  readonly closeIcon = CLOSE_ICON;
  readonly controlsVisible = signal(true);
  readonly downloadIcon = DOWNLOAD_ICON;
  readonly fullscreenExitIcon = FULLSCREEN_EXIT_ICON;
  readonly fullscreenIcon = computed(() =>
    this.isFullscreen() ? FULLSCREEN_EXIT_ICON : FULLSCREEN_ICON,
  );
  readonly infoIcon = INFO_ICON;
  readonly moreIcon = MORE_ICON;
  readonly nextIcon = NEXT_ICON;
  readonly previousIcon = PREVIOUS_ICON;
  readonly shareActionIcon = computed(() => (this.shareCopied() ? CHECK_ICON : SHARE_ICON));
  readonly shareLabel = signal("Partager");
  readonly shareCopied = signal(false);
  readonly isFullscreen = signal(false);
  readonly fullscreenAvailable = signal(
    typeof document !== "undefined" && this.isFullscreenSupported(),
  );
  readonly imageMotion = signal<ImageMotion | null>(null);
  readonly isClosing = signal(false);
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
  private overlayContainerElement?: HTMLElement;
  private toolbarOverlayRef?: OverlayRef;
  private fullscreenHostElement?: HTMLDivElement;

  private readonly handleFullscreenChange = () => {
    const fullscreenElement = this.getFullscreenElement();
    const isFullscreen = Boolean(fullscreenElement) || this.fullscreenFallback;
    this.setFullscreenLayout(isFullscreen);
  };

  private readonly handleGlobalKeydown = (event: KeyboardEvent) => {
    if (
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      this.dialog.openDialogs.some((dialogRef) => dialogRef.id === IMAGE_INFORMATION_DIALOG_ID) ||
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
    this.document.addEventListener("webkitfullscreenchange", this.handleFullscreenChange);
    this.document.addEventListener("keydown", this.handleGlobalKeydown);
    this.dialogRef.beforeClosed().subscribe(() => this.beginCloseAnimation());
    this.preloadAdjacentImages();
  }

  ngAfterViewInit() {
    this.overlayContainerElement = this.overlayContainer.getContainerElement();
    this.fullscreenHostElement = this.document.createElement("div");
    this.fullscreenHostElement.classList.add(IMAGE_DIALOG_FULLSCREEN_HOST_CLASS);
    this.overlayContainerElement.parentElement?.insertBefore(
      this.fullscreenHostElement,
      this.overlayContainerElement,
    );
    this.fullscreenHostElement.appendChild(this.overlayContainerElement);
    this.toolbarOverlayRef = this.overlay.create({
      panelClass: "site-image-dialog-toolbar-overlay",
      positionStrategy: this.overlay.position().global().top("0").right("0"),
      scrollStrategy: this.overlay.scrollStrategies.noop(),
    });
    this.toolbarOverlayRef.hostElement.classList.add("site-image-dialog-toolbar-host");
    this.fullscreenHostElement.appendChild(this.toolbarOverlayRef.hostElement);
    this.toolbarOverlayRef.attach(this.toolbarPortal());
  }

  ngOnDestroy() {
    if (typeof document === "undefined") return;

    this.document.removeEventListener("fullscreenchange", this.handleFullscreenChange);
    this.document.removeEventListener("webkitfullscreenchange", this.handleFullscreenChange);
    this.document.removeEventListener("keydown", this.handleGlobalKeydown);
    if (this.imageMotionTimer) window.clearTimeout(this.imageMotionTimer);
    if (this.shareLabelTimer) window.clearTimeout(this.shareLabelTimer);
    this.clearTapTimer();
    this.hideTooltip();
    this.toolbarOverlayRef?.dispose();
    const overlayContainerElement = this.overlayContainerElement;
    const fullscreenHostElement = this.fullscreenHostElement;
    void this.exitFullscreen().finally(() => {
      if (overlayContainerElement && fullscreenHostElement?.parentElement) {
        fullscreenHostElement.parentElement.insertBefore(
          overlayContainerElement,
          fullscreenHostElement,
        );
      }
      fullscreenHostElement?.remove();
    });
  }

  previous() {
    this.goTo(this.currentIndex() - 1, "previous");
  }

  next() {
    this.goTo(this.currentIndex() + 1, "next");
  }

  close() {
    this.beginCloseAnimation();
    this.hideTooltip();
    void this.exitFullscreen().finally(() => this.dialogRef.close());
  }

  async toggleFullscreen() {
    this.hideTooltip();

    if (this.getFullscreenElement() || this.fullscreenFallback) {
      await this.exitFullscreen();
      return;
    }

    this.setFullscreenLayout(true);

    try {
      const fullscreenHost = this.fullscreenHostElement;
      if (!fullscreenHost) throw new Error("fullscreen_unavailable");

      if (fullscreenHost.requestFullscreen) {
        await fullscreenHost.requestFullscreen();
      } else {
        const webkitFullscreenHost = fullscreenHost as WebkitFullscreenElement;
        if (!webkitFullscreenHost.webkitRequestFullscreen) {
          throw new Error("fullscreen_unavailable");
        }
        await webkitFullscreenHost.webkitRequestFullscreen();
      }
    } catch {
      this.fullscreenFallback = true;
      this.setFullscreenLayout(true);
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

  openInformation() {
    this.hideTooltip();
    const item = this.current();
    const previewImage = this.document.querySelector<HTMLImageElement>(".site-image-dialog-image");

    this.dialog.open(ImageInformationDialogComponent, {
      id: IMAGE_INFORMATION_DIALOG_ID,
      ariaLabel: `Informations sur l'image : ${item.label}`,
      autoFocus: false,
      backdropClass: "site-image-dialog-backdrop",
      data: {
        createdAt: item.createdAt,
        height: previewImage?.naturalHeight || item.height,
        lastModified: item.lastModified,
        name: item.alt?.trim() || item.label || fileNameFromURL(item.src, this.document.baseURI),
        src: item.src,
        width: previewImage?.naturalWidth || item.width,
      } satisfies ImageInformationDialogData,
      maxWidth: "calc(100vw - 2rem)",
      panelClass: "site-image-information-dialog-panel",
      restoreFocus: true,
    });
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

  private beginCloseAnimation() {
    if (this.isClosing()) return;

    this.isClosing.set(true);
    this.controlsVisible.set(false);
  }

  private async exitFullscreen() {
    if (!this.getFullscreenElement()) {
      this.fullscreenFallback = false;
      this.setFullscreenLayout(false);
      return;
    }

    try {
      if (this.document.exitFullscreen) {
        await this.document.exitFullscreen();
      } else {
        await (this.document as WebkitFullscreenDocument).webkitExitFullscreen?.();
      }
    } catch {}

    this.fullscreenFallback = false;
    this.setFullscreenLayout(false);
  }

  private restoreDialogSize() {
    this.dialogRef.removePanelClass("site-image-dialog-panel-fullscreen");
    this.dialogRef.updateSize("", "");
  }

  private getFullscreenElement() {
    const webkitDocument = this.document as WebkitFullscreenDocument;
    return this.document.fullscreenElement ?? webkitDocument.webkitFullscreenElement ?? null;
  }

  private isFullscreenSupported() {
    const webkitDocument = this.document as WebkitFullscreenDocument;
    return Boolean(this.document.fullscreenEnabled || webkitDocument.webkitFullscreenEnabled);
  }

  private setFullscreenLayout(active: boolean) {
    this.isFullscreen.set(active);
    this.document.documentElement.classList.toggle(IMAGE_DIALOG_FULLSCREEN_DOCUMENT_CLASS, active);
    this.fullscreenHostElement?.classList.toggle(IMAGE_DIALOG_FULLSCREEN_ACTIVE_CLASS, active);

    if (active) {
      this.controlsVisible.set(true);
      if (this.fullscreenHostElement && this.toolbarOverlayRef) {
        this.fullscreenHostElement.appendChild(this.toolbarOverlayRef.hostElement);
      }
      this.dialogRef.addPanelClass("site-image-dialog-panel-fullscreen");
      this.dialogRef.updateSize("100%", "100%");
    } else {
      this.restoreDialogSize();
    }
  }

  private hideTooltip() {
    this.tooltips().forEach((tooltip) => tooltip.hide(0));
    this.document.dispatchEvent(new CustomEvent(SITE_EVENTS.tooltipHide));
  }

  private setShareFeedback(message: string) {
    this.shareCopied.set(message === "Lien copié");
    this.shareLabel.set(message);
    this.snackBar.open(message, undefined, {
      duration: SHARE_FEEDBACK_DURATION_MS,
      horizontalPosition: "center",
      verticalPosition: "bottom",
    });
    if (this.shareLabelTimer) window.clearTimeout(this.shareLabelTimer);
    this.shareLabelTimer = window.setTimeout(() => {
      this.shareCopied.set(false);
      this.shareLabel.set("Partager");
    }, SHARE_FEEDBACK_DURATION_MS);
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
