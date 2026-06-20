import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatRippleModule } from "@angular/material/core";
import { MatMenuModule, MatMenuTrigger } from "@angular/material/menu";
import { MatRadioModule } from "@angular/material/radio";
import { MatTooltipModule } from "@angular/material/tooltip";

type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "site_theme_preference";
const ICONS = {
  formatColorFill:
    "M16.56 8.94 7.62 0 6.21 1.41l2.38 2.38-5.15 5.15c-.59.59-.59 1.54 0 2.12l5.5 5.5c.29.29.68.44 1.06.44s.77-.15 1.06-.44l5.5-5.5c.59-.59.59-1.53 0-2.12ZM5.21 10 10 5.21 14.79 10H5.21ZM19 11.5s-2 2.17-2 3.5c0 1.1.9 2 2 2s2-.9 2-2c0-1.33-2-3.5-2-3.5ZM2 20h20v4H2Z",
} as const;

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
    MatMenuModule,
    MatRadioModule,
    MatRippleModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      matIconButton
      type="button"
      class="site-theme-trigger site-icon-button"
      #menuTrigger="matMenuTrigger"
      [matMenuTriggerFor]="themeMenu"
      [matTooltip]="triggerLabel()"
      matTooltipPosition="below"
      [attr.aria-label]="triggerLabel()"
      aria-haspopup="menu"
    >
      <svg matButtonIcon aria-hidden="true" viewBox="0 0 24 24" focusable="false">
        <path [attr.d]="icons.formatColorFill"></path>
      </svg>
    </button>

    <mat-menu #themeMenu="matMenu" xPosition="before" class="site-theme-menu">
      <mat-radio-group
        class="site-theme-radio-group"
        [value]="preference()"
        aria-label="Choisir le thème"
      >
        @for (option of options; track option.value) {
          <mat-radio-button
            matRipple
            class="site-theme-radio-option"
            [value]="option.value"
            [disableRipple]="true"
            matRippleColor="var(--site-theme-ripple-color)"
            (change)="selectPreference(option.value, menuTrigger)"
          >
            <span class="site-theme-radio-content">
              <span>{{ option.label }}</span>
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
            </span>
          </mat-radio-button>
        }
      </mat-radio-group>
    </mat-menu>
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
  readonly icons = ICONS;
  readonly options = OPTIONS;
  readonly preference = signal<ThemePreference>("system");
  readonly triggerLabel = computed(() => {
    const label = this.options.find((option) => option.value === this.preference())?.label;
    return `Thème : ${label ?? "Système"}`;
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

  selectPreference(preference: ThemePreference, menuTrigger: MatMenuTrigger) {
    this.preference.set(preference);
    this.applyTheme(preference, true);
    menuTrigger.closeMenu();
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
