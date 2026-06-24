import {
  ChangeDetectionStrategy,
  Component,
  signal,
} from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";
import { MatButton } from "@angular/material/button";

const STORAGE_KEY = "ct_cookie_consent_v1";
const COOKIE_NAME = "ct_cookie_consent";
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

declare global {
  interface Window {
    cookieConsent?: {
      acceptedService: (service: string, category: string) => boolean;
      isCategoryAccepted: (category: string) => boolean;
    };
  }
}

function readConsent(): ConsentState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeConsent(functionality: boolean) {
  const state: ConsentState = {
    functionality,
    updatedAt: new Date().toISOString(),
    version: 1,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  document.cookie = `${COOKIE_NAME}=${functionality ? "accepted" : "rejected"}; Max-Age=31536000; Path=/; SameSite=Lax`;
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
    @if (visible()) {
      <div class="cookie-consent-backdrop" aria-hidden="true"></div>
      <section
        class="cookie-consent"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-consent-title"
        aria-describedby="cookie-consent-desc"
      >
        <div class="cookie-consent-content">
          <h2 id="cookie-consent-title">Cookies</h2>
          <p id="cookie-consent-desc">
            Un cookie de consentement permet d'activer la détection de votre IP
            et de votre pays affichés dans le footer. Refuser garde cette
            fonctionnalité désactivée.
          </p>
        </div>

        <div class="cookie-consent-actions">
          <button
            matButton="text"
            type="button"
            (click)="reject()"
          >
            Refuser
          </button>
          <button
            matButton="text"
            type="button"
            (click)="accept()"
          >
            Accepter
          </button>
        </div>
      </section>
    }
  `,
})
export class CookieConsentBannerComponent implements OnInit, OnDestroy {
  private readonly handleKeydown = (event: KeyboardEvent) => {
    if (!this.visible()) return;

    if (event.key === "Escape") {
      this.reject();
      return;
    }

    if (event.key === "Tab") this.trapFocus(event);
  };

  readonly visible = signal(false);
  private focusFrame = 0;

  ngOnInit() {
    if (typeof window === "undefined") return;

    exposeConsentApi();
    document.dispatchEvent(new Event("site:consent-change"));
    const shouldShow = readConsent() === null;

    this.visible.set(shouldShow);
    this.syncPageState();
    if (shouldShow) this.focusInitialAction();
    window.addEventListener("keydown", this.handleKeydown);
  }

  ngOnDestroy() {
    if (typeof window === "undefined") return;

    window.removeEventListener("keydown", this.handleKeydown);
    if (this.focusFrame) cancelAnimationFrame(this.focusFrame);
    this.unlockPage();
  }

  accept() {
    this.save(true);
  }

  reject() {
    this.save(false);
  }

  private save(functionality: boolean) {
    writeConsent(functionality);
    exposeConsentApi();
    this.visible.set(false);
    if (this.focusFrame) cancelAnimationFrame(this.focusFrame);
    this.unlockPage();
    document.dispatchEvent(new Event("site:consent-change"));
  }

  private syncPageState() {
    if (this.visible()) {
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
      ? activeIndex <= 0 ? elements.length - 1 : activeIndex - 1
      : activeIndex === -1 || activeIndex >= elements.length - 1 ? 0 : activeIndex + 1;

    event.preventDefault();
    elements[nextIndex].focus();
  }
}
