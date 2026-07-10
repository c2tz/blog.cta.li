import {
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  signal,
} from "@angular/core";
import { materialControlValue } from "@/lib/material-web-events";

interface TagPostItem {
  createdIso: string;
  createdLabelCompact: string;
  createdLabelFull: string;
  title: string;
  url: string;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

@Component({
  selector: "site-tag-posts-paginator",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tag-posts-paginator">
      <p class="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {{ pageStatus() }}
      </p>

      <ul id="tag-posts-list" class="tag-posts">
        @for (post of visiblePosts(); track post.url) {
          <li class="tag-post">
            <span class="tag-post-date">
              <time class="post-date site-date-compact" [attr.datetime]="post.createdIso">
                {{ post.createdLabelCompact }}
              </time>
              <time class="post-date site-date-full" [attr.datetime]="post.createdIso">
                {{ post.createdLabelFull }}
              </time>
            </span>
            <span class="tag-separator" aria-hidden="true">·</span>
            <a class="tag-post-title" [href]="post.url">{{ post.title }}</a>
          </li>
        }
      </ul>

      @if (posts().length > pageSizeOptions[0]) {
        <nav
          class="tag-posts-paginator-control"
          [attr.aria-label]="'Pagination des articles du tag ' + tag()"
        >
          <div class="tag-posts-page-size">
            <span>Articles par page</span>
            <md-outlined-select
              label="Articles par page"
              [value]="pageSize().toString()"
              aria-controls="tag-posts-list"
              (change)="changePageSize($event)"
            >
              @for (size of pageSizeOptions; track size) {
                <md-select-option [value]="size.toString()">
                  <span slot="headline">{{ size }}</span>
                </md-select-option>
              }
            </md-outlined-select>
          </div>

          <span class="tag-posts-range">{{ rangeLabel() }}</span>

          <div class="tag-posts-page-actions">
            <md-icon-button
              type="button"
              aria-label="Première page"
              aria-controls="tag-posts-list"
              [disabled]="!hasPreviousPage()"
              (click)="goToPage(0)"
            >
              <md-icon aria-hidden="true">&#xE5DC;</md-icon>
            </md-icon-button>
            <md-icon-button
              type="button"
              aria-label="Page précédente"
              aria-controls="tag-posts-list"
              [disabled]="!hasPreviousPage()"
              (click)="goToPage(pageIndex() - 1)"
            >
              <md-icon aria-hidden="true">&#xE5CB;</md-icon>
            </md-icon-button>
            <md-icon-button
              type="button"
              aria-label="Page suivante"
              aria-controls="tag-posts-list"
              [disabled]="!hasNextPage()"
              (click)="goToPage(pageIndex() + 1)"
            >
              <md-icon aria-hidden="true">&#xE5CC;</md-icon>
            </md-icon-button>
            <md-icon-button
              type="button"
              aria-label="Dernière page"
              aria-controls="tag-posts-list"
              [disabled]="!hasNextPage()"
              (click)="goToPage(pageCount() - 1)"
            >
              <md-icon aria-hidden="true">&#xE5DD;</md-icon>
            </md-icon-button>
          </div>
        </nav>
      }
    </div>
  `,
  styles: `
    .tag-posts-paginator {
      display: block;
    }

    .tag-posts-paginator-control {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 1rem;
      margin-block-start: 1rem;
      color: var(--site-text);
    }

    .tag-posts-page-size {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      color: var(--site-muted);
      font-size: 0.875rem;
    }

    .tag-posts-page-size md-outlined-select {
      width: auto;
      min-width: 5rem;
    }

    .tag-posts-range {
      min-width: 7.5rem;
      color: var(--site-muted);
      font-size: 0.875rem;
      text-align: end;
    }

    .tag-posts-page-actions {
      display: flex;
      align-items: center;
      gap: 0.125rem;
    }

    .tag-posts-page-actions md-icon-button {
      --md-icon-button-icon-color: var(--site-muted);
      --md-icon-button-hover-icon-color: var(--site-text);
      --md-icon-button-focus-icon-color: var(--site-text);
      --md-icon-button-pressed-icon-color: var(--site-text);
    }

    @media (max-width: 720px) {
      .tag-posts-paginator-control {
        flex-wrap: wrap;
      }

      .tag-posts-page-size {
        margin-inline-end: auto;
      }
    }

    @media (max-width: 520px) {
      .tag-posts-paginator-control {
        justify-content: space-between;
      }

      .tag-posts-range {
        order: 3;
        width: 100%;
        text-align: center;
      }
    }
  `,
})
export class TagPostsPaginatorComponent {
  readonly pageIndex = signal(0);
  readonly pageSize = signal<number>(PAGE_SIZE_OPTIONS[0]);
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly posts = input<TagPostItem[]>([]);
  readonly tag = input("all");
  readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.posts().length / this.pageSize())),
  );
  readonly visiblePosts = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.posts().slice(start, start + this.pageSize());
  });
  readonly hasPreviousPage = computed(() => this.pageIndex() > 0);
  readonly hasNextPage = computed(() => this.pageIndex() + 1 < this.pageCount());
  readonly rangeLabel = computed(() => {
    const total = this.posts().length;
    if (total === 0) return "0 sur 0";

    const start = this.pageIndex() * this.pageSize() + 1;
    const end = Math.min(start + this.visiblePosts().length - 1, total);
    return `${start} - ${end} sur ${total}`;
  });
  readonly pageStatus = computed(() => {
    const total = this.posts().length;
    if (total === 0) return `Aucun article pour le tag ${this.tag()}.`;

    const start = this.pageIndex() * this.pageSize() + 1;
    const end = Math.min(start + this.visiblePosts().length - 1, total);
    return `Articles ${start} à ${end} sur ${total} pour le tag ${this.tag()}.`;
  });

  constructor() {
    effect(() => {
      const lastPage = this.pageCount() - 1;
      if (this.pageIndex() > lastPage) this.pageIndex.set(lastPage);
    });
  }

  changePageSize(event: Event) {
    const nextSize = Number.parseInt(materialControlValue(event), 10);
    if (!Number.isFinite(nextSize) || nextSize <= 0) return;

    this.pageSize.set(nextSize);
    this.pageIndex.set(0);
  }

  goToPage(index: number) {
    this.pageIndex.set(Math.min(Math.max(0, index), this.pageCount() - 1));
  }
}
