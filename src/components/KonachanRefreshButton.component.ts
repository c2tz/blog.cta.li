import {
  ChangeDetectionStrategy,
  Component,
  signal,
} from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";

interface RefreshState {
  busy?: boolean;
  status?: string;
}

const REFRESH_ICON_PATH =
  "M480-120q-75 0-140.5-28.5t-114-77q-48.5-48.5-77-114T120-480q0-75 28.5-140.5t77-114q48.5-48.5 114-77T480-840q82 0 155.5 35T760-706v-94h80v240H600v-80h110q-41-56-101-88t-129-32q-117 0-198.5 81.5T200-480q0 117 81.5 198.5T480-200q93 0 168.5-54.5T755-397h82q-27 121-125 199T480-120Z";

@Component({
  selector: "konachan-refresh-button",
  standalone: true,
  imports: [MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      matMiniFab
      type="button"
      class="home-anime-refresh site-action-button site-tooltip"
      [disabled]="busy()"
      [attr.aria-label]="busy() ? 'Image en cours de chargement' : 'Changer l\\'image'"
      [attr.data-tooltip]="busy() ? 'Image en cours de chargement' : 'Changer l\\'image'"
      data-tooltip-placement="bottom"
      (click)="refresh()"
    >
      <svg matButtonIcon aria-hidden="true" viewBox="0 -960 960 960" focusable="false">
        <path d="${REFRESH_ICON_PATH}"></path>
      </svg>
    </button>
    <span class="sr-only" role="status" aria-live="polite" data-konachan-status>
      {{ status() }}
    </span>
  `,
})
export class KonachanRefreshButtonComponent implements OnInit, OnDestroy {
  readonly busy = signal(false);
  readonly status = signal("");

  private readonly handleRefreshState = (event: Event) => {
    const detail = (event as CustomEvent<RefreshState>).detail ?? {};

    if (typeof detail.busy === "boolean") this.busy.set(detail.busy);
    if (typeof detail.status === "string") this.status.set(detail.status);
  };

  ngOnInit() {
    if (typeof document === "undefined") return;
    document.addEventListener("konachan:refresh-state", this.handleRefreshState);
  }

  ngOnDestroy() {
    if (typeof document === "undefined") return;
    document.removeEventListener("konachan:refresh-state", this.handleRefreshState);
  }

  refresh() {
    if (this.busy() || typeof document === "undefined") return;

    document.dispatchEvent(new CustomEvent("site:tooltip-hide"));
    document.dispatchEvent(new CustomEvent("konachan:refresh-request"));
  }
}
