import { ChangeDetectionStrategy, Component } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { MatSlideToggle } from "@angular/material/slide-toggle";

import type { OnInit } from "@angular/core";
import {
  SITE_COOKIE_NAMES,
  SITE_EVENTS,
  SITE_LEGACY_COOKIE_NAMES,
  SITE_LEGACY_STORAGE_KEYS,
  SITE_STORAGE_KEYS,
} from "@/lib/site-contracts";

@Component({
  selector: "site-home-detail-toggle",
  standalone: true,
  imports: [FormsModule, MatSlideToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-slide-toggle
      class="home-detail-toggle"
      name="home-detail-view"
      [(ngModel)]="detailed"
      (ngModelChange)="setDetailedView($event)"
    >
      {{ detailed ? "Affichage détaillé" : "Affichage simple" }}
    </mat-slide-toggle>
  `,
  styles: `
    :host {
      display: flex;
      justify-content: flex-start;
      margin-block: 0.7rem 0;
    }

    .home-detail-toggle.mat-mdc-slide-toggle {
      --mat-slide-toggle-label-text-color: var(--site-muted);
      --mat-slide-toggle-label-text-size: 0.8125rem;
      --mat-slide-toggle-label-text-line-height: 1.25rem;
      --mat-slide-toggle-track-outline-color: color-mix(
        in srgb,
        var(--site-muted) 48%,
        transparent
      );
      --mat-slide-toggle-unselected-track-color: color-mix(
        in srgb,
        var(--site-muted) 24%,
        var(--site-bg)
      );
      --mat-slide-toggle-unselected-hover-track-color: color-mix(
        in srgb,
        var(--site-muted) 30%,
        var(--site-bg)
      );
      --mat-slide-toggle-unselected-focus-track-color: color-mix(
        in srgb,
        var(--site-muted) 34%,
        var(--site-bg)
      );
      --mat-slide-toggle-unselected-pressed-track-color: color-mix(
        in srgb,
        var(--site-muted) 38%,
        var(--site-bg)
      );
      --mat-slide-toggle-unselected-handle-color: color-mix(
        in srgb,
        var(--site-muted) 72%,
        var(--site-bg)
      );
      --mat-slide-toggle-unselected-hover-handle-color: var(--site-muted);
      --mat-slide-toggle-unselected-focus-handle-color: var(--site-muted);
      --mat-slide-toggle-unselected-pressed-handle-color: var(--site-muted);
      --mat-slide-toggle-unselected-icon-color: color-mix(
        in srgb,
        var(--site-bg) 72%,
        var(--site-muted)
      );
      --mat-slide-toggle-unselected-hover-state-layer-color: var(--site-muted);
      --mat-slide-toggle-unselected-focus-state-layer-color: var(--site-muted);
      --mat-slide-toggle-unselected-pressed-state-layer-color: var(--site-muted);
    }
  `,
})
export class HomeDetailToggleComponent implements OnInit {
  detailed = false;

  ngOnInit() {
    const stored = this.readStoredDetailView();
    this.detailed = stored;
    this.persistDetailView(stored);
    this.applyDetailView(stored);
  }

  setDetailedView(detailed: boolean) {
    this.detailed = detailed;
    this.persistDetailView(detailed);
    this.applyDetailView(detailed);
  }

  private applyDetailView(detailed: boolean) {
    if (typeof document === "undefined") return;

    if (detailed) {
      document.body.dataset["homeDetailView"] = "true";
    } else {
      delete document.body.dataset["homeDetailView"];
    }

    document.dispatchEvent(
      new CustomEvent(SITE_EVENTS.homeDetailViewChange, {
        detail: { detailed },
      }),
    );
  }

  private readStoredDetailView() {
    const candidates = [
      this.readLocalStorage(SITE_STORAGE_KEYS.homeDetailView),
      this.readLocalStorage(SITE_LEGACY_STORAGE_KEYS.homeDetailView),
      this.readCookie(SITE_COOKIE_NAMES.homeDetailView),
      this.readCookie(SITE_LEGACY_COOKIE_NAMES.homeDetailView),
    ];

    for (const candidate of candidates) {
      const normalized = this.normalizeDetailView(candidate);
      if (normalized !== null) return normalized;
    }

    return false;
  }

  private persistDetailView(detailed: boolean) {
    const value = detailed ? "true" : "false";

    try {
      localStorage.setItem(SITE_STORAGE_KEYS.homeDetailView, value);
      localStorage.removeItem(SITE_LEGACY_STORAGE_KEYS.homeDetailView);
    } catch {}

    this.writeCookie(SITE_COOKIE_NAMES.homeDetailView, value);
    this.expireCookie(SITE_LEGACY_COOKIE_NAMES.homeDetailView);
  }

  private normalizeDetailView(value: string | null) {
    if (value === "true" || value === "detailed") return true;
    if (value === "false" || value === "compact") return false;
    return null;
  }

  private readLocalStorage(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private readCookie(name: string) {
    if (typeof document === "undefined") return null;

    const encodedName = `${encodeURIComponent(name)}=`;
    const cookie = document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(encodedName));

    if (!cookie) return null;

    try {
      return decodeURIComponent(cookie.slice(encodedName.length));
    } catch {
      return null;
    }
  }

  private writeCookie(name: string, value: string) {
    if (typeof document === "undefined") return;

    document.cookie = [
      `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
      "Max-Age=31536000",
      "Path=/",
      "SameSite=Lax",
    ].join("; ");
  }

  private expireCookie(name: string) {
    if (typeof document === "undefined") return;

    document.cookie = `${encodeURIComponent(name)}=; Max-Age=0; Path=/; SameSite=Lax`;
  }
}
