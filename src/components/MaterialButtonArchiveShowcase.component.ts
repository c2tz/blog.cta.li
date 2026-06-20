import { ChangeDetectionStrategy, Component } from "@angular/core";
import { MatButtonModule, type MatButtonAppearance } from "@angular/material/button";

const GOOGLE_LINK = "https://www.google.com/";

const ICONS: Record<string, string> = {
  delete:
    "M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z",
  favorite:
    "M480-120 423-172q-99-90-164-154T155-443q-39-53-57-98.5T80-634q0-94 63-157t157-63q52 0 99 22t81 62q34-40 81-62t99-22q94 0 157 63t63 157q0 47-18 92.5T805-443q-39 53-104 117T537-172l-57 52Zm0-108q96-86 158-147.5t98-107q36-45.5 50-80T800-634q0-60-40-100t-100-40q-47 0-87 26.5T518-680h-76q-15-41-55-67.5T300-774q-60 0-100 40t-40 100q0 36 14 70.5t50 80q36 45.5 98 107T480-228Zm0-273Z",
  home:
    "M240-200h120v-240h240v240h120v-360L480-740 240-560v360Zm-80 80v-480l320-240 320 240v480H520v-240h-80v240H160Zm320-350Z",
  menu: "M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z",
  moreVert:
    "M480-160q-33 0-56.5-23.5T400-240q0-33 23.5-56.5T480-320q33 0 56.5 23.5T560-240q0 33-23.5 56.5T480-160Zm0-240q-33 0-56.5-23.5T400-480q0-33 23.5-56.5T480-560q33 0 56.5 23.5T560-480q0 33-23.5 56.5T480-400Zm0-240q-33 0-56.5-23.5T400-720q0-33 23.5-56.5T480-800q33 0 56.5 23.5T560-720q0 33-23.5 56.5T480-640Z",
  openInNew:
    "M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h280v80H200v560h560v-280h80v280q0 33-23.5 56.5T760-120H200Zm188-212-56-56 372-372H560v-80h280v280h-80v-144L388-332Z",
};

interface StandardItem {
  disabled?: boolean;
  href?: string;
  text: string;
}

interface StandardSection {
  appearance: MatButtonAppearance;
  label: string;
  items: StandardItem[];
}

interface IconItem {
  ariaLabel?: string;
  disabled?: boolean;
  href?: string;
  icon: string;
  text?: string;
}

@Component({
  selector: "material-button-archive-showcase",
  standalone: true,
  imports: [MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="material-button-template" aria-label="Boutons Angular Material de l'archive">
      @for (section of standardSections; track section.label; let sectionIndex = $index) {
        @if (sectionIndex > 0) {
          <div class="material-button-template__divider" aria-hidden="true"></div>
        }
        <section class="material-button-template__section">
          <div class="example-label">{{ section.label }}</div>
          <div class="example-button-row">
            @for (item of section.items; track item.text) {
              @if (item.href) {
                <a
                  [matButton]="section.appearance"
                  class="material-archive-button site-material-ripple"
                  [href]="item.href"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {{ item.text }}
                </a>
              } @else {
                <button
                  [matButton]="section.appearance"
                  type="button"
                  class="material-archive-button site-material-ripple"
                  [disabled]="item.disabled === true"
                >
                  {{ item.text }}
                </button>
              }
            }
          </div>
        </section>
      }

      @for (section of iconSections; track section.label) {
        <div class="material-button-template__divider" aria-hidden="true"></div>
        <section class="material-button-template__section">
          <div class="example-label">{{ section.label }}</div>
          <div class="example-button-row">
            @switch (section.kind) {
              @case ("icon") {
                @for (item of section.items; track item.ariaLabel) {
                  <button
                    matIconButton
                    type="button"
                    class="material-archive-icon-button site-material-ripple"
                    [disabled]="item.disabled === true"
                    [attr.aria-label]="item.ariaLabel ?? null"
                  >
                    <svg
                      class="material-button-template__icon"
                      viewBox="0 -960 960 960"
                      aria-hidden="true"
                    >
                      <path [attr.d]="icons[item.icon]"></path>
                    </svg>
                  </button>
                }
              }
              @case ("fab") {
                @for (item of section.items; track item.ariaLabel) {
                  <button
                    matFab
                    type="button"
                    class="material-archive-fab material-archive-fab--regular site-material-ripple"
                    [disabled]="item.disabled === true"
                    [attr.aria-label]="item.ariaLabel ?? null"
                  >
                    <svg
                      matButtonIcon
                      class="material-button-template__icon"
                      viewBox="0 -960 960 960"
                      aria-hidden="true"
                    >
                      <path [attr.d]="icons[item.icon]"></path>
                    </svg>
                  </button>
                }
              }
              @case ("miniFab") {
                @for (item of section.items; track item.ariaLabel) {
                  <button
                    matMiniFab
                    type="button"
                    class="material-archive-fab material-archive-fab--mini site-material-ripple"
                    [disabled]="item.disabled === true"
                    [attr.aria-label]="item.ariaLabel ?? null"
                  >
                    <svg
                      matButtonIcon
                      class="material-button-template__icon"
                      viewBox="0 -960 960 960"
                      aria-hidden="true"
                    >
                      <path [attr.d]="icons[item.icon]"></path>
                    </svg>
                  </button>
                }
              }
              @case ("extendedFab") {
                @for (item of section.items; track item.text) {
                  @if (item.href) {
                    <a
                      matFab
                      extended
                      class="material-archive-extended-fab site-material-ripple"
                      [href]="item.href"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <svg
                        matButtonIcon
                        class="material-button-template__icon"
                        viewBox="0 -960 960 960"
                        aria-hidden="true"
                      >
                        <path [attr.d]="icons[item.icon]"></path>
                      </svg>
                      <span>{{ item.text }}</span>
                    </a>
                  } @else {
                    <button
                      matFab
                      extended
                      type="button"
                      class="material-archive-extended-fab site-material-ripple"
                      [disabled]="item.disabled === true"
                    >
                      <svg
                        matButtonIcon
                        class="material-button-template__icon"
                        viewBox="0 -960 960 960"
                        aria-hidden="true"
                      >
                        <path [attr.d]="icons[item.icon]"></path>
                      </svg>
                      <span>{{ item.text }}</span>
                    </button>
                  }
                }
              }
            }
          </div>
        </section>
      }
    </div>
  `,
  styles: [`
    .material-button-template {
      margin-block: 1.5rem;
      border-block: 1px solid var(--site-border);
    }

    .material-button-template__section {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding-block: 1rem;
    }

    .material-button-template__divider {
      height: 1px;
      background: var(--site-border);
    }

    .example-label {
      flex: 0 0 7.5rem;
      color: var(--site-muted);
      font-size: 0.875rem;
      font-weight: 600;
      line-height: 1.25;
    }

    .example-button-row {
      display: flex;
      flex: 1 1 auto;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
      min-width: 0;
    }

    .material-button-template .material-archive-button {
      margin: 0;
      white-space: nowrap;
    }

    .material-button-template .mat-mdc-elevated-button {
      background: var(--site-bg);
      box-shadow: var(--mat-sys-level1);
      color: var(--site-link);
    }

    .material-button-template .mat-mdc-elevated-button:is(:hover, :focus-visible) {
      box-shadow: var(--mat-sys-level2);
    }

    .material-button-template .mat-mdc-outlined-button {
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--site-link) 56%, transparent);
    }

    .material-button-template .material-archive-icon-button,
    .material-button-template .material-archive-fab,
    .material-button-template .material-archive-extended-fab {
      position: relative;
      isolation: isolate;
    }

    .material-button-template .material-archive-icon-button {
      color: var(--site-link);
    }

    .material-button-template .material-archive-fab,
    .material-button-template .material-archive-extended-fab {
      background: var(--site-link-container);
      box-shadow: var(--mat-sys-level3);
      color: var(--site-on-link-container);
    }

    .material-button-template .material-archive-fab--mini {
      width: 2.5rem;
      height: 2.5rem;
      min-width: 2.5rem;
    }

    .material-button-template
      :is(.material-archive-fab, .material-archive-extended-fab):is(:hover, :focus-visible) {
      box-shadow: var(--mat-sys-level4);
    }

    .material-button-template
      :is(.material-archive-fab, .material-archive-extended-fab):active {
      box-shadow: var(--mat-sys-level3);
      transform: translateY(1px);
    }

    .material-button-template .material-button-template__icon {
      position: relative;
      z-index: 1;
      width: 20px;
      height: 20px;
      flex: 0 0 auto;
      fill: currentColor;
    }

    .material-button-template :disabled {
      cursor: default;
      opacity: 0.62;
      pointer-events: none;
    }

    @media (max-width: 640px) {
      .material-button-template__section {
        align-items: flex-start;
        flex-direction: column;
        gap: 0.75rem;
      }

      .example-label {
        flex-basis: auto;
      }
    }
  `],
})
export class MaterialButtonArchiveShowcaseComponent {
  readonly icons = ICONS;

  readonly standardSections: StandardSection[] = [
    {
      label: "Text",
      appearance: "text",
      items: [
        { text: "Basic" },
        { text: "Disabled", disabled: true },
        { text: "Link", href: GOOGLE_LINK },
      ],
    },
    {
      label: "Elevated",
      appearance: "elevated",
      items: [
        { text: "Basic" },
        { text: "Disabled", disabled: true },
        { text: "Link", href: GOOGLE_LINK },
      ],
    },
    {
      label: "Outlined",
      appearance: "outlined",
      items: [
        { text: "Basic" },
        { text: "Disabled", disabled: true },
        { text: "Link", href: GOOGLE_LINK },
      ],
    },
    {
      label: "Filled",
      appearance: "filled",
      items: [
        { text: "Basic" },
        { text: "Disabled", disabled: true },
        { text: "Link", href: GOOGLE_LINK },
      ],
    },
    {
      label: "Tonal",
      appearance: "tonal",
      items: [
        { text: "Basic" },
        { text: "Disabled", disabled: true },
        { text: "Link", href: GOOGLE_LINK },
      ],
    },
  ];

  readonly iconSections = [
    {
      label: "Icon",
      kind: "icon",
      items: [
        {
          ariaLabel: "Example icon button with a vertical three dot icon",
          icon: "moreVert",
        },
        {
          ariaLabel: "Example icon button with a open in new tab icon",
          icon: "openInNew",
          disabled: true,
        },
      ] satisfies IconItem[],
    },
    {
      label: "Floating Action Button (FAB)",
      kind: "fab",
      items: [
        {
          ariaLabel: "Example icon button with a delete icon",
          icon: "delete",
        },
        {
          ariaLabel: "Example icon button with a heart icon",
          icon: "favorite",
          disabled: true,
        },
      ] satisfies IconItem[],
    },
    {
      label: "Mini FAB",
      kind: "miniFab",
      items: [
        {
          ariaLabel: "Example icon button with a menu icon",
          icon: "menu",
        },
        {
          ariaLabel: "Example icon button with a home icon",
          icon: "home",
          disabled: true,
        },
      ] satisfies IconItem[],
    },
    {
      label: "Extended FAB",
      kind: "extendedFab",
      items: [
        { text: "Basic", icon: "favorite" },
        { text: "Disabled", icon: "favorite", disabled: true },
        { text: "Link", icon: "favorite", href: GOOGLE_LINK },
      ] satisfies IconItem[],
    },
  ];
}
