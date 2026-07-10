import { CUSTOM_ELEMENTS_SCHEMA, ChangeDetectionStrategy, Component, signal } from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";
import { SITE_EVENTS } from "@/lib/site-contracts";

function getScrollProgress() {
  const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
  const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  return Math.min(100, Math.max(0, Math.round((scrollTop / scrollable) * 100)));
}

function isScrollTopDisabledPage() {
  return document.body.classList.contains("home-page");
}

@Component({
  selector: "site-scroll-top-button",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="site-scroll-top" [class.is-visible]="visible()" [hidden]="!visible()">
      <md-filled-tonal-icon-button
        class="site-scroll-top-button"
        title="Retour en haut"
        [attr.aria-label]="'Retour en haut, progression ' + progress() + ' %'"
        (click)="scrollToTop()"
      >
        <md-icon class="site-scroll-top-icon" aria-hidden="true">&#xE25A;</md-icon>
      </md-filled-tonal-icon-button>
    </div>
  `,
  styles: `
    .site-scroll-top {
      position: fixed;
      right: calc(2rem + env(safe-area-inset-right, 0px));
      bottom: 1rem;
      z-index: 9000;
      width: 2.5rem;
      height: 2.5rem;
      overflow: visible;
    }

    .site-scroll-top-button {
      display: inline-flex;
    }

    @media (max-width: 520px) {
      .site-scroll-top {
        right: calc(2rem + env(safe-area-inset-right, 0px));
        bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
      }
    }
  `,
})
export class ScrollTopButtonComponent implements OnInit, OnDestroy {
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
    if (isScrollTopDisabledPage()) return;

    document.dispatchEvent(new CustomEvent(SITE_EVENTS.tooltipHide));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  private sync() {
    const progress = getScrollProgress();
    this.progress.set(progress);
    this.visible.set(!isScrollTopDisabledPage() && window.scrollY > 100);
  }
}
