import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";
import { MatButtonToggleModule } from "@angular/material/button-toggle";
import type { MatButtonToggleChange } from "@angular/material/button-toggle";
import { MatCardModule } from "@angular/material/card";

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
  imports: [MatButtonToggleModule, MatCardModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "not-prose",
    "data-angular-component": "cookie-preferences",
  },
  template: `
    <mat-card
      class="cookie-preferences-panel"
      appearance="outlined"
      aria-labelledby="modifier-vos-choix-cookies"
    >
      <mat-card-content>
        <p>
          Services optionnels :
          <strong>{{ statusLabel() }}</strong>
        </p>
        <div class="cookie-preferences-actions" aria-label="Choix des services optionnels">
          <mat-button-toggle-group
            class="cookie-preferences-toggle-group"
            appearance="standard"
            name="cookie-optional-services"
            aria-label="Choix des services optionnels"
            [value]="selectedToggle()"
            (change)="handleChoiceChange($event)"
          >
            <mat-button-toggle
              class="cookie-preferences-toggle"
              value="accepted"
              aria-label="Autoriser les services optionnels"
            >
              Autoriser
            </mat-button-toggle>
            <mat-button-toggle
              class="cookie-preferences-toggle"
              value="rejected"
              aria-label="Refuser les services optionnels"
            >
              Refuser
            </mat-button-toggle>
            <mat-button-toggle
              class="cookie-preferences-toggle"
              value="unset"
              aria-label="Réinitialiser le choix des services optionnels"
            >
              Réinitialiser
            </mat-button-toggle>
          </mat-button-toggle-group>
        </div>
        <p class="cookie-preferences-feedback" role="status" aria-live="polite">
          {{ feedback() }}
        </p>
      </mat-card-content>
    </mat-card>
  `,
})
export class CookiePreferencesComponent implements OnDestroy, OnInit {
  readonly choice = signal<ConsentChoice>("unset");
  readonly feedback = signal("");
  readonly selectedToggle = signal<ConsentChoice | null>(null);
  readonly statusLabel = () => STATUS_LABELS[this.choice()];

  private resetFeedbackTimer = 0;

  ngOnInit() {
    const storedChoice = this.readStoredChoice();
    this.choice.set(storedChoice);
    this.selectedToggle.set(storedChoice === "unset" ? null : storedChoice);
  }

  ngOnDestroy() {
    this.clearResetFeedbackTimer();
  }

  handleChoiceChange(event: MatButtonToggleChange) {
    if (event.value === "accepted" || event.value === "rejected") {
      this.writeConsent(event.value);
      return;
    }

    if (event.value === "unset") {
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
