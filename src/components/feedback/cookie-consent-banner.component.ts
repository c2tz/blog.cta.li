import { ChangeDetectionStrategy, Component, computed, signal } from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";
import { MatButton } from "@angular/material/button";
import {
  SITE_COOKIE_NAMES,
  SITE_EVENTS,
  SITE_LEGACY_COOKIE_NAMES,
  SITE_LEGACY_STORAGE_KEYS,
  SITE_STORAGE_KEYS,
} from "@/lib/site-contracts";

const STORAGE_KEY = SITE_STORAGE_KEYS.cookieConsent;
const EXPLICIT_CONTENT_STORAGE_KEY = SITE_STORAGE_KEYS.explicitContentAcknowledgement;
const LEGACY_STORAGE_KEY = SITE_LEGACY_STORAGE_KEYS.cookieConsent;
const COOKIE_NAME = SITE_COOKIE_NAMES.cookieConsent;
const EXPLICIT_CONTENT_COOKIE_NAME = SITE_COOKIE_NAMES.explicitContentAcknowledgement;
const LEGACY_COOKIE_NAME = SITE_LEGACY_COOKIE_NAMES.cookieConsent;
const BACKGROUND_INTERACTION_SELECTORS = [".site-main", ".site-footer"] as const;
const DIALOG_FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

interface ConsentState {
  functionality: boolean;
  updatedAt: string;
  version: 1;
}

interface ExplicitContentState {
  acknowledged: boolean;
  updatedAt: string;
  version: 1;
}

type ActiveNotice = "explicit-content" | "privacy";

declare global {
  interface Window {
    cookieConsent?: {
      acceptedService: (service: string, category: string) => boolean;
      isCategoryAccepted: (category: string) => boolean;
    };
  }
}

function readCookie(name: string) {
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

function readConsent(): ConsentState | null {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    const raw = current ?? legacy;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1) return null;

    if (current === null && legacy !== null) {
      localStorage.setItem(STORAGE_KEY, legacy);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }

    return parsed;
  } catch {
    return null;
  }
}

function readExplicitContentAcknowledgement(): ExplicitContentState | null {
  try {
    const current = localStorage.getItem(EXPLICIT_CONTENT_STORAGE_KEY);
    const parsed = JSON.parse(current || "null");
    if (parsed?.version === 1 && parsed.acknowledged === true) return parsed;
  } catch {}

  if (readCookie(EXPLICIT_CONTENT_COOKIE_NAME) === "acknowledged") {
    return {
      acknowledged: true,
      updatedAt: new Date().toISOString(),
      version: 1,
    };
  }

  return null;
}

function removeLegacyConsentCookie() {
  document.cookie = `${LEGACY_COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`;
}

function writeConsent(functionality: boolean) {
  const state: ConsentState = {
    functionality,
    updatedAt: new Date().toISOString(),
    version: 1,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  document.cookie = `${COOKIE_NAME}=${functionality ? "accepted" : "rejected"}; Max-Age=31536000; Path=/; SameSite=Lax`;
  removeLegacyConsentCookie();
}

function writeExplicitContentAcknowledgement() {
  const state: ExplicitContentState = {
    acknowledged: true,
    updatedAt: new Date().toISOString(),
    version: 1,
  };

  localStorage.setItem(EXPLICIT_CONTENT_STORAGE_KEY, JSON.stringify(state));
  document.cookie = `${EXPLICIT_CONTENT_COOKIE_NAME}=acknowledged; Max-Age=31536000; Path=/; SameSite=Lax`;
}

function exposeConsentApi() {
  window.cookieConsent = {
    acceptedService: (service: string, category: string) =>
      category === "functionality" && service === "ipgeo" && Boolean(readConsent()?.functionality),
    isCategoryAccepted: (category: string) =>
      category === "necessary" ||
      (category === "functionality" && Boolean(readConsent()?.functionality)),
  };
}

function setBackgroundInteractionDisabled(disabled: boolean) {
  for (const selector of BACKGROUND_INTERACTION_SELECTORS) {
    document.querySelector(selector)?.toggleAttribute("inert", disabled);
  }
}

function isFocusableElement(element: HTMLElement) {
  const style = getComputedStyle(element);

  return (
    element.tabIndex >= 0 &&
    !element.hasAttribute("disabled") &&
    element.getAttribute("aria-hidden") !== "true" &&
    style.display !== "none" &&
    style.visibility !== "hidden"
  );
}

@Component({
  selector: "site-cookie-consent-banner",
  standalone: true,
  imports: [MatButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (activeNotice()) {
      @if (activeNotice() === "explicit-content") {
        <div
          class="cookie-consent-backdrop cookie-consent-backdrop--modal"
          aria-hidden="true"
        ></div>
      }
      <section
        class="cookie-consent"
        [class.cookie-consent--modal]="activeNotice() === 'explicit-content'"
        [class.cookie-consent--explicit-content]="activeNotice() === 'explicit-content'"
        [attr.role]="activeNotice() === 'explicit-content' ? 'dialog' : 'region'"
        [attr.aria-modal]="activeNotice() === 'explicit-content' ? 'true' : null"
        [attr.aria-labelledby]="
          activeNotice() === 'explicit-content' ? 'explicit-content-consent-title' : null
        "
        [attr.aria-label]="activeNotice() === 'explicit-content' ? null : 'Avis de confidentialité'"
        [attr.aria-describedby]="
          activeNotice() === 'explicit-content'
            ? 'explicit-content-consent-desc'
            : 'cookie-consent-desc'
        "
      >
        @if (activeNotice() === "explicit-content") {
          <div class="cookie-consent-alert">
            <svg
              class="cookie-consent-boot-warning-icon"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 -960 960 960"
              aria-hidden="true"
            >
              <path
                d="m40-120 440-760 440 760H40Zm468.5-131.5Q520-263 520-280t-11.5-28.5Q497-320 480-320t-28.5 11.5Q440-297 440-280t11.5 28.5Q463-240 480-240t28.5-11.5ZM440-360h80v-200h-80v200Z"
              />
            </svg>
            <div class="cookie-consent-content">
              <h3 id="explicit-content-consent-title">Avertissement relatif aux images</h3>
              <p id="explicit-content-consent-desc">
                Ce site peut contenir des images d’anime à caractère explicite, réservées à un
                public adulte. En continuant, vous confirmez avoir au moins 18 ans, ou avoir atteint
                l’âge légal de la majorité dans votre pays ou région.
              </p>
            </div>
          </div>

          <div class="cookie-consent-actions">
            <button
              class="cookie-consent-return-action"
              matButton="text"
              type="button"
              aria-label="Quitter le site"
              (click)="leaveExplicitContent()"
            >
              QUITTER
            </button>
            <button
              class="cookie-consent-confirm-action"
              matButton="text"
              type="button"
              aria-label="J’ACCEPTE ET J’ENTRE en confirmant avoir au moins 18 ans"
              (click)="acknowledgeExplicitContent()"
            >
              J’ACCEPTE ET J’ENTRE
            </button>
          </div>
        } @else {
          <div class="cookie-consent-content">
            <p id="cookie-consent-desc">
              Ce site utilise des cookies pour fournir ses services et analyser le trafic.
            </p>
          </div>

          <div class="cookie-consent-actions">
            <button
              matButton="text"
              type="button"
              disabled
              aria-label="Plus de détails, page à venir"
            >
              PLUS DE DÉTAILS
            </button>
            <button matButton="text" type="button" (click)="acknowledgePrivacyNotice()">
              JE COMPRENDS
            </button>
          </div>
        }
      </section>
    }
  `,
})
export class CookieConsentBannerComponent implements OnInit, OnDestroy {
  private readonly handleKeydown = (event: KeyboardEvent) => {
    if (!this.visible()) return;

    if (event.key === "Escape" && this.activeNotice() === "privacy") {
      this.acknowledgePrivacyNotice();
      return;
    }

    if (event.key === "Tab" && this.activeNotice() === "explicit-content") {
      this.trapFocus(event);
    }
  };

  readonly activeNotice = signal<ActiveNotice | null>(null);
  readonly visible = computed(() => this.activeNotice() !== null);
  private focusFrame = 0;
  private cookieConsentPending = false;
  private explicitContentPending = false;

  ngOnInit() {
    if (typeof window === "undefined") return;

    exposeConsentApi();
    removeLegacyConsentCookie();
    document.dispatchEvent(new Event(SITE_EVENTS.consentChange));
    this.explicitContentPending = readExplicitContentAcknowledgement() === null;
    this.cookieConsentPending = readConsent() === null;

    this.showNextNotice();
    window.addEventListener("keydown", this.handleKeydown);
  }

  ngOnDestroy() {
    if (typeof window === "undefined") return;

    window.removeEventListener("keydown", this.handleKeydown);
    if (this.focusFrame) cancelAnimationFrame(this.focusFrame);
    this.unlockPage();
  }

  acknowledgePrivacyNotice() {
    this.save(true);
  }

  acknowledgeExplicitContent() {
    writeExplicitContentAcknowledgement();
    this.explicitContentPending = false;
    document.dispatchEvent(new Event(SITE_EVENTS.explicitContentChange));
    this.showNextNotice();
  }

  leaveExplicitContent() {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.assign("https://www.cta.li/");
  }

  private save(functionality: boolean) {
    writeConsent(functionality);
    exposeConsentApi();
    this.cookieConsentPending = false;
    document.dispatchEvent(new Event(SITE_EVENTS.consentChange));
    this.showNextNotice();
  }

  private showNextNotice() {
    this.activeNotice.set(
      this.explicitContentPending
        ? "explicit-content"
        : this.cookieConsentPending
          ? "privacy"
          : null,
    );

    this.syncPageState();
    if (this.activeNotice() === "explicit-content") this.focusInitialAction();
  }

  private syncPageState() {
    if (this.activeNotice() === "explicit-content") {
      document.documentElement.classList.add("interaction-disabled", "consent-visible");
      setBackgroundInteractionDisabled(true);
    } else {
      this.unlockPage();
    }
  }

  private unlockPage() {
    document.documentElement.classList.remove("interaction-disabled", "consent-visible");
    setBackgroundInteractionDisabled(false);
  }

  private getFocusableDialogElements() {
    return Array.from(
      document.querySelectorAll<HTMLElement>(`.cookie-consent ${DIALOG_FOCUSABLE_SELECTOR}`),
    ).filter(isFocusableElement);
  }

  private focusInitialAction() {
    if (this.focusFrame) cancelAnimationFrame(this.focusFrame);

    this.focusFrame = requestAnimationFrame(() => {
      this.focusFrame = 0;
      this.getFocusableDialogElements()[0]?.focus();
    });
  }

  private trapFocus(event: KeyboardEvent) {
    const elements = this.getFocusableDialogElements();
    if (elements.length === 0) return;

    const activeIndex = elements.indexOf(document.activeElement as HTMLElement);
    const nextIndex = event.shiftKey
      ? activeIndex <= 0
        ? elements.length - 1
        : activeIndex - 1
      : activeIndex === -1 || activeIndex >= elements.length - 1
        ? 0
        : activeIndex + 1;

    event.preventDefault();
    elements[nextIndex].focus();
  }
}
