import { ChangeDetectionStrategy, Component, computed, input, signal } from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";
import { MatTableModule } from "@angular/material/table";

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
  imports: [MatTableModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="home-posts-table-scroll"
      tabindex="0"
      aria-label="Derniers articles"
      [attr.aria-busy]="loading()"
    >
      <table mat-table [dataSource]="visiblePosts()" class="home-posts-table">
        <ng-container matColumnDef="date" sticky>
          <th mat-header-cell *matHeaderCellDef scope="col">Date</th>
          <td mat-cell *matCellDef="let post">
            <time class="post-date home-post-date-compact" [attr.datetime]="post.datetime">
              {{ post.dateCompact }}
            </time>
            <time class="post-date home-post-date-full" [attr.datetime]="post.datetime">
              {{ post.dateFull }}
            </time>
          </td>
        </ng-container>

        <ng-container matColumnDef="title">
          <th mat-header-cell *matHeaderCellDef scope="col">Titre</th>
          <td mat-cell *matCellDef="let post">
            <a class="home-post-title" [href]="post.href">{{ post.title }}</a>
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayedColumns; sticky: true"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
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
      scrollbar-width: thin;
      -webkit-overflow-scrolling: touch;
    }

    .home-posts-table-scroll:focus-visible {
      border-radius: 4px;
      outline: 2px solid var(--site-link);
      outline-offset: 2px;
    }

    .home-posts-table.mat-mdc-table {
      min-width: 42rem;
      width: max-content;
      border-collapse: separate;
      border-spacing: 0;
      background: transparent;
      color: var(--site-text);
      font-family: var(--site-font);
    }

    .home-posts-table ::ng-deep .mat-mdc-header-cell,
    .home-posts-table ::ng-deep .mat-mdc-cell {
      border: 0;
      border-block-end: 1px solid var(--site-border);
      background: var(--site-bg);
      color: var(--site-text);
      font-family: var(--site-font);
      font-size: 1rem;
      font-weight: 400;
      letter-spacing: 0;
      line-height: 1.5;
      white-space: nowrap;
    }

    .home-posts-table ::ng-deep .mat-mdc-header-row,
    .home-posts-table ::ng-deep .mat-mdc-row {
      height: 2.75rem;
      background: transparent;
    }

    .home-posts-table ::ng-deep .mat-mdc-header-cell {
      color: var(--site-muted);
      font-weight: 600;
      top: 0;
      text-transform: none;
      z-index: 4;
    }

    .home-posts-table ::ng-deep .mat-mdc-row:last-child .mat-mdc-cell {
      border-block-end-color: transparent;
    }

    .home-posts-table ::ng-deep .mat-column-date {
      width: 14rem;
      min-width: 14rem;
      box-shadow: 1px 0 0 var(--site-border);
      z-index: 3;
    }

    .home-posts-table ::ng-deep .mat-column-title {
      min-width: 24rem;
    }

    .home-posts-table ::ng-deep .mat-mdc-header-cell.mat-column-date {
      z-index: 7;
    }

    .home-posts-table ::ng-deep .mat-mdc-header-cell.mat-column-title {
      position: sticky;
      left: 14rem;
      z-index: 6;
    }

    .home-post-title {
      display: inline;
      white-space: nowrap;
    }

    @media (max-width: 520px) {
      .home-posts-table.mat-mdc-table {
        min-width: 36rem;
      }

      .home-posts-table ::ng-deep .mat-column-date {
        width: 12.5rem;
        min-width: 12.5rem;
      }

      .home-posts-table ::ng-deep .mat-column-title {
        min-width: 20rem;
      }

      .home-posts-table ::ng-deep .mat-mdc-header-cell.mat-column-title {
        left: 12.5rem;
      }
    }
  `,
})
export class HomeLatestPostsTableComponent implements OnInit, OnDestroy {
  readonly detailEndpoint = input("/latest-posts.json");
  readonly posts = input<readonly HomeLatestPost[]>([]);
  readonly displayedColumns = ["date", "title"] as const;
  readonly detailed = signal(false);
  readonly detailedPosts = signal<readonly HomeLatestPost[] | null>(null);
  readonly loading = signal(false);
  readonly visiblePosts = computed(() => {
    if (this.detailed()) return this.detailedPosts() ?? this.posts();

    return this.posts().slice(0, 3);
  });

  private detailRequest: Promise<void> | null = null;

  ngOnInit() {
    if (typeof document === "undefined") return;

    const detailed = document.body.dataset["homeDetailView"] === "true";
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
