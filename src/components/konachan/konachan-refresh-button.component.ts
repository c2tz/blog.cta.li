import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";
import { MatIconButton } from "@angular/material/button";
import { MatIcon } from "@angular/material/icon";
import { MatProgressSpinner } from "@angular/material/progress-spinner";
import { MatTooltip } from "@angular/material/tooltip";
import { SITE_EVENTS } from "@/lib/site-contracts";

interface RefreshState {
  busy?: boolean;
  loaded?: boolean;
  status?: string;
}

@Component({
  selector: "site-konachan-refresh-button",
  standalone: true,
  imports: [MatIconButton, MatIcon, MatProgressSpinner, MatTooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      matIconButton
      type="button"
      class="home-anime-refresh"
      [disabled]="busy()"
      [attr.aria-busy]="busy()"
      [attr.aria-label]="buttonLabel()"
      [matTooltip]="buttonLabel()"
      matTooltipPosition="below"
      (click)="refresh()"
    >
      @if (busy()) {
        <mat-progress-spinner
          class="home-anime-refresh-spinner"
          mode="indeterminate"
          diameter="24"
          strokeWidth="3"
          aria-hidden="true"
        />
      } @else {
        <mat-icon aria-hidden="true">&#xE5D5;</mat-icon>
      }
    </button>
    <span class="sr-only" role="status" aria-live="polite" data-konachan-status>
      {{ status() }}
    </span>
  `,
  styles: `
    .home-anime-refresh.mat-mdc-icon-button {
      --mat-icon-button-disabled-icon-color: #fff;
      --mdc-icon-button-disabled-icon-color: #fff;
    }

    .home-anime-refresh.mat-mdc-icon-button:disabled {
      color: #fff;
      opacity: 0.92;
    }

    .home-anime-refresh-spinner {
      display: inline-flex;
      color: currentColor;
      --mat-progress-spinner-active-indicator-color: currentColor;
      --mdc-circular-progress-active-indicator-color: currentColor;
    }
  `,
})
export class KonachanRefreshButtonComponent implements OnInit, OnDestroy {
  readonly busy = signal(false);
  readonly loaded = signal(false);
  readonly status = signal("");
  readonly buttonLabel = computed(() => {
    if (this.busy()) return "Image Konachan en cours de chargement";

    return this.loaded() ? "Changer l'image Konachan" : "Afficher une image Konachan";
  });

  private readonly handleRefreshState = (event: Event) => {
    const detail = (event as CustomEvent<RefreshState>).detail ?? {};

    if (typeof detail.busy === "boolean") this.busy.set(detail.busy);
    if (typeof detail.loaded === "boolean") this.loaded.set(detail.loaded);
    if (typeof detail.status === "string") this.status.set(detail.status);
  };

  ngOnInit() {
    if (typeof document === "undefined") return;
    this.loaded.set(
      document.querySelector("[data-konachan-background]")?.getAttribute("data-loaded") ===
        "true",
    );
    document.addEventListener(SITE_EVENTS.konachanRefreshState, this.handleRefreshState);
  }

  ngOnDestroy() {
    if (typeof document === "undefined") return;
    document.removeEventListener(SITE_EVENTS.konachanRefreshState, this.handleRefreshState);
  }

  refresh() {
    if (this.busy() || typeof document === "undefined") return;

    document.dispatchEvent(new CustomEvent(SITE_EVENTS.tooltipHide));
    document.dispatchEvent(new CustomEvent(SITE_EVENTS.konachanRefreshRequest));
  }
}
