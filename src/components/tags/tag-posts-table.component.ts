import {
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  signal,
} from "@angular/core";
import { MaterialTextFieldValueDirective } from "@/components/material/material-text-field-value.directive";
import { materialControlValue } from "@/lib/material-web-events";

interface TagPostItem {
  createdIso: string;
  createdLabelCompact: string;
  createdLabelFull: string;
  title: string;
  url: string;
}

type TagSortColumn = "created" | "title";
type SortDirection = "asc" | "desc";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

@Component({
  selector: "site-tag-posts-table",
  standalone: true,
  imports: [MaterialTextFieldValueDirective],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tag-posts-table-tools">
      <md-outlined-text-field
        id="tag-posts-filter"
        class="tag-posts-table-filter"
        type="search"
        label="Filtrer les articles"
        autocomplete="off"
        [value]="filterValue()"
        aria-controls="tag-posts-table"
        siteMaterialValue
        (siteMaterialValueChange)="setFilterValue($event)"
        (input)="applyFilter($event)"
        (keyup)="applyFilter($event)"
      ></md-outlined-text-field>
    </div>

    <p class="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {{ tableStatus() }}
    </p>
    <p class="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {{ sortStatus() }}
    </p>

    <div class="tag-posts-table-scroll" tabindex="0">
      <table
        id="tag-posts-table"
        class="tag-posts-table"
        [attr.aria-label]="'Articles du tag ' + tag()"
      >
        <thead>
          <tr>
            <th class="tag-posts-created-column" scope="col" [attr.aria-sort]="sortAria('created')">
              <button
                type="button"
                class="tag-posts-sort-button"
                [class.tag-posts-sort-active]="sortColumn() === 'created'"
                aria-label="Trier par date"
                (click)="toggleSort('created')"
              >
                <span>Date</span>
                <md-icon aria-hidden="true">{{ sortIcon("created") }}</md-icon>
                <md-ripple></md-ripple>
              </button>
            </th>
            <th
              class="tag-posts-title-column tag-posts-title-header"
              scope="col"
              [attr.aria-sort]="sortAria('title')"
            >
              <button
                type="button"
                class="tag-posts-sort-button"
                [class.tag-posts-sort-active]="sortColumn() === 'title'"
                aria-label="Trier par titre"
                (click)="toggleSort('title')"
              >
                <span>Titre</span>
                <md-icon aria-hidden="true">{{ sortIcon("title") }}</md-icon>
                <md-ripple></md-ripple>
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          @for (post of visiblePosts(); track post.url) {
            <tr class="tag-posts-table-row">
              <td class="tag-posts-created-column">
                <time class="post-date site-date-compact" [attr.datetime]="post.createdIso">
                  {{ post.createdLabelCompact }}
                </time>
                <time class="post-date site-date-full" [attr.datetime]="post.createdIso">
                  {{ post.createdLabelFull }}
                </time>
              </td>
              <td class="tag-posts-title-column">
                <a class="tag-post-title" [href]="post.url">{{ post.title }}</a>
              </td>
            </tr>
          } @empty {
            <tr class="tag-posts-table-empty">
              <td colspan="2">Aucun article ne correspond au filtre.</td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    @if (posts().length > pageSizeOptions[0]) {
      <nav
        class="tag-posts-table-paginator"
        [attr.aria-label]="'Pagination des articles du tag ' + tag()"
      >
        <div class="tag-posts-page-size">
          <span>Articles par page</span>
          <md-outlined-select
            label="Articles par page"
            [value]="pageSize().toString()"
            aria-controls="tag-posts-table"
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
            aria-controls="tag-posts-table"
            [disabled]="!hasPreviousPage()"
            (click)="goToPage(0)"
          >
            <md-icon aria-hidden="true">&#xE5DC;</md-icon>
          </md-icon-button>
          <md-icon-button
            type="button"
            aria-label="Page précédente"
            aria-controls="tag-posts-table"
            [disabled]="!hasPreviousPage()"
            (click)="goToPage(pageIndex() - 1)"
          >
            <md-icon aria-hidden="true">&#xE5CB;</md-icon>
          </md-icon-button>
          <md-icon-button
            type="button"
            aria-label="Page suivante"
            aria-controls="tag-posts-table"
            [disabled]="!hasNextPage()"
            (click)="goToPage(pageIndex() + 1)"
          >
            <md-icon aria-hidden="true">&#xE5CC;</md-icon>
          </md-icon-button>
          <md-icon-button
            type="button"
            aria-label="Dernière page"
            aria-controls="tag-posts-table"
            [disabled]="!hasNextPage()"
            (click)="goToPage(pageCount() - 1)"
          >
            <md-icon aria-hidden="true">&#xE5DD;</md-icon>
          </md-icon-button>
        </div>
      </nav>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .tag-posts-table-tools {
      margin-block: 0 0.75rem;
    }

    .tag-posts-table-filter {
      width: min(100%, 24rem);
      --md-outlined-text-field-container-shape: var(--md-sys-shape-corner-extra-large);
      --md-outlined-text-field-focus-caret-color: var(--site-link);
      --md-outlined-text-field-focus-label-text-color: var(--site-link);
      --md-outlined-text-field-focus-outline-color: var(--site-link);
      --md-outlined-text-field-input-text-color: var(--site-text);
      --md-outlined-text-field-input-text-font: var(--site-font);
      --md-outlined-text-field-label-text-color: var(--site-muted);
      --md-outlined-text-field-label-text-font: var(--site-font);
      --md-outlined-text-field-outline-color: var(--site-border);
    }

    .tag-posts-table-scroll {
      --tag-posts-date-column-content-width: 16rem;
      --tag-posts-date-column-fallback-width: calc(
        var(--tag-posts-date-column-content-width) + 3rem
      );
      --tag-posts-date-column-width: var(--tag-posts-date-column-fallback-width);

      position: relative;
      max-width: 100%;
      margin-block: 0 1rem;
      overflow-x: auto;
      overflow-y: hidden;
      -webkit-overflow-scrolling: touch;
    }

    .tag-posts-table-scroll::-webkit-scrollbar {
      height: 0.5rem;
    }

    .tag-posts-table-scroll::-webkit-scrollbar-thumb {
      border-radius: 9999px;
      background: color-mix(in srgb, var(--site-muted) 42%, transparent);
    }

    .tag-posts-table-scroll:focus-visible {
      border-radius: var(--site-shape-extra-small);
      outline: 2px solid var(--site-link);
      outline-offset: 2px;
    }

    .tag-posts-table {
      min-width: 42rem;
      width: max-content;
      border-collapse: separate;
      border-spacing: 0;
      background: transparent;
      color: var(--site-text);
      font-family: var(--site-font);
    }

    .tag-posts-table th,
    .tag-posts-table td {
      height: 3rem;
      padding: 0 2rem 0 1rem;
      border: 0;
      border-block-end: 1px solid var(--site-border);
      background: var(--site-bg);
      color: var(--site-text);
      font-family: var(--site-font);
      font-size: 1rem;
      font-weight: 400;
      letter-spacing: 0;
      line-height: 1.5;
      text-align: start;
      white-space: nowrap;
    }

    .tag-posts-table th {
      position: sticky;
      top: 0;
      z-index: 2;
      padding: 0;
      color: var(--site-muted);
      font-weight: 600;
    }

    .tag-posts-table .tag-posts-created-column {
      width: var(--tag-posts-date-column-content-width);
      min-width: var(--tag-posts-date-column-content-width);
      border-inline-end: 1px solid var(--site-border);
    }

    .tag-posts-table .tag-posts-title-column {
      min-width: 20rem;
    }

    .tag-posts-table .tag-posts-title-header {
      overflow: visible;
    }

    .tag-posts-sort-button {
      --md-ripple-focus-color: var(--site-link);
      --md-ripple-hover-color: var(--site-link);
      --md-ripple-pressed-color: var(--site-link);

      position: relative;
      display: flex;
      align-items: center;
      gap: 0.25rem;
      width: 100%;
      min-height: 3rem;
      box-sizing: border-box;
      padding: 0 2rem 0 1rem;
      overflow: hidden;
      border: 0;
      background: var(--site-bg);
      color: inherit;
      cursor: pointer;
      font: inherit;
      font-weight: inherit;
      text-align: start;
    }

    .tag-posts-sort-button md-icon {
      --md-icon-size: 1.25rem;

      width: 1.25rem;
      height: 1.25rem;
      flex-basis: 1.25rem;
      font-size: 1.25rem;
    }

    .tag-posts-sort-active {
      background: color-mix(in srgb, var(--site-link) 10%, var(--site-bg));
      color: var(--site-text);
    }

    .tag-posts-sort-button:focus-visible {
      outline: 0;
      box-shadow: inset 0 0 0 2px var(--site-link);
    }

    .tag-posts-table .tag-posts-table-row:last-child td,
    .tag-posts-table .tag-posts-table-empty td {
      border-block-end: 0;
    }

    .tag-posts-table-empty td {
      height: 5rem;
      color: var(--site-muted);
      text-align: center;
    }

    .tag-post-title {
      display: inline;
      white-space: nowrap;
    }

    .tag-posts-table-paginator {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 1rem;
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
      .tag-posts-table-paginator {
        flex-wrap: wrap;
      }

      .tag-posts-page-size {
        margin-inline-end: auto;
      }
    }

    @media (max-width: 520px) {
      .tag-posts-table-scroll {
        --tag-posts-date-column-content-width: 13rem;
      }

      .tag-posts-table {
        min-width: 36rem;
      }

      .tag-posts-table .tag-posts-created-column {
        width: var(--tag-posts-date-column-content-width);
        min-width: var(--tag-posts-date-column-content-width);
      }

      .tag-posts-table .tag-posts-title-column {
        min-width: 20rem;
      }

      .tag-posts-table-paginator {
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
export class TagPostsTableComponent {
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly posts = input<TagPostItem[]>([]);
  readonly tag = input("all");
  readonly filterValue = signal("");
  readonly pageIndex = signal(0);
  readonly pageSize = signal<number>(PAGE_SIZE_OPTIONS[0]);
  readonly sortColumn = signal<TagSortColumn | null>(null);
  readonly sortDirection = signal<SortDirection>("asc");
  readonly sortStatus = signal("");
  readonly normalizedFilter = computed(() => this.filterValue().trim().toLocaleLowerCase("fr"));
  readonly filteredPosts = computed(() => {
    const filter = this.normalizedFilter();
    if (!filter) return this.posts();

    return this.posts().filter((post) =>
      `${post.createdLabelCompact} ${post.createdLabelFull} ${post.createdIso} ${post.title}`
        .toLocaleLowerCase("fr")
        .includes(filter),
    );
  });
  readonly sortedPosts = computed(() => {
    const column = this.sortColumn();
    if (!column) return this.filteredPosts();

    const direction = this.sortDirection() === "asc" ? 1 : -1;
    return [...this.filteredPosts()].sort((left, right) => {
      if (column === "created") {
        const leftDate = Date.parse(left.createdIso);
        const rightDate = Date.parse(right.createdIso);
        const result =
          Number.isNaN(leftDate) || Number.isNaN(rightDate)
            ? left.createdIso.localeCompare(right.createdIso, "fr")
            : leftDate - rightDate;
        return result * direction;
      }

      return left.title.localeCompare(right.title, "fr", { sensitivity: "base" }) * direction;
    });
  });
  readonly filteredCount = computed(() => this.filteredPosts().length);
  readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.filteredCount() / this.pageSize())),
  );
  readonly visiblePosts = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.sortedPosts().slice(start, start + this.pageSize());
  });
  readonly hasPreviousPage = computed(() => this.pageIndex() > 0);
  readonly hasNextPage = computed(() => this.pageIndex() + 1 < this.pageCount());
  readonly rangeLabel = computed(() => {
    const total = this.filteredCount();
    if (total === 0) return "0 sur 0";

    const start = this.pageIndex() * this.pageSize() + 1;
    const end = Math.min(start + this.visiblePosts().length - 1, total);
    return `${start} - ${end} sur ${total}`;
  });
  readonly tableStatus = computed(() => {
    const total = this.filteredCount();
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

  applyFilter(event: Event) {
    this.setFilterValue(materialControlValue(event));
  }

  setFilterValue(value: string) {
    this.filterValue.set(value);
    this.pageIndex.set(0);
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

  toggleSort(column: TagSortColumn) {
    if (this.sortColumn() !== column) {
      this.sortColumn.set(column);
      this.sortDirection.set("asc");
    } else if (this.sortDirection() === "asc") {
      this.sortDirection.set("desc");
    } else {
      this.sortColumn.set(null);
      this.sortDirection.set("asc");
    }

    if (!this.sortColumn()) {
      this.sortStatus.set("Tri désactivé.");
      return;
    }

    const direction = this.sortDirection() === "asc" ? "croissant" : "décroissant";
    const label = column === "created" ? "date" : "titre";
    this.sortStatus.set(`Articles triés par ${label}, ordre ${direction}.`);
  }

  sortAria(column: TagSortColumn) {
    if (this.sortColumn() !== column) return null;
    return this.sortDirection() === "asc" ? "ascending" : "descending";
  }

  sortIcon(column: TagSortColumn) {
    if (this.sortColumn() !== column) return "\uE5D7";
    return this.sortDirection() === "asc" ? "\uE5D8" : "\uE5DB";
  }
}
