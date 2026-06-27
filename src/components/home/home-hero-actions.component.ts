import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { MatButton } from "@angular/material/button";

@Component({
  selector: "site-home-hero-actions",
  standalone: true,
  imports: [MatButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="home-hero-actions" aria-label="Navigation d'accueil">
      <a
        matButton="tonal"
        class="home-hero-button"
        [href]="primaryActionHref()"
        [attr.aria-label]="primaryActionAriaLabel()"
      >
        {{ primaryActionLabel() }}
      </a>
      <a
        matButton="text"
        class="home-hero-button"
        [href]="secondaryActionHref()"
        [attr.aria-label]="secondaryActionAriaLabel()"
      >
        {{ secondaryActionLabel() }}
      </a>
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
