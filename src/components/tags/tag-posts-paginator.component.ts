import { ChangeDetectionStrategy, Component, computed, input, signal } from "@angular/core";
import {
  MatPaginatorIntl,
  MatPaginatorModule,
  type PageEvent,
} from "@angular/material/paginator";

interface TagPostItem {
  createdIso: string;
  createdLabel: string;
  title: string;
  url: string;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50];

function createFrenchPaginatorIntl() {
  const intl = new MatPaginatorIntl();

  intl.itemsPerPageLabel = "Articles par page";
  intl.nextPageLabel = "Page suivante";
  intl.previousPageLabel = "Page précédente";
  intl.firstPageLabel = "Première page";
  intl.lastPageLabel = "Dernière page";
  intl.getRangeLabel = (page, pageSize, length) => {
    if (length === 0 || pageSize === 0) return `0 sur ${length}`;

    const startIndex = page * pageSize;
    const endIndex = Math.min(startIndex + pageSize, length);
    return `${startIndex + 1} - ${endIndex} sur ${length}`;
  };

  return intl;
}

@Component({
  selector: "site-tag-posts-paginator",
  standalone: true,
  imports: [MatPaginatorModule],
  providers: [{ provide: MatPaginatorIntl, useFactory: createFrenchPaginatorIntl }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tag-posts-paginator">
      <p class="sr-only" role="status" aria-live="polite">
        {{ pageStatus() }}
      </p>

      <ul class="tag-posts">
        @for (post of visiblePosts(); track post.url) {
          <li class="tag-post">
            <span class="tag-post-date">
              <time class="post-date" [attr.datetime]="post.createdIso">
                {{ post.createdLabel }}
              </time>
            </span>
            <span class="tag-separator" aria-hidden="true">·</span>
            <a class="tag-post-title" [href]="post.url">{{ post.title }}</a>
          </li>
        }
      </ul>

      @if (posts().length > pageSizeOptions[0]) {
        <mat-paginator
          class="tag-posts-paginator-control"
          [length]="posts().length"
          [pageIndex]="pageIndex()"
          [pageSize]="pageSize()"
          [pageSizeOptions]="pageSizeOptions"
          [showFirstLastButtons]="true"
          [attr.aria-label]="'Pagination des articles du tag ' + tag()"
          (page)="setPage($event)"
        />
      }
    </div>
  `,
  styles: `
    .tag-posts-paginator {
      display: block;
    }

    .tag-posts-paginator-control {
      margin-block-start: 1rem;
      background: transparent;
      color: var(--site-text);
    }
  `,
})
export class TagPostsPaginatorComponent {
  readonly pageIndex = signal(0);
  readonly pageSize = signal(PAGE_SIZE_OPTIONS[0]);
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly posts = input<TagPostItem[]>([]);
  readonly tag = input("all");

  readonly visiblePosts = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.posts().slice(start, start + this.pageSize());
  });

  readonly pageStatus = computed(() => {
    const total = this.posts().length;
    if (total === 0) return `Aucun article pour le tag ${this.tag()}.`;

    const start = this.pageIndex() * this.pageSize() + 1;
    const end = Math.min(start + this.visiblePosts().length - 1, total);
    return `Articles ${start} à ${end} sur ${total} pour le tag ${this.tag()}.`;
  });

  setPage(event: PageEvent) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }
}
