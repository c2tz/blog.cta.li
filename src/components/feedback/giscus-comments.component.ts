import {
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewEncapsulation,
  ViewChild,
  computed,
  input,
  signal,
} from "@angular/core";
import type { AfterViewInit, OnDestroy } from "@angular/core";
import { SITE_COOKIE_NAMES, SITE_EVENTS, SITE_STORAGE_KEYS } from "@/lib/site-contracts";

type SiteTheme = "dark" | "light";

interface GiscusAcceptanceState {
  accepted: true;
  updatedAt: string;
  version: 1;
}

const GISCUS_ORIGIN = "https://giscus.app";
const GISCUS_SCRIPT_URL = `${GISCUS_ORIGIN}/client.js`;
const GISCUS_ACCEPTANCE_STORAGE_KEY = SITE_STORAGE_KEYS.giscusCommentsEnabled;
const GISCUS_ACCEPTANCE_COOKIE_NAME = SITE_COOKIE_NAMES.giscusCommentsEnabled;
const GISCUS_ACCEPTANCE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;
const CODE_OF_CONDUCT_URL =
  "https://raw.githubusercontent.com/c2tz/ct-blog-comments/refs/heads/main/CODE_OF_CONDUCT.md";
const GISCUS_THEME_VERSION = "20260708-emoji-popover";
const GISCUS_THEME_SYNC_DELAYS = [0, 150, 500, 1200] as const;
const LOADING_INDICATOR_DELAY_MS = 200;
const GISCUS_FALLBACK_THEMES = {
  dark: "dark_dimmed",
  light: "light",
} as const satisfies Record<SiteTheme, string>;

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

function hasAcceptedCodeOfConduct() {
  try {
    const value = localStorage.getItem(GISCUS_ACCEPTANCE_STORAGE_KEY);
    const parsed = JSON.parse(value || "null") as Partial<GiscusAcceptanceState> | null;
    if (parsed?.version === 1 && parsed.accepted === true) return true;

    if (value === "true" || value === "accepted") return true;
  } catch {}

  return readCookie(GISCUS_ACCEPTANCE_COOKIE_NAME) === "accepted";
}

function rememberCodeOfConductAcceptance() {
  const state: GiscusAcceptanceState = {
    accepted: true,
    updatedAt: new Date().toISOString(),
    version: 1,
  };

  try {
    localStorage.setItem(GISCUS_ACCEPTANCE_STORAGE_KEY, JSON.stringify(state));
  } catch {}

  document.cookie = `${GISCUS_ACCEPTANCE_COOKIE_NAME}=accepted; Max-Age=${GISCUS_ACCEPTANCE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;
}

function getCurrentTheme(): SiteTheme {
  return document.documentElement.dataset["theme"] === "dark" ? "dark" : "light";
}

function hasOptionalServicesConsent() {
  try {
    return Boolean(
      window.cookieConsent?.acceptedService("giscus", "functionality") ||
      window.cookieConsent?.isCategoryAccepted("functionality"),
    );
  } catch {
    return false;
  }
}

@Component({
  selector: "site-giscus-comments",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <section class="giscus-comments" aria-label="Commentaires" data-pagefind-ignore>
      <header class="giscus-comments-header">
        <div class="giscus-comments-intro">
          <h2>Commentaires</h2>
          <p>Avant de participer, merci de respecter les règles de conduite du projet.</p>
        </div>
        <div class="giscus-comments-actions">
          <md-text-button
            class="giscus-comments-conduct-link"
            [href]="codeOfConductUrl"
            target="_blank"
            aria-label="Code de conduite (nouvel onglet)"
            has-icon
          >
            <md-icon slot="icon" aria-hidden="true">&#xE89E;</md-icon>
            Code de conduite
          </md-text-button>
          <md-filled-tonal-button
            type="button"
            class="giscus-comments-accept-button"
            [disabled]="!configured() || accepted() || !optionalServicesAllowed()"
            (click)="acceptCodeOfConduct()"
          >
            J’accepte
          </md-filled-tonal-button>
        </div>
      </header>

      @if (!configured()) {
        <p id="giscus-comments-config" class="giscus-comments-config">
          Configuration Giscus en attente : ajoutez le repo public, le repo ID, la catégorie et le
          category ID.
        </p>
      }

      @if (!optionalServicesAllowed()) {
        <p class="giscus-comments-config giscus-comments-privacy">
          Les commentaires externes sont désactivés par
          <a href="/cookies/#modifier-vos-choix-cookies">votre choix de confidentialité</a>.
        </p>
      }

      @if (accepted()) {
        <div class="giscus-comments-panel-content" [attr.aria-busy]="loading()">
          @if (loadingIndicatorVisible()) {
            <md-linear-progress
              class="giscus-comments-progress"
              indeterminate
              aria-label="Chargement des commentaires"
            ></md-linear-progress>
          }

          @if (error()) {
            <p class="giscus-comments-error">
              Les commentaires ne sont pas disponibles pour le moment.
            </p>
          }

          <div #giscusContainer class="giscus-comments-frame"></div>
        </div>
      }
    </section>
  `,
  styles: `
    :host {
      display: block;
      margin-block-start: 0;
    }

    .giscus-comments {
      padding-block-start: 1rem;
    }

    .giscus-comments-config,
    .giscus-comments-error {
      margin-block: 0;
      color: var(--site-muted);
      font-size: 0.95rem;
      line-height: 1.5;
    }

    .giscus-comments-config {
      margin-block-start: 1rem;
      margin-block-end: 0.5rem;
      color: var(--site-link);
    }

    .giscus-comments-privacy {
      color: var(--site-text);
    }

    .giscus-comments-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .giscus-comments-intro {
      min-width: 0;
    }

    .giscus-comments-intro h2 {
      margin-block: 0 0.25rem;
      color: var(--site-text);
      font-size: 1rem;
      line-height: 1.5;
    }

    .giscus-comments-intro p {
      margin: 0;
      color: var(--site-muted);
      font-size: 0.95rem;
      line-height: 1.5;
    }

    .giscus-comments-actions {
      display: flex;
      flex: 0 0 auto;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-end;
      gap: 0.5rem;
    }

    .giscus-comments-conduct-link,
    .giscus-comments-accept-button {
      flex: 0 0 auto;
      white-space: nowrap;
    }

    .giscus-comments-panel-content {
      position: relative;
      min-height: 7rem;
      padding-block-start: 1rem;
    }

    .giscus-comments-progress {
      position: absolute;
      inset: 0 0 auto;
      width: 100%;
      overflow: hidden;
      border-radius: 9999px;
      --md-linear-progress-active-indicator-color: var(--site-link);
      --md-linear-progress-active-indicator-height: 0.18rem;
      --md-linear-progress-track-color: color-mix(in srgb, var(--site-link) 16%, transparent);
      --md-linear-progress-track-height: 0.18rem;
      --md-linear-progress-track-shape: 9999px;
    }

    .giscus-comments-frame {
      min-width: 0;
    }

    .giscus-comments-error {
      margin-block-start: 1rem;
      color: var(--site-muted);
    }

    @media (max-width: 520px) {
      .giscus-comments-header {
        align-items: center;
        flex-direction: column;
        text-align: center;
      }

      .giscus-comments-actions {
        justify-content: center;
        width: 100%;
      }

      .giscus-comments-config {
        margin-block-start: 1.25rem;
      }

      .giscus-comments-conduct-link,
      .giscus-comments-accept-button {
        align-self: center;
      }
    }
  `,
})
export class GiscusCommentsComponent implements AfterViewInit, OnDestroy {
  readonly codeOfConductUrl = CODE_OF_CONDUCT_URL;
  readonly repo = input("");
  readonly repoId = input("");
  readonly category = input("");
  readonly categoryId = input("");
  readonly mapping = input("pathname");
  readonly strict = input("0");
  readonly reactionsEnabled = input("1");
  readonly emitMetadata = input("0");
  readonly inputPosition = input("bottom");
  readonly lang = input("fr");

  readonly accepted = signal(false);
  readonly optionalServicesAllowed = signal(false);
  readonly loading = signal(false);
  readonly loadingIndicatorVisible = signal(false);
  readonly loaded = signal(false);
  readonly error = signal(false);
  readonly theme = signal<SiteTheme>("light");
  readonly configured = computed(
    () =>
      Boolean(this.repo().trim()) &&
      Boolean(this.repoId().trim()) &&
      Boolean(this.category().trim()) &&
      Boolean(this.categoryId().trim()),
  );

  @ViewChild("giscusContainer")
  private readonly giscusContainer?: ElementRef<HTMLElement>;

  private themeObserver?: MutationObserver;
  private themeSyncTimers = new Set<number>();
  private loadingIndicatorTimer = 0;
  private readonly handleConsentChange = () => this.syncOptionalServicesConsent();

  ngAfterViewInit() {
    if (typeof window === "undefined") return;

    this.theme.set(getCurrentTheme());
    this.syncOptionalServicesConsent();
    document.addEventListener(SITE_EVENTS.consentChange, this.handleConsentChange);
    this.themeObserver = new MutationObserver(() => this.syncTheme());
    this.themeObserver.observe(document.documentElement, {
      attributeFilter: ["data-theme"],
      attributes: true,
    });

    if (hasAcceptedCodeOfConduct()) {
      this.accepted.set(true);
      if (this.optionalServicesAllowed()) window.setTimeout(() => this.loadGiscus());
    }
  }

  ngOnDestroy() {
    this.themeObserver?.disconnect();
    if (typeof window === "undefined") return;

    document.removeEventListener(SITE_EVENTS.consentChange, this.handleConsentChange);

    for (const timer of this.themeSyncTimers) {
      window.clearTimeout(timer);
    }
    this.themeSyncTimers.clear();
    this.endLoading();
  }

  acceptCodeOfConduct() {
    if (!this.configured() || this.accepted() || !this.optionalServicesAllowed()) return;

    rememberCodeOfConductAcceptance();
    this.accepted.set(true);
    window.setTimeout(() => this.loadGiscus());
  }

  private syncOptionalServicesConsent() {
    const allowed = hasOptionalServicesConsent();
    this.optionalServicesAllowed.set(allowed);
    if (allowed && this.accepted()) window.setTimeout(() => this.loadGiscus());
  }

  private loadGiscus() {
    const container = this.giscusContainer?.nativeElement;
    if (!container || this.loaded() || this.loading()) return;

    this.error.set(false);
    this.beginLoading();
    container.textContent = "";

    const script = document.createElement("script");
    script.src = GISCUS_SCRIPT_URL;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.setAttribute("data-repo", this.repo());
    script.setAttribute("data-repo-id", this.repoId());
    script.setAttribute("data-category", this.category());
    script.setAttribute("data-category-id", this.categoryId());
    script.setAttribute("data-mapping", this.mapping());
    script.setAttribute("data-strict", this.strict());
    script.setAttribute("data-reactions-enabled", this.reactionsEnabled());
    script.setAttribute("data-emit-metadata", this.emitMetadata());
    script.setAttribute("data-input-position", this.inputPosition());
    script.setAttribute("data-theme", this.themeUrl());
    script.setAttribute("data-lang", this.lang());
    script.setAttribute("data-loading", "lazy");

    script.addEventListener("load", () => {
      this.loaded.set(true);
      this.endLoading();
      this.scheduleThemeSync();
    });
    script.addEventListener("error", () => {
      this.error.set(true);
      this.endLoading();
      this.loaded.set(false);
    });

    container.append(script);
  }

  private beginLoading() {
    this.loading.set(true);
    this.cancelLoadingIndicatorTimer();
    this.loadingIndicatorTimer = window.setTimeout(() => {
      this.loadingIndicatorTimer = 0;
      if (this.loading()) this.loadingIndicatorVisible.set(true);
    }, LOADING_INDICATOR_DELAY_MS);
  }

  private endLoading() {
    this.loading.set(false);
    this.cancelLoadingIndicatorTimer();
    this.loadingIndicatorVisible.set(false);
  }

  private cancelLoadingIndicatorTimer() {
    if (!this.loadingIndicatorTimer || typeof window === "undefined") return;
    window.clearTimeout(this.loadingIndicatorTimer);
    this.loadingIndicatorTimer = 0;
  }

  private syncTheme() {
    const nextTheme = getCurrentTheme();
    this.theme.set(nextTheme);
    this.postTheme(nextTheme);
  }

  private scheduleThemeSync() {
    for (const delay of GISCUS_THEME_SYNC_DELAYS) {
      const timer = window.setTimeout(() => {
        this.themeSyncTimers.delete(timer);
        this.syncTheme();
      }, delay);
      this.themeSyncTimers.add(timer);
    }
  }

  private postTheme(theme: SiteTheme) {
    const iframe = this.getGiscusFrame();
    if (!iframe) return;

    iframe?.contentWindow?.postMessage(
      {
        giscus: {
          setConfig: {
            theme: this.themeUrl(theme),
          },
        },
      },
      GISCUS_ORIGIN,
    );
  }

  private getGiscusFrame() {
    const iframe =
      this.giscusContainer?.nativeElement.querySelector<HTMLIFrameElement>("iframe.giscus-frame") ??
      document.querySelector<HTMLIFrameElement>("iframe.giscus-frame");

    if (!iframe?.src) return;

    try {
      return new URL(iframe.src).origin === GISCUS_ORIGIN ? iframe : undefined;
    } catch {
      return undefined;
    }
  }

  private themeUrl(theme = this.theme()) {
    if (window.location.protocol !== "https:") {
      return GISCUS_FALLBACK_THEMES[theme];
    }

    const themeUrl = new URL(`/giscus/ct-${theme}.css`, window.location.origin);
    themeUrl.searchParams.set("v", GISCUS_THEME_VERSION);

    return themeUrl.toString();
  }
}
