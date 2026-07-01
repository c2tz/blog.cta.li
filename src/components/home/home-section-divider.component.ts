import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { MatDivider } from "@angular/material/divider";

type HomeSectionDividerSpacing = "section" | "end";

@Component({
  selector: "site-home-section-divider",
  standalone: true,
  imports: [MatDivider],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[class.home-section-divider-host-end]": 'spacing() === "end"',
  },
  template: `<mat-divider class="home-section-divider" />`,
  styles: `
    :host {
      display: block;
      margin-block: 0 1.25rem;
    }

    :host(.home-section-divider-host-end) {
      margin-block: 0;
    }

    .home-section-divider.mat-divider {
      --mat-divider-color: var(--site-border);
    }
  `,
})
export class HomeSectionDividerComponent {
  readonly spacing = input<HomeSectionDividerSpacing>("section");
}
