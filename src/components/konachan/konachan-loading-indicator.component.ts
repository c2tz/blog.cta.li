import { CUSTOM_ELEMENTS_SCHEMA, ChangeDetectionStrategy, Component, signal } from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";
import { SITE_EVENTS } from "@/lib/site-contracts";

const LOADING_INDICATOR_DELAY_MS = 200;

@Component({
  selector: "site-konachan-loading-indicator",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[class.is-busy]": "visible()",
    "[attr.aria-hidden]": "visible() ? null : 'true'",
  },
  template: `
    @if (visible()) {
      <span class="home-anime-loading" role="status" aria-label="Chargement de l'image Konachan">
        <md-circular-progress
          class="home-anime-loading-progress"
          indeterminate
          four-color
          aria-label="Chargement de l'image Konachan"
        ></md-circular-progress>
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
    }

    .home-anime-loading-progress {
      --md-circular-progress-color: var(--md-sys-color-primary);
      --md-circular-progress-active-indicator-color: #fff;
      --md-circular-progress-active-indicator-width: 10;
      --md-circular-progress-size: 48px;
    }
  `,
})
export class KonachanLoadingIndicatorComponent implements OnInit, OnDestroy {
  readonly busy = signal(false);
  readonly visible = signal(false);
  private revealTimer = 0;

  private readonly handleRefreshState = (event: Event) => {
    const busy = (event as CustomEvent<{ busy?: boolean }>).detail?.busy;
    if (typeof busy !== "boolean" || busy === this.busy()) return;

    this.setBusy(busy);
  };

  ngOnInit() {
    if (typeof document === "undefined") return;
    const busy =
      document.querySelector(".home-anime-landing")?.getAttribute("aria-busy") === "true";
    this.setBusy(busy);
    document.addEventListener(SITE_EVENTS.konachanRefreshState, this.handleRefreshState);
  }

  ngOnDestroy() {
    if (typeof document === "undefined") return;
    document.removeEventListener(SITE_EVENTS.konachanRefreshState, this.handleRefreshState);
    this.hide();
  }

  private setBusy(busy: boolean) {
    this.busy.set(busy);
    if (!busy) {
      this.hide();
      return;
    }

    this.cancelReveal();
    this.revealTimer = window.setTimeout(() => {
      this.revealTimer = 0;
      if (this.busy()) this.visible.set(true);
    }, LOADING_INDICATOR_DELAY_MS);
  }

  private hide() {
    this.cancelReveal();
    this.visible.set(false);
  }

  private cancelReveal() {
    if (!this.revealTimer || typeof window === "undefined") return;
    window.clearTimeout(this.revealTimer);
    this.revealTimer = 0;
  }
}
