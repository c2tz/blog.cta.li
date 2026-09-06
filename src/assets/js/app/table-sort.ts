// Use the site's Rounded symbol with Angular Material's sort-header motion:
// https://github.com/angular/components/tree/main/src/material/sort
export const SORT_INDICATOR_HTML =
  '<span class="site-sort-arrow" data-sort-icon aria-hidden="true"><md-icon aria-hidden="true">&#xE5D8;</md-icon></span>';

const initializedButtons = new WeakSet<HTMLElement>();

export function updateTableSortHeader(
  button: HTMLElement,
  direction: "asc" | "desc" | null,
  cleared = false,
) {
  if (!initializedButtons.has(button)) {
    initializedButtons.add(button);
    const resetClear = () => delete button.dataset.sortCleared;
    button.addEventListener("pointerleave", resetClear);
    button.addEventListener("blur", resetClear);
    button.addEventListener("focus", resetClear);
  }

  const previousDirection = button.dataset.sortDirection;
  const header = button.closest("th");
  if (direction) {
    button.dataset.sortDirection = direction;
    delete button.dataset.sortCleared;
    header?.setAttribute("aria-sort", direction === "asc" ? "ascending" : "descending");
  } else {
    delete button.dataset.sortDirection;
    header?.removeAttribute("aria-sort");
    if (cleared && previousDirection) button.dataset.sortCleared = previousDirection;
    else if (!cleared) delete button.dataset.sortCleared;
  }
}
