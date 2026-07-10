import {
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  signal,
} from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";
import { SITE_LEGACY_STORAGE_KEYS, SITE_STORAGE_KEYS } from "@/lib/site-contracts";

type ThemePreference = "system" | "light" | "dark";
type MenuFocusTarget = "first-item" | "last-item";
type MaterialMenuElement = HTMLElement & {
  open: boolean;
  defaultFocus: MenuFocusTarget;
  close(): void;
  show(): void;
  activateNextItem(): HTMLElement;
  activatePreviousItem(): HTMLElement;
};

const STORAGE_KEY = SITE_STORAGE_KEYS.themePreference;
const LEGACY_STORAGE_KEY = SITE_LEGACY_STORAGE_KEYS.themePreference;
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
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "data-angular-component": "theme-switcher",
  },
  template: `
    <md-icon-button
      id="site-theme-trigger"
      type="button"
      class="site-theme-trigger"
      [attr.title]="triggerLabel()"
      [attr.aria-label]="triggerLabel()"
      [attr.aria-expanded]="menuOpen()"
      aria-controls="site-theme-menu"
      aria-haspopup="menu"
      (click)="toggleMenu()"
      (keydown)="handleTriggerKeydown($event)"
    >
      <md-icon aria-hidden="true">{{ triggerIcon() }}</md-icon>
    </md-icon-button>

    <md-menu
      #themeMenu
      id="site-theme-menu"
      class="site-theme-menu"
      anchor="site-theme-trigger"
      anchor-corner="end-end"
      menu-corner="start-end"
      positioning="popover"
      aria-label="Choisir le thème"
      (opened)="menuOpen.set(true)"
      (closed)="handleMenuClosed()"
    >
      @for (option of options; track option.value) {
        <md-menu-item
          type="button"
          class="site-theme-menu-item"
          [selected]="preference() === option.value"
          [attr.aria-label]="
            option.label + (preference() === option.value ? ', thème sélectionné' : '')
          "
          (click)="selectPreference(option.value)"
        >
          <md-icon
            slot="start"
            class="site-theme-radio-icon"
            [class.site-theme-radio-icon-checked]="preference() === option.value"
            aria-hidden="true"
          >
            {{ preference() === option.value ? checkedRadioIcon : uncheckedRadioIcon }}
          </md-icon>

          <span slot="headline" class="site-theme-menu-content">
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
                <rect
                  width="80"
                  height="80"
                  [class]="
                    option.value === 'dark'
                      ? 'site-theme-swatch-surface-dark'
                      : 'site-theme-swatch-surface-light'
                  "
                ></rect>
                @if (option.value === "system") {
                  <rect x="40" width="40" height="80" class="site-theme-swatch-surface-dark"></rect>
                }
                <rect
                  width="80"
                  height="17.24"
                  [class]="
                    option.value === 'dark'
                      ? 'site-theme-swatch-primary-dark'
                      : 'site-theme-swatch-primary-light'
                  "
                ></rect>
                @if (option.value === "system") {
                  <rect
                    x="40"
                    width="40"
                    height="17.24"
                    class="site-theme-swatch-primary-dark"
                  ></rect>
                }
                <g [attr.clip-path]="'url(#theme-pill-' + option.value + ')'">
                  <rect
                    x="20"
                    y="40"
                    width="40"
                    height="12"
                    [class]="
                      option.value === 'dark'
                        ? 'site-theme-swatch-primary-dark'
                        : 'site-theme-swatch-primary-light'
                    "
                  ></rect>
                  @if (option.value === "system") {
                    <rect
                      x="40"
                      y="40"
                      width="20"
                      height="12"
                      class="site-theme-swatch-primary-dark"
                    ></rect>
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
            <span>{{ option.label }}</span>
            @if (preference() === option.value) {
              <span class="sr-only">Thème sélectionné</span>
            }
          </span>
        </md-menu-item>
      }
    </md-menu>

    <span class="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {{ announcement() }}
    </span>
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      width: 2.5rem;
      height: 2.5rem;
      flex: 0 0 2.5rem;
    }
  `,
})
export class ThemeSwitcherComponent implements OnInit, OnDestroy {
  @ViewChild("themeMenu", { read: ElementRef })
  private themeMenu?: ElementRef<MaterialMenuElement>;

  readonly options = OPTIONS;
  readonly checkedRadioIcon = "\uE837";
  readonly uncheckedRadioIcon = "\uE836";
  readonly preference = signal<ThemePreference>("system");
  readonly announcement = signal("");
  readonly menuOpen = signal(false);
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
  private readonly handlePageShow = () => {
    this.syncPreferenceFromStorage();
  };

  ngOnInit() {
    if (typeof window === "undefined") return;

    this.systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
    this.systemTheme.addEventListener("change", this.handleSystemThemeChange);
    window.addEventListener("pageshow", this.handlePageShow);
    this.syncPreferenceFromStorage();
  }

  ngOnDestroy() {
    this.systemTheme?.removeEventListener("change", this.handleSystemThemeChange);
    if (typeof window === "undefined") return;

    window.removeEventListener("pageshow", this.handlePageShow);
  }

  toggleMenu() {
    const menu = this.themeMenu?.nativeElement;
    if (!menu) return;

    if (menu.open) menu.close();
    else {
      menu.defaultFocus = "first-item";
      menu.show();
    }
  }

  handleTriggerKeydown(event: KeyboardEvent) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

    event.preventDefault();
    const menu = this.themeMenu?.nativeElement;
    if (!menu) return;

    const focusTarget: MenuFocusTarget = event.key === "ArrowUp" ? "last-item" : "first-item";
    if (menu.open) {
      if (focusTarget === "first-item") menu.activateNextItem();
      else menu.activatePreviousItem();
      return;
    }

    menu.defaultFocus = focusTarget;
    menu.show();
  }

  handleMenuClosed() {
    this.menuOpen.set(false);
    const menu = this.themeMenu?.nativeElement;
    if (menu) menu.defaultFocus = "first-item";
  }

  selectPreference(preference: ThemePreference) {
    this.preference.set(preference);
    this.applyTheme(preference, true);
    const label = this.options.find((option) => option.value === preference)?.label;
    this.announcement.set(`Thème ${label ?? "Système"} activé`);
    this.menuOpen.set(false);
    void this.themeMenu?.nativeElement.close();
  }

  private applyTheme(preference: ThemePreference, persist: boolean) {
    const resolved =
      preference === "system" ? (this.systemTheme?.matches ? "dark" : "light") : preference;

    document.documentElement.dataset["theme"] = resolved;
    document.documentElement.dataset["themePreference"] = preference;
    document.documentElement.style.colorScheme = resolved;
    if (persist) {
      try {
        window.localStorage.setItem(STORAGE_KEY, preference);
      } catch {}
    }
  }

  private syncPreferenceFromStorage() {
    let stored: string | null = null;
    try {
      const current = window.localStorage.getItem(STORAGE_KEY);
      const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
      stored = isThemePreference(current) ? current : legacy;

      if (!isThemePreference(current) && isThemePreference(legacy)) {
        window.localStorage.setItem(STORAGE_KEY, legacy);
      }
      if (legacy !== null) window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {}

    const preference = isThemePreference(stored) ? stored : "system";
    this.preference.set(preference);
    this.applyTheme(preference, false);
  }
}
