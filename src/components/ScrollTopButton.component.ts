import {
  ChangeDetectionStrategy,
  Component,
  signal,
} from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";

const SCROLL_TOP_ICON_PATH =
  "M440-727 256-544l-56-56 280-280 280 280-56 57-184-184v287h-80v-287Zm0 487v-120h80v120h-80Zm0 160v-80h80v80h-80Z";

function getScrollProgress() {
  const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
  const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  return Math.min(100, Math.max(0, Math.round((scrollTop / scrollable) * 100)));
}

@Component({
  selector: "site-scroll-top-button",
  standalone: true,
  imports: [MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      matButton="outlined"
      type="button"
      class="site-scroll-top site-material-ripple"
      [class.is-visible]="visible()"
      [tabIndex]="visible() ? 0 : -1"
      [attr.aria-label]="'Retour en haut, progression ' + progress() + ' %'"
      (click)="scrollToTop()"
    >
      <svg matButtonIcon aria-hidden="true" viewBox="0 -960 960 960" focusable="false">
        <path [attr.d]="iconPath"></path>
      </svg>
      <span>Haut</span>
      <span class="site-scroll-top__count" data-scroll-progress-count aria-hidden="true">
        {{ progress() }}%
      </span>
    </button>
  `,
})
export class ScrollTopButtonComponent implements OnInit, OnDestroy {
  readonly iconPath = SCROLL_TOP_ICON_PATH;
  readonly progress = signal(0);
  readonly visible = signal(false);

  private frame = 0;

  private readonly requestSync = () => {
    if (this.frame) return;

    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.sync();
    });
  };

  ngOnInit() {
    if (typeof window === "undefined") return;

    this.sync();
    window.addEventListener("scroll", this.requestSync, { passive: true });
    window.addEventListener("resize", this.requestSync, { passive: true });
  }

  ngOnDestroy() {
    if (typeof window === "undefined") return;

    window.removeEventListener("scroll", this.requestSync);
    window.removeEventListener("resize", this.requestSync);
    if (this.frame) cancelAnimationFrame(this.frame);
  }

  scrollToTop() {
    document.dispatchEvent(new CustomEvent("site:tooltip-hide"));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  private sync() {
    const progress = getScrollProgress();
    this.progress.set(progress);
    this.visible.set(window.scrollY > 100);
  }
}
