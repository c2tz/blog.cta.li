import { isSearchSortMode } from "@/components/search/site-search-model";
import { loadPagefindModule } from "@/components/search/site-search-pagefind";
import { SITE_LOADING_INDICATOR_DELAY_MS } from "@/lib/site-contracts";
import { hideSiteTooltip } from "./site-tooltips.js";

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

function loadFilterChipModule() {
  filterChipModule ??= import("@material/web/chips/filter-chip.js");
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
    this.syncUrl = root.dataset.syncUrl === "true";
    this.autofocus = root.dataset.autofocus === "true";

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
    this.filterChipReady = loadFilterChipModule();

    this.handleInput = this.handleInput.bind(this);
    this.connect();
  }

  connect() {
    if (this.syncUrl && window.location.pathname === "/search/") {
      const params = new URLSearchParams(window.location.search);
      this.query = params.get("q") ?? "";
      this.selectedTags = this.parseTagsParam(params);
      this.sortMode = this.parseSortMode(params.get("sort"));
    } else if (typeof this.input.value === "string" && this.input.value) {
      // Preserve a value entered by autofill or automation before a deferred
      // panel finishes connecting.
      this.query = this.input.value;
    }

    this.input.value = this.query;
    this.sortSelect.value = this.sortMode;
    this.syncSortOptions();
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

    void this.connectMaterialTextField();
    void this.connectSortMenuRepositioning();
    void this.loadTagFilters();
    void this.search(this.query.trim());

    if (this.autofocus && this.shouldAutofocusSearch()) {
      window.setTimeout(() => this.focus());
    }
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
    this.sortSelect.value = nextSort;
    this.syncSortOptions();
    void this.search(this.query.trim());
  }

  setSelectedTags(value) {
    const nextTags = this.normalizeSelectedTags(value);
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
    this.resultsElement.replaceChildren();

    for (const result of this.results) {
      const item = document.createElement("li");
      item.className = "site-search-panel-result";

      const body = document.createElement("div");
      body.className = "site-search-panel-result-body";

      const title = document.createElement("a");
      title.className = "site-search-panel-result-title";
      title.href = result.url;
      title.innerHTML = result.titleHtml;
      body.append(title);

      if (result.createdLabel || result.modifiedLabel) {
        body.append(this.renderResultMeta(result));
      }

      if (result.excerpt) {
        const excerpt = document.createElement("p");
        excerpt.className = "site-search-panel-result-excerpt";
        excerpt.innerHTML = result.excerpt;
        body.append(excerpt);
      }

      item.append(body);
      this.resultsElement.append(item);
    }
  }

  renderResultMeta(result) {
    const meta = document.createElement("div");
    meta.className = "site-search-panel-result-meta";

    if (result.createdLabel) {
      meta.append(
        this.renderDateMeta("\uE89C", "Création du post", result.createdAt, result.createdLabel),
      );
    }

    if (result.createdLabel && result.modifiedLabel) {
      const separator = document.createElement("span");
      separator.className = "site-search-panel-result-meta-separator";
      separator.setAttribute("aria-hidden", "true");
      separator.textContent = "·";
      meta.append(separator);
    }

    if (result.modifiedLabel) {
      meta.append(
        this.renderDateMeta(
          "\uF88C",
          "Dernière modification du post",
          result.modifiedAt,
          result.modifiedLabel,
        ),
      );
    }

    return meta;
  }

  renderDateMeta(iconValue, tooltip, dateTime, label) {
    const wrapper = document.createElement("span");
    const icon = document.createElement("md-icon");
    icon.textContent = iconValue;
    icon.dataset.tooltip = tooltip;
    icon.setAttribute("aria-label", tooltip);
    const time = document.createElement("time");
    if (dateTime) time.dateTime = dateTime;
    time.textContent = label;
    wrapper.append(icon, time);
    return wrapper;
  }

  syncSortOptions() {
    this.sortSelect.querySelectorAll("md-select-option").forEach((option) => {
      option.selected = option.value === this.sortMode;
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
    this.updateUrl(query);
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
          createdLabel: this.formatDate(createdAt),
          excerpt: this.removeLeadingTitle(result.data.excerpt ?? "", title),
          modifiedAt,
          modifiedLabel: this.formatDate(modifiedAt),
          priority: this.parsePriority(result.data.meta?.priority),
          score: result.score,
          tags: this.parseTags(result.data.meta?.tags),
          title,
          titleHtml: this.highlightTitle(title, query),
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
      if (this.loadingOperations.size > 0) this.progress.hidden = false;
    }, SITE_LOADING_INDICATOR_DELAY_MS);
  }

  hideLoadingIndicator() {
    this.cancelLoadingIndicatorTimer();
    this.progress.hidden = true;
  }

  cancelLoadingIndicatorTimer() {
    if (!this.loadingIndicatorTimer) return;
    window.clearTimeout(this.loadingIndicatorTimer);
    this.loadingIndicatorTimer = 0;
  }

  updateUrl(query) {
    if (!this.syncUrl || window.location.pathname !== "/search/") return;

    const url = new URL(window.location.href);
    if (query) url.searchParams.set("q", query);
    else url.searchParams.delete("q");

    if (this.selectedTags.length > 0) {
      url.searchParams.set("tags", this.selectedTags.join(","));
      url.searchParams.delete("tag");
    } else {
      url.searchParams.delete("tags");
      url.searchParams.delete("tag");
    }

    url.searchParams.delete("from");
    url.searchParams.delete("to");
    if (this.sortMode !== "relevance") url.searchParams.set("sort", this.sortMode);
    else url.searchParams.delete("sort");
    window.history.replaceState({}, "", url);
  }

  parseSortMode(value) {
    return isSearchSortMode(value) ? value : "relevance";
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
      const leftTime = this.dateValue(left.createdAt);
      const rightTime = this.dateValue(right.createdAt);
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

  parseTagsParam(params) {
    return (params.get("tags") ?? params.get("tag") ?? "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, MAX_SELECTED_TAGS);
  }

  normalizeSelectedTags(value) {
    const tags = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
    return [...new Set(tags.filter((tag) => typeof tag === "string"))].slice(0, MAX_SELECTED_TAGS);
  }

  shouldAutofocusSearch() {
    return !window.matchMedia("(max-width: 720px), (pointer: coarse)").matches;
  }

  dateValue(value) {
    const date = Date.parse(value ?? "");
    return Number.isNaN(date) ? Number.POSITIVE_INFINITY : date;
  }

  formatDate(value) {
    if (!value) return undefined;
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? undefined : this.dateFormatter.format(date);
  }

  parseTags(value) {
    return (value ?? "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  parsePriority(value) {
    const priority = Number.parseInt(value ?? "0", 10);
    return Number.isNaN(priority) ? 0 : Math.min(MAX_PRIORITY, Math.max(0, priority));
  }

  escapeHtml(value) {
    return value.replace(/[&<>"']/g, (character) => {
      if (character === "&") return "&amp;";
      if (character === "<") return "&lt;";
      if (character === ">") return "&gt;";
      if (character === '"') return "&quot;";
      return "&#39;";
    });
  }

  escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  highlightTitle(title, query) {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return this.escapeHtml(title);
    const escapedTitle = this.escapeHtml(title);
    const escapedQuery = this.escapeHtml(trimmedQuery);
    const pattern = new RegExp(this.escapeRegExp(escapedQuery), "gi");
    return escapedTitle.replace(pattern, (match) => `<mark>${match}</mark>`);
  }

  removeLeadingTitle(excerpt, title) {
    if (!excerpt) return excerpt;
    const template = document.createElement("template");
    template.innerHTML = excerpt;
    const text = template.content.textContent ?? "";
    const prefixEnd = this.findTitlePrefixEnd(text, title);
    if (prefixEnd < 0) return excerpt;
    this.removeLeadingText(template.content, prefixEnd);
    this.trimLeadingText(template.content);
    return template.innerHTML.trim();
  }

  findTitlePrefixEnd(text, title) {
    const normalizedTitle = title.trim().replace(/\s+/g, " ");
    let textIndex = 0;
    let titleIndex = 0;
    while (textIndex < text.length && /\s/.test(text[textIndex] ?? "")) textIndex++;

    while (textIndex < text.length && titleIndex < normalizedTitle.length) {
      const titleCharacter = normalizedTitle[titleIndex] ?? "";
      const textCharacter = text[textIndex] ?? "";
      if (/\s/.test(titleCharacter)) {
        if (!/\s/.test(textCharacter)) return -1;
        while (textIndex < text.length && /\s/.test(text[textIndex] ?? "")) textIndex++;
        while (
          titleIndex < normalizedTitle.length &&
          /\s/.test(normalizedTitle[titleIndex] ?? "")
        ) {
          titleIndex++;
        }
        continue;
      }
      if (textCharacter.toLocaleLowerCase() !== titleCharacter.toLocaleLowerCase()) return -1;
      textIndex++;
      titleIndex++;
    }

    return titleIndex === normalizedTitle.length ? textIndex : -1;
  }

  removeLeadingText(root, count) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    let remaining = count;

    for (const node of nodes) {
      const value = node.nodeValue ?? "";
      if (remaining >= value.length) {
        node.nodeValue = "";
        remaining -= value.length;
        continue;
      }
      node.nodeValue = value.slice(remaining);
      break;
    }
  }

  trimLeadingText(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const trimmed = (node.nodeValue ?? "").replace(/^\s+/, "");
      if (!trimmed) {
        node.nodeValue = "";
        continue;
      }
      node.nodeValue = trimmed;
      break;
    }
    root.querySelectorAll("*").forEach((element) => {
      if (!element.textContent?.trim() && element.children.length === 0) element.remove();
    });
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
    initSiteSearchPanel(root);
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
          customElements.whenDefined("md-dialog"),
          customElements.whenDefined("md-filled-text-field"),
          customElements.whenDefined("md-icon-button"),
        ]);
        // The Material dialog becomes visible before its opening animation
        // resolves. Connect the deferred panel first so early input is never lost.
        initSiteSearchPanel(panel, { includeDeferred: true });
        stopOpeningIndicator();
        await dialog.show();
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
