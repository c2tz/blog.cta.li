import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";
import { MatIconButton } from "@angular/material/button";
import { MatDialog } from "@angular/material/dialog";
import { MatIcon } from "@angular/material/icon";
import { MatTooltip } from "@angular/material/tooltip";

type SearchDialogModule = typeof import("./site-search-dialog.component");

@Component({
  selector: "site-search-trigger",
  standalone: true,
  imports: [MatIcon, MatIconButton, MatTooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      matIconButton
      type="button"
      class="site-search-trigger-button"
      matTooltip="Rechercher"
      matTooltipPosition="below"
      aria-label="Rechercher"
      aria-haspopup="dialog"
      [disabled]="opening()"
      [attr.aria-busy]="opening()"
      (click)="open($event)"
      (focusin)="preload()"
      (pointerenter)="preload()"
    >
      <mat-icon aria-hidden="true">{{ searchIcon }}</mat-icon>
    </button>
  `,
  styles: `
    :host {
      display: block;
      width: 2.5rem;
      height: 2.5rem;
      flex: 0 0 2.5rem;
    }
  `,
})
export class SiteSearchTriggerComponent implements OnInit, OnDestroy {
  readonly searchIcon = "\uE8B6";
  readonly opening = signal(false);

  private readonly dialog = inject(MatDialog);
  private preloadRequest?: number | ReturnType<typeof setTimeout>;
  private preloadRequestKind: "idle" | "timeout" = "timeout";
  private searchDialogModule?: Promise<SearchDialogModule>;

  ngOnInit() {
    if (typeof window === "undefined") return;

    this.preloadRequest = this.scheduleIdlePreload(() => {
      this.preloadRequest = undefined;
      void this.preload();
    });
  }

  ngOnDestroy() {
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

    this.opening.set(true);

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
      this.opening.set(false);
    }
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
