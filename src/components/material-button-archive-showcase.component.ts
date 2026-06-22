import { ChangeDetectionStrategy, Component } from "@angular/core";
import {
  MatButton,
  MatFabButton,
  MatIconButton,
  MatMiniFabButton,
  type MatButtonAppearance,
} from "@angular/material/button";
import { MatIcon } from "@angular/material/icon";

const GOOGLE_LINK = "https://www.google.com/";

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
  selector: "site-material-button-archive-showcase",
  standalone: true,
  imports: [MatButton, MatIconButton, MatFabButton, MatMiniFabButton, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="material-button-template" aria-label="Boutons Angular Material de l'archive">
      @for (section of standardSections; track section.label; let sectionIndex = $index) {
        @if (sectionIndex > 0) {
          <div class="material-button-template-divider" aria-hidden="true"></div>
        }
        <section class="material-button-template-section">
          <div class="example-label">{{ section.label }}</div>
          <div class="example-button-row">
            @for (item of section.items; track item.text) {
              @if (item.href) {
                <a
                  [matButton]="section.appearance"
                  class="material-archive-button"
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
                  class="material-archive-button"
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
        <div class="material-button-template-divider" aria-hidden="true"></div>
        <section class="material-button-template-section">
          <div class="example-label">{{ section.label }}</div>
          <div class="example-button-row">
            @switch (section.kind) {
              @case ("icon") {
                @for (item of section.items; track item.ariaLabel) {
                  <button
                    matIconButton
                    type="button"
                    class="material-archive-icon-button"
                    [disabled]="item.disabled === true"
                    [attr.aria-label]="item.ariaLabel ?? null"
                  >
                    <mat-icon class="material-button-template-icon" aria-hidden="true">
                      {{ item.icon }}
                    </mat-icon>
                  </button>
                }
              }
              @case ("fab") {
                @for (item of section.items; track item.ariaLabel) {
                  <button
                    matFab
                    type="button"
                    class="material-archive-fab"
                    [disabled]="item.disabled === true"
                    [attr.aria-label]="item.ariaLabel ?? null"
                  >
                    <mat-icon class="material-button-template-icon" aria-hidden="true">
                      {{ item.icon }}
                    </mat-icon>
                  </button>
                }
              }
              @case ("miniFab") {
                @for (item of section.items; track item.ariaLabel) {
                  <button
                    matMiniFab
                    type="button"
                    class="material-archive-fab material-archive-fab-mini"
                    [disabled]="item.disabled === true"
                    [attr.aria-label]="item.ariaLabel ?? null"
                  >
                    <mat-icon class="material-button-template-icon" aria-hidden="true">
                      {{ item.icon }}
                    </mat-icon>
                  </button>
                }
              }
              @case ("extendedFab") {
                @for (item of section.items; track item.text) {
                  @if (item.href) {
                    <a
                      matFab
                      extended
                      class="material-archive-extended-fab"
                      [href]="item.href"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <mat-icon class="material-button-template-icon" aria-hidden="true">
                        {{ item.icon }}
                      </mat-icon>
                      <span>{{ item.text }}</span>
                    </a>
                  } @else {
                    <button
                      matFab
                      extended
                      type="button"
                      class="material-archive-extended-fab"
                      [disabled]="item.disabled === true"
                    >
                      <mat-icon class="material-button-template-icon" aria-hidden="true">
                        {{ item.icon }}
                      </mat-icon>
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

    .material-button-template-section {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding-block: 1rem;
    }

    .material-button-template-divider {
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

    .material-button-template .material-archive-fab-mini {
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

    .material-button-template .material-button-template-icon {
      position: relative;
      z-index: 1;
      width: 20px;
      height: 20px;
      flex: 0 0 auto;
      font-size: 20px;
      line-height: 20px;
    }

    .material-button-template :disabled {
      cursor: default;
      opacity: 0.62;
      pointer-events: none;
    }

    @media (max-width: 640px) {
      .material-button-template-section {
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
          icon: "more_vert",
        },
        {
          ariaLabel: "Example icon button with a open in new tab icon",
          icon: "open_in_new",
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
