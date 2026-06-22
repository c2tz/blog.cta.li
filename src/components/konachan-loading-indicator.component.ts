import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";
import { MatProgressSpinner } from "@angular/material/progress-spinner";

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
      <span class="home-anime-loading" role="status" aria-label="Chargement de l'image">
        <mat-spinner diameter="48" strokeWidth="4" aria-hidden="true"></mat-spinner>
        <span class="sr-only">Chargement de l'image</span>
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

  private readonly handleRefreshState = (event: Event) => {
    const busy = (event as CustomEvent<{ busy?: boolean }>).detail?.busy;
    if (typeof busy === "boolean") this.busy.set(busy);
  };

  ngOnInit() {
    if (typeof document === "undefined") return;
    this.busy.set(
      document.querySelector(".home-anime-landing")?.getAttribute("aria-busy") === "true",
    );
    document.addEventListener("konachan:refresh-state", this.handleRefreshState);
  }

  ngOnDestroy() {
    if (typeof document === "undefined") return;
    document.removeEventListener("konachan:refresh-state", this.handleRefreshState);
  }
}
