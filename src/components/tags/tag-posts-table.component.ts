import {
  ChangeDetectionStrategy,
  Component,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  signal,
} from "@angular/core";
import { LiveAnnouncer } from "@angular/cdk/a11y";
import { MatFormField, MatLabel } from "@angular/material/form-field";
import { MatInput } from "@angular/material/input";
import {
  MatPaginator,
  MatPaginatorIntl,
  MatPaginatorModule,
  type PageEvent,
} from "@angular/material/paginator";
import { MatSort, MatSortModule, type Sort } from "@angular/material/sort";
import { MatTableDataSource, MatTableModule } from "@angular/material/table";

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
  selector: "site-tag-posts-table",
  standalone: true,
  imports: [MatFormField, MatInput, MatLabel, MatPaginatorModule, MatSortModule, MatTableModule],
  providers: [{ provide: MatPaginatorIntl, useFactory: createFrenchPaginatorIntl }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tag-posts-table-tools">
      <mat-form-field class="tag-posts-table-filter" appearance="outline" subscriptSizing="dynamic">
        <mat-label>Filtrer les articles</mat-label>
        <input
          matInput
          type="search"
          [value]="filterValue()"
          aria-controls="tag-posts-table"
          (input)="applyFilter($event)"
        />
      </mat-form-field>
    </div>

    <p class="sr-only" role="status" aria-live="polite">
      {{ tableStatus() }}
    </p>

    <div class="tag-posts-table-scroll">
      <table
        mat-table
        matSort
        id="tag-posts-table"
        class="tag-posts-table"
        [dataSource]="dataSource"
        [attr.aria-label]="'Articles du tag ' + tag()"
        (matSortChange)="announceSortChange($event)"
      >
        <ng-container matColumnDef="created">
          <th
            mat-header-cell
            *matHeaderCellDef
            mat-sort-header
            sortActionDescription="Trier par date"
            scope="col"
          >
            Date
          </th>
          <td mat-cell *matCellDef="let post">
            <time class="post-date" [attr.datetime]="post.createdIso">
              {{ post.createdLabel }}
            </time>
          </td>
        </ng-container>

        <ng-container matColumnDef="title">
          <th
            mat-header-cell
            *matHeaderCellDef
            mat-sort-header
            sortActionDescription="Trier par titre"
            class="tag-posts-title-header"
            scope="col"
          >
            Titre
          </th>
          <td mat-cell *matCellDef="let post">
            <a class="tag-post-title" [href]="post.url">{{ post.title }}</a>
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayedColumns; sticky: true"></tr>
        <tr
          class="tag-posts-table-row"
          mat-row
          *matRowDef="let row; columns: displayedColumns"
        ></tr>
        <tr class="tag-posts-table-empty" *matNoDataRow>
          <td [attr.colspan]="displayedColumns.length">Aucun article ne correspond au filtre.</td>
        </tr>
      </table>
    </div>

    @if (posts().length > pageSizeOptions[0]) {
      <mat-paginator
        class="tag-posts-table-paginator"
        [length]="filteredCount()"
        [pageIndex]="pageIndex()"
        [pageSize]="pageSize()"
        [pageSizeOptions]="pageSizeOptions"
        [showFirstLastButtons]="true"
        [attr.aria-label]="'Pagination des articles du tag ' + tag()"
        (page)="setPage($event)"
      />
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .tag-posts-table-tools {
      margin-block: 0 0.75rem;
    }

    .tag-posts-table-filter.mat-mdc-form-field {
      width: min(100%, 24rem);
      font-family: var(--site-font);
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
      color: var(--site-muted);
      font-weight: 600;
    }

    .tag-posts-table th,
    .tag-posts-table td {
      height: 3rem;
      padding: 0 2rem 0 1rem;
    }

    .tag-posts-table .mat-column-created {
      width: var(--tag-posts-date-column-content-width);
      min-width: var(--tag-posts-date-column-content-width);
      border-inline-end: 1px solid var(--site-border);
    }

    .tag-posts-table .mat-column-title {
      min-width: 24rem;
    }

    .tag-posts-table .tag-posts-title-header {
      overflow: visible;
    }

    :host ::ng-deep .tag-posts-table .tag-posts-title-header .mat-sort-header-container {
      position: sticky;
      left: 0;
      z-index: 3;
      box-sizing: border-box;
      width: var(--tag-posts-date-column-width);
      height: 100%;
      min-height: 3rem;
      margin-inline-start: -1rem;
      padding-inline: 1rem 0.65rem;
      background: var(--site-bg);
    }

    .tag-posts-table .mat-sort-header {
      --mat-sort-arrow-color: currentColor;
    }

    :host ::ng-deep .tag-posts-table .mat-sort-header-arrow {
      display: inline-grid;
      place-items: center;
      width: 1.25rem;
      height: 1.25rem;
      margin-inline-start: 0.25rem;
      color: currentColor;
      font-family: "Material Symbols Rounded";
      font-size: 1.25rem;
      font-style: normal;
      font-weight: 400;
      font-variation-settings:
        "FILL" 0,
        "wght" 400,
        "GRAD" 0,
        "opsz" 20;
      line-height: 1;
    }

    :host ::ng-deep .tag-posts-table .mat-sort-header-arrow svg {
      display: none;
    }

    :host ::ng-deep .tag-posts-table .mat-sort-header-arrow::before {
      content: "\\e5d8";
    }

    .tag-posts-table .mat-sort-header-sorted {
      color: var(--site-text);
    }

    .tag-posts-table .tag-posts-table-row:last-child td,
    .tag-posts-table .tag-posts-table-empty td {
      border-block-end: 0;
    }

    .tag-post-title {
      display: inline;
      white-space: nowrap;
    }

    .tag-posts-table-paginator {
      background: transparent;
      color: var(--site-text);
    }

    @media (max-width: 520px) {
      .tag-posts-table-scroll {
        --tag-posts-date-column-content-width: 13rem;
      }

      .tag-posts-table {
        min-width: 36rem;
      }

      .tag-posts-table .mat-column-created {
        width: var(--tag-posts-date-column-content-width);
        min-width: var(--tag-posts-date-column-content-width);
      }

      .tag-posts-table .mat-column-title {
        min-width: 20rem;
      }
    }
  `,
})
export class TagPostsTableComponent {
  private readonly liveAnnouncer = inject(LiveAnnouncer);

  @ViewChild(MatPaginator)
  set paginator(paginator: MatPaginator | undefined) {
    this.dataSource.paginator = paginator ?? null;
  }

  @ViewChild(MatSort)
  set sort(sort: MatSort | undefined) {
    this.dataSource.sort = sort ?? null;
  }

  readonly displayedColumns = ["created", "title"] as const;
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly posts = input<TagPostItem[]>([]);
  readonly tag = input("all");
  readonly dataSource = new MatTableDataSource<TagPostItem>();
  readonly filterValue = signal("");
  readonly pageIndex = signal(0);
  readonly pageSize = signal(PAGE_SIZE_OPTIONS[0]);
  readonly filteredCount = computed(() => this.filterPosts(this.posts()).length);
  readonly tableStatus = computed(() => {
    const total = this.filteredCount();
    if (total === 0) return `Aucun article pour le tag ${this.tag()}.`;

    const start = this.pageIndex() * this.pageSize() + 1;
    const end = Math.min(start + this.pageSize() - 1, total);
    return `Articles ${start} à ${end} sur ${total} pour le tag ${this.tag()}.`;
  });

  private readonly syncPosts = effect(() => {
    this.dataSource.data = [...this.posts()];
    this.dataSource.filter = this.normalizedFilter();
  });

  constructor() {
    this.dataSource.sortingDataAccessor = (post, column) => {
      if (column === "created") return new Date(post.createdIso).valueOf();
      if (column === "title") return post.title.toLocaleLowerCase("fr");

      return "";
    };
    this.dataSource.filterPredicate = (post, filter) => {
      const searchable = `${post.createdLabel} ${post.createdIso} ${post.title}`.toLocaleLowerCase(
        "fr",
      );

      return searchable.includes(filter);
    };
  }

  applyFilter(event: Event) {
    const target = event.target instanceof HTMLInputElement ? event.target : null;

    this.filterValue.set(target?.value ?? "");
    this.dataSource.filter = this.normalizedFilter();
    this.dataSource.paginator?.firstPage();
    this.pageIndex.set(0);
  }

  setPage(event: PageEvent) {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  announceSortChange(sortState: Sort) {
    if (!sortState.direction) {
      this.liveAnnouncer.announce("Tri désactivé.");
      return;
    }

    const direction = sortState.direction === "asc" ? "croissant" : "décroissant";
    const column = sortState.active === "created" ? "date" : "titre";
    this.liveAnnouncer.announce(`Articles triés par ${column}, ordre ${direction}.`);
  }

  private normalizedFilter() {
    return this.filterValue().trim().toLocaleLowerCase("fr");
  }

  private filterPosts(posts: readonly TagPostItem[]) {
    const filter = this.normalizedFilter();
    if (!filter) return posts;

    return posts.filter((post) =>
      `${post.createdLabel} ${post.createdIso} ${post.title}`
        .toLocaleLowerCase("fr")
        .includes(filter),
    );
  }
}
