import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatMenuModule } from "@angular/material/menu";
import { MatTooltipModule } from "@angular/material/tooltip";

type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "site_theme_preference";
const OPTIONS: ReadonlyArray<{ value: ThemePreference; label: string }> = [
  { value: "system", label: "Système" },
  { value: "light", label: "Clair" },
  { value: "dark", label: "Sombre" },
];

function isThemePreference(value: string | null | undefined): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

@Component({
  selector: "site-theme-switcher",
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      matIconButton
      type="button"
      class="site-theme-trigger site-icon-button"
      [matMenuTriggerFor]="themeMenu"
      [matTooltip]="triggerLabel()"
      matTooltipPosition="below"
      [attr.aria-label]="triggerLabel()"
      aria-haspopup="menu"
    >
      <mat-icon aria-hidden="true">{{ triggerIcon() }}</mat-icon>
    </button>

    <mat-menu
      #themeMenu="matMenu"
      xPosition="before"
      class="site-theme-menu"
      aria-label="Choisir le thème"
    >
      @for (option of options; track option.value) {
        <button
          mat-menu-item
          type="button"
          class="site-theme-menu-item"
          role="menuitemradio"
          [attr.aria-checked]="preference() === option.value"
          (click)="selectPreference(option.value)"
        >
          <mat-icon
            matMenuItemIcon
            class="site-theme-radio-icon"
            [class.site-theme-radio-icon--checked]="preference() === option.value"
            aria-hidden="true"
          >
            {{ preference() === option.value ? "radio_button_checked" : "radio_button_unchecked" }}
          </mat-icon>

          <span class="site-theme-menu-content">
            <svg
              class="site-theme-example-icon"
              width="25"
              height="24"
              viewBox="0 0 80 80"
              aria-hidden="true"
              focusable="false"
            >
              <defs>
                <clipPath [attr.id]="'theme-swatch-' + option.value">
                  <rect width="80" height="80" rx="2.13"></rect>
                </clipPath>
                <clipPath [attr.id]="'theme-pill-' + option.value">
                  <rect x="20" y="40" width="40" height="12" rx="6"></rect>
                </clipPath>
              </defs>
              <g [attr.clip-path]="'url(#theme-swatch-' + option.value + ')'">
                <rect width="80" height="80" [attr.fill]="option.value === 'dark' ? '#000' : '#fff'"></rect>
                @if (option.value === 'system') {
                  <rect x="40" width="40" height="80" fill="#000"></rect>
                }
                <rect
                  width="80"
                  height="17.24"
                  [attr.fill]="option.value === 'dark' ? '#90caf9' : '#1565c0'"
                ></rect>
                @if (option.value === 'system') {
                  <rect x="40" width="40" height="17.24" fill="#90caf9"></rect>
                }
                <g [attr.clip-path]="'url(#theme-pill-' + option.value + ')'">
                  <rect
                    x="20"
                    y="40"
                    width="40"
                    height="12"
                    [attr.fill]="option.value === 'dark' ? '#90caf9' : '#1565c0'"
                  ></rect>
                  @if (option.value === 'system') {
                    <rect x="40" y="40" width="20" height="12" fill="#90caf9"></rect>
                  }
                </g>
              </g>
              <rect
                x="0.5"
                y="0.5"
                width="79"
                height="79"
                rx="2.13"
                fill="none"
                stroke="currentColor"
                stroke-opacity="0.24"
              ></rect>
            </svg>
            <span class="site-theme-menu-label">{{ option.label }}</span>
          </span>
        </button>
      }
    </mat-menu>

    <span class="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {{ announcement() }}
    </span>
  `,
  styles: `
    :host {
      display: block;
      width: 2.5rem;
      height: 2.5rem;
      flex: 0 0 2.5rem;
    }

    .site-theme-trigger.mat-mdc-icon-button.mat-mdc-button-base {
      background: transparent;
      --site-icon-button-color: var(--site-text);
      --mat-icon-button-state-layer-color: var(--site-text);
      --mat-icon-button-ripple-color: var(--site-theme-ripple-color);
    }
  `,
})
export class ThemeSwitcherComponent implements OnInit, OnDestroy {
  readonly options = OPTIONS;
  readonly preference = signal<ThemePreference>("system");
  readonly announcement = signal("");
  readonly triggerLabel = computed(() => {
    const label = this.options.find((option) => option.value === this.preference())?.label;
    return `Thème : ${label ?? "Système"}`;
  });
  readonly triggerIcon = computed(() => {
    switch (this.preference()) {
      case "dark":
        return "\uE3A6";
      case "light":
        return "\uE3AA";
      default:
        return "\uE1AB";
    }
  });

  private systemTheme?: MediaQueryList;

  private readonly handleSystemThemeChange = () => {
    if (this.preference() === "system") this.applyTheme("system", false);
  };

  ngOnInit() {
    if (typeof window === "undefined") return;

    this.systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
    this.systemTheme.addEventListener("change", this.handleSystemThemeChange);

    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {}
    const initial = isThemePreference(stored) ? stored : "system";
    this.preference.set(initial);
    this.applyTheme(initial, false);
  }

  ngOnDestroy() {
    this.systemTheme?.removeEventListener("change", this.handleSystemThemeChange);
  }

  selectPreference(preference: ThemePreference) {
    this.preference.set(preference);
    this.applyTheme(preference, true);
    const label = this.options.find((option) => option.value === preference)?.label;
    this.announcement.set(`Thème ${label ?? "Système"} activé`);
  }

  private applyTheme(preference: ThemePreference, persist: boolean) {
    const resolved =
      preference === "system"
        ? this.systemTheme?.matches
          ? "dark"
          : "light"
        : preference;

    document.documentElement.dataset["theme"] = resolved;
    document.documentElement.dataset["themePreference"] = preference;
    document.documentElement.style.colorScheme = resolved;
    if (persist) {
      try {
        window.localStorage.setItem(STORAGE_KEY, preference);
      } catch {}
    }
  }
}
