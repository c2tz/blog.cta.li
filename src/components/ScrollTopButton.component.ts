import {
  ChangeDetectionStrategy,
  Component,
  signal,
} from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";
import { MatBadgeModule } from "@angular/material/badge";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatTooltipModule } from "@angular/material/tooltip";

function getScrollProgress() {
  const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
  const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  return Math.min(100, Math.max(0, Math.round((scrollTop / scrollable) * 100)));
}

@Component({
  selector: "site-scroll-top-button",
  standalone: true,
  imports: [
    MatBadgeModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      matIconButton
      type="button"
      class="site-scroll-top site-icon-button"
      [class.is-visible]="visible()"
      [tabIndex]="visible() ? 0 : -1"
      [attr.aria-label]="'Retour en haut, progression ' + progress() + ' %'"
      [matBadge]="progress()"
      [matBadgeHidden]="!visible()"
      matBadgePosition="above after"
      [showProgress]="true"
      matTooltip="Retour en haut"
      matTooltipPosition="left"
      (click)="scrollToTop()"
    >
      <mat-spinner
        progressIndicator
        class="site-scroll-top__progress"
        mode="determinate"
        [value]="progress()"
        diameter="40"
        strokeWidth="3"
        aria-hidden="true"
      ></mat-spinner>
      <mat-icon class="site-scroll-top__icon" aria-hidden="true">&#xE5D8;</mat-icon>
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
    document.dispatchEvent(new CustomEvent("site:tooltip-hide"));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  private sync() {
    const progress = getScrollProgress();
    this.progress.set(progress);
    this.visible.set(window.scrollY > 100);
  }
}
