import {
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  inject,
} from "@angular/core";
import { MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { SiteSearchPanelComponent } from "./site-search-panel.component";

@Component({
  selector: "site-search-dialog",
  standalone: true,
  imports: [MatDialogModule, SiteSearchPanelComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="site-search-dialog-header">
      <h2 mat-dialog-title>Recherche</h2>
      <md-icon-button
        type="button"
        title="Fermer la recherche"
        aria-label="Fermer la recherche"
        (click)="close()"
      >
        <md-icon aria-hidden="true">{{ closeIcon }}</md-icon>
      </md-icon-button>
    </div>

    <mat-dialog-content>
      <site-search-panel />
    </mat-dialog-content>
  `,
  styles: `
    .site-search-dialog-panel .mat-mdc-dialog-container,
    .site-search-dialog-panel .mat-mdc-dialog-surface {
      border-radius: var(--image-radius);
    }

    .site-search-dialog-panel .mat-mdc-dialog-container {
      max-height: inherit;
    }

    .site-search-dialog-panel .mat-mdc-dialog-surface {
      background: var(--m3-surface-container-low);
      color: var(--site-text);
      overflow: hidden;
    }

    .site-search-dialog-panel .mat-mdc-dialog-content {
      max-height: min(72vh, 42rem);
      overflow: auto;
      overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch;
    }

    .site-search-dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding-inline-end: 0.75rem;
    }

    .site-search-dialog-header [mat-dialog-title] {
      margin: 0;
      font-family: var(--site-heading-font);
    }

    .site-search-dialog-header md-icon-button {
      --md-icon-button-icon-color: var(--site-muted);
      --md-icon-button-hover-icon-color: var(--site-text);
      --md-icon-button-focus-icon-color: var(--site-text);
      --md-icon-button-pressed-icon-color: var(--site-text);
      --md-icon-button-hover-state-layer-color: var(--site-muted);
      --md-icon-button-focus-state-layer-color: var(--site-muted);
      --md-icon-button-pressed-state-layer-color: var(--site-muted);
      flex: 0 0 auto;
    }

    @media (max-width: 720px), (pointer: coarse) {
      .site-search-dialog-panel.cdk-overlay-pane {
        position: fixed !important;
        top: calc(0.75rem + env(safe-area-inset-top, 0px)) !important;
        right: calc(0.75rem + env(safe-area-inset-right, 0px)) !important;
        left: calc(0.75rem + env(safe-area-inset-left, 0px)) !important;
        width: auto !important;
        max-width: none !important;
        max-height: calc(
          100dvh - 1.5rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)
        ) !important;
        transform: none !important;
      }

      .site-search-dialog-panel .mat-mdc-dialog-container,
      .site-search-dialog-panel .mat-mdc-dialog-surface {
        max-height: inherit;
      }

      .site-search-dialog-panel .mat-mdc-dialog-content {
        max-height: calc(
          100dvh - 7.5rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px)
        );
      }
    }
  `,
})
export class SiteSearchDialogComponent {
  readonly closeIcon = "\uE5CD";

  private readonly dialogRef = inject(MatDialogRef<SiteSearchDialogComponent>);

  close() {
    this.dialogRef.close();
  }
}
