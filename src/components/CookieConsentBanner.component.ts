import { DOCUMENT } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";
import { MatButton } from "@angular/material/button";

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
  imports: [MatButton],
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
        <div class="cookie-consent__icon" aria-hidden="true">
          <svg viewBox="0 -960 960 960" focusable="false">
            <path
              d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-75 29-147t81-128.5q52-56.5 125-91T475-881q21 0 43 2t45 7q-9 45 6 85t45 66.5q30 26.5 71.5 36.5t85.5-5q-26 59 7.5 113t99.5 56q1 11 1.5 20.5t.5 20.5q0 82-31.5 154.5t-85.5 127q-54 54.5-127 86T480-80Zm-60-480q25 0 42.5-17.5T480-620q0-25-17.5-42.5T420-680q-25 0-42.5 17.5T360-620q0 25 17.5 42.5T420-560Zm-80 200q25 0 42.5-17.5T400-420q0-25-17.5-42.5T340-480q-25 0-42.5 17.5T280-420q0 25 17.5 42.5T340-360Zm260 40q17 0 28.5-11.5T640-360q0-17-11.5-28.5T600-400q-17 0-28.5 11.5T560-360q0 17 11.5 28.5T600-320ZM480-160q122 0 216.5-84T800-458q-50-22-78.5-60T683-603q-77-11-132-66t-68-132q-80-2-140.5 29t-101 79.5Q201-644 180.5-587T160-480q0 133 93.5 226.5T480-160Zm0-324Z"
            />
          </svg>
        </div>

        <div class="cookie-consent__content">
          <h2 id="cookie-consent-title">Cookies</h2>
          <p id="cookie-consent-desc">
            Un cookie de consentement permet d'activer la détection de votre IP
            et de votre pays affichés dans le footer. Refuser garde cette
            fonctionnalité désactivée.
          </p>
        </div>

        <div class="cookie-consent__actions">
          <button matButton="outlined" type="button" (click)="reject()">
            Refuser
          </button>
          <button
            matButton="outlined"
            type="button"
            class="cookie-consent__accept"
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
  private readonly document = inject(DOCUMENT);
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
    this.document.dispatchEvent(new Event("cc:onConsent"));
    this.document.dispatchEvent(new Event("cc:onChange"));
  }

  private syncPageState() {
    if (this.visible()) {
      this.document.documentElement.classList.add("disable--interaction", "show--consent");
      this.document.querySelector(".site-main")?.setAttribute("inert", "");
    } else {
      this.unlockPage();
    }
  }

  private unlockPage() {
    this.document.documentElement.classList.remove("disable--interaction", "show--consent");
    this.document.querySelector(".site-main")?.removeAttribute("inert");
  }
}
