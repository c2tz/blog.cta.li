import { SITE_EVENTS, SITE_LOADING_INDICATOR_DELAY_MS } from "@/lib/site-contracts";

interface HomeLatestPost {
  readonly dateCompact: string;
  readonly dateFull: string;
  readonly datetime: string;
  readonly href: string;
  readonly title: string;
}

interface LatestPostsResponse {
  readonly posts?: readonly unknown[];
}

type HomeSortColumn = "date" | "title";
type SortDirection = "asc" | "desc";

const UNSORTED_ICON = "\uE5D7";
const ASCENDING_ICON = "\uE5D8";
const DESCENDING_ICON = "\uE5DB";

function isHomeLatestPost(value: unknown): value is HomeLatestPost {
  if (!value || typeof value !== "object") return false;

  const post = value as Record<string, unknown>;
  return (
    typeof post.dateCompact === "string" &&
    typeof post.dateFull === "string" &&
    typeof post.datetime === "string" &&
    typeof post.href === "string" &&
    typeof post.title === "string"
  );
}

class HomeLatestPostsTableElement extends HTMLElement {
  private initialized = false;
  private initialPosts: HomeLatestPost[] = [];
  private detailedPosts: HomeLatestPost[] | null = null;
  private detailed = false;
  private loading = false;
  private sortColumn: HomeSortColumn | null = null;
  private sortDirection: SortDirection = "asc";
  private detailRequest: Promise<void> | null = null;
  private dateColumnResizeObserver: ResizeObserver | null = null;
  private dateColumnMeasureFrame = 0;
  private loadingIndicatorTimer = 0;

  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;
    this.dataset.enhanced = "true";
    this.initialPosts = this.readInitialPosts();

    for (const button of this.sortButtons) {
      button.addEventListener("click", this.handleSortClick);
    }
    document.addEventListener(SITE_EVENTS.homeDetailViewChange, this.handleDetailViewChange);

    this.detailed =
      document.documentElement.dataset.homeDetailView === "true" ||
      document.body.dataset.homeDetailView === "true";
    this.syncDetailedPresentation();
    this.updateSortPresentation();
    this.renderRows();
    this.watchDateColumnWidth();
    this.queueDateColumnMeasure();

    if (this.detailed) void this.loadDetailedPosts();
  }

  disconnectedCallback() {
    if (!this.initialized) return;
    this.initialized = false;

    for (const button of this.sortButtons) {
      button.removeEventListener("click", this.handleSortClick);
    }
    document.removeEventListener(SITE_EVENTS.homeDetailViewChange, this.handleDetailViewChange);
    this.dateColumnResizeObserver?.disconnect();
    this.dateColumnResizeObserver = null;
    this.cancelDateColumnMeasure();
    this.endLoading();
  }

  private get sortButtons() {
    return this.querySelectorAll<HTMLButtonElement>("[data-sort-column]");
  }

  private get table() {
    return this.querySelector<HTMLTableElement>("[data-posts-table]");
  }

  private get tableBody() {
    return this.querySelector<HTMLTableSectionElement>("[data-posts-body]");
  }

  private get scroller() {
    return this.querySelector<HTMLElement>("[data-table-scroll]");
  }

  private get loadingProgress() {
    return this.querySelector<HTMLElement>("[data-loading-progress]");
  }

  private get sortStatus() {
    return this.querySelector<HTMLElement>("[data-sort-status]");
  }

  private readonly handleSortClick = (event: Event) => {
    const button = event.currentTarget;
    if (!(button instanceof HTMLButtonElement)) return;

    const column = button.dataset.sortColumn;
    if (column !== "date" && column !== "title") return;
    this.toggleSort(column);
  };

  private readonly handleDetailViewChange = (event: Event) => {
    const detailed = Boolean((event as CustomEvent<{ detailed?: boolean }>).detail?.detailed);
    this.setDetailed(detailed);
  };

  private readInitialPosts() {
    try {
      const value = JSON.parse(this.dataset.posts ?? "[]");
      return Array.isArray(value) ? value.filter(isHomeLatestPost).slice(0, 3) : [];
    } catch {
      return [];
    }
  }

  private setDetailed(detailed: boolean) {
    this.detailed = detailed;
    this.syncDetailedPresentation();
    this.renderRows();
    this.queueDateColumnMeasure();

    if (detailed) void this.loadDetailedPosts();
  }

  private syncDetailedPresentation() {
    this.scroller?.classList.toggle("home-posts-table-scroll-detailed", this.detailed);
  }

  private toggleSort(column: HomeSortColumn) {
    if (this.sortColumn !== column) {
      this.sortColumn = column;
      this.sortDirection = "asc";
    } else if (this.sortDirection === "asc") {
      this.sortDirection = "desc";
    } else {
      this.sortColumn = null;
      this.sortDirection = "asc";
    }

    const status = this.sortStatus;
    if (!this.sortColumn) {
      if (status) status.textContent = "Tri désactivé.";
    } else {
      const direction = this.sortDirection === "asc" ? "croissant" : "décroissant";
      const label = column === "date" ? "date" : "titre";
      if (status) {
        status.textContent = `Articles triés par ${label}, ordre ${direction}.`;
      }
    }

    this.updateSortPresentation();
    this.renderRows();
  }

  private updateSortPresentation() {
    for (const button of this.sortButtons) {
      const column = button.dataset.sortColumn as HomeSortColumn;
      const active = this.sortColumn === column;
      button.classList.toggle("home-posts-sort-active", active);

      const header = button.closest("th");
      if (active) {
        header?.setAttribute(
          "aria-sort",
          this.sortDirection === "asc" ? "ascending" : "descending",
        );
      } else {
        header?.removeAttribute("aria-sort");
      }

      const icon = button.querySelector<HTMLElement>("[data-sort-icon]");
      if (icon) icon.textContent = this.sortIcon(column);
    }
  }

  private sortIcon(column: HomeSortColumn) {
    if (this.sortColumn !== column) return UNSORTED_ICON;
    return this.sortDirection === "asc" ? ASCENDING_ICON : DESCENDING_ICON;
  }

  private visiblePosts() {
    const source = this.detailed
      ? (this.detailedPosts ?? this.initialPosts)
      : this.initialPosts.slice(0, 3);
    if (!this.sortColumn) return [...source];

    const direction = this.sortDirection === "asc" ? 1 : -1;
    return [...source].sort((left, right) => {
      if (this.sortColumn === "date") {
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
  }

  private renderRows() {
    const body = this.tableBody;
    if (!body) return;

    const posts = this.visiblePosts();
    const fragment = document.createDocumentFragment();
    for (const post of posts) fragment.append(this.createPostRow(post));

    if (posts.length === 0) {
      const row = document.createElement("tr");
      row.className = "home-posts-table-loading-row";

      const cell = document.createElement("td");
      cell.colSpan = 2;

      const empty = document.createElement("span");
      empty.className = "home-posts-table-empty";
      empty.textContent = "Aucun article à afficher.";

      cell.append(empty);
      row.append(cell);
      fragment.append(row);
    }

    body.replaceChildren(fragment);
    this.queueDateColumnMeasure();
  }

  private createPostRow(post: HomeLatestPost) {
    const row = document.createElement("tr");
    row.className = "home-posts-table-row";

    const dateCell = document.createElement("td");
    dateCell.className = "home-posts-date-column";
    dateCell.append(
      this.createTime(post.datetime, post.dateCompact, "site-date-compact home-post-date-compact"),
      this.createTime(post.datetime, post.dateFull, "site-date-full home-post-date-full"),
    );

    const titleCell = document.createElement("td");
    titleCell.className = "home-posts-title-column";

    const link = document.createElement("a");
    link.className = "home-post-title";
    link.setAttribute("href", post.href);
    link.textContent = post.title;

    titleCell.append(link);
    row.append(dateCell, titleCell);
    return row;
  }

  private createTime(datetime: string, label: string, variantClasses: string) {
    const time = document.createElement("time");
    time.className = `post-date ${variantClasses}`;
    time.dateTime = datetime;
    time.textContent = label;
    return time;
  }

  private loadDetailedPosts() {
    if (this.detailedPosts) {
      this.renderRows();
      return Promise.resolve();
    }
    if (this.detailRequest) return this.detailRequest;

    this.beginLoading();
    this.detailRequest = fetch(this.dataset.detailEndpoint || "/latest-posts.json", {
      credentials: "same-origin",
    })
      .then((response) => {
        if (!response.ok) throw new Error("Impossible de charger les derniers articles.");
        return response.json() as Promise<LatestPostsResponse>;
      })
      .then((payload) => {
        const posts = Array.isArray(payload.posts)
          ? payload.posts.filter(isHomeLatestPost).slice(0, 8)
          : [];
        this.detailedPosts = posts.length > 0 ? posts : [...this.initialPosts];
        if (this.detailed && this.isConnected) this.renderRows();
      })
      .catch(() => {
        this.detailedPosts = [...this.initialPosts];
        if (this.detailed && this.isConnected) this.renderRows();
      })
      .finally(() => {
        this.endLoading();
        this.detailRequest = null;
      });

    return this.detailRequest;
  }

  private beginLoading() {
    this.loading = true;
    this.table?.setAttribute("aria-busy", "true");
    this.cancelLoadingIndicatorTimer();
    this.loadingIndicatorTimer = window.setTimeout(() => {
      this.loadingIndicatorTimer = 0;
      if (this.loading && this.loadingProgress) {
        this.loadingProgress.setAttribute("aria-hidden", "false");
        this.loadingProgress.setAttribute("data-loading-active", "");
      }
    }, SITE_LOADING_INDICATOR_DELAY_MS);
  }

  private endLoading() {
    this.loading = false;
    this.table?.removeAttribute("aria-busy");
    this.cancelLoadingIndicatorTimer();
    this.loadingProgress?.removeAttribute("data-loading-active");
    this.loadingProgress?.setAttribute("aria-hidden", "true");
  }

  private cancelLoadingIndicatorTimer() {
    if (!this.loadingIndicatorTimer) return;
    window.clearTimeout(this.loadingIndicatorTimer);
    this.loadingIndicatorTimer = 0;
  }

  private watchDateColumnWidth() {
    if (typeof ResizeObserver === "undefined") return;

    const dateHeader = this.querySelector<HTMLElement>(".home-posts-table .home-posts-date-column");
    if (!dateHeader) return;

    this.dateColumnResizeObserver = new ResizeObserver(() => this.queueDateColumnMeasure());
    this.dateColumnResizeObserver.observe(dateHeader);
  }

  private queueDateColumnMeasure() {
    this.cancelDateColumnMeasure();
    this.dateColumnMeasureFrame = window.requestAnimationFrame(() => {
      this.dateColumnMeasureFrame = 0;
      this.measureDateColumn();
    });
  }

  private cancelDateColumnMeasure() {
    if (!this.dateColumnMeasureFrame) return;
    window.cancelAnimationFrame(this.dateColumnMeasureFrame);
    this.dateColumnMeasureFrame = 0;
  }

  private measureDateColumn() {
    const scroller = this.scroller;
    const dateHeader = this.querySelector<HTMLElement>(".home-posts-table .home-posts-date-column");
    if (!scroller || !dateHeader) return;

    const width = dateHeader.getBoundingClientRect().width;
    if (width > 0) {
      scroller.style.setProperty("--home-posts-date-column-measured-width", `${width}px`);
    }
  }
}

if (!customElements.get("site-home-latest-posts-table")) {
  customElements.define("site-home-latest-posts-table", HomeLatestPostsTableElement);
}
