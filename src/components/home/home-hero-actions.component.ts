import { CUSTOM_ELEMENTS_SCHEMA, ChangeDetectionStrategy, Component, input } from "@angular/core";

@Component({
  selector: "site-home-hero-actions",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "data-angular-component": "home-hero-actions",
  },
  template: `
    <nav class="home-hero-actions" aria-label="Navigation d'accueil">
      <md-elevated-button
        class="home-hero-button"
        [href]="primaryActionHref()"
        [attr.aria-label]="primaryActionAriaLabel()"
        has-icon
      >
        <md-icon slot="icon" aria-hidden="true">&#xE5D3;</md-icon>
        {{ primaryActionLabel() }}
      </md-elevated-button>
      <md-text-button
        class="home-hero-button"
        [href]="secondaryActionHref()"
        [attr.aria-label]="secondaryActionAriaLabel()"
        has-icon
      >
        <md-icon slot="icon" aria-hidden="true">&#xE89E;</md-icon>
        {{ secondaryActionLabel() }}
      </md-text-button>
    </nav>
  `,
})
export class HomeHeroActionsComponent {
  readonly primaryActionHref = input("/tags/all/");
  readonly primaryActionLabel = input("Voir plus");
  readonly secondaryActionHref = input("https://www.cta.li");
  readonly secondaryActionLabel = input("À propos");

  readonly primaryActionAriaLabel = () => {
    return this.primaryActionLabel().toLocaleLowerCase("fr") === "voir plus"
      ? "Voir plus d’articles"
      : this.primaryActionLabel();
  };
  readonly secondaryActionAriaLabel = () => {
    return this.secondaryActionLabel().toLocaleLowerCase("fr") === "à propos"
      ? "À propos de ce site"
      : this.secondaryActionLabel();
  };
}
