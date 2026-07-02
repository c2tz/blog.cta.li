import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  signal,
} from "@angular/core";
import { LiveAnnouncer } from "@angular/cdk/a11y";
import type { AfterViewInit, OnDestroy, OnInit } from "@angular/core";
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
  imports: [MatSortModule, MatTableModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="home-posts-table-scroll" [class.home-posts-table-scroll-detailed]="detailed()">
      @if (loading()) {
        <div class="home-posts-table-loader" role="status">
          <span class="home-posts-table-spinner" aria-hidden="true"></span>
          <span class="sr-only">Chargement des articles</span>
        </div>
      }

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
      </table>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .home-posts-table-scroll {
      --home-posts-date-column-content-width: 8rem;
      --home-posts-date-column-fallback-width: calc(
        var(--home-posts-date-column-content-width) + 3rem
      );
      --home-posts-date-column-width: var(
        --home-posts-date-column-measured-width,
        var(--home-posts-date-column-fallback-width)
      );

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

    .home-posts-table-scroll-detailed {
      --home-posts-date-column-content-width: 14rem;
    }

    .home-posts-table-scroll:focus-visible {
      border-radius: var(--site-shape-extra-small);
      outline: 2px solid var(--site-link);
      outline-offset: 2px;
    }

    .home-posts-table-loader {
      position: absolute;
      inset-block-start: 0.65rem;
      inset-inline-end: 0.65rem;
      z-index: 2;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      border-radius: 9999px;
      background: color-mix(in srgb, var(--site-bg) 86%, transparent);
      box-shadow: 0 0.125rem 0.5rem rgb(0 0 0 / 16%);
    }

    .home-posts-table-spinner {
      display: block;
      width: 1rem;
      height: 1rem;
      border: 2px solid color-mix(in srgb, var(--site-muted) 36%, transparent);
      border-block-start-color: var(--site-link);
      border-radius: 50%;
      animation: home-posts-table-spin 700ms linear infinite;
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

    .home-posts-table .mat-column-date {
      width: var(--home-posts-date-column-content-width);
      min-width: var(--home-posts-date-column-content-width);
      border-inline-end: 1px solid var(--site-border);
    }

    .home-posts-table .mat-column-title {
      min-width: 24rem;
    }

    .home-posts-table .home-posts-title-header {
      overflow: visible;
    }

    :host ::ng-deep .home-posts-table .home-posts-title-header .mat-sort-header-container {
      position: sticky;
      left: 0;
      z-index: 2;
      box-sizing: border-box;
      width: var(--home-posts-date-column-width);
      height: 100%;
      min-height: 2.75rem;
      margin-inline-start: -1rem;
      padding-inline: 1rem 0.65rem;
      background: var(--site-bg);
    }

    .home-posts-table .mat-sort-header {
      --mat-sort-arrow-color: currentColor;
    }

    :host ::ng-deep .home-posts-table .mat-sort-header-arrow {
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

    :host ::ng-deep .home-posts-table .mat-sort-header-arrow svg {
      display: none;
    }

    :host ::ng-deep .home-posts-table .mat-sort-header-arrow::before {
      content: "\\e5d8";
    }

    .home-posts-table .mat-sort-header-sorted {
      color: var(--site-text);
    }

    .home-post-title {
      display: inline;
      white-space: nowrap;
    }

    @keyframes home-posts-table-spin {
      to {
        transform: rotate(360deg);
      }
    }

    @media (max-width: 520px) {
      .home-posts-table-scroll-detailed {
        --home-posts-date-column-content-width: 12.5rem;
      }

      .home-posts-table {
        min-width: 36rem;
      }

      .home-posts-table .mat-column-date {
        width: var(--home-posts-date-column-content-width);
        min-width: var(--home-posts-date-column-content-width);
      }

      .home-posts-table .mat-column-title {
        min-width: 20rem;
      }
    }
  `,
})
export class HomeLatestPostsTableComponent implements AfterViewInit, OnInit, OnDestroy {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly liveAnnouncer = inject(LiveAnnouncer);

  @ViewChild(MatSort) sort?: MatSort;

  readonly detailEndpoint = input("/latest-posts.json");
  readonly posts = input<readonly HomeLatestPost[]>([]);
  readonly displayedColumns = ["date", "title"] as const;
  readonly dataSource = new MatTableDataSource<HomeLatestPost>();
  readonly detailed = signal(false);
  readonly detailedPosts = signal<readonly HomeLatestPost[] | null>(null);
  readonly loading = signal(false);
  readonly tablePosts = computed(() => {
    const posts =
      this.detailed() && this.detailedPosts() ? (this.detailedPosts() ?? []) : this.posts();

    return this.detailed() ? posts : posts.slice(0, 3);
  });

  private readonly syncTablePosts = effect(() => {
    this.dataSource.data = [...this.tablePosts()];
    this.queueDateColumnMeasure();
  });

  private detailRequest: Promise<void> | null = null;
  private dateColumnResizeObserver: ResizeObserver | null = null;
  private dateColumnMeasureFrame = 0;

  constructor() {
    this.dataSource.sortingDataAccessor = (post, column) => {
      if (column === "date") return new Date(post.datetime).valueOf();
      if (column === "title") return post.title.toLocaleLowerCase("fr");

      return "";
    };
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

  ngAfterViewInit() {
    if (this.sort) this.dataSource.sort = this.sort;
    this.watchDateColumnWidth();
    this.queueDateColumnMeasure();
  }

  ngOnDestroy() {
    if (typeof document === "undefined") return;

    document.removeEventListener(SITE_EVENTS.homeDetailViewChange, this.handleDetailViewChange);
    this.dateColumnResizeObserver?.disconnect();
    this.dateColumnResizeObserver = null;
    this.cancelDateColumnMeasure();
  }

  private readonly handleDetailViewChange = (event: Event) => {
    const detailed = Boolean((event as CustomEvent<{ detailed?: boolean }>).detail?.detailed);
    this.detailed.set(detailed);
    if (detailed) void this.loadDetailedPosts();
    this.queueDateColumnMeasure();
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

  private watchDateColumnWidth() {
    if (typeof ResizeObserver === "undefined") return;

    const dateHeader = this.elementRef.nativeElement.querySelector<HTMLElement>(
      ".home-posts-table .mat-column-date",
    );
    if (!dateHeader) return;

    this.dateColumnResizeObserver = new ResizeObserver(() => {
      this.queueDateColumnMeasure();
    });
    this.dateColumnResizeObserver.observe(dateHeader);
  }

  private queueDateColumnMeasure() {
    if (typeof window === "undefined") return;

    this.cancelDateColumnMeasure();
    this.dateColumnMeasureFrame = window.requestAnimationFrame(() => {
      this.dateColumnMeasureFrame = 0;
      this.measureDateColumn();
    });
  }

  private cancelDateColumnMeasure() {
    if (typeof window === "undefined" || this.dateColumnMeasureFrame === 0) return;

    window.cancelAnimationFrame(this.dateColumnMeasureFrame);
    this.dateColumnMeasureFrame = 0;
  }

  private measureDateColumn() {
    const scroller = this.elementRef.nativeElement.querySelector<HTMLElement>(
      ".home-posts-table-scroll",
    );
    const dateHeader = this.elementRef.nativeElement.querySelector<HTMLElement>(
      ".home-posts-table .mat-column-date",
    );
    if (!scroller || !dateHeader) return;

    const width = dateHeader.getBoundingClientRect().width;
    if (width <= 0) return;

    scroller.style.setProperty("--home-posts-date-column-measured-width", `${width}px`);
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
