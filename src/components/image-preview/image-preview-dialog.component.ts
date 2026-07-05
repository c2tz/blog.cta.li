import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogModule } from "@angular/material/dialog";

export interface ImagePreviewDialogData {
  alt?: string;
  height?: number;
  label: string;
  src: string;
  width?: number;
}

@Component({
  selector: "site-image-preview-dialog",
  standalone: true,
  imports: [MatDialogModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <mat-dialog-content class="site-image-dialog-content">
      <img
        class="site-image-dialog-image"
        [src]="data.src"
        [alt]="data.alt || data.label"
        [attr.width]="data.width || null"
        [attr.height]="data.height || null"
        decoding="async"
      />
    </mat-dialog-content>
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

    .site-image-dialog-panel .mat-mdc-dialog-container,
    .site-image-dialog-panel .mat-mdc-dialog-surface {
      max-width: inherit;
      max-height: inherit;
      border-radius: var(--image-radius);
      overflow: visible;
    }

    .site-image-dialog-panel .mat-mdc-dialog-surface {
      background: transparent;
      box-shadow: none;
    }

    .site-image-dialog-panel .site-image-dialog-content.mat-mdc-dialog-content {
      display: grid;
      place-items: center;
      max-width: inherit;
      max-height: inherit;
      margin: 0;
      padding: 0;
      overflow: visible;
    }

    .site-image-dialog-image {
      display: block;
      width: auto;
      max-width: calc(100vw - 2rem);
      height: auto;
      max-height: calc(100dvh - 2rem);
      object-fit: contain;
      border-radius: var(--image-radius);
      background: var(--m3-surface-container-high);
      box-shadow: 0 1.5rem 4rem rgb(0 0 0 / 42%);
    }

    @media (max-width: 720px), (pointer: coarse) {
      .site-image-dialog-panel.cdk-overlay-pane,
      .site-image-dialog-image {
        max-width: calc(
          100vw - 1rem - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)
        ) !important;
        max-height: calc(
          100dvh - 1rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)
        ) !important;
      }
    }
  `,
})
export class ImagePreviewDialogComponent {
  readonly data = inject<ImagePreviewDialogData>(MAT_DIALOG_DATA);
}
