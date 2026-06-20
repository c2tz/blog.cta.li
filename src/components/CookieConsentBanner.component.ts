import {
  ChangeDetectionStrategy,
  Component,
  signal,
} from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";

const STORAGE_KEY = "ct_cookie_consent_v1";
const COOKIE_NAME = "ct_cookie_consent";

interface ConsentState {
  functionality: boolean;
  updatedAt: string;
  version: 1;
}

declare global {
  interface Window {
    CookieConsent?: {
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
  window.CookieConsent = {
    acceptedService: (service: string, category: string) =>
      category === "functionality" && service === "ipgeo" && Boolean(readConsent()?.functionality),
    isCategoryAccepted: (category: string) =>
      category === "necessary" ||
      (category === "functionality" && Boolean(readConsent()?.functionality)),
  };
}

@Component({
  selector: "cookie-consent-banner",
  standalone: true,
  imports: [MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div class="cookie-consent__backdrop" aria-hidden="true"></div>
      <section
        class="cookie-consent"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-consent-title"
        aria-describedby="cookie-consent-desc"
      >
        <div class="cookie-consent__content">
          <h2 id="cookie-consent-title">Cookies</h2>
          <p id="cookie-consent-desc">
            Un cookie de consentement permet d'activer la détection de votre IP
            et de votre pays affichés dans le footer. Refuser garde cette
            fonctionnalité désactivée.
          </p>
        </div>

        <div class="cookie-consent__actions">
          <button
            matButton="text"
            type="button"
            class="cookie-consent__button"
            (click)="reject()"
          >
            Refuser
          </button>
          <button
            matButton="text"
            type="button"
            class="cookie-consent__button cookie-consent__accept"
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
    if (event.key === "Escape" && this.visible()) this.reject();
  };

  readonly visible = signal(false);

  ngOnInit() {
    if (typeof window === "undefined") return;

    exposeConsentApi();
    this.visible.set(readConsent() === null);
    this.syncPageState();
    window.addEventListener("keydown", this.handleKeydown);
  }

  ngOnDestroy() {
    if (typeof window === "undefined") return;

    window.removeEventListener("keydown", this.handleKeydown);
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
    this.unlockPage();
    document.dispatchEvent(new Event("cc:onConsent"));
    document.dispatchEvent(new Event("cc:onChange"));
  }

  private syncPageState() {
    if (this.visible()) {
      document.documentElement.classList.add("disable--interaction", "show--consent");
      document.querySelector(".site-main")?.setAttribute("inert", "");
    } else {
      this.unlockPage();
    }
  }

  private unlockPage() {
    document.documentElement.classList.remove("disable--interaction", "show--consent");
    document.querySelector(".site-main")?.removeAttribute("inert");
  }
}
