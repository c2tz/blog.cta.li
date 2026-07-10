import {
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";
import { SITE_EVENTS } from "@/lib/site-contracts";

interface RefreshState {
  busy?: boolean;
  loaded?: boolean;
  status?: string;
}

@Component({
  selector: "site-konachan-refresh-button",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <md-icon-button
      type="button"
      class="home-anime-refresh"
      [disabled]="busy()"
      [attr.aria-busy]="busy()"
      [attr.aria-label]="buttonLabel()"
      [attr.title]="buttonLabel()"
      (click)="refresh()"
    >
      <md-icon aria-hidden="true">&#xE5D5;</md-icon>
    </md-icon-button>
    <span class="sr-only" role="status" aria-live="polite" data-konachan-status>
      {{ status() }}
    </span>
  `,
  styles: `
    .home-anime-refresh {
      --md-icon-button-disabled-icon-color: var(--home-hero-surface-label);
      --md-icon-button-disabled-icon-opacity: 0.92;
      --md-icon-button-focus-icon-color: var(--home-hero-surface-label);
      --md-icon-button-hover-icon-color: var(--home-hero-surface-label);
      --md-icon-button-hover-state-layer-color: var(--home-hero-surface-label);
      --md-icon-button-icon-color: var(--home-hero-surface-label);
      --md-icon-button-pressed-icon-color: var(--home-hero-surface-label);
      --md-icon-button-pressed-state-layer-color: var(--home-hero-surface-label);
    }
  `,
})
export class KonachanRefreshButtonComponent implements OnInit, OnDestroy {
  readonly busy = signal(false);
  readonly loaded = signal(false);
  readonly status = signal("");
  readonly buttonLabel = computed(() =>
    this.busy() ? "Actualisation de l'image en cours" : "Actualiser l'image",
  );

  private readonly handleRefreshState = (event: Event) => {
    const detail = (event as CustomEvent<RefreshState>).detail ?? {};

    if (typeof detail.busy === "boolean") this.busy.set(detail.busy);
    if (typeof detail.loaded === "boolean") this.loaded.set(detail.loaded);
    if (typeof detail.status === "string") this.status.set(detail.status);
  };

  ngOnInit() {
    if (typeof document === "undefined") return;
    this.loaded.set(
      document.querySelector("[data-konachan-background]")?.getAttribute("data-loaded") === "true",
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
