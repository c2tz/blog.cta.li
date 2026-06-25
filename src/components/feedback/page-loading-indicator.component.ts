import {
  ChangeDetectionStrategy,
  Component,
  signal,
} from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";
import { MatProgressSpinner } from "@angular/material/progress-spinner";
import { SimulatedLoadingProgress } from "@/lib/simulated-loading-progress";
import { SITE_EVENTS } from "@/lib/site-contracts";

interface LoadingEventDetail {
  key?: string;
}

@Component({
  selector: "site-page-loading-indicator",
  standalone: true,
  imports: [MatProgressSpinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div class="site-page-loading" role="status" aria-live="polite" aria-label="Chargement">
        <mat-progress-spinner
          mode="indeterminate"
          diameter="44"
          strokeWidth="4"
          aria-label="Chargement de la page"
        ></mat-progress-spinner>
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
  `,
})
export class PageLoadingIndicatorComponent implements OnInit, OnDestroy {
  readonly visible = signal(true);
  private readonly loadingProgress = new SimulatedLoadingProgress();
  readonly progress = this.loadingProgress.value;
  private readonly active = new Set<string>();

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
    ) return;
    const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
    if (
      !target ||
      target.target ||
      target.hasAttribute("download")
    ) return;

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
    this.loadingProgress.destroy();
  }

  private start(key: string) {
    const wasInactive = this.active.size === 0;
    this.active.add(key);
    if (wasInactive) this.loadingProgress.start();
    this.visible.set(true);
  }

  private end(key: string) {
    this.active.delete(key);
    if (this.active.size === 0) this.loadingProgress.complete();
    this.visible.set(this.active.size > 0);
  }

  private clear() {
    this.active.clear();
    this.loadingProgress.complete();
    this.visible.set(false);
  }
}
