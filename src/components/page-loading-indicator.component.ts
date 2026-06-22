import {
  ChangeDetectionStrategy,
  Component,
  signal,
} from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";
import { MatProgressSpinner } from "@angular/material/progress-spinner";

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
        <mat-spinner diameter="44" strokeWidth="4" aria-hidden="true"></mat-spinner>
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
      target.hasAttribute("download") ||
      target.hasAttribute("data-pswp-item")
    ) return;

    const url = new URL(target.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    if (url.pathname === location.pathname && url.search === location.search && url.hash) return;
    this.start("navigation");
  };

  private readonly handlePhotoSwipeState = (event: Event) => {
    const open = Boolean((event as CustomEvent<{ open?: boolean }>).detail?.open);
    if (open) this.end("navigation");
  };

  ngOnInit() {
    if (typeof window === "undefined") return;

    if (document.readyState !== "complete") this.start("page");
    else this.clear();
    window.addEventListener("load", this.handleLoad, { once: true });
    window.addEventListener("pageshow", this.handlePageShow);
    document.addEventListener("click", this.handleDocumentClick);
    document.addEventListener("site:loading-start", this.handleStart);
    document.addEventListener("site:loading-end", this.handleEnd);
    document.addEventListener("site:photo-swipe-state", this.handlePhotoSwipeState);
  }

  ngOnDestroy() {
    if (typeof window === "undefined") return;

    window.removeEventListener("load", this.handleLoad);
    window.removeEventListener("pageshow", this.handlePageShow);
    document.removeEventListener("click", this.handleDocumentClick);
    document.removeEventListener("site:loading-start", this.handleStart);
    document.removeEventListener("site:loading-end", this.handleEnd);
    document.removeEventListener("site:photo-swipe-state", this.handlePhotoSwipeState);
  }

  private start(key: string) {
    this.active.add(key);
    this.visible.set(true);
  }

  private end(key: string) {
    this.active.delete(key);
    this.visible.set(this.active.size > 0);
  }

  private clear() {
    this.active.clear();
    this.visible.set(false);
  }
}
