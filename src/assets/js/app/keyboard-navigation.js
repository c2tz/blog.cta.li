const ACTION_GROUPS = [
  ".site-header-actions",
  ".home-hero-actions",
  ".cookie-consent-actions",
  ".cookie-preferences-actions",
  ".cookie-preferences-services",
  ".home-posts-table thead tr",
  ".tag-posts-table thead tr",
].join(",");
const ACTIONS = [
  "a[href]",
  "button",
  "input:not([type='hidden'])",
  "select",
  "textarea",
  "summary",
  "[tabindex]",
  "md-icon-button",
  "md-filled-icon-button",
  "md-filled-tonal-icon-button",
  "md-outlined-icon-button",
  "md-text-button",
  "md-filled-button",
  "md-filled-tonal-button",
  "md-outlined-button",
  "md-elevated-button",
  "md-switch",
  "md-checkbox",
  "md-radio",
  "md-slider",
  "md-filled-text-field",
  "md-outlined-text-field",
  "md-filled-select",
  "md-outlined-select",
  "md-assist-chip",
  "md-filter-chip",
  "md-input-chip",
  "md-suggestion-chip",
  "md-primary-tab",
  "md-secondary-tab",
].join(",");
// These controls own their arrow keys (editing, choosing a value or navigating
// a composite widget). The page shortcuts must not replace that behavior.
const OWN_ARROW_KEYS = [
  "input:not([type='checkbox']):not([type='button']):not([type='submit']):not([type='reset'])",
  "textarea",
  "select",
  "[contenteditable]:not([contenteditable='false'])",
  "audio",
  "video",
  "pre[tabindex]",
  "md-menu",
  "md-filled-select",
  "md-outlined-select",
  "md-chip-set",
  "md-tabs",
  "md-slider",
  "md-radio",
  '[role="menu"]',
  '[role="menubar"]',
  '[role="listbox"]',
  '[role="combobox"]',
  '[role="tablist"]',
  '[role="tree"]',
  '[role="grid"]',
  '[role="radiogroup"]',
  '[role="slider"]',
  '[role="spinbutton"]',
].join(",");
const MODALS = 'md-dialog[open], dialog[open], [role="dialog"][aria-modal="true"]';
const SCROLL_REGIONS = ".home-posts-table-scroll, .tag-posts-table-scroll";
const observedRegions = new WeakSet();
let installed = false;

function isAvailable(element) {
  return (
    !element.hasAttribute("disabled") &&
    !element.matches(":disabled") &&
    element.getAttribute("aria-disabled") !== "true" &&
    !element.closest('[inert], [hidden], [aria-hidden="true"]') &&
    !(element.hasAttribute("tabindex") && element.tabIndex < 0) &&
    element.checkVisibility({ checkVisibilityCSS: true })
  );
}

function navigateActions(event) {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
    return;
  }

  const path = event.composedPath().filter((node) => node instanceof HTMLElement);
  if (path.some((node) => node.matches(OWN_ARROW_KEYS))) return;
  // Use the Material host, not its shadow button, so each control occurs once
  // in the same document order used by Tab.
  const action = path.find((node) => node.getRootNode() === document && node.matches(ACTIONS));
  if (!action) return;
  if (action.matches(SCROLL_REGIONS) && ["ArrowLeft", "ArrowRight"].includes(event.key)) return;

  const boundaryKey = event.key === "Home" || event.key === "End";
  const group = action.closest(ACTION_GROUPS);
  if (boundaryKey && !group) return;
  const scope = boundaryKey ? group : (action.closest(MODALS) ?? document);
  const selector =
    boundaryKey && group.matches(".site-header-actions")
      ? "[data-search-open], .home-detail-trigger, .site-theme-trigger"
      : ACTIONS;
  const actions = [...scope.querySelectorAll(selector)].filter(isAvailable);
  if (!actions.length) return;
  const index = actions.indexOf(action);

  const backwards = event.key === "ArrowLeft" || event.key === "ArrowUp";
  const rtl =
    ["ArrowLeft", "ArrowRight"].includes(event.key) && getComputedStyle(action).direction === "rtl";
  const step = backwards !== rtl ? -1 : 1;
  // A skip link or a dismissed notice can leave focus on main/heading with
  // tabindex=-1. Continue from that position without adding a new Tab stop.
  const following =
    index < 0
      ? actions.findIndex(
          (element) => action.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING,
        )
      : -1;
  const origin =
    index >= 0 ? index : (following < 0 ? actions.length : following) - (step > 0 ? 1 : 0);
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? actions.length - 1
        : (origin + step + actions.length) % actions.length;
  event.preventDefault();
  actions[next].focus();
}

function updateScrollRegion(region) {
  const scrollable = region.scrollWidth > region.clientWidth + 1;
  region.tabIndex = scrollable ? 0 : -1;
  if (scrollable) {
    region.setAttribute("role", "region");
    region.setAttribute(
      "aria-label",
      `${region.querySelector("table")?.getAttribute("aria-label") || "Tableau"} — défilement horizontal`,
    );
  } else {
    region.removeAttribute("role");
    region.removeAttribute("aria-label");
  }
}

function scrollWithKeyboard(event) {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  const region = event.target;
  if (!(region instanceof HTMLElement) || !region.matches(SCROLL_REGIONS)) return;
  if (region.scrollWidth <= region.clientWidth + 1) return;
  // WebKit does not consistently scroll a programmatically focused region.
  // Descendant controls keep their own keyboard behavior.
  event.preventDefault();
  region.scrollBy({ left: event.key === "ArrowLeft" ? -40 : 40, behavior: "auto" });
}

/** Adds page-wide arrow shortcuts while preserving native Tab and widget keys. */
export function initKeyboardNavigation() {
  if (!installed) {
    installed = true;
    document.addEventListener("keydown", navigateActions);
    document.addEventListener("keydown", scrollWithKeyboard);
  }

  for (const region of document.querySelectorAll(SCROLL_REGIONS)) {
    if (observedRegions.has(region)) continue;
    observedRegions.add(region);
    // Watch both sides: detail mode, fonts and new rows can resize the table
    // without changing the available width of its scrolling container.
    const observer = new ResizeObserver(() => updateScrollRegion(region));
    observer.observe(region);
    const table = region.querySelector("table");
    if (table) observer.observe(table);
    updateScrollRegion(region);
    document.addEventListener(
      "astro:before-swap",
      () => {
        observer.disconnect();
        observedRegions.delete(region);
      },
      { once: true },
    );
  }
}
