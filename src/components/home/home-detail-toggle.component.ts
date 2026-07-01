import { ChangeDetectionStrategy, Component } from "@angular/core";
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
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="home-detail-toggle">
      <input
        class="home-detail-toggle-input"
        type="checkbox"
        name="home-detail-view"
        [checked]="detailed"
        (change)="handleToggleChange($event)"
      />
      <span class="home-detail-toggle-control" aria-hidden="true">
        <span class="home-detail-toggle-thumb"></span>
      </span>
      <span class="home-detail-toggle-label">
        {{ detailed ? "Affichage détaillé" : "Affichage simple" }}
      </span>
    </label>
  `,
  styles: `
    :host {
      display: flex;
      justify-content: flex-start;
      margin-block: 0.7rem 0;
    }

    .home-detail-toggle {
      display: inline-flex;
      align-items: center;
      gap: 0.55rem;
      color: var(--site-muted);
      cursor: pointer;
      font-size: 0.8125rem;
      line-height: 1.25rem;
      user-select: none;
    }

    .home-detail-toggle-input {
      position: absolute;
      width: 1px;
      height: 1px;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    .home-detail-toggle-control {
      position: relative;
      display: inline-flex;
      align-items: center;
      width: 2.25rem;
      height: 1.25rem;
      border: 1px solid color-mix(in srgb, var(--site-muted) 48%, transparent);
      border-radius: 9999px;
      background: color-mix(in srgb, var(--site-muted) 24%, var(--site-bg));
      transition:
        background-color 160ms ease,
        border-color 160ms ease;
    }

    .home-detail-toggle-thumb {
      position: absolute;
      left: 0.125rem;
      width: 0.875rem;
      height: 0.875rem;
      border-radius: 50%;
      background: color-mix(in srgb, var(--site-muted) 72%, var(--site-bg));
      transition:
        background-color 160ms ease,
        transform 180ms cubic-bezier(0.2, 0, 0, 1);
    }

    .home-detail-toggle-input:checked + .home-detail-toggle-control {
      border-color: var(--site-link);
      background: color-mix(in srgb, var(--site-link) 24%, var(--site-bg));
    }

    .home-detail-toggle-input:checked + .home-detail-toggle-control .home-detail-toggle-thumb {
      background: var(--site-link);
      transform: translateX(1rem);
    }

    .home-detail-toggle-input:focus-visible + .home-detail-toggle-control {
      outline: 2px solid var(--site-link);
      outline-offset: 3px;
    }

    .home-detail-toggle:is(:hover, :focus-within) .home-detail-toggle-label {
      color: var(--site-text);
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

  handleToggleChange(event: Event) {
    this.setDetailedView((event.target as HTMLInputElement | null)?.checked === true);
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
