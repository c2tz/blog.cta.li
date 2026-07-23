type TagPostsView = "list" | "table";
type SortColumn = "created" | "title";
type SortDirection = "asc" | "desc";

interface MaterialValueElement extends HTMLElement {
  value?: string;
}

interface TagPostDomItem {
  created: string;
  element: HTMLElement;
  index: number;
  search: string;
  title: string;
}

const UNSORTED_ICON = "\uE5D7";
const SORT_ASC_ICON = "\uE5D8";
const SORT_DESC_ICON = "\uE5DB";

function materialValue(element: MaterialValueElement) {
  return typeof element.value === "string" ? element.value : (element.getAttribute("value") ?? "");
}

class SiteTagPostsElement extends HTMLElement {
  private items: TagPostDomItem[] = [];
  private itemsContainer: HTMLElement | null = null;
  private emptyRow: HTMLElement | null = null;
  private pageIndex = 0;
  private pageSize = 10;
  private filterValue = "";
  private sortColumn: SortColumn | null = null;
  private sortDirection: SortDirection = "asc";
  private tag = "all";
  private view: TagPostsView = "list";

  connectedCallback() {
    if (this.hasAttribute("data-enhanced")) return;
    this.setAttribute("data-enhanced", "true");

    this.tag = this.getAttribute("data-tag") || "all";
    this.view = this.getAttribute("data-view") === "table" ? "table" : "list";
    this.itemsContainer = this.querySelector<HTMLElement>("[data-tag-posts-items]");
    this.emptyRow = this.querySelector<HTMLElement>("[data-empty-row]");
    this.items = Array.from(this.querySelectorAll<HTMLElement>("[data-tag-post-item]")).map(
      (element, index) => ({
        created: element.getAttribute("data-created") ?? "",
        element,
        index: Number.parseInt(element.getAttribute("data-index") ?? `${index}`, 10),
        search: (element.getAttribute("data-search") ?? "").toLocaleLowerCase("fr"),
        title: element.getAttribute("data-title") ?? "",
      }),
    );

    this.bindFilter();
    this.bindSort();
    this.bindPagination();
    this.render();
  }

  private bindFilter() {
    const field = this.querySelector<MaterialValueElement>("[data-tag-posts-filter]");
    if (!field) return;

    const updateFilter = () => {
      const nextValue = materialValue(field);
      if (nextValue === this.filterValue) return;

      this.filterValue = nextValue;
      this.pageIndex = 0;
      this.render();
    };

    field.addEventListener("input", updateFilter);
    field.addEventListener("change", updateFilter);
  }

  private bindSort() {
    this.querySelectorAll<HTMLButtonElement>("[data-sort-column]").forEach((button) => {
      button.addEventListener("click", () => {
        const column = button.getAttribute("data-sort-column");
        if (column !== "created" && column !== "title") return;
        this.toggleSort(column);
      });
    });
  }

  private bindPagination() {
    const pageSize = this.querySelector<MaterialValueElement>("[data-page-size]");
    pageSize?.addEventListener("change", () => {
      const nextSize = Number.parseInt(materialValue(pageSize), 10);
      if (!Number.isFinite(nextSize) || nextSize <= 0) return;

      this.pageSize = nextSize;
      this.pageIndex = 0;
      this.render();
    });

    this.querySelectorAll<HTMLElement>("[data-page-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.getAttribute("data-page-action");
        const pageCount = this.pageCount(this.filteredItems().length);

        if (action === "first") this.pageIndex = 0;
        else if (action === "previous") this.pageIndex -= 1;
        else if (action === "next") this.pageIndex += 1;
        else if (action === "last") this.pageIndex = pageCount - 1;
        else return;

        this.pageIndex = Math.min(Math.max(0, this.pageIndex), pageCount - 1);
        this.render();
      });
    });
  }

  private toggleSort(column: SortColumn) {
    if (this.sortColumn !== column) {
      this.sortColumn = column;
      this.sortDirection = "asc";
    } else if (this.sortDirection === "asc") {
      this.sortDirection = "desc";
    } else {
      this.sortColumn = null;
      this.sortDirection = "asc";
    }

    this.pageIndex = 0;
    const status = this.querySelector<HTMLElement>("[data-sort-status]");
    if (status) {
      if (!this.sortColumn) {
        status.textContent = "Tri désactivé.";
      } else {
        const direction = this.sortDirection === "asc" ? "croissant" : "décroissant";
        const label = column === "created" ? "date" : "titre";
        status.textContent = `Articles triés par ${label}, ordre ${direction}.`;
      }
    }

    this.render();
  }

  private filteredItems() {
    const filter = this.filterValue.trim().toLocaleLowerCase("fr");
    const filtered = filter
      ? this.items.filter((item) => item.search.includes(filter))
      : this.items;
    return this.sortItems(filtered);
  }

  private sortItems(items: TagPostDomItem[]) {
    if (this.view !== "table" || !this.sortColumn) {
      return [...items].sort((left, right) => left.index - right.index);
    }

    const direction = this.sortDirection === "asc" ? 1 : -1;
    return [...items].sort((left, right) => {
      if (this.sortColumn === "created") {
        const leftDate = Date.parse(left.created);
        const rightDate = Date.parse(right.created);
        const result =
          Number.isNaN(leftDate) || Number.isNaN(rightDate)
            ? left.created.localeCompare(right.created, "fr")
            : leftDate - rightDate;
        return result * direction;
      }

      return left.title.localeCompare(right.title, "fr", { sensitivity: "base" }) * direction;
    });
  }

  private render() {
    const filtered = this.filteredItems();
    const pageCount = this.pageCount(filtered.length);
    this.pageIndex = Math.min(this.pageIndex, pageCount - 1);

    const orderedItems = this.sortItems(this.items);
    if (this.itemsContainer) {
      this.itemsContainer.append(...orderedItems.map((item) => item.element));
      if (this.emptyRow) this.itemsContainer.append(this.emptyRow);
    }

    const start = this.pageIndex * this.pageSize;
    const visiblePage = filtered.slice(start, start + this.pageSize);
    const visibleItems = new Set(visiblePage);
    const lastVisibleItem = visiblePage.at(-1);
    this.items.forEach((item) => {
      item.element.hidden = !visibleItems.has(item);
      item.element.classList.toggle("is-last-visible", item === lastVisibleItem);
    });
    if (this.emptyRow) this.emptyRow.hidden = filtered.length > 0;

    this.updateSortState();
    this.updatePagination(filtered.length, pageCount);
  }

  private updateSortState() {
    this.querySelectorAll<HTMLElement>("[data-sort-header]").forEach((header) => {
      const column = header.getAttribute("data-sort-header");
      const active = column === this.sortColumn;
      const button = header.querySelector<HTMLElement>("[data-sort-column]");
      const icon = header.querySelector<HTMLElement>("[data-sort-icon]");

      if (active) {
        header.setAttribute("aria-sort", this.sortDirection === "asc" ? "ascending" : "descending");
      } else {
        header.removeAttribute("aria-sort");
      }
      button?.classList.toggle("tag-posts-sort-active", active);
      if (icon) {
        icon.textContent = active
          ? this.sortDirection === "asc"
            ? SORT_ASC_ICON
            : SORT_DESC_ICON
          : UNSORTED_ICON;
      }
    });
  }

  private updatePagination(total: number, pageCount: number) {
    const hasPreviousPage = this.pageIndex > 0;
    const hasNextPage = this.pageIndex + 1 < pageCount;
    this.setActionDisabled("first", !hasPreviousPage);
    this.setActionDisabled("previous", !hasPreviousPage);
    this.setActionDisabled("next", !hasNextPage);
    this.setActionDisabled("last", !hasNextPage);

    const start = total === 0 ? 0 : this.pageIndex * this.pageSize + 1;
    const end = total === 0 ? 0 : Math.min(start + this.pageSize - 1, total);
    const range = this.querySelector<HTMLElement>("[data-page-range]");
    if (range) range.textContent = total === 0 ? "0 sur 0" : `${start} - ${end} sur ${total}`;

    const status = this.querySelector<HTMLElement>("[data-page-status]");
    if (status) {
      status.textContent =
        total === 0
          ? this.tag === "all"
            ? "Aucun article à afficher."
            : `Aucun article pour le tag ${this.tag}.`
          : this.tag === "all"
            ? `Articles ${start} à ${end} sur ${total}.`
            : `Articles ${start} à ${end} sur ${total} pour le tag ${this.tag}.`;
    }
  }

  private setActionDisabled(action: string, disabled: boolean) {
    this.querySelector<HTMLElement>(`[data-page-action="${action}"]`)?.toggleAttribute(
      "disabled",
      disabled,
    );
  }

  private pageCount(total: number) {
    return Math.max(1, Math.ceil(total / this.pageSize));
  }
}

if (!customElements.get("site-tag-posts")) {
  customElements.define("site-tag-posts", SiteTagPostsElement);
}
