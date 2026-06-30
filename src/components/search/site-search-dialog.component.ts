import { ChangeDetectionStrategy, Component, ViewEncapsulation } from "@angular/core";
import { MatIconButton } from "@angular/material/button";
import { MatDialogModule } from "@angular/material/dialog";
import { MatIcon } from "@angular/material/icon";
import { SiteSearchPanelComponent } from "./site-search-panel.component";

@Component({
  selector: "site-search-dialog",
  standalone: true,
  imports: [MatDialogModule, MatIcon, MatIconButton, SiteSearchPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="site-search-dialog-header">
      <h2 mat-dialog-title>Recherche</h2>
      <button matIconButton type="button" mat-dialog-close aria-label="Fermer la recherche">
        <mat-icon aria-hidden="true">{{ closeIcon }}</mat-icon>
      </button>
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
      background: var(--site-bg);
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
}
