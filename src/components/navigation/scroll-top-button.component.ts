import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";
import { MatBadge } from "@angular/material/badge";
import { MatMiniFabButton } from "@angular/material/button";
import { MatIcon } from "@angular/material/icon";
import { MatTooltip } from "@angular/material/tooltip";
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
  imports: [MatBadge, MatMiniFabButton, MatIcon, MatTooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      matMiniFab
      type="button"
      class="site-scroll-top"
      [class.is-visible]="visible()"
      [disabled]="!visible()"
      [hidden]="!visible()"
      [attr.aria-label]="'Retour en haut, progression ' + progress() + ' %'"
      [matBadge]="progress() + '%'"
      [matBadgeDescription]="'Progression ' + progress() + ' %'"
      [matBadgeHidden]="!visible()"
      matBadgePosition="above after"
      matBadgeSize="large"
      matTooltip="Retour en haut"
      matTooltipPosition="left"
      (click)="scrollToTop()"
    >
      <mat-icon class="site-scroll-top-icon" aria-hidden="true">&#xE5D8;</mat-icon>
    </button>
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
