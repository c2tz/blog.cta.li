import { ChangeDetectionStrategy, Component } from "@angular/core";
import {
  MatButton,
  MatFabButton,
  MatIconButton,
  MatMiniFabButton,
  type MatButtonAppearance,
} from "@angular/material/button";
import { MatDivider } from "@angular/material/divider";
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
  imports: [MatButton, MatIconButton, MatFabButton, MatMiniFabButton, MatDivider, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="material-button-template" aria-label="Boutons Angular Material de l'archive">
      @for (section of standardSections; track section.label; let sectionIndex = $index) {
        @if (sectionIndex > 0) {
          <mat-divider></mat-divider>
        }
        <section class="material-button-template-section">
          <div class="example-label">{{ section.label }}</div>
          <div class="example-button-row">
            @for (item of section.items; track item.text) {
              @if (item.href) {
                <a
                  [matButton]="section.appearance"
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
        <mat-divider></mat-divider>
        <section class="material-button-template-section">
          <div class="example-label">{{ section.label }}</div>
          <div class="example-button-row">
            <div class="example-flex-container">
              @switch (section.kind) {
              @case ("icon") {
                @for (item of section.items; track item.ariaLabel) {
                  <button
                    matIconButton
                    type="button"
                    [disabled]="item.disabled === true"
                    [attr.aria-label]="item.ariaLabel ?? null"
                  >
                    <mat-icon aria-hidden="true">
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
                    [disabled]="item.disabled === true"
                    [attr.aria-label]="item.ariaLabel ?? null"
                  >
                    <mat-icon aria-hidden="true">
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
                    [disabled]="item.disabled === true"
                    [attr.aria-label]="item.ariaLabel ?? null"
                  >
                    <mat-icon aria-hidden="true">
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
                      [href]="item.href"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <mat-icon aria-hidden="true">
                        {{ item.icon }}
                      </mat-icon>
                      <span>{{ item.text }}</span>
                    </a>
                  } @else {
                    <button
                      matFab
                      extended
                      type="button"
                      [disabled]="item.disabled === true"
                    >
                      <mat-icon aria-hidden="true">
                        {{ item.icon }}
                      </mat-icon>
                      <span>{{ item.text }}</span>
                    </button>
                  }
                }
              }
              }
            </div>
          </div>
        </section>
      }
    </div>
  `,
  styles: [`
    .material-button-template-section {
      display: flex;
      align-items: center;
    }

    .example-label {
      min-width: 120px;
      margin: 0 16px 0 8px;
      font-size: 14px;
    }

    .example-button-row {
      max-width: 600px;
    }

    .example-button-row .mat-mdc-button-base {
      margin: 8px 8px 8px 0;
    }

    .example-flex-container {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
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
