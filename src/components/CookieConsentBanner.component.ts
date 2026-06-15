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
              d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-82 31-154.5T195-761q53-54 125.5-86.5T475-880q12 0 23.5.5T522-877q-8 38 16 68t62 30q12 0 23-3.5t21-10.5q13 29 38 47.5t58 18.5q11 0 22-2t21-6q45 51 71 116.5T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-47-13.5-90T749-650q-4 1-9 1h-10q-53 0-92-34t-46-86q-54-14-104-4T395-734q-43 31-66.5 78T305-555q0 105 73.5 179T557-302q41 0 78-13t68-37q-32 86-111.5 139T480-160ZM360-520q17 0 28.5-11.5T400-560q0-17-11.5-28.5T360-600q-17 0-28.5 11.5T320-560q0 17 11.5 28.5T360-520Zm120 160q17 0 28.5-11.5T520-400q0-17-11.5-28.5T480-440q-17 0-28.5 11.5T440-400q0 17 11.5 28.5T480-360Zm120-160q17 0 28.5-11.5T640-560q0-17-11.5-28.5T600-600q-17 0-28.5 11.5T560-560q0 17 11.5 28.5T600-520Z"
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
