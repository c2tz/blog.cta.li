import {
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
import { MatExpansionModule } from "@angular/material/expansion";
import { MatProgressBar } from "@angular/material/progress-bar";
import { SITE_STORAGE_KEYS } from "@/lib/site-contracts";

type SiteTheme = "dark" | "light";

const STORAGE_KEY = SITE_STORAGE_KEYS.giscusCommentsEnabled;
const GISCUS_ORIGIN = "https://giscus.app";
const GISCUS_SCRIPT_URL = `${GISCUS_ORIGIN}/client.js`;
const GISCUS_THEME_SYNC_DELAYS = [0, 150, 500, 1200] as const;
const GISCUS_FALLBACK_THEMES = {
  dark: "dark_dimmed",
  light: "light",
} as const satisfies Record<SiteTheme, string>;

function readEnabledPreference() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "enabled";
  } catch {
    return false;
  }
}

function writeEnabledPreference(enabled: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "enabled" : "disabled");
  } catch {}
}

function getCurrentTheme(): SiteTheme {
  return document.documentElement.dataset["theme"] === "dark" ? "dark" : "light";
}

@Component({
  selector: "site-giscus-comments",
  standalone: true,
  imports: [MatExpansionModule, MatProgressBar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <section class="giscus-comments" aria-label="Commentaires" data-pagefind-ignore>
      @if (!configured()) {
        <p id="giscus-comments-config" class="giscus-comments-config">
          Configuration Giscus en attente : ajoutez le repo public, le repo ID, la catégorie et le
          category ID.
        </p>
      }

      <mat-expansion-panel
        class="giscus-comments-expansion"
        [expanded]="enabled()"
        [disabled]="!configured()"
        (opened)="openComments()"
        (closed)="closeComments()"
      >
        <mat-expansion-panel-header>
          <mat-panel-title>Commentaires</mat-panel-title>
        </mat-expansion-panel-header>

        <div
          class="giscus-comments-panel-content"
          [class.is-loading]="loading()"
          [attr.aria-busy]="loading()"
        >
          @if (loading()) {
            <mat-progress-bar
              class="giscus-comments-progress"
              mode="indeterminate"
              aria-label="Chargement des commentaires"
            />
            <div class="giscus-comments-skeleton" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
            </div>
          }

          @if (error()) {
            <p class="giscus-comments-error">
              Les commentaires ne sont pas disponibles pour le moment.
            </p>
          }

          <div #giscusContainer class="giscus-comments-frame"></div>
        </div>
      </mat-expansion-panel>
    </section>
  `,
  styles: `
    :host {
      display: block;
      margin-block-start: 1rem;
    }

    .giscus-comments {
      padding-block-start: 0.75rem;
      border-block-start: 1px solid var(--site-border);
    }

    .giscus-comments-config,
    .giscus-comments-error {
      margin-block: 0;
      color: var(--site-muted);
      font-size: 0.95rem;
      line-height: 1.5;
    }

    .giscus-comments-config {
      margin-block-end: 0.5rem;
      color: var(--site-link);
    }

    .giscus-comments-expansion.mat-expansion-panel {
      border-radius: 0;
      background: transparent;
      box-shadow: none;
      color: var(--site-text);
      font-family: var(--site-font);
    }

    .giscus-comments-expansion .mat-expansion-panel-header {
      min-height: 2.5rem;
      padding-inline: 0;
      color: var(--site-text);
      font-family: var(--site-font);
    }

    .giscus-comments-expansion .mat-expansion-panel-header-title {
      color: var(--site-text);
      font-family: var(--site-font);
      font-size: 1rem;
      font-weight: 400;
    }

    .giscus-comments-expansion .mat-expansion-indicator::after {
      color: var(--site-link);
    }

    .giscus-comments-panel-content {
      position: relative;
      min-height: 7rem;
      padding-block-start: 0.75rem;
    }

    .giscus-comments-progress.mat-mdc-progress-bar {
      height: 0.18rem;
      overflow: hidden;
      border-radius: 9999px;
      --mdc-linear-progress-active-indicator-color: var(--site-link);
      --mdc-linear-progress-track-color: color-mix(in srgb, var(--site-link) 16%, transparent);
    }

    .giscus-comments-skeleton {
      display: grid;
      gap: 0.65rem;
      margin-block-start: 1rem;
    }

    .giscus-comments-skeleton span {
      display: block;
      height: 0.85rem;
      border-radius: 9999px;
      background: linear-gradient(
        90deg,
        color-mix(in srgb, var(--site-link-container) 45%, transparent),
        color-mix(in srgb, var(--site-link-container) 80%, transparent),
        color-mix(in srgb, var(--site-link-container) 45%, transparent)
      );
      background-size: 200% 100%;
      animation: giscus-comments-skeleton 1.4s ease-in-out infinite;
    }

    .giscus-comments-skeleton span:nth-child(1) {
      width: 68%;
    }

    .giscus-comments-skeleton span:nth-child(2) {
      width: 92%;
    }

    .giscus-comments-skeleton span:nth-child(3) {
      width: 52%;
    }

    .giscus-comments-frame {
      min-width: 0;
    }

    .giscus-comments-error {
      margin-block-start: 1rem;
      color: var(--site-muted);
    }

    @keyframes giscus-comments-skeleton {
      from {
        background-position: 200% 0;
      }

      to {
        background-position: -200% 0;
      }
    }
  `,
})
export class GiscusCommentsComponent implements AfterViewInit, OnDestroy {
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

  readonly enabled = signal(false);
  readonly loading = signal(false);
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

  ngAfterViewInit() {
    if (typeof window === "undefined") return;

    this.theme.set(getCurrentTheme());
    this.themeObserver = new MutationObserver(() => this.syncTheme());
    this.themeObserver.observe(document.documentElement, {
      attributeFilter: ["data-theme"],
      attributes: true,
    });

    if (this.configured() && readEnabledPreference()) {
      this.enabled.set(true);
      window.queueMicrotask(() => this.loadGiscus());
    }
  }

  ngOnDestroy() {
    this.themeObserver?.disconnect();
    if (typeof window === "undefined") return;

    for (const timer of this.themeSyncTimers) {
      window.clearTimeout(timer);
    }
    this.themeSyncTimers.clear();
  }

  openComments() {
    if (!this.configured()) return;

    this.enabled.set(true);
    writeEnabledPreference(true);
    this.loadGiscus();
  }

  closeComments() {
    this.enabled.set(false);
    writeEnabledPreference(false);
  }

  private loadGiscus() {
    const container = this.giscusContainer?.nativeElement;
    if (!container || this.loaded() || this.loading()) return;

    this.error.set(false);
    this.loading.set(true);
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
      this.loading.set(false);
      this.scheduleThemeSync();
    });
    script.addEventListener("error", () => {
      this.error.set(true);
      this.loading.set(false);
      this.loaded.set(false);
    });

    container.append(script);
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

    return new URL(`/giscus/ct-${theme}.css`, window.location.origin).toString();
  }
}
