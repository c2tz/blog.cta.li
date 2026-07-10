import { CUSTOM_ELEMENTS_SCHEMA, ChangeDetectionStrategy, Component, input } from "@angular/core";

type HomeSectionDividerSpacing = "section" | "end";

@Component({
  selector: "site-home-section-divider",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[class.home-section-divider-host-end]": 'spacing() === "end"',
  },
  template: `<md-divider class="home-section-divider"></md-divider>`,
  styles: `
    :host {
      display: block;
      margin-block: 0 1rem;
    }

    :host(.home-section-divider-host-end) {
      margin-block: 0;
    }

    .home-section-divider {
      --md-divider-color: var(--md-sys-color-outline-variant);
    }
  `,
})
export class HomeSectionDividerComponent {
  readonly spacing = input<HomeSectionDividerSpacing>("section");
}
