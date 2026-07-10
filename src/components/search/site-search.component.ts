import {
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";

type SearchDialogModule = typeof import("./site-search-dialog.component");
const LOADING_INDICATOR_DELAY_MS = 200;

@Component({
  selector: "site-search-trigger",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <md-icon-button
      type="button"
      class="site-search-trigger-button"
      title="Rechercher"
      aria-label="Rechercher"
      aria-haspopup="dialog"
      [disabled]="opening()"
      [attr.aria-busy]="opening()"
      (click)="open($event)"
      (focusin)="preload()"
      (pointerenter)="preload()"
    >
      @if (openingIndicatorVisible()) {
        <md-circular-progress
          class="site-search-trigger-progress"
          indeterminate
          aria-hidden="true"
        ></md-circular-progress>
      } @else {
        <md-icon aria-hidden="true">{{ searchIcon }}</md-icon>
      }
    </md-icon-button>
  `,
  styles: `
    :host {
      display: block;
      width: 2.5rem;
      height: 2.5rem;
      flex: 0 0 2.5rem;
    }

    .site-search-trigger-progress {
      --md-circular-progress-color: var(--md-sys-color-on-surface-variant);
      --md-circular-progress-active-indicator-color: var(--md-sys-color-on-surface-variant);
      --md-circular-progress-active-indicator-width: 12;
      --md-circular-progress-size: 24px;
    }
  `,
})
export class SiteSearchTriggerComponent implements OnInit, OnDestroy {
  readonly searchIcon = "\uE8B6";
  readonly opening = signal(false);
  readonly openingIndicatorVisible = signal(false);

  private readonly dialog = inject(MatDialog);
  private preloadRequest?: number | ReturnType<typeof setTimeout>;
  private preloadRequestKind: "idle" | "timeout" = "timeout";
  private searchDialogModule?: Promise<SearchDialogModule>;
  private openingIndicatorTimer = 0;

  ngOnInit() {
    if (typeof window === "undefined") return;

    this.preloadRequest = this.scheduleIdlePreload(() => {
      this.preloadRequest = undefined;
      void this.preload();
    });
  }

  ngOnDestroy() {
    this.endOpening();
    if (typeof window === "undefined" || this.preloadRequest === undefined) return;

    if (this.preloadRequestKind === "idle") {
      window.cancelIdleCallback(this.preloadRequest as number);
    } else {
      clearTimeout(this.preloadRequest);
    }
  }

  preload() {
    this.searchDialogModule ??= import("./site-search-dialog.component").catch((error) => {
      this.searchDialogModule = undefined;
      throw error;
    });

    return this.searchDialogModule;
  }

  async open(event: MouseEvent) {
    event.preventDefault();
    if (this.opening()) return;

    this.beginOpening();

    try {
      const { SiteSearchDialogComponent } = await this.preload();

      this.dialog.open(SiteSearchDialogComponent, {
        ariaLabel: "Recherche",
        autoFocus: false,
        maxWidth: "calc(100vw - 2rem)",
        panelClass: "site-search-dialog-panel",
        restoreFocus: true,
        width: "min(50rem, calc(100vw - 2rem))",
      });
    } finally {
      this.endOpening();
    }
  }

  private beginOpening() {
    this.opening.set(true);
    this.cancelOpeningIndicatorTimer();
    this.openingIndicatorTimer = window.setTimeout(() => {
      this.openingIndicatorTimer = 0;
      if (this.opening()) this.openingIndicatorVisible.set(true);
    }, LOADING_INDICATOR_DELAY_MS);
  }

  private endOpening() {
    this.opening.set(false);
    this.cancelOpeningIndicatorTimer();
    this.openingIndicatorVisible.set(false);
  }

  private cancelOpeningIndicatorTimer() {
    if (!this.openingIndicatorTimer || typeof window === "undefined") return;
    window.clearTimeout(this.openingIndicatorTimer);
    this.openingIndicatorTimer = 0;
  }

  private scheduleIdlePreload(callback: () => void) {
    if ("requestIdleCallback" in window) {
      this.preloadRequestKind = "idle";
      return window.requestIdleCallback(callback, { timeout: 2500 });
    }

    this.preloadRequestKind = "timeout";
    return setTimeout(callback, 1200);
  }
}
