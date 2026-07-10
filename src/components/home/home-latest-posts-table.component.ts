import {
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from "@angular/core";
import type { AfterViewInit, OnDestroy, OnInit } from "@angular/core";

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

const LOADING_INDICATOR_DELAY_MS = 200;

type HomeSortColumn = "date" | "title";
type SortDirection = "asc" | "desc";

@Component({
  selector: "site-home-latest-posts-table",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {{ sortStatus() }}
    </p>

    <div
      class="home-posts-table-scroll"
      tabindex="0"
      [class.home-posts-table-scroll-detailed]="detailed()"
    >
      @if (loadingIndicatorVisible()) {
        <md-linear-progress
          class="home-posts-table-progress"
          indeterminate
          aria-label="Chargement des articles"
        ></md-linear-progress>
      }
      <table
        id="home-latest-posts-table"
        class="home-posts-table"
        aria-label="Derniers articles"
        [attr.aria-busy]="loading() ? 'true' : null"
      >
        <thead>
          <tr>
            <th class="home-posts-date-column" scope="col" [attr.aria-sort]="sortAria('date')">
              <button
                type="button"
                class="home-posts-sort-button"
                [class.home-posts-sort-active]="sortColumn() === 'date'"
                aria-label="Trier par date"
                (click)="toggleSort('date')"
              >
                <span>Date</span>
                <md-icon aria-hidden="true">{{ sortIcon("date") }}</md-icon>
                <md-ripple></md-ripple>
              </button>
            </th>
            <th
              class="home-posts-title-column home-posts-title-header"
              scope="col"
              [attr.aria-sort]="sortAria('title')"
            >
              <button
                type="button"
                class="home-posts-sort-button"
                [class.home-posts-sort-active]="sortColumn() === 'title'"
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
          @for (post of sortedPosts(); track post.href) {
            <tr class="home-posts-table-row">
              <td class="home-posts-date-column">
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
              <td class="home-posts-title-column">
                <a class="home-post-title" [href]="post.href">{{ post.title }}</a>
              </td>
            </tr>
          } @empty {
            <tr class="home-posts-table-loading-row">
              <td colspan="2">
                @if (loading()) {
                  <span class="sr-only">Chargement des articles</span>
                } @else {
                  <span class="home-posts-table-empty">Aucun article à afficher.</span>
                }
              </td>
            </tr>
          }
        </tbody>
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
      height: 2.75rem;
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

    .home-posts-table th {
      padding: 0;
      color: var(--site-muted);
      font-weight: 600;
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

    .home-posts-table-progress {
      --md-linear-progress-active-indicator-color: var(--md-sys-color-primary);
      --md-linear-progress-active-indicator-height: 0.2rem;
      --md-linear-progress-track-color: var(--md-sys-color-surface-container-highest);
      --md-linear-progress-track-height: 0.2rem;
      --md-linear-progress-track-shape: var(--md-sys-shape-corner-none);

      position: sticky;
      top: 0;
      left: 0;
      z-index: 3;
      width: 100%;
      min-width: 100%;
    }

    .home-posts-table-empty {
      display: inline-block;
      padding: 1rem;
      color: var(--site-muted);
    }

    .home-posts-table .home-posts-date-column {
      width: var(--home-posts-date-column-content-width);
      min-width: var(--home-posts-date-column-content-width);
      border-inline-end: 1px solid var(--site-border);
    }

    .home-posts-table .home-posts-title-column {
      min-width: 20rem;
    }

    .home-posts-table .home-posts-title-header {
      overflow: visible;
    }

    .home-posts-sort-button {
      --md-ripple-focus-color: var(--site-link);
      --md-ripple-hover-color: var(--site-link);
      --md-ripple-pressed-color: var(--site-link);

      position: relative;
      display: flex;
      align-items: center;
      gap: 0.25rem;
      width: 100%;
      min-height: 2.75rem;
      box-sizing: border-box;
      padding: 0 2rem 0 1rem;
      overflow: hidden;
      border: 0;
      background: transparent;
      color: inherit;
      cursor: pointer;
      font: inherit;
      font-weight: inherit;
      text-align: start;
    }

    .home-posts-sort-button md-icon {
      --md-icon-size: 1.25rem;

      width: 1.25rem;
      height: 1.25rem;
      flex-basis: 1.25rem;
      font-size: 1.25rem;
    }

    .home-posts-sort-active {
      background: color-mix(in srgb, var(--site-link) 10%, transparent);
      color: var(--site-text);
    }

    .home-posts-sort-button:focus-visible {
      outline: 0;
      box-shadow: inset 0 0 0 2px var(--site-link);
    }

    .home-post-title {
      display: inline;
      white-space: nowrap;
    }
  `,
})
export class HomeLatestPostsTableComponent implements AfterViewInit, OnInit, OnDestroy {
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly detailEndpoint = input("/latest-posts.json");
  readonly posts = input<readonly HomeLatestPost[]>([]);
  readonly detailed = signal(false);
  readonly detailedPosts = signal<readonly HomeLatestPost[] | null>(null);
  readonly loading = signal(false);
  readonly loadingIndicatorVisible = signal(false);
  readonly sortColumn = signal<HomeSortColumn | null>(null);
  readonly sortDirection = signal<SortDirection>("asc");
  readonly sortStatus = signal("");
  readonly tablePosts = computed(() => {
    const posts = this.detailed() ? (this.detailedPosts() ?? this.posts()) : this.posts();

    return this.detailed() ? posts : posts.slice(0, 3);
  });
  readonly sortedPosts = computed(() => {
    const column = this.sortColumn();
    if (!column) return this.tablePosts();

    const direction = this.sortDirection() === "asc" ? 1 : -1;
    return [...this.tablePosts()].sort((left, right) => {
      if (column === "date") {
        const leftDate = Date.parse(left.datetime);
        const rightDate = Date.parse(right.datetime);
        const result =
          Number.isNaN(leftDate) || Number.isNaN(rightDate)
            ? left.datetime.localeCompare(right.datetime, "fr")
            : leftDate - rightDate;
        return result * direction;
      }

      return left.title.localeCompare(right.title, "fr", { sensitivity: "base" }) * direction;
    });
  });

  private detailRequest: Promise<void> | null = null;
  private dateColumnResizeObserver: ResizeObserver | null = null;
  private dateColumnMeasureFrame = 0;
  private loadingIndicatorTimer = 0;

  constructor() {
    effect(() => {
      this.tablePosts();
      this.queueDateColumnMeasure();
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

  ngAfterViewInit() {
    this.watchDateColumnWidth();
    this.queueDateColumnMeasure();
  }

  ngOnDestroy() {
    if (typeof document !== "undefined") {
      document.removeEventListener(SITE_EVENTS.homeDetailViewChange, this.handleDetailViewChange);
    }
    this.dateColumnResizeObserver?.disconnect();
    this.dateColumnResizeObserver = null;
    this.cancelDateColumnMeasure();
    this.endLoading();
  }

  toggleSort(column: HomeSortColumn) {
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
    const label = column === "date" ? "date" : "titre";
    this.sortStatus.set(`Articles triés par ${label}, ordre ${direction}.`);
  }

  sortAria(column: HomeSortColumn) {
    if (this.sortColumn() !== column) return null;
    return this.sortDirection() === "asc" ? "ascending" : "descending";
  }

  sortIcon(column: HomeSortColumn) {
    if (this.sortColumn() !== column) return "\uE5D7";
    return this.sortDirection() === "asc" ? "\uE5D8" : "\uE5DB";
  }

  private readonly handleDetailViewChange = (event: Event) => {
    const detailed = Boolean((event as CustomEvent<{ detailed?: boolean }>).detail?.detailed);
    this.detailed.set(detailed);
    if (detailed) void this.loadDetailedPosts();
    this.queueDateColumnMeasure();
  };

  private watchDateColumnWidth() {
    if (typeof ResizeObserver === "undefined") return;

    const dateHeader = this.elementRef.nativeElement.querySelector<HTMLElement>(
      ".home-posts-table .home-posts-date-column",
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
      ".home-posts-table .home-posts-date-column",
    );
    if (!scroller || !dateHeader) return;

    const width = dateHeader.getBoundingClientRect().width;
    if (width <= 0) return;

    scroller.style.setProperty("--home-posts-date-column-measured-width", `${width}px`);
  }

  private loadDetailedPosts() {
    if (this.detailedPosts()) return Promise.resolve();
    if (this.detailRequest) return this.detailRequest;

    this.beginLoading();
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
        this.endLoading();
        this.detailRequest = null;
      });

    return this.detailRequest;
  }

  private beginLoading() {
    this.loading.set(true);
    this.cancelLoadingIndicatorTimer();
    this.loadingIndicatorTimer = window.setTimeout(() => {
      this.loadingIndicatorTimer = 0;
      if (this.loading()) this.loadingIndicatorVisible.set(true);
    }, LOADING_INDICATOR_DELAY_MS);
  }

  private endLoading() {
    this.loading.set(false);
    this.cancelLoadingIndicatorTimer();
    this.loadingIndicatorVisible.set(false);
  }

  private cancelLoadingIndicatorTimer() {
    if (!this.loadingIndicatorTimer || typeof window === "undefined") return;
    window.clearTimeout(this.loadingIndicatorTimer);
    this.loadingIndicatorTimer = 0;
  }
}
