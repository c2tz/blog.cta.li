import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";

@Component({
  selector: "home-hero-actions",
  standalone: true,
  imports: [MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="home-hero__actions" aria-label="Navigation d'accueil">
      <a
        matButton="tonal"
        class="home-hero__button"
        [href]="primaryActionHref()"
      >
        {{ primaryActionLabel() }}
      </a>
      <a
        matButton="outlined"
        class="home-hero__button"
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
  readonly secondaryActionHref = input("http://www.cta.li");
  readonly secondaryActionLabel = input("À propos");
}
