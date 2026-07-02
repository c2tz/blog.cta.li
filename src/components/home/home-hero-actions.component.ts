import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { MatButton } from "@angular/material/button";
import { MatIcon } from "@angular/material/icon";

@Component({
  selector: "site-home-hero-actions",
  standalone: true,
  imports: [MatButton, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="home-hero-actions" aria-label="Navigation d'accueil">
      <a
        matButton="text"
        class="home-hero-button"
        [href]="primaryActionHref()"
        [attr.aria-label]="primaryActionAriaLabel()"
      >
        {{ primaryActionLabel() }}
        <mat-icon iconPositionEnd aria-hidden="true">&#xE5D3;</mat-icon>
      </a>
      <a
        matButton="text"
        class="home-hero-button"
        [href]="secondaryActionHref()"
        [attr.aria-label]="secondaryActionAriaLabel()"
      >
        {{ secondaryActionLabel() }}
        <mat-icon iconPositionEnd aria-hidden="true">&#xE89E;</mat-icon>
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
