import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  signal,
} from "@angular/core";
import type { OnInit } from "@angular/core";
import { MatIconButton } from "@angular/material/button";
import { MatIcon } from "@angular/material/icon";
import { MatTooltip } from "@angular/material/tooltip";
import {
  SITE_COOKIE_NAMES,
  SITE_EVENTS,
  SITE_LEGACY_COOKIE_NAMES,
  SITE_LEGACY_STORAGE_KEYS,
  SITE_STORAGE_KEYS,
} from "@/lib/site-contracts";

type KonachanRatingPreference = "safe" | "questionable" | "explicit";

interface RatingOption {
  readonly value: KonachanRatingPreference;
  readonly label: string;
  readonly icon: string;
}

const RATING_OPTIONS: readonly RatingOption[] = [
  {
    value: "safe",
    label: "Images Konachan safe",
    icon: "\uEF80",
  },
  {
    value: "questionable",
    label: "Images Konachan questionable",
    icon: "\uF8EA",
  },
  {
    value: "explicit",
    label: "Images Konachan explicites",
    icon: "\uF8FD",
  },
];

function normalizeRatingPreference(
  value: string | null | undefined,
): KonachanRatingPreference | null {
  if (value === "safe" || value === "questionable" || value === "explicit") {
    return value;
  }

  if (value === "sensitive") return "questionable";

  return null;
}

@Component({
  selector: "site-konachan-rating-toggle",
  standalone: true,
  imports: [MatIconButton, MatIcon, MatTooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="home-anime-rating-picker"
      [class.is-open]="optionsOpen()"
      role="group"
      aria-label="Niveau Konachan"
    >
      <button
        matIconButton
        type="button"
        class="home-anime-rating-trigger"
        [class.is-safe]="ratingPreference() === 'safe'"
        [class.is-questionable]="ratingPreference() === 'questionable'"
        [class.is-explicit]="ratingPreference() === 'explicit'"
        [matTooltip]="triggerLabel()"
        matTooltipPosition="below"
        [attr.aria-expanded]="optionsOpen()"
        aria-controls="home-anime-rating-options"
        [attr.aria-label]="triggerLabel()"
        aria-haspopup="true"
        (click)="toggleOptions()"
      >
        <mat-icon aria-hidden="true">{{ triggerIcon() }}</mat-icon>
      </button>

      <div
        id="home-anime-rating-options"
        class="home-anime-rating-options"
        [attr.aria-hidden]="!optionsOpen()"
      >
        @for (option of ratingOptions; track option.value) {
          @if (option.value !== ratingPreference()) {
            <button
              matIconButton
              type="button"
              class="home-anime-rating-option"
              [class.is-safe]="option.value === 'safe'"
              [class.is-questionable]="option.value === 'questionable'"
              [class.is-explicit]="option.value === 'explicit'"
              [disabled]="!optionsOpen()"
              [tabIndex]="optionsOpen() ? 0 : -1"
              [attr.aria-label]="'Choisir ' + option.label"
              [matTooltip]="option.label"
              matTooltipPosition="below"
              (click)="selectRating(option.value)"
            >
              <mat-icon aria-hidden="true">{{ option.icon }}</mat-icon>
            </button>
          }
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      position: absolute;
      top: 0.75rem;
      left: 0.75rem;
      z-index: 2;
      display: inline-flex;
    }

    .home-anime-rating-picker {
      position: relative;
      display: inline-flex;
      align-items: center;
    }

    .home-anime-rating-options {
      position: absolute;
      top: 0;
      left: calc(100% + 0.35rem);
      display: inline-flex;
      gap: 0.25rem;
      pointer-events: none;
    }

    .home-anime-rating-picker.is-open .home-anime-rating-options {
      pointer-events: auto;
    }

    .home-anime-rating-trigger.mat-mdc-icon-button,
    .home-anime-rating-option.mat-mdc-icon-button {
      --mat-icon-button-icon-color: #fff;
      --mat-icon-button-state-layer-color: #fff;
      --mat-icon-button-ripple-color: rgb(255 255 255 / 12%);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.5rem;
      height: 2.5rem;
      padding: 0;
      background: rgb(0 0 0 / 52%);
      color: #fff;
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
    }

    .home-anime-rating-option.mat-mdc-icon-button {
      opacity: 0;
      transform: translateX(-0.5rem) scale(0.82);
      transition:
        opacity 160ms ease,
        transform 180ms cubic-bezier(0.2, 0, 0, 1);
    }

    .home-anime-rating-option.mat-mdc-icon-button:nth-child(2) {
      transition-delay: 25ms;
    }

    .home-anime-rating-option.mat-mdc-icon-button:nth-child(3) {
      transition-delay: 50ms;
    }

    .home-anime-rating-picker.is-open .home-anime-rating-option.mat-mdc-icon-button {
      opacity: 1;
      transform: translateX(0) scale(1);
    }

    .home-anime-rating-trigger.is-safe.mat-mdc-icon-button {
      --mat-icon-button-icon-color: var(--mat-sys-on-primary-container);
      --mat-icon-button-state-layer-color: var(--mat-sys-on-primary-container);
      --mat-icon-button-ripple-color: color-mix(
        in srgb,
        var(--mat-sys-on-primary-container) 12%,
        transparent
      );
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
    }

    .home-anime-rating-trigger.is-questionable.mat-mdc-icon-button {
      --mat-icon-button-icon-color: var(--mat-sys-on-tertiary-container);
      --mat-icon-button-state-layer-color: var(--mat-sys-on-tertiary-container);
      --mat-icon-button-ripple-color: color-mix(
        in srgb,
        var(--mat-sys-on-tertiary-container) 12%,
        transparent
      );
      background: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
    }

    .home-anime-rating-trigger.is-explicit.mat-mdc-icon-button {
      --mat-icon-button-icon-color: var(--mat-sys-on-error-container);
      --mat-icon-button-state-layer-color: var(--mat-sys-on-error-container);
      --mat-icon-button-ripple-color: color-mix(
        in srgb,
        var(--mat-sys-on-error-container) 12%,
        transparent
      );
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }

    .home-anime-rating-trigger .mat-icon,
    .home-anime-rating-option .mat-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      font-size: 24px;
      line-height: 1;
      margin: 0;
    }

    @media (max-width: 360px) {
      .home-anime-rating-options {
        top: calc(100% + 0.35rem);
        left: 0;
        flex-direction: column;
      }

      .home-anime-rating-option.mat-mdc-icon-button {
        transform: translateY(-0.5rem) scale(0.82);
      }
    }

    @media (max-width: 735px) {
      :host {
        top: 0.65rem;
        left: 0.65rem;
      }
    }
  `,
})
export class KonachanRatingToggleComponent implements OnInit {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly ratingOptions = RATING_OPTIONS;
  readonly optionsOpen = signal(false);
  readonly ratingPreference = signal<KonachanRatingPreference>("safe");
  readonly triggerLabel = computed(() => {
    const label = this.ratingOptions.find(
      (option) => option.value === this.ratingPreference(),
    )?.label;

    return `Niveau Konachan : ${label ?? "Images Konachan safe"}`;
  });
  readonly triggerIcon = computed(() => {
    return (
      this.ratingOptions.find((option) => option.value === this.ratingPreference())?.icon ??
      RATING_OPTIONS[0].icon
    );
  });

  ngOnInit() {
    const stored = this.readStoredPreference();
    this.ratingPreference.set(stored);
    this.persistPreference(stored);
  }

  selectRating(preference: KonachanRatingPreference) {
    this.closeOptions();
    if (this.ratingPreference() === preference) return;

    this.ratingPreference.set(preference);
    this.persistPreference(preference);
    this.emitChange(preference);
  }

  toggleOptions() {
    this.optionsOpen.update((open) => !open);
  }

  closeOptions() {
    this.optionsOpen.set(false);
  }

  @HostListener("document:pointerdown", ["$event"])
  handleDocumentPointerDown(event: PointerEvent) {
    if (!this.optionsOpen()) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (!this.elementRef.nativeElement.contains(target)) this.closeOptions();
  }

  @HostListener("document:keydown.escape")
  handleEscapeKey() {
    this.closeOptions();
  }

  private readStoredPreference(): KonachanRatingPreference {
    const candidates = [
      this.readLocalStorage(SITE_STORAGE_KEYS.homeKonachanRatingPreference),
      this.readLocalStorage(SITE_LEGACY_STORAGE_KEYS.homeKonachanRatingPreference),
      this.readCookie(SITE_COOKIE_NAMES.homeKonachanRatingPreference),
      this.readCookie(SITE_LEGACY_COOKIE_NAMES.homeKonachanRatingPreference),
    ];

    for (const candidate of candidates) {
      const normalized = normalizeRatingPreference(candidate);
      if (normalized) return normalized;
    }

    return "safe";
  }

  private persistPreference(preference: KonachanRatingPreference) {
    try {
      localStorage.setItem(SITE_STORAGE_KEYS.homeKonachanRatingPreference, preference);
      localStorage.removeItem(SITE_LEGACY_STORAGE_KEYS.homeKonachanRatingPreference);
    } catch {}

    this.writeCookie(SITE_COOKIE_NAMES.homeKonachanRatingPreference, preference);
    this.expireCookie(SITE_LEGACY_COOKIE_NAMES.homeKonachanRatingPreference);
  }

  private readLocalStorage(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private readCookie(name: string) {
    if (typeof document === "undefined") return null;

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

  private writeCookie(name: string, value: string) {
    if (typeof document === "undefined") return;

    document.cookie = [
      `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
      "Max-Age=31536000",
      "Path=/",
      "SameSite=Lax",
    ].join("; ");
  }

  private expireCookie(name: string) {
    if (typeof document === "undefined") return;

    document.cookie = `${encodeURIComponent(name)}=; Max-Age=0; Path=/; SameSite=Lax`;
  }

  private emitChange(preference: KonachanRatingPreference) {
    if (typeof document === "undefined") return;

    document.dispatchEvent(
      new CustomEvent(SITE_EVENTS.konachanRatingChange, {
        detail: {
          ratingPreference: preference,
          allowSensitive: preference !== "safe",
          allowExplicit: preference === "explicit",
        },
      }),
    );
  }
}
