import { ChangeDetectionStrategy, Component, input } from "@angular/core";

@Component({
  selector: "site-home-tags-tree",
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul id="home-tags-list" class="home-tags-tree-links" aria-label="Tous les tags">
      @for (tag of tags(); track tag) {
        <li>
          <a
            class="home-tags-tree-link"
            [href]="'/tags/' + tag + '/'"
            [attr.aria-label]="'Voir les articles du tag ' + tag"
          >
            #{{ tag }}
          </a>
        </li>
      }
    </ul>
  `,
  styles: `
    :host {
      display: block;
    }

    .home-tags-tree-links {
      display: flex;
      flex-wrap: wrap;
      gap: 0 0.5em;
      margin-block: 0 1em;
      padding: 0;
      list-style-type: none;
    }

    .home-tags-tree-link {
      color: var(--site-link);
      text-decoration: none;
    }

    .home-tags-tree-link:is(:hover, :focus-visible) {
      text-decoration: underline;
    }
  `,
})
export class HomeTagsTreeComponent {
  readonly tags = input<string[]>([]);
}
