import {
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
} from "@angular/core";
import type { AfterViewInit, OnDestroy, OnInit } from "@angular/core";

import {
  SITE_COOKIE_NAMES,
  SITE_EVENTS,
  SITE_LEGACY_COOKIE_NAMES,
  SITE_LEGACY_STORAGE_KEYS,
  SITE_STORAGE_KEYS,
} from "@/lib/site-contracts";

const CONSENT_MAX_AGE_SECONDS = 31_536_000;
const RESET_FEEDBACK_DURATION_MS = 2200;
const STATUS_LABELS = {
  accepted: "autorisés",
  rejected: "refusés",
  unset: "aucun choix enregistré",
} as const;

type ConsentChoice = keyof typeof STATUS_LABELS;

@Component({
  selector: "site-cookie-preferences",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "not-prose",
    "data-angular-component": "cookie-preferences",
  },
  template: `
    <section class="cookie-preferences-panel" aria-labelledby="modifier-vos-choix-cookies">
      <p>
        Services optionnels :
        <strong>{{ statusLabel() }}</strong>
      </p>
      <div class="cookie-preferences-actions" aria-label="Choix des services optionnels">
        <md-chip-set
          class="cookie-preferences-toggle-group"
          aria-label="Choix des services optionnels"
        >
          <md-filter-chip
            class="cookie-preferences-toggle"
            aria-label="Autoriser les services optionnels"
            [selected]="selectedChoice() === 'accepted'"
            (click)="handleChoiceChange('accepted', $event)"
          >
            Autoriser
          </md-filter-chip>
          <md-filter-chip
            class="cookie-preferences-toggle"
            aria-label="Refuser les services optionnels"
            [selected]="selectedChoice() === 'rejected'"
            (click)="handleChoiceChange('rejected', $event)"
          >
            Refuser
          </md-filter-chip>
          <md-filter-chip
            class="cookie-preferences-toggle"
            aria-label="Réinitialiser le choix des services optionnels"
            [selected]="selectedChoice() === 'unset'"
            (click)="handleChoiceChange('unset', $event)"
          >
            Réinitialiser
          </md-filter-chip>
        </md-chip-set>
      </div>
      <p class="cookie-preferences-feedback" role="status" aria-live="polite">
        {{ feedback() }}
      </p>
    </section>
  `,
  styles: `
    .cookie-preferences-toggle-group {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .cookie-preferences-toggle {
      min-width: 7.5rem;
      --md-filter-chip-label-text-font: var(--site-font);
      --md-filter-chip-label-text-line-height: 1.5rem;
      --md-filter-chip-label-text-size: 1rem;
      --md-filter-chip-label-text-weight: 700;
    }
  `,
})
export class CookiePreferencesComponent implements AfterViewInit, OnDestroy, OnInit {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly choice = signal<ConsentChoice>("unset");
  readonly feedback = signal("");
  readonly selectedToggle = signal<ConsentChoice | null>(null);
  readonly statusLabel = () => STATUS_LABELS[this.choice()];
  readonly selectedChoice = () => this.selectedToggle();

  private resetFeedbackTimer = 0;

  ngOnInit() {
    const storedChoice = this.readStoredChoice();
    this.choice.set(storedChoice);
    this.selectedToggle.set(storedChoice === "unset" ? null : storedChoice);
  }

  ngAfterViewInit() {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    this.host.nativeElement.dataset.cookiePreferencesReady = "true";
    document.dispatchEvent(new Event("site:cookie-preferences-ready"));
  }

  ngOnDestroy() {
    this.clearResetFeedbackTimer();
  }

  handleChoiceChange(choice: ConsentChoice, event: Event) {
    const chip = event.currentTarget;
    if (chip instanceof HTMLElement && "selected" in chip) {
      (chip as HTMLElement & { selected: boolean }).selected = true;
    }

    if (choice === "accepted" || choice === "rejected") {
      this.writeConsent(choice);
      return;
    }

    if (choice === "unset") {
      this.resetConsent();
    }
  }

  writeConsent(choice: Exclude<ConsentChoice, "unset">) {
    this.clearResetFeedbackTimer();

    const functionality = choice === "accepted";
    const state = {
      functionality,
      updatedAt: new Date().toISOString(),
      version: 1,
    };

    try {
      localStorage.setItem(SITE_STORAGE_KEYS.cookieConsent, JSON.stringify(state));
      localStorage.removeItem(SITE_LEGACY_STORAGE_KEYS.cookieConsent);
    } catch {}

    this.writeCookie(SITE_COOKIE_NAMES.cookieConsent, choice);
    this.expireCookie(SITE_LEGACY_COOKIE_NAMES.cookieConsent);
    this.choice.set(choice);
    this.selectedToggle.set(choice);
    this.feedback.set("Choix cookies mis à jour.");
    document.dispatchEvent(new Event(SITE_EVENTS.consentChange));
  }

  resetConsent() {
    try {
      localStorage.removeItem(SITE_STORAGE_KEYS.cookieConsent);
      localStorage.removeItem(SITE_LEGACY_STORAGE_KEYS.cookieConsent);
    } catch {}

    this.expireCookie(SITE_COOKIE_NAMES.cookieConsent);
    this.expireCookie(SITE_LEGACY_COOKIE_NAMES.cookieConsent);
    this.choice.set("unset");
    this.selectedToggle.set("unset");
    this.feedback.set("Choix cookies réinitialisé.");
    document.dispatchEvent(new Event(SITE_EVENTS.consentChange));
    this.scheduleResetFeedbackClear();
  }

  private scheduleResetFeedbackClear() {
    if (typeof window === "undefined") return;

    this.clearResetFeedbackTimer();
    this.resetFeedbackTimer = window.setTimeout(() => {
      this.resetFeedbackTimer = 0;
      if (this.choice() === "unset" && this.selectedToggle() === "unset") {
        this.selectedToggle.set(null);
      }
    }, RESET_FEEDBACK_DURATION_MS);
  }

  private clearResetFeedbackTimer() {
    if (typeof window === "undefined" || !this.resetFeedbackTimer) return;

    window.clearTimeout(this.resetFeedbackTimer);
    this.resetFeedbackTimer = 0;
  }

  private readStoredChoice(): ConsentChoice {
    try {
      const raw =
        localStorage.getItem(SITE_STORAGE_KEYS.cookieConsent) ??
        localStorage.getItem(SITE_LEGACY_STORAGE_KEYS.cookieConsent);
      const parsed = JSON.parse(raw || "null");
      if (parsed?.version === 1) return parsed.functionality ? "accepted" : "rejected";
    } catch {}

    const cookie =
      this.readCookie(SITE_COOKIE_NAMES.cookieConsent) ??
      this.readCookie(SITE_LEGACY_COOKIE_NAMES.cookieConsent);
    if (cookie === "accepted" || cookie === "rejected") return cookie;

    return "unset";
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
      `Max-Age=${CONSENT_MAX_AGE_SECONDS}`,
      "Path=/",
      "SameSite=Lax",
    ].join("; ");
  }

  private expireCookie(name: string) {
    if (typeof document === "undefined") return;

    document.cookie = `${encodeURIComponent(name)}=; Max-Age=0; Path=/; SameSite=Lax`;
  }
}
