import { ChangeDetectionStrategy, Component } from "@angular/core";
import type { OnInit } from "@angular/core";
import { MatIconButton } from "@angular/material/button";
import { MatIcon } from "@angular/material/icon";
import { MatTooltip } from "@angular/material/tooltip";

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
  imports: [MatIconButton, MatIcon, MatTooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "data-angular-component": "home-detail-toggle",
  },
  template: `
    <button
      matIconButton
      type="button"
      class="home-detail-trigger"
      [matTooltip]="label"
      matTooltipPosition="below"
      [attr.aria-label]="label"
      [attr.aria-pressed]="detailed"
      (click)="toggleDetailedView()"
    >
      <mat-icon aria-hidden="true">{{ icon }}</mat-icon>
    </button>
  `,
  styles: `
    :host {
      display: block;
      width: 2.5rem;
      height: 2.5rem;
      flex: 0 0 2.5rem;
    }
  `,
})
export class HomeDetailToggleComponent implements OnInit {
  readonly simpleIcon = "\uE261";
  readonly detailedIcon = "\uE8D2";
  detailed = false;

  get icon() {
    return this.detailed ? this.detailedIcon : this.simpleIcon;
  }

  get label() {
    return this.detailed ? "Mode détaillé" : "Mode simple";
  }

  ngOnInit() {
    const stored = this.readStoredDetailView();
    this.detailed = stored;
    this.persistDetailView(stored);
    this.applyDetailView(stored);
  }

  toggleDetailedView() {
    this.setDetailedView(!this.detailed);
  }

  setDetailedView(detailed: boolean) {
    this.detailed = detailed;
    this.persistDetailView(detailed);
    this.applyDetailView(detailed);
  }

  private applyDetailView(detailed: boolean) {
    if (typeof document === "undefined") return;

    if (detailed) {
      document.documentElement.dataset["homeDetailView"] = "true";
      document.body.dataset["homeDetailView"] = "true";
    } else {
      delete document.documentElement.dataset["homeDetailView"];
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
