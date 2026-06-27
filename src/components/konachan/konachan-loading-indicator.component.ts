import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";
import { MatProgressSpinner } from "@angular/material/progress-spinner";
import { SimulatedLoadingProgress } from "@/lib/simulated-loading-progress";
import { SITE_EVENTS } from "@/lib/site-contracts";

@Component({
  selector: "site-konachan-loading-indicator",
  standalone: true,
  imports: [MatProgressSpinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[class.is-busy]": "busy()",
    "[attr.aria-hidden]": "busy() ? null : 'true'",
  },
  template: `
    @if (busy()) {
      <span class="home-anime-loading" role="status" aria-label="Chargement de l'image Konachan">
        <mat-progress-spinner
          mode="indeterminate"
          diameter="48"
          strokeWidth="4"
          aria-label="Chargement de l'image Konachan"
        ></mat-progress-spinner>
        <span class="sr-only">Chargement de l'image Konachan</span>
      </span>
    }
  `,
  styles: `
    :host {
      position: absolute;
      inset: 0;
      z-index: 2;
      display: none;
      place-items: center;
      pointer-events: none;
    }

    :host.is-busy {
      display: grid;
    }

    .home-anime-loading {
      display: grid;
      place-items: center;
      padding: 0.75rem;
      border-radius: var(--mat-sys-corner-full);
      background: rgb(0 0 0 / 62%);
      color: #fff;
      box-shadow: var(--mat-sys-level2);
      --mat-progress-spinner-active-indicator-color: #fff;
    }
  `,
})
export class KonachanLoadingIndicatorComponent implements OnInit, OnDestroy {
  readonly busy = signal(false);
  private readonly loadingProgress = new SimulatedLoadingProgress();
  readonly progress = this.loadingProgress.value;

  private readonly handleRefreshState = (event: Event) => {
    const busy = (event as CustomEvent<{ busy?: boolean }>).detail?.busy;
    if (typeof busy !== "boolean" || busy === this.busy()) return;

    if (busy) this.loadingProgress.start();
    else this.loadingProgress.complete();
    this.busy.set(busy);
  };

  ngOnInit() {
    if (typeof document === "undefined") return;
    const busy =
      document.querySelector(".home-anime-landing")?.getAttribute("aria-busy") === "true";
    if (busy) this.loadingProgress.start();
    this.busy.set(busy);
    document.addEventListener(SITE_EVENTS.konachanRefreshState, this.handleRefreshState);
  }

  ngOnDestroy() {
    if (typeof document === "undefined") return;
    document.removeEventListener(SITE_EVENTS.konachanRefreshState, this.handleRefreshState);
    this.loadingProgress.destroy();
  }
}
