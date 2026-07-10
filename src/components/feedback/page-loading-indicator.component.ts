import { CUSTOM_ELEMENTS_SCHEMA, ChangeDetectionStrategy, Component, signal } from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";
import { SITE_EVENTS } from "@/lib/site-contracts";

interface LoadingEventDetail {
  key?: string;
}

const LOADING_INDICATOR_DELAY_MS = 200;

@Component({
  selector: "site-page-loading-indicator",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div class="site-page-loading" role="status" aria-live="polite" aria-label="Chargement">
        <md-circular-progress
          class="site-page-loading-progress"
          indeterminate
          four-color
          aria-label="Chargement de la page"
        ></md-circular-progress>
        <span class="sr-only">Chargement</span>
      </div>
    }
  `,
  styles: `
    .site-page-loading {
      position: fixed;
      inset: 0;
      z-index: 12000;
      display: grid;
      place-items: center;
      pointer-events: none;
      background: color-mix(in srgb, var(--site-bg) 72%, transparent);
    }

    .site-page-loading-progress {
      --md-circular-progress-color: var(--md-sys-color-primary);
      --md-circular-progress-active-indicator-color: var(--site-link);
      --md-circular-progress-active-indicator-width: 10;
      --md-circular-progress-size: 44px;
    }
  `,
})
export class PageLoadingIndicatorComponent implements OnInit, OnDestroy {
  readonly visible = signal(false);
  private readonly active = new Set<string>();
  private revealTimer = 0;

  private readonly handleLoad = () => this.end("page");
  private readonly handlePageShow = () => this.clear();

  private readonly handleStart = (event: Event) => {
    const key = (event as CustomEvent<LoadingEventDetail>).detail?.key ?? "global";
    this.start(key);
  };

  private readonly handleEnd = (event: Event) => {
    const key = (event as CustomEvent<LoadingEventDetail>).detail?.key ?? "global";
    this.end(key);
  };

  private readonly handleDocumentClick = (event: MouseEvent) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const target =
      event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
    if (!target || target.target || target.hasAttribute("download")) return;

    const url = new URL(target.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    if (url.pathname === location.pathname && url.search === location.search && url.hash) return;
    this.start("navigation");
  };

  ngOnInit() {
    if (typeof window === "undefined") return;

    if (document.readyState !== "complete") this.start("page");
    else this.clear();
    window.addEventListener("load", this.handleLoad, { once: true });
    window.addEventListener("pageshow", this.handlePageShow);
    document.addEventListener("click", this.handleDocumentClick);
    document.addEventListener(SITE_EVENTS.loadingStart, this.handleStart);
    document.addEventListener(SITE_EVENTS.loadingEnd, this.handleEnd);
  }

  ngOnDestroy() {
    if (typeof window === "undefined") return;

    window.removeEventListener("load", this.handleLoad);
    window.removeEventListener("pageshow", this.handlePageShow);
    document.removeEventListener("click", this.handleDocumentClick);
    document.removeEventListener(SITE_EVENTS.loadingStart, this.handleStart);
    document.removeEventListener(SITE_EVENTS.loadingEnd, this.handleEnd);
    this.hide();
  }

  private start(key: string) {
    const wasInactive = this.active.size === 0;
    this.active.add(key);
    if (wasInactive) this.scheduleReveal();
  }

  private end(key: string) {
    this.active.delete(key);
    if (this.active.size === 0) this.hide();
  }

  private clear() {
    this.active.clear();
    this.hide();
  }

  private scheduleReveal() {
    this.cancelReveal();
    this.revealTimer = window.setTimeout(() => {
      this.revealTimer = 0;
      if (this.active.size > 0) this.visible.set(true);
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
