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
      >
        {{ primaryActionLabel() }}
      </a>
      <a
        matButton="outlined"
        class="home-hero-button"
        [href]="secondaryActionHref()"
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
}
