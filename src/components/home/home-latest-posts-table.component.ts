import {
  ChangeDetectionStrategy,
  Component,
  ViewChild,
  computed,
  effect,
  input,
  inject,
  signal,
} from "@angular/core";
import { LiveAnnouncer } from "@angular/cdk/a11y";
import type { OnDestroy, OnInit } from "@angular/core";
import { MatProgressSpinner } from "@angular/material/progress-spinner";
import { MatSort, MatSortModule, type Sort } from "@angular/material/sort";
import { MatTableDataSource, MatTableModule } from "@angular/material/table";

import { SITE_EVENTS } from "@/lib/site-contracts";

export interface HomeLatestPost {
  readonly dateCompact: string;
  readonly dateFull: string;
  readonly datetime: string;
  readonly href: string;
  readonly title: string;
}

interface LatestPostsResponse {
  readonly posts?: readonly HomeLatestPost[];
}

@Component({
  selector: "site-home-latest-posts-table",
  standalone: true,
  imports: [MatProgressSpinner, MatSortModule, MatTableModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="home-posts-table-scroll">
      <table
        mat-table
        [dataSource]="dataSource"
        matSort
        id="home-latest-posts-table"
        class="home-posts-table"
        aria-label="Derniers articles"
        [attr.aria-busy]="loading()"
        (matSortChange)="announceSortChange($event)"
      >
        <ng-container matColumnDef="date">
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
            <time
              class="post-date site-date-compact home-post-date-compact"
              [attr.datetime]="post.datetime"
            >
              {{ post.dateCompact }}
            </time>
            <time
              class="post-date site-date-full home-post-date-full"
              [attr.datetime]="post.datetime"
            >
              {{ post.dateFull }}
            </time>
          </td>
        </ng-container>

        <ng-container matColumnDef="title">
          <th
            mat-header-cell
            *matHeaderCellDef
            mat-sort-header
            sortActionDescription="Trier par titre"
            class="home-posts-title-header"
            scope="col"
          >
            Titre
          </th>
          <td mat-cell *matCellDef="let post">
            <a class="home-post-title" [href]="post.href">{{ post.title }}</a>
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
        <tr
          class="home-posts-table-row"
          mat-row
          *matRowDef="let row; columns: displayedColumns"
        ></tr>
        <tr class="home-posts-table-loading-row" *matNoDataRow>
          <td [attr.colspan]="displayedColumns.length">
            @if (loading()) {
              <div class="home-posts-table-loading" role="status">
                <mat-progress-spinner
                  mode="indeterminate"
                  diameter="64"
                  strokeWidth="6"
                  aria-hidden="true"
                />
                <span class="sr-only">Chargement des articles</span>
              </div>
            } @else {
              <span class="home-posts-table-empty">Aucun article à afficher.</span>
            }
          </td>
        </tr>
      </table>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .home-posts-table-scroll {
      position: relative;
      max-width: 100%;
      margin-block: 0 1em;
      overflow-x: auto;
      overflow-y: hidden;
      -webkit-overflow-scrolling: touch;
    }

    .home-posts-table-scroll::-webkit-scrollbar {
      height: 0.5rem;
    }

    .home-posts-table-scroll::-webkit-scrollbar-thumb {
      border-radius: 9999px;
      background: color-mix(in srgb, var(--site-muted) 42%, transparent);
    }

    .home-posts-table-scroll:focus-visible {
      border-radius: var(--site-shape-extra-small);
      outline: 2px solid var(--site-link);
      outline-offset: 2px;
    }

    .home-posts-table {
      min-width: 42rem;
      width: max-content;
      border-collapse: separate;
      border-spacing: 0;
      background: transparent;
      color: var(--site-text);
      font-family: var(--site-font);
    }

    .home-posts-table th,
    .home-posts-table td {
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

    .home-posts-table th {
      color: var(--site-muted);
      font-weight: 600;
    }

    .home-posts-table th,
    .home-posts-table td {
      height: 2.75rem;
      padding: 0 2rem 0 1rem;
    }

    .home-posts-table .home-posts-table-row:last-child td {
      border-block-end: 0;
    }

    .home-posts-table-loading-row td {
      height: 9rem;
      padding: 0;
      background: var(--m3-surface-container-low);
      text-align: center;
    }

    .home-posts-table-loading {
      --mat-progress-spinner-active-indicator-color: var(--site-link);

      display: grid;
      min-height: 9rem;
      place-items: center;
    }

    .home-posts-table-empty {
      display: inline-block;
      padding: 1rem;
      color: var(--site-muted);
    }

    .home-posts-table .mat-column-date {
      width: 9rem;
      min-width: 9rem;
      border-inline-end: 1px solid var(--site-border);
    }

    .home-posts-table .mat-column-title {
      min-width: 24rem;
    }

    .home-post-title {
      display: inline;
      white-space: nowrap;
    }
  `,
})
export class HomeLatestPostsTableComponent implements OnInit, OnDestroy {
  private readonly liveAnnouncer = inject(LiveAnnouncer);

  @ViewChild(MatSort)
  set sort(sort: MatSort | undefined) {
    this.dataSource.sort = sort ?? null;
  }

  readonly detailEndpoint = input("/latest-posts.json");
  readonly posts = input<readonly HomeLatestPost[]>([]);
  readonly displayedColumns = ["date", "title"] as const;
  readonly dataSource = new MatTableDataSource<HomeLatestPost>();
  readonly detailed = signal(false);
  readonly detailedPosts = signal<readonly HomeLatestPost[] | null>(null);
  readonly loading = signal(false);
  readonly tablePosts = computed(() => {
    const posts = this.detailed() ? (this.detailedPosts() ?? this.posts()) : this.posts();

    return this.detailed() ? posts : posts.slice(0, 3);
  });

  private detailRequest: Promise<void> | null = null;

  constructor() {
    this.dataSource.sortingDataAccessor = (post, column) => {
      if (column === "date") return new Date(post.datetime).valueOf();
      if (column === "title") return post.title.toLocaleLowerCase("fr");

      return "";
    };
    effect(() => {
      this.dataSource.data = [...this.tablePosts()];
    });
  }

  ngOnInit() {
    if (typeof document === "undefined") return;

    const detailed =
      document.documentElement.dataset["homeDetailView"] === "true" ||
      document.body.dataset["homeDetailView"] === "true";
    this.detailed.set(detailed);
    if (detailed) void this.loadDetailedPosts();
    document.addEventListener(SITE_EVENTS.homeDetailViewChange, this.handleDetailViewChange);
  }

  ngOnDestroy() {
    if (typeof document === "undefined") return;

    document.removeEventListener(SITE_EVENTS.homeDetailViewChange, this.handleDetailViewChange);
  }

  private readonly handleDetailViewChange = (event: Event) => {
    const detailed = Boolean((event as CustomEvent<{ detailed?: boolean }>).detail?.detailed);
    this.detailed.set(detailed);
    if (detailed) void this.loadDetailedPosts();
  };

  announceSortChange(sortState: Sort) {
    if (!sortState.direction) {
      this.liveAnnouncer.announce("Tri désactivé.");
      return;
    }

    const direction = sortState.direction === "asc" ? "croissant" : "décroissant";
    const column = sortState.active === "date" ? "date" : "titre";
    this.liveAnnouncer.announce(`Articles triés par ${column}, ordre ${direction}.`);
  }

  private loadDetailedPosts() {
    if (this.detailedPosts()) return Promise.resolve();
    if (this.detailRequest) return this.detailRequest;

    this.loading.set(true);
    this.detailRequest = fetch(this.detailEndpoint(), {
      credentials: "same-origin",
    })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((payload: LatestPostsResponse) => {
        if (Array.isArray(payload.posts) && payload.posts.length > 0) {
          this.detailedPosts.set(payload.posts.slice(0, 8));
        }
      })
      .catch(() => {
        this.detailedPosts.set(this.posts());
      })
      .finally(() => {
        this.loading.set(false);
        this.detailRequest = null;
      });

    return this.detailRequest;
  }
}
