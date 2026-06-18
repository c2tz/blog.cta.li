import {
  ChangeDetectionStrategy,
  Component,
  signal,
} from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";

interface RefreshState {
  busy?: boolean;
  status?: string;
}

@Component({
  selector: "konachan-refresh-button",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="home-anime-refresh site-action-button site-tooltip"
      [disabled]="busy()"
      [class.is-rippling]="rippling()"
      [attr.aria-label]="busy() ? 'Image en cours de chargement' : 'Changer l\\'image'"
      [attr.data-tooltip]="busy() ? 'Image en cours de chargement' : 'Changer l\\'image'"
      (pointerdown)="startRipple($event)"
      (click)="refresh()"
    >
      <span class="site-action-button__clip" aria-hidden="true">
        <span class="site-action-button__state"></span>
        <span class="site-action-button__ripple"></span>
      </span>
      <svg aria-hidden="true" viewBox="0 -960 960 960" focusable="false">
        <path
          d="M480-120q-75 0-140.5-28.5t-114-77q-48.5-48.5-77-114T120-480q0-75 28.5-140.5t77-114q48.5-48.5 114-77T480-840q82 0 155.5 35T760-706v-94h80v240H600v-80h110q-41-56-101-88t-129-32q-117 0-198.5 81.5T200-480q0 117 81.5 198.5T480-200q93 0 168.5-54.5T755-397h82q-27 121-125 199T480-120Z"
        />
      </svg>
    </button>
    <span class="sr-only" role="status" aria-live="polite" data-konachan-status>
      {{ status() }}
    </span>
  `,
})
export class KonachanRefreshButtonComponent implements OnInit, OnDestroy {
  readonly busy = signal(false);
  readonly rippling = signal(false);
  readonly status = signal("");
  private rippleTimeout = 0;

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
    window.clearTimeout(this.rippleTimeout);
  }

  startRipple(event: PointerEvent) {
    if (this.busy()) return;

    const button = event.currentTarget as HTMLElement | null;
    const rect = button?.getBoundingClientRect();
    if (button && rect) {
      button.style.setProperty("--ripple-x", `${event.clientX - rect.left}px`);
      button.style.setProperty("--ripple-y", `${event.clientY - rect.top}px`);
    }

    this.rippling.set(false);
    requestAnimationFrame(() => {
      this.rippling.set(true);
      window.clearTimeout(this.rippleTimeout);
      this.rippleTimeout = window.setTimeout(() => this.rippling.set(false), 480);
    });
  }

  refresh() {
    if (this.busy() || typeof document === "undefined") return;

    document.dispatchEvent(new CustomEvent("site:tooltip-hide"));
    document.dispatchEvent(new CustomEvent("konachan:refresh-request"));
  }
}
