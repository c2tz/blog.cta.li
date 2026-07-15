import { isSearchSortMode } from "@/components/search/site-search-model";
import { loadPagefindModule } from "@/components/search/site-search-pagefind";
import { SITE_LOADING_INDICATOR_DELAY_MS } from "@/lib/site-contracts";
import { hideSiteTooltip } from "./site-tooltips.js";
import { renderSearchResults } from "./site-search-renderer.js";
import {
  dateValue,
  formatDate,
  highlightTitle,
  normalizeSelectedTags,
  parsePriority,
  parseTags,
  removeLeadingTitle,
} from "./site-search-utils.js";

const MIN_QUERY_LENGTH = 2;
const RESULT_LIMIT = 12;
const EXPANDED_RESULT_FETCH_LIMIT = 100;
const TAG_FILTER_LIMIT = 18;
const MAX_SELECTED_TAGS = 3;
const SEARCH_TIMEOUT_MS = 12_000;
const QUERY_DEBOUNCE_MS = 160;
const MAX_PRIORITY = 100;
const RELEVANCE_PRIORITY_WEIGHT = 0.01;

const panelControllers = new WeakMap();
let filterChipModule;
let searchMaterialModule;

function loadSearchMaterialModule() {
  searchMaterialModule ??= import("@/assets/js/material-web/search.js").catch((error) => {
    searchMaterialModule = undefined;
    throw error;
  });
  return searchMaterialModule;
}

function loadFilterChipModule() {
  filterChipModule ??= import("@material/web/chips/filter-chip.js").catch((error) => {
    filterChipModule = undefined;
    throw error;
  });
  return filterChipModule;
}

function controlValue(event) {
  const candidates = [event.composedPath()[0], event.target, event.currentTarget];

  for (const candidate of candidates) {
    if (typeof candidate?.value === "string") return candidate.value;
  }

  return "";
}

class SearchPanelController {
  constructor(root) {
    this.root = root;
    this.form = root.querySelector("[data-search-form]");
    this.input = root.querySelector("[data-search-input]");
    this.clearSearchButton = root.querySelector("[data-clear-search]");
    this.sortSelect = root.querySelector("[data-sort-select]");
    this.statusElement = root.querySelector("[data-search-status]");
    this.filterActions = root.querySelector("[data-filter-actions]");
    this.clearFiltersButton = root.querySelector("[data-clear-filters]");
    this.filterLimit = root.querySelector("[data-filter-limit]");
    this.progress = root.querySelector("[data-search-progress]");
    this.tagsElement = root.querySelector("[data-search-tags]");
    this.resultsElement = root.querySelector("[data-search-results]");
    this.dateFormatter = new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    this.query = "";
    this.selectedTags = [];
    this.sortMode = "relevance";
    this.tagFilters = [];
    this.results = [];
    this.status = "Tapez au moins deux caractères ou choisissez un filtre.";
    this.filtersLoaded = false;
    this.allTagFilterCounts = undefined;
    this.pagefind = undefined;
    this.requestId = 0;
    this.loadingOperations = new Set();
    this.currentSearchOperation = null;
    this.loadingIndicatorTimer = 0;
    this.queryDebounceTimer = 0;
    this.inputControl = undefined;
    this.sortControlMedia = window.matchMedia("(max-width: 720px), (pointer: coarse)");
    this.filterChipReady = loadFilterChipModule();

    this.handleInput = this.handleInput.bind(this);
    this.handleSortControlMediaChange = this.handleSortControlMediaChange.bind(this);
    this.connect();
  }

  connect() {
    if (typeof this.input.value === "string" && this.input.value) {
      // Preserve a value entered by autofill or automation before a deferred
      // panel finishes connecting.
      this.query = this.input.value;
    }

    // The deferred panel is connected while its Material dialog is still
    // hidden. Avoid asking Material Web to animate an unchanged empty label
    // against zero-sized geometry (0 / 0 produces invalid NaN keyframes in
    // Chromium). Autofill and pre-connect input are already mirrored above.
    if (this.input.value !== this.query) this.input.value = this.query;
    this.syncSortControl();
    this.render();

    this.form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.query = String(this.input.value ?? this.query);
      void this.search(this.query.trim());
    });
    this.input.addEventListener("input", this.handleInput);
    this.input.addEventListener("keyup", this.handleInput);
    this.clearSearchButton.addEventListener("click", () => this.clearSearch());
    this.clearFiltersButton.addEventListener("click", () => this.clearFilters());
    this.sortSelect.addEventListener("change", (event) => this.setSortMode(controlValue(event)));
    this.sortControlMedia.addEventListener("change", this.handleSortControlMediaChange);
    document.addEventListener(
      "astro:before-swap",
      () => {
        this.sortControlMedia.removeEventListener("change", this.handleSortControlMediaChange);
      },
      { once: true },
    );

    void this.connectMaterialTextField();
    void this.connectSortMenuRepositioning();
    void this.loadTagFilters();
    void this.search(this.query.trim());
  }

  async connectMaterialTextField() {
    await customElements.whenDefined("md-filled-text-field");
    await this.input.updateComplete;

    const control = this.input.shadowRoot?.querySelector("input, textarea");
    if (!control || this.inputControl === control) return;

    this.inputControl?.removeEventListener("input", this.handleInput);
    this.inputControl = control;
    control.addEventListener("input", this.handleInput);
  }

  async connectSortMenuRepositioning() {
    await customElements.whenDefined("md-filled-select");
    await this.sortSelect.updateComplete;

    const dialog = this.root.closest("md-dialog");
    if (!dialog) return;

    await customElements.whenDefined("md-dialog");
    await dialog.updateComplete;

    const menu = this.sortSelect.shadowRoot?.querySelector("md-menu");
    const dialogScroller = dialog.shadowRoot?.querySelector(".scroller");
    if (!menu || !dialogScroller) return;

    let repositionFrame = 0;
    let settleTimer = 0;
    let tracking = false;
    const resizeObserver = new ResizeObserver(() => scheduleReposition());

    const scheduleReposition = () => {
      if (!menu.open) return;

      window.clearTimeout(settleTimer);
      window.cancelAnimationFrame(repositionFrame);
      repositionFrame = window.requestAnimationFrame(() => {
        repositionFrame = 0;
        menu.reposition();

        settleTimer = window.setTimeout(() => {
          if (menu.open) menu.reposition();
        }, 160);
      });
    };
    const startTracking = () => {
      if (tracking) return;
      tracking = true;
      dialogScroller.addEventListener("scroll", scheduleReposition, { passive: true });
      window.addEventListener("resize", scheduleReposition, { passive: true });
      window.visualViewport?.addEventListener("resize", scheduleReposition, { passive: true });
      resizeObserver.observe(dialogScroller);
      scheduleReposition();
    };
    const stopTracking = () => {
      if (!tracking) return;
      tracking = false;
      dialogScroller.removeEventListener("scroll", scheduleReposition);
      window.removeEventListener("resize", scheduleReposition);
      window.visualViewport?.removeEventListener("resize", scheduleReposition);
      resizeObserver.disconnect();
      window.cancelAnimationFrame(repositionFrame);
      window.clearTimeout(settleTimer);
      repositionFrame = 0;
      settleTimer = 0;
    };

    this.sortSelect.addEventListener("opened", startTracking);
    this.sortSelect.addEventListener("closed", stopTracking);
    document.addEventListener("astro:before-swap", stopTracking, { once: true });
  }

  handleInput(event) {
    const value = controlValue(event);
    if (value === this.query && this.queryDebounceTimer) return;

    this.query = value;
    this.input.value = value;
    this.renderQueryState();
    window.clearTimeout(this.queryDebounceTimer);
    this.queryDebounceTimer = window.setTimeout(() => {
      this.queryDebounceTimer = 0;
      void this.search(this.query.trim());
    }, QUERY_DEBOUNCE_MS);
  }

  focus() {
    this.input.focus({ preventScroll: true });
  }

  clearFilters() {
    this.selectedTags = [];
    this.render();
    void this.search(this.query.trim());
  }

  clearSearch() {
    window.clearTimeout(this.queryDebounceTimer);
    this.queryDebounceTimer = 0;
    this.query = "";
    this.input.value = "";
    if (this.inputControl) this.inputControl.value = "";
    this.renderQueryState();
    void this.search("");
    this.focus();
  }

  setSortMode(value) {
    const nextSort = isSearchSortMode(value) ? value : "relevance";
    if (this.sortMode === nextSort) return;

    this.sortMode = nextSort;
    this.syncSortControl();
    void this.search(this.query.trim());
  }

  handleSortControlMediaChange() {
    this.syncSortControl();
  }

  syncSortControl() {
    // The sort control is intentionally absent from the compact/coarse layout.
    // It is also display:none while its deferred dialog is closed. Updating
    // its floating label in either state makes Material Web measure 0 / 0 and
    // Chromium rejects the generated NaN animation keyframes.
    const dialog = this.root.closest("md-dialog");
    if (this.sortControlMedia.matches || (dialog && !dialog.open)) return;

    if (this.sortSelect.value !== this.sortMode) this.sortSelect.value = this.sortMode;
    this.syncSortOptions();
  }

  setSelectedTags(value) {
    const nextTags = normalizeSelectedTags(value, MAX_SELECTED_TAGS);
    if (
      nextTags.length === this.selectedTags.length &&
      nextTags.every((tag, index) => tag === this.selectedTags[index])
    ) {
      return;
    }

    this.selectedTags = nextTags;
    this.render();
    void this.search(this.query.trim());
  }

  toggleTag(tag, event) {
    const nextTags = this.selectedTags.includes(tag)
      ? this.selectedTags.filter((selectedTag) => selectedTag !== tag)
      : [...this.selectedTags, tag];

    this.setSelectedTags(nextTags);
    if (window.matchMedia("(pointer: coarse)").matches) {
      window.setTimeout(() => {
        if (event.currentTarget instanceof HTMLElement) event.currentTarget.blur();
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      });
    }
  }

  render() {
    this.renderQueryState();
    this.renderStatus();
    this.renderFilters();
    this.renderResults();
  }

  renderQueryState() {
    this.clearSearchButton.hidden = this.query.trim().length === 0;
  }

  renderStatus() {
    this.statusElement.textContent = this.status;
    this.filterActions.hidden = this.selectedTags.length === 0;
    this.filterLimit.hidden = this.selectedTags.length < MAX_SELECTED_TAGS;
  }

  renderFilters() {
    this.tagsElement.replaceChildren();
    this.tagsElement.hidden = this.tagFilters.length === 0;
    const selectedTagLimitReached = this.selectedTags.length >= MAX_SELECTED_TAGS;

    for (const tag of this.tagFilters) {
      const chip = document.createElement("md-filter-chip");
      const selected = this.selectedTags.includes(tag.value);
      chip.textContent = `#${tag.value}`;
      chip.selected = selected;
      chip.disabled = selectedTagLimitReached && !selected;
      chip.setAttribute(
        "aria-label",
        selected ? `Retirer le tag ${tag.value}` : `Ajouter le tag ${tag.value}`,
      );
      chip.addEventListener("click", (event) => this.toggleTag(tag.value, event));
      this.tagsElement.append(chip);
    }
  }

  renderResults() {
    renderSearchResults(this.resultsElement, this.results);
  }

  syncSortOptions() {
    this.sortSelect.querySelectorAll("md-select-option").forEach((option) => {
      const selected = option.value === this.sortMode;
      option.selected = selected;
      option.toggleAttribute("data-selected-option", selected);
    });
  }

  async loadPagefind() {
    this.pagefind ??= loadPagefindModule().catch((error) => {
      this.pagefind = undefined;
      throw error;
    });
    return this.pagefind;
  }

  async loadTagFilters() {
    if (this.filtersLoaded) return;
    this.filtersLoaded = true;
    const operation = "tag-filters";
    this.beginLoadingOperation(operation);

    try {
      const pagefind = await this.loadPagefind();
      const [filters] = await Promise.all([pagefind.filters(), this.filterChipReady]);
      this.allTagFilterCounts = filters.tag;
      this.setTagFilterCounts(filters.tag);
    } catch {
      this.tagFilters = [];
      this.renderFilters();
    } finally {
      this.endLoadingOperation(operation);
    }
  }

  setTagFilterCounts(counts) {
    const entries = new Map(Object.entries(counts ?? {}).filter(([value]) => value !== "all"));

    for (const tag of this.selectedTags) {
      if (!entries.has(tag)) entries.set(tag, 0);
    }

    const tagFilters = [...entries]
      .map(([value, count]) => ({ count, value }))
      .sort((left, right) => {
        const leftSelected = this.selectedTags.includes(left.value);
        const rightSelected = this.selectedTags.includes(right.value);
        if (leftSelected !== rightSelected) return leftSelected ? -1 : 1;
        if (left.count !== right.count) return right.count - left.count;
        return left.value.localeCompare(right.value, "fr");
      });

    const selectedTagFilters = tagFilters.filter((tag) => this.selectedTags.includes(tag.value));
    const remainingSlots = Math.max(0, TAG_FILTER_LIMIT - selectedTagFilters.length);
    const unselectedTagFilters = tagFilters
      .filter((tag) => !this.selectedTags.includes(tag.value))
      .slice(0, remainingSlots);

    this.tagFilters = [...selectedTagFilters, ...unselectedTagFilters];
    this.renderFilters();
    this.renderStatus();
  }

  async search(query) {
    const currentRequest = ++this.requestId;
    const hasActiveFilters = this.hasActiveFilters();
    this.cancelCurrentSearchOperation();

    if (query.length > 0 && query.length < MIN_QUERY_LENGTH) {
      this.results = [];
      this.setTagFilterCounts(this.allTagFilterCounts);
      this.status = "Encore un caractère.";
      this.render();
      return;
    }

    if (!query && !hasActiveFilters) {
      this.results = [];
      this.setTagFilterCounts(this.allTagFilterCounts);
      this.status = "Tapez au moins deux caractères ou choisissez un filtre.";
      this.render();
      return;
    }

    const operation = `search:${currentRequest}`;
    this.currentSearchOperation = operation;
    this.beginLoadingOperation(operation);

    try {
      const pagefind = await this.withSearchTimeout(this.loadPagefind());
      const response = await this.withSearchTimeout(
        pagefind.search(query || null, this.pagefindSearchOptions()),
      );

      await this.filterChipReady;
      if (currentRequest !== this.requestId) return;

      this.setTagFilterCounts(response.filters?.tag ?? response.totalFilters?.tag);

      const resultRefs = response.results.slice(0, this.resultFetchLimit());
      const results = await this.withSearchTimeout(
        Promise.all(
          resultRefs.map(async (result) => ({
            data: await result.data(),
            score: result.score ?? 0,
          })),
        ),
      );

      if (currentRequest !== this.requestId) return;

      const mappedResults = results.map((result) => {
        const title = result.data.meta?.title ?? result.data.title ?? result.data.url;
        const createdAt = result.data.meta?.created;
        const modifiedAt = result.data.meta?.modified;

        return {
          createdAt,
          createdLabel: formatDate(createdAt, this.dateFormatter),
          excerpt: removeLeadingTitle(result.data.excerpt ?? "", title),
          modifiedAt,
          modifiedLabel: formatDate(modifiedAt, this.dateFormatter),
          priority: parsePriority(result.data.meta?.priority, MAX_PRIORITY),
          score: result.score,
          tags: parseTags(result.data.meta?.tags),
          title,
          titleHtml: highlightTitle(title, query),
          url: result.data.url,
        };
      });

      this.results = this.sortResults(
        mappedResults.filter((result) => this.matchesSelectedTags(result, this.selectedTags)),
      ).slice(0, RESULT_LIMIT);
      this.status =
        this.results.length === 0
          ? "Aucun article trouvé."
          : `${this.results.length} résultat${this.results.length > 1 ? "s" : ""}.`;
      this.render();
    } catch {
      if (currentRequest !== this.requestId) return;

      this.results = [];
      this.status = "Recherche indisponible. Lance pnpm build pour générer l’index.";
      this.render();
    } finally {
      this.endLoadingOperation(operation);
      if (this.currentSearchOperation === operation) this.currentSearchOperation = null;
    }
  }

  beginLoadingOperation(operation) {
    const wasIdle = this.loadingOperations.size === 0;
    this.loadingOperations.add(operation);
    if (wasIdle) this.scheduleLoadingIndicator();
  }

  endLoadingOperation(operation) {
    this.loadingOperations.delete(operation);
    if (this.loadingOperations.size > 0) return;
    this.hideLoadingIndicator();
  }

  cancelCurrentSearchOperation() {
    if (!this.currentSearchOperation) return;
    this.endLoadingOperation(this.currentSearchOperation);
    this.currentSearchOperation = null;
  }

  scheduleLoadingIndicator() {
    this.cancelLoadingIndicatorTimer();
    this.loadingIndicatorTimer = window.setTimeout(() => {
      this.loadingIndicatorTimer = 0;
      if (this.loadingOperations.size > 0) {
        this.progress.setAttribute("aria-hidden", "false");
        this.progress.setAttribute("data-loading-active", "");
      }
    }, SITE_LOADING_INDICATOR_DELAY_MS);
  }

  hideLoadingIndicator() {
    this.cancelLoadingIndicatorTimer();
    this.progress.removeAttribute("data-loading-active");
    this.progress.setAttribute("aria-hidden", "true");
  }

  cancelLoadingIndicatorTimer() {
    if (!this.loadingIndicatorTimer) return;
    window.clearTimeout(this.loadingIndicatorTimer);
    this.loadingIndicatorTimer = 0;
  }

  pagefindSearchOptions() {
    const options = {};
    const sort = this.pagefindSort();

    if (this.selectedTags.length === 1) options.filters = { tag: this.selectedTags[0] ?? "" };
    else if (this.selectedTags.length > 1) options.filters = { tag: this.selectedTags };
    if (sort) options.sort = sort;
    return options;
  }

  pagefindSort() {
    return this.sortMode === "created-desc" ? { created: "desc" } : undefined;
  }

  sortResults(results) {
    if (this.sortMode === "relevance") {
      return [...results].sort(
        (left, right) => this.relevanceValue(right) - this.relevanceValue(left),
      );
    }

    if (this.sortMode === "title-asc") {
      return [...results].sort((left, right) =>
        left.title.localeCompare(right.title, "fr", { numeric: true, sensitivity: "base" }),
      );
    }

    return [...results].sort((left, right) => {
      const leftTime = dateValue(left.createdAt);
      const rightTime = dateValue(right.createdAt);
      if (leftTime === rightTime) return 0;
      if (!Number.isFinite(leftTime)) return 1;
      if (!Number.isFinite(rightTime)) return -1;
      return rightTime - leftTime;
    });
  }

  relevanceValue(result) {
    return result.score + result.priority * RELEVANCE_PRIORITY_WEIGHT;
  }

  resultFetchLimit() {
    return this.sortMode === "created-desc" ? RESULT_LIMIT : EXPANDED_RESULT_FETCH_LIMIT;
  }

  hasActiveFilters() {
    return this.selectedTags.length > 0 || this.sortMode !== "relevance";
  }

  matchesSelectedTags(result, selectedTags) {
    return selectedTags.length === 0 || selectedTags.every((tag) => result.tags.includes(tag));
  }

  async withSearchTimeout(promise) {
    let timeoutId = 0;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          timeoutId = window.setTimeout(
            () => reject(new Error("Search request timed out.")),
            SEARCH_TIMEOUT_MS,
          );
        }),
      ]);
    } finally {
      window.clearTimeout(timeoutId);
    }
  }
}

function initSiteSearchPanel(root, { includeDeferred = false } = {}) {
  if (root.dataset.searchEnhanced === "true") return panelControllers.get(root);
  if (root.dataset.deferred === "true" && !includeDeferred && !root.closest("md-dialog[open]")) {
    return undefined;
  }

  root.dataset.searchEnhanced = "true";
  const controller = new SearchPanelController(root);
  panelControllers.set(root, controller);
  return controller;
}

export function initSiteSearchPanels() {
  document.querySelectorAll("[data-site-search-panel]").forEach((root) => {
    if (root.dataset.deferred === "true" && !root.closest("md-dialog[open]")) return;
    void loadSearchMaterialModule().then(() => initSiteSearchPanel(root));
  });
}

function focusSiteSearchPanel(root) {
  panelControllers.get(root)?.focus();
}

export function initSiteSearchTriggers() {
  document.querySelectorAll("[data-site-search-trigger]").forEach((root) => {
    if (root.dataset.searchEnhanced === "true") return;
    root.dataset.searchEnhanced = "true";

    const openButton = root.querySelector("[data-search-open]");
    const openIcon = root.querySelector("[data-search-open-icon]");
    const openProgress = root.querySelector("[data-search-open-progress]");
    const dialog = root.querySelector("[data-search-dialog]");
    const closeButton = root.querySelector("[data-search-close]");
    const panel = dialog.querySelector("[data-site-search-panel]");
    let opening = false;
    let indicatorTimer = 0;

    const stopOpeningIndicator = () => {
      openButton.removeAttribute("aria-busy");
      window.clearTimeout(indicatorTimer);
      indicatorTimer = 0;
      openProgress.hidden = true;
      openIcon.hidden = false;
    };

    const endOpening = () => {
      opening = false;
      openButton.disabled = false;
      stopOpeningIndicator();
    };

    const open = async () => {
      if (opening || dialog.open) return;
      hideSiteTooltip();
      opening = true;
      openButton.setAttribute("aria-expanded", "true");
      openButton.disabled = true;
      openButton.setAttribute("aria-busy", "true");
      indicatorTimer = window.setTimeout(() => {
        indicatorTimer = 0;
        if (!opening) return;
        openIcon.hidden = true;
        openProgress.hidden = false;
      }, SITE_LOADING_INDICATOR_DELAY_MS);

      try {
        await Promise.all([
          loadSearchMaterialModule(),
          customElements.whenDefined("md-dialog"),
          customElements.whenDefined("md-filled-text-field"),
          customElements.whenDefined("md-icon-button"),
        ]);
        // Opening the deferred select while its dialog is display:none makes
        // Material Web animate its floating label from zero-sized geometry and
        // Chromium rejects the resulting NaN keyframes. Wait only until the
        // native modal surface exists, then connect during (not after) the open
        // animation so the panel is ready before the trigger is re-enabled.
        const showPromise = dialog.show();
        let openFrame = 0;
        const openSurfacePromise = new Promise((resolve) => {
          const checkOpen = () => {
            if (dialog.open) {
              resolve();
              return;
            }
            openFrame = window.requestAnimationFrame(checkOpen);
          };
          checkOpen();
        });
        try {
          await Promise.race([showPromise, openSurfacePromise]);
        } finally {
          window.cancelAnimationFrame(openFrame);
        }
        if (dialog.open) {
          await dialog.updateComplete;
          await new Promise((resolve) => {
            window.requestAnimationFrame(resolve);
          });
          const controller = initSiteSearchPanel(panel, { includeDeferred: true });
          // A controller may already exist when the dialog is reopened after a
          // compact-to-wide resize. Synchronize only now that Material can
          // measure the visible select safely.
          controller?.syncSortControl();
        }
        await showPromise;
        window.setTimeout(() => focusSiteSearchPanel(panel));
      } finally {
        endOpening();
      }
    };

    openButton.addEventListener("click", (event) => {
      event.preventDefault();
      void open();
    });
    closeButton.addEventListener("click", () => void dialog.close("close-button"));
    dialog.addEventListener("closed", () => {
      openButton.setAttribute("aria-expanded", "false");
      openButton.focus({ preventScroll: true });
      hideSiteTooltip();
    });
    openButton.setAttribute("aria-expanded", "false");
  });
}
