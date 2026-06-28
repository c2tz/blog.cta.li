import { ChangeDetectionStrategy, Component, input, signal } from "@angular/core";
import { MatButton } from "@angular/material/button";
import { MatIcon } from "@angular/material/icon";
import { MatProgressBar } from "@angular/material/progress-bar";

@Component({
  selector: "site-home-tags-tree",
  standalone: true,
  imports: [MatButton, MatIcon, MatProgressBar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 id="tags">
      <a href="#tags" class="heading-link">{{ title() }}</a>
    </h2>

    <div
      aria-labelledby="tags"
      class="home-tags-tree"
    >
      <button
        matButton="elevated"
        class="home-tags-tree-toggle"
        type="button"
        aria-controls="home-tags-list"
        [attr.aria-label]="expanded() ? 'Masquer les tags' : 'Afficher les tags'"
        [attr.aria-expanded]="expanded()"
        (click)="toggle()"
      >
        <span>{{ expanded() ? "Afficher moins" : "Afficher plus" }}</span>
        <mat-icon iconPositionEnd class="mat-icon-rtl-mirror" aria-hidden="true">
          {{ expanded() ? expandLessIcon : expandMoreIcon }}
        </mat-icon>
      </button>
    </div>

    @if (loading()) {
      <mat-progress-bar
        class="home-tags-tree-progress"
        mode="indeterminate"
        aria-label="Chargement des tags"
      />
    }

    @if (loaded() && expanded()) {
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
    }
  `,
  styles: `
    :host {
      display: block;
    }

    :host > h2 {
      margin-block: 0 1em;
    }

    .home-tags-tree {
      display: block;
      margin-block-end: 0.75rem;
    }

    .home-tags-tree-toggle.mat-mdc-button-base {
      min-width: 0;
      height: 2.25rem;
      padding-inline: 0.85rem 0.7rem;
      border-radius: 9999px;
      color: var(--site-link);
    }

    .home-tags-tree-toggle .mat-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.2rem;
      height: 1.2rem;
      font-size: 1.2rem;
      line-height: 1;
    }

    .home-tags-tree-progress.mat-mdc-progress-bar {
      width: min(24rem, 100%);
      height: 0.18rem;
      margin-block: 0.35rem 0.75rem;
      overflow: hidden;
      border-radius: 9999px;
      --mdc-linear-progress-active-indicator-color: var(--site-link);
      --mdc-linear-progress-track-color: color-mix(
        in srgb,
        var(--site-link) 16%,
        transparent
      );
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

    @media (max-width: 520px) {
      .home-tags-tree-progress.mat-mdc-progress-bar {
        width: 100%;
      }
    }
  `,
})
export class HomeTagsTreeComponent {
  readonly tags = input<string[]>([]);
  readonly title = input("les tags");
  readonly expanded = signal(false);
  readonly loaded = signal(false);
  readonly loading = signal(false);
  readonly expandLessIcon = "\uE5CE";
  readonly expandMoreIcon = "\uE5CF";

  toggle() {
    if (this.expanded()) {
      this.expanded.set(false);
      return;
    }

    if (this.loaded()) {
      this.expanded.set(true);
      return;
    }

    this.loading.set(true);
    window.setTimeout(() => {
      this.loaded.set(true);
      this.loading.set(false);
      this.expanded.set(true);
    }, 140);
  }
}
