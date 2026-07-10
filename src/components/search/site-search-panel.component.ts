import {
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  ViewEncapsulation,
  computed,
  signal,
} from "@angular/core";
import type { AfterViewInit, OnDestroy } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl } from "@angular/forms";
import { MatTooltip } from "@angular/material/tooltip";
import { debounceTime, distinctUntilChanged } from "rxjs";
import { MaterialTextFieldValueDirective } from "@/components/material/material-text-field-value.directive";
import { materialControlValue } from "@/lib/material-web-events";
import { isSearchSortMode, SORT_OPTIONS } from "./site-search-model";
import type { SearchResult, SearchSortMode, TagFilter } from "./site-search-model";
import { loadPagefindModule } from "./site-search-pagefind";
import type {
  PagefindModule,
  PagefindSearchOptions,
  PagefindSortDirection,
} from "./site-search-pagefind";

const MIN_QUERY_LENGTH = 2;
const RESULT_LIMIT = 12;
const EXPANDED_RESULT_FETCH_LIMIT = 100;
const TAG_FILTER_LIMIT = 18;
const MAX_SELECTED_TAGS = 3;
const SEARCH_TIMEOUT_MS = 12000;
const LOADING_INDICATOR_DELAY_MS = 200;
const MAX_PRIORITY = 100;
const RELEVANCE_PRIORITY_WEIGHT = 0.01;

@Component({
  selector: "site-search-panel",
  standalone: true,
  imports: [MatTooltip, MaterialTextFieldValueDirective],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <form class="site-search-panel-form" role="search" (submit)="submit($event)">
      <div class="site-search-panel-field">
        <div class="site-search-panel-query">
          <md-outlined-text-field
            #searchInput
            class="site-search-panel-input"
            type="search"
            label="Mot-clé, titre ou contenu"
            autocomplete="off"
            spellcheck="false"
            has-leading-icon
            aria-controls="site-search-panel-results site-search-panel-tags"
            aria-describedby="site-search-panel-status site-search-panel-filter-limit"
            [value]="queryValue()"
            siteMaterialValue
            (siteMaterialValueChange)="setQueryValue($event)"
            (input)="updateQuery($event)"
            (keyup)="updateQuery($event)"
          >
            <md-icon slot="leading-icon" aria-hidden="true">{{ searchIcon }}</md-icon>
          </md-outlined-text-field>

          @if (hasSearchText()) {
            <md-icon-button
              class="site-search-panel-clear-search"
              type="button"
              matTooltip="Effacer la recherche"
              matTooltipPosition="below"
              aria-label="Effacer la recherche"
              (click)="clearSearch()"
            >
              <md-icon aria-hidden="true">{{ closeIcon }}</md-icon>
            </md-icon-button>
          }
        </div>

        <span class="site-search-panel-divider" aria-hidden="true"></span>
        <md-outlined-select
          class="site-search-panel-sort-select"
          label="Tri par"
          aria-label="Trier les résultats"
          menu-positioning="fixed"
          [value]="sortMode()"
          (change)="setSortModeFromEvent($event)"
        >
          @for (option of sortOptions; track option.value) {
            <md-select-option [value]="option.value" [selected]="option.value === sortMode()">
              <span slot="headline">{{ option.label }}</span>
            </md-select-option>
          }
        </md-outlined-select>
      </div>
    </form>

    @if (status() || loadingIndicatorVisible() || hasFilterState()) {
      <div class="site-search-panel-state">
        @if (status()) {
          <p
            id="site-search-panel-status"
            class="site-search-panel-status"
            role="status"
            aria-live="polite"
          >
            {{ status() }}
          </p>
        }
        @if (hasFilterState()) {
          <div class="site-search-panel-filter-actions">
            <md-text-button
              class="site-search-panel-filter-button site-search-panel-clear-filters"
              type="button"
              has-icon
              aria-label="Effacer les filtres sélectionnés"
              (click)="clearFilters()"
            >
              <md-icon slot="icon" aria-hidden="true">{{ closeIcon }}</md-icon>
              <span>Effacer filtres</span>
            </md-text-button>
          </div>
        }
        @if (selectedTagLimitReached()) {
          <p
            id="site-search-panel-filter-limit"
            class="site-search-panel-filter-limit"
            role="status"
            aria-live="polite"
          >
            Limite atteinte : 3 tags maximum.
          </p>
        }
        @if (loadingIndicatorVisible()) {
          <md-linear-progress
            class="site-search-panel-progress"
            aria-label="Recherche en cours"
            indeterminate
          ></md-linear-progress>
        }
      </div>
    }

    <div class="site-search-panel-filters">
      @if (tagFilters().length > 0) {
        <md-chip-set
          id="site-search-panel-tags"
          class="site-search-panel-tags"
          aria-label="Filtrer par tags"
        >
          @for (tag of tagFilters(); track tag.value) {
            <md-filter-chip
              [disabled]="isTagDisabled(tag.value)"
              [selected]="selectedTags().includes(tag.value)"
              [attr.aria-label]="tagAriaLabel(tag.value)"
              (click)="toggleTag(tag.value, $event)"
            >
              #{{ tag.value }}
            </md-filter-chip>
          }
        </md-chip-set>
      }
    </div>

    <ol id="site-search-panel-results" class="site-search-panel-results" aria-live="polite">
      @for (result of results(); track result.url) {
        <li class="site-search-panel-result">
          <div class="site-search-panel-result-body">
            <a
              class="site-search-panel-result-title"
              [href]="result.url"
              [innerHTML]="result.titleHtml"
            ></a>
            <div class="site-search-panel-result-meta">
              @if (result.createdLabel) {
                <span>
                  <md-icon
                    [matTooltip]="createdTooltip"
                    matTooltipPosition="below"
                    [attr.aria-label]="createdTooltip"
                  >
                    {{ createdIcon }}
                  </md-icon>
                  <time [attr.datetime]="result.createdAt">{{ result.createdLabel }}</time>
                </span>
              }
              @if (result.createdLabel && result.modifiedLabel) {
                <span class="site-search-panel-result-meta-separator" aria-hidden="true">·</span>
              }
              @if (result.modifiedLabel) {
                <span>
                  <md-icon
                    [matTooltip]="modifiedTooltip"
                    matTooltipPosition="below"
                    [attr.aria-label]="modifiedTooltip"
                  >
                    {{ modifiedIcon }}
                  </md-icon>
                  <time [attr.datetime]="result.modifiedAt">{{ result.modifiedLabel }}</time>
                </span>
              }
            </div>
            @if (result.excerpt) {
              <p class="site-search-panel-result-excerpt" [innerHTML]="result.excerpt"></p>
            }
          </div>
        </li>
      }
    </ol>
  `,
  styles: `
    site-search-panel {
      display: block;
    }

    .site-search-panel-form {
      margin: 0;
    }

    .site-search-panel-field {
      display: grid;
      position: relative;
      grid-template-columns: minmax(0, 1fr) auto minmax(11rem, 11rem);
      align-items: center;
      min-height: 3.5rem;
      width: 100%;
      box-sizing: border-box;
      gap: 0.75rem;
      color: var(--site-text);
    }

    .site-search-panel-query {
      grid-column: 1;
      position: relative;
      min-width: 0;
    }

    .site-search-panel-input {
      display: flex;
      min-width: 0;
      width: 100%;
      --md-outlined-text-field-container-shape: var(--md-sys-shape-corner-extra-large);
      --md-outlined-text-field-focus-caret-color: var(--site-link);
      --md-outlined-text-field-focus-label-text-color: var(--site-link);
      --md-outlined-text-field-focus-leading-icon-color: var(--site-link);
      --md-outlined-text-field-focus-outline-color: var(--site-link);
      --md-outlined-text-field-input-text-color: var(--site-text);
      --md-outlined-text-field-input-text-font: var(--site-font);
      --md-outlined-text-field-input-text-size: 1rem;
      --md-outlined-text-field-label-text-color: var(--site-muted);
      --md-outlined-text-field-label-text-font: var(--site-font);
      --md-outlined-text-field-leading-icon-color: var(--site-muted);
      --md-outlined-text-field-outline-color: var(--site-border);
      --md-outlined-text-field-trailing-space: 3.25rem;
    }

    .site-search-panel-clear-search {
      --md-icon-button-state-layer-width: 2rem;
      --md-icon-button-state-layer-height: 2rem;
      --md-icon-button-icon-size: 1.15rem;
      --md-icon-button-icon-color: var(--site-muted);
      --md-icon-button-hover-icon-color: var(--site-text);
      --md-icon-button-focus-icon-color: var(--site-text);
      --md-icon-button-pressed-icon-color: var(--site-text);
      --md-icon-button-hover-state-layer-color: var(--site-muted);
      --md-icon-button-focus-state-layer-color: var(--site-muted);
      --md-icon-button-pressed-state-layer-color: var(--site-muted);
      --md-icon-button-hover-state-layer-opacity: 0.12;
      --md-icon-button-pressed-state-layer-opacity: 0.18;
      position: absolute;
      top: 50%;
      right: 0.65rem;
      z-index: 1;
      transform: translateY(-50%);
      cursor: pointer;
    }

    .site-search-panel-clear-search md-icon {
      --md-icon-size: 1.15rem;
      transform: translateY(1px);
    }

    .site-search-panel-divider {
      grid-column: 2;
      align-self: stretch;
      width: 1px;
      height: auto;
      margin-block: 0.45rem;
      background: var(--site-border);
    }

    .site-search-panel-sort-select {
      grid-column: 3;
      display: flex;
      min-width: 0;
      width: 100%;
      --md-outlined-select-text-field-container-shape: var(--md-sys-shape-corner-extra-large);
      --md-outlined-select-text-field-focus-input-text-color: var(--site-text);
      --md-outlined-select-text-field-focus-label-text-color: var(--site-link);
      --md-outlined-select-text-field-focus-outline-color: var(--site-link);
      --md-outlined-select-text-field-input-text-color: var(--site-text);
      --md-outlined-select-text-field-input-text-font: var(--site-font);
      --md-outlined-select-text-field-label-text-color: var(--site-muted);
      --md-outlined-select-text-field-label-text-font: var(--site-font);
      --md-outlined-select-text-field-outline-color: var(--site-border);
    }

    .site-search-panel-progress {
      position: absolute;
      inset: auto 0 0;
      width: 100%;
      overflow: hidden;
      border-radius: 9999px;
      --md-linear-progress-active-indicator-color: var(--site-link);
      --md-linear-progress-active-indicator-height: 0.18rem;
      --md-linear-progress-track-color: color-mix(in srgb, var(--site-link) 16%, transparent);
      --md-linear-progress-track-height: 0.18rem;
      --md-linear-progress-track-shape: 9999px;
    }

    .site-search-panel-filters {
      position: relative;
      min-width: 0;
      margin-block-start: 0.55rem;
      padding-block-end: 0.7rem;
      overflow: visible;
    }

    .site-search-panel-tags {
      min-width: 0;
      flex: 1 1 auto;
      gap: 0.5rem;
    }

    .site-search-panel-tags md-filter-chip {
      --site-search-chip-selected-bg: var(--site-link-container);
      --site-search-chip-selected-fg: var(--site-on-link-container);
      --site-search-chip-label-fg: var(--site-muted);
      --site-search-chip-outline: color-mix(in srgb, var(--site-link) 78%, transparent);
      --md-filter-chip-container-height: 2rem;
      --md-filter-chip-focus-label-text-color: var(--site-search-chip-label-fg);
      --md-filter-chip-focus-outline-color: var(--site-search-chip-outline);
      --md-filter-chip-hover-label-text-color: var(--site-search-chip-label-fg);
      --md-filter-chip-hover-state-layer-color: var(--site-search-chip-label-fg);
      --md-filter-chip-label-text-color: var(--site-search-chip-label-fg);
      --md-filter-chip-label-text-font: var(--site-font);
      --md-filter-chip-label-text-size: 0.88rem;
      --md-filter-chip-outline-color: var(--site-search-chip-outline);
      --md-filter-chip-pressed-label-text-color: var(--site-search-chip-label-fg);
      --md-filter-chip-selected-container-color: var(--site-search-chip-selected-bg);
      --md-filter-chip-selected-focus-label-text-color: var(--site-search-chip-selected-fg);
      --md-filter-chip-selected-hover-label-text-color: var(--site-search-chip-selected-fg);
      --md-filter-chip-selected-hover-state-layer-color: var(--site-search-chip-selected-fg);
      --md-filter-chip-selected-label-text-color: var(--site-search-chip-selected-fg);
      --md-filter-chip-selected-pressed-label-text-color: var(--site-search-chip-selected-fg);
      flex: 0 0 auto;
      touch-action: manipulation;
    }

    .site-search-panel-tags md-filter-chip[disabled] {
      opacity: 0.52;
    }

    .site-search-panel-filter-button {
      --md-text-button-container-height: 2.25rem;
      --md-text-button-label-text-color: var(--site-link);
      --md-text-button-icon-color: var(--site-link);
      --md-text-button-hover-label-text-color: var(--site-link);
      --md-text-button-hover-icon-color: var(--site-link);
      --md-text-button-hover-state-layer-color: var(--site-link);
      --md-text-button-focus-label-text-color: var(--site-link);
      --md-text-button-focus-icon-color: var(--site-link);
      --md-text-button-pressed-label-text-color: var(--site-link);
      --md-text-button-pressed-icon-color: var(--site-link);
      --md-text-button-pressed-state-layer-color: var(--site-link);
      flex: 0 0 auto;
      min-width: max-content;
    }

    .site-search-panel-filter-button md-icon {
      --md-icon-size: 1.15rem;
    }

    .site-search-panel-clear-filters {
      color: var(--site-link);
    }

    .site-search-panel-state {
      position: relative;
      display: grid;
      justify-items: start;
      gap: 0.5rem;
      min-height: 2.5rem;
      padding-block-end: 0.35rem;
      margin-block: 0.6rem 0.45rem;
    }

    .site-search-panel-status {
      margin: 0;
      color: var(--site-muted);
      font-size: 0.9rem;
    }

    .site-search-panel-filter-limit {
      margin: -0.2rem 0 0;
      color: var(--site-link);
      font-size: 0.84rem;
    }

    .site-search-panel-filter-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .site-search-panel-results {
      display: grid;
      gap: 0.75rem;
      padding: 0;
      margin: 0;
      list-style: none;
    }

    .site-search-panel-result {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      align-items: center;
      gap: 0.85rem;
      padding: 0.75rem 0.85rem;
      border: 1px solid var(--site-border);
      border-radius: var(--image-radius);
    }

    .site-search-panel-result-body {
      min-width: 0;
    }

    .site-search-panel-result-title {
      color: var(--site-link);
      font-size: 1.05rem;
      font-weight: 700;
      text-decoration: none;
    }

    .site-search-panel-result-title:is(:hover, :focus-visible) {
      color: var(--site-link);
      text-decoration: underline;
    }

    .site-search-panel-result-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.32rem 0.5rem;
      margin-block-start: 0.35rem;
      color: var(--site-muted);
      font-size: 0.84rem;
    }

    .site-search-panel-result-meta span {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }

    .site-search-panel-result-meta-separator {
      color: var(--site-muted);
    }

    .site-search-panel-result-meta md-icon {
      --md-icon-size: 1rem;
    }

    .site-search-panel-result-excerpt {
      margin-block: 0.5rem 0;
      color: var(--site-text);
      font-size: 0.94rem;
      line-height: 1.55;
    }

    .site-search-panel-result-excerpt mark {
      padding-inline: 0.12em;
      background: var(--site-mark-bg);
      color: var(--site-mark-text);
    }

    .site-search-panel-result-title mark {
      padding-inline: 0.08em;
      background: var(--site-mark-bg);
      color: var(--site-mark-text);
    }

    @media (max-width: 720px) {
      .site-search-panel-field {
        grid-template-columns: minmax(0, 1fr);
      }

      .site-search-panel-divider,
      .site-search-panel-sort-select {
        display: none;
      }
    }

    @media (max-width: 720px), (pointer: coarse) {
      .site-search-panel-filters {
        overflow-x: auto;
      }

      .site-search-panel-filters::-webkit-scrollbar {
        height: 0.5rem;
      }

      .site-search-panel-filters::-webkit-scrollbar-thumb {
        border-radius: 9999px;
        background: color-mix(in srgb, var(--site-muted) 42%, transparent);
      }

      .site-search-panel-tags {
        flex-wrap: nowrap;
      }

      .site-search-panel-tags md-filter-chip {
        --md-filter-chip-hover-state-layer-opacity: 0;
        --md-filter-chip-pressed-state-layer-opacity: 0;
        --md-filter-chip-selected-hover-state-layer-opacity: 0;
        --md-filter-chip-selected-pressed-state-layer-opacity: 0;
      }
    }

    @media (max-width: 520px) {
      .site-search-panel-field {
        min-height: 3.5rem;
      }

      .site-search-panel-state {
        min-height: 2rem;
      }
    }
  `,
})
export class SiteSearchPanelComponent implements AfterViewInit, OnDestroy {
  @ViewChild("searchInput") private searchInput?: ElementRef<HTMLElement>;

  readonly hasFilterState = computed(() => {
    return this.selectedTags().length > 0;
  });
  readonly hasSearchText = computed(() => this.queryValue().trim().length > 0);
  readonly selectedTagLimitReached = computed(() => {
    return this.selectedTags().length >= MAX_SELECTED_TAGS;
  });
  readonly loading = signal(false);
  readonly loadingIndicatorVisible = signal(false);
  readonly query = new FormControl("", { nonNullable: true });
  readonly queryValue = signal("");
  readonly results = signal<SearchResult[]>([]);
  readonly selectedTags = signal<string[]>([]);
  readonly sortMode = signal<SearchSortMode>("relevance");
  readonly tagFilters = signal<TagFilter[]>([]);
  readonly closeIcon = "\uE5CD";
  readonly createdIcon = "\uE89C";
  readonly createdTooltip = "Création du post";
  readonly modifiedIcon = "\uF88C";
  readonly modifiedTooltip = "Dernière modification du post";
  readonly searchIcon = "\uE8B6";
  readonly sortOptions = SORT_OPTIONS;
  readonly status = signal("Tapez au moins deux caractères ou choisissez un filtre.");

  private readonly dateFormatter = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  private filtersLoaded = false;
  private allTagFilterCounts?: Record<string, number>;
  private pagefind?: Promise<PagefindModule>;
  private requestId = 0;
  private readonly loadingOperations = new Set<string>();
  private currentSearchOperation: string | null = null;
  private loadingIndicatorTimer = 0;

  constructor() {
    this.query.valueChanges
      .pipe(debounceTime(160), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((query) => {
        const trimmedQuery = query.trim();
        this.queryValue.set(query);
        void this.search(trimmedQuery);
      });
  }

  ngAfterViewInit() {
    if (typeof window === "undefined") return;

    if (this.syncsUrl()) {
      const params = new URLSearchParams(window.location.search);
      const query = params.get("q") ?? "";
      this.selectedTags.set(this.parseTagsParam(params));
      this.sortMode.set(this.parseSortMode(params.get("sort")));
      this.query.setValue(query, { emitEvent: false });
      this.queryValue.set(query);
    }

    void this.loadTagFilters();
    void this.search(this.query.value.trim());
    if (this.shouldAutofocusSearch()) {
      window.setTimeout(() => this.searchInput?.nativeElement.focus({ preventScroll: true }));
    }
  }

  ngOnDestroy() {
    this.loadingOperations.clear();
    this.loading.set(false);
    this.hideLoadingIndicator();
  }

  submit(event: SubmitEvent) {
    event.preventDefault();
    this.queryValue.set(this.query.value);
    void this.search(this.query.value.trim());
  }

  clearFilters() {
    this.selectedTags.set([]);
    void this.search(this.query.value.trim());
  }

  clearSearch() {
    this.query.setValue("", { emitEvent: false });
    this.queryValue.set("");
    void this.search("");
  }

  updateQuery(event: Event) {
    this.setQueryValue(materialControlValue(event));
  }

  setQueryValue(value: string) {
    this.queryValue.set(value);
    this.query.setValue(value);
  }

  setSortModeFromEvent(event: Event) {
    this.setSortMode(materialControlValue(event));
  }

  setSortMode(value: unknown) {
    const nextSort = isSearchSortMode(value) ? value : "relevance";
    if (this.sortMode() === nextSort) return;

    this.sortMode.set(nextSort);
    void this.search(this.query.value.trim());
  }

  setSelectedTags(value: unknown) {
    const nextTags = this.normalizeSelectedTags(value);
    const selectedTags = this.selectedTags();

    if (
      nextTags.length === selectedTags.length &&
      nextTags.every((tag, index) => tag === selectedTags[index])
    )
      return;

    this.selectedTags.set(nextTags);
    void this.search(this.query.value.trim());
  }

  toggleTag(tag: string, event: Event) {
    const selectedTags = this.selectedTags();
    const nextTags = selectedTags.includes(tag)
      ? selectedTags.filter((selectedTag) => selectedTag !== tag)
      : [...selectedTags, tag];

    this.setSelectedTags(nextTags);
    this.releaseTouchFocus(event);
  }

  isTagDisabled(tag: string) {
    return this.selectedTagLimitReached() && !this.selectedTags().includes(tag);
  }

  tagAriaLabel(tag: string) {
    return this.selectedTags().includes(tag) ? `Retirer le tag ${tag}` : `Ajouter le tag ${tag}`;
  }

  releaseTouchFocus(event: Event) {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(pointer: coarse)").matches) return;

    window.setTimeout(() => {
      const target = event.currentTarget;
      if (target instanceof HTMLElement) target.blur();
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
  }

  private async loadPagefind() {
    this.pagefind ??= loadPagefindModule().catch((error) => {
      this.pagefind = undefined;
      throw error;
    });
    return this.pagefind;
  }

  private async loadTagFilters() {
    if (this.filtersLoaded) return;
    this.filtersLoaded = true;
    const operation = "tag-filters";
    this.beginLoadingOperation(operation);

    try {
      const pagefind = await this.loadPagefind();
      const filters = await pagefind.filters();
      this.allTagFilterCounts = filters["tag"];
      this.setTagFilterCounts(filters["tag"]);
    } catch {
      this.tagFilters.set([]);
    } finally {
      this.endLoadingOperation(operation);
    }
  }

  private setTagFilterCounts(counts?: Record<string, number>) {
    const selectedTags = this.selectedTags();
    const entries = new Map(
      Object.entries(counts ?? {})
        .filter(([value]) => value !== "all")
        .map(([value, count]) => [value, count] as const),
    );

    for (const tag of selectedTags) {
      if (!entries.has(tag)) entries.set(tag, 0);
    }

    const tagFilters = [...entries]
      .map(([value, count]) => ({ count, value }))
      .sort((left, right) => {
        const leftSelected = selectedTags.includes(left.value);
        const rightSelected = selectedTags.includes(right.value);
        if (leftSelected !== rightSelected) return leftSelected ? -1 : 1;
        if (left.count !== right.count) return right.count - left.count;
        return left.value.localeCompare(right.value, "fr");
      });

    const selectedTagFilters = tagFilters.filter((tag) => selectedTags.includes(tag.value));
    const remainingSlots = Math.max(0, TAG_FILTER_LIMIT - selectedTagFilters.length);
    const unselectedTagFilters = tagFilters
      .filter((tag) => !selectedTags.includes(tag.value))
      .slice(0, remainingSlots);

    this.tagFilters.set([...selectedTagFilters, ...unselectedTagFilters]);
  }

  private async search(query: string) {
    const currentRequest = ++this.requestId;
    const hasActiveFilters = this.hasActiveFilters();
    this.updateUrl(query);
    this.cancelCurrentSearchOperation();

    if (query.length > 0 && query.length < MIN_QUERY_LENGTH) {
      this.results.set([]);
      this.setTagFilterCounts(this.allTagFilterCounts);
      this.status.set("Encore un caractère.");
      return;
    }

    if (!query && !hasActiveFilters) {
      this.results.set([]);
      this.setTagFilterCounts(this.allTagFilterCounts);
      this.status.set("Tapez au moins deux caractères ou choisissez un filtre.");
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

      if (currentRequest !== this.requestId) return;

      this.setTagFilterCounts(response.filters?.["tag"] ?? response.totalFilters?.["tag"]);

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

      const selectedTags = this.selectedTags();
      const mappedResults = results.map((result) => {
        const title = result.data.meta?.title ?? result.data.title ?? result.data.url;
        const createdAt = result.data.meta?.created;
        const modifiedAt = result.data.meta?.modified;
        const tags = this.parseTags(result.data.meta?.tags);

        return {
          createdAt,
          createdLabel: this.formatDate(createdAt),
          excerpt: this.removeLeadingTitle(result.data.excerpt ?? "", title),
          modifiedAt,
          modifiedLabel: this.formatDate(modifiedAt),
          priority: this.parsePriority(result.data.meta?.priority),
          score: result.score,
          tags,
          title,
          titleHtml: this.highlightTitle(title, query),
          url: result.data.url,
        };
      });

      const visibleResults = this.sortResults(
        mappedResults.filter((result) => this.matchesSelectedTags(result, selectedTags)),
      ).slice(0, RESULT_LIMIT);

      this.results.set(visibleResults);
      this.status.set(
        visibleResults.length === 0
          ? "Aucun article trouvé."
          : `${visibleResults.length} résultat${visibleResults.length > 1 ? "s" : ""}.`,
      );
    } catch {
      if (currentRequest !== this.requestId) return;

      this.results.set([]);
      this.status.set("Recherche indisponible. Lance pnpm build pour générer l’index.");
    } finally {
      this.endLoadingOperation(operation);
      if (this.currentSearchOperation === operation) this.currentSearchOperation = null;
    }
  }

  private beginLoadingOperation(operation: string) {
    const wasIdle = this.loadingOperations.size === 0;
    this.loadingOperations.add(operation);
    this.loading.set(true);
    if (wasIdle) this.scheduleLoadingIndicator();
  }

  private endLoadingOperation(operation: string) {
    this.loadingOperations.delete(operation);
    if (this.loadingOperations.size > 0) return;

    this.loading.set(false);
    this.hideLoadingIndicator();
  }

  private cancelCurrentSearchOperation() {
    if (!this.currentSearchOperation) return;
    this.endLoadingOperation(this.currentSearchOperation);
    this.currentSearchOperation = null;
  }

  private scheduleLoadingIndicator() {
    this.cancelLoadingIndicatorTimer();
    this.loadingIndicatorTimer = window.setTimeout(() => {
      this.loadingIndicatorTimer = 0;
      if (this.loadingOperations.size > 0) this.loadingIndicatorVisible.set(true);
    }, LOADING_INDICATOR_DELAY_MS);
  }

  private hideLoadingIndicator() {
    this.cancelLoadingIndicatorTimer();
    this.loadingIndicatorVisible.set(false);
  }

  private cancelLoadingIndicatorTimer() {
    if (!this.loadingIndicatorTimer || typeof window === "undefined") return;
    window.clearTimeout(this.loadingIndicatorTimer);
    this.loadingIndicatorTimer = 0;
  }

  private syncsUrl() {
    return typeof window !== "undefined" && window.location.pathname === "/search/";
  }

  private updateUrl(query: string) {
    if (!this.syncsUrl()) return;

    const url = new URL(window.location.href);
    if (query) {
      url.searchParams.set("q", query);
    } else {
      url.searchParams.delete("q");
    }

    if (this.selectedTags().length > 0) {
      url.searchParams.set("tags", this.selectedTags().join(","));
      url.searchParams.delete("tag");
    } else {
      url.searchParams.delete("tags");
      url.searchParams.delete("tag");
    }

    url.searchParams.delete("from");
    url.searchParams.delete("to");

    if (this.sortMode() !== "relevance") {
      url.searchParams.set("sort", this.sortMode());
    } else {
      url.searchParams.delete("sort");
    }

    window.history.replaceState({}, "", url);
  }

  private parseSortMode(value: string | null): SearchSortMode {
    return isSearchSortMode(value) ? value : "relevance";
  }

  private pagefindSearchOptions(): PagefindSearchOptions {
    const options: PagefindSearchOptions = {};
    const selectedTags = this.selectedTags();
    const sort = this.pagefindSort();

    if (selectedTags.length === 1) {
      options.filters = { tag: selectedTags[0] ?? "" };
    } else if (selectedTags.length > 1) {
      options.filters = { tag: selectedTags };
    }

    if (sort) {
      options.sort = sort;
    }

    return options;
  }

  private pagefindSort(): Record<string, PagefindSortDirection> | undefined {
    switch (this.sortMode()) {
      case "created-desc":
        return { created: "desc" };
      default:
        return undefined;
    }
  }

  private sortResults(results: SearchResult[]) {
    const sortMode = this.sortMode();
    if (sortMode === "relevance") {
      return [...results].sort(
        (left, right) => this.relevanceValue(right) - this.relevanceValue(left),
      );
    }

    if (sortMode === "title-asc") {
      return [...results].sort((left, right) =>
        left.title.localeCompare(right.title, "fr", {
          numeric: true,
          sensitivity: "base",
        }),
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

  private relevanceValue(result: SearchResult) {
    return result.score + result.priority * RELEVANCE_PRIORITY_WEIGHT;
  }

  private resultFetchLimit() {
    return this.sortMode() === "created-desc" ? RESULT_LIMIT : EXPANDED_RESULT_FETCH_LIMIT;
  }

  private hasActiveFilters() {
    return this.selectedTags().length > 0 || this.sortMode() !== "relevance";
  }

  private matchesSelectedTags(result: SearchResult, selectedTags: string[]) {
    if (selectedTags.length === 0) return true;

    return selectedTags.every((tag) => result.tags.includes(tag));
  }

  private withSearchTimeout<T>(promise: Promise<T>) {
    let timeoutId = 0;

    return Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(
          () => reject(new Error("Search request timed out.")),
          SEARCH_TIMEOUT_MS,
        );
      }),
    ]).finally(() => window.clearTimeout(timeoutId));
  }

  private parseTagsParam(params: URLSearchParams) {
    const tags = params.get("tags") ?? params.get("tag") ?? "";

    return tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, MAX_SELECTED_TAGS);
  }

  private normalizeSelectedTags(value: unknown) {
    const tags = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];

    return [...new Set(tags.filter((tag): tag is string => typeof tag === "string"))].slice(
      0,
      MAX_SELECTED_TAGS,
    );
  }

  private shouldAutofocusSearch() {
    if (typeof window === "undefined") return false;

    return !window.matchMedia("(max-width: 720px), (pointer: coarse)").matches;
  }

  private dateValue(value?: string) {
    const date = Date.parse(value ?? "");
    return Number.isNaN(date) ? Number.POSITIVE_INFINITY : date;
  }

  private formatDate(value?: string) {
    if (!value) return undefined;

    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) return undefined;

    return this.dateFormatter.format(date);
  }

  private parseTags(value?: string) {
    return (value ?? "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  private parsePriority(value?: string) {
    const priority = Number.parseInt(value ?? "0", 10);
    if (Number.isNaN(priority)) return 0;

    return Math.min(MAX_PRIORITY, Math.max(0, priority));
  }

  private escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, (character) => {
      switch (character) {
        case "&":
          return "&amp;";
        case "<":
          return "&lt;";
        case ">":
          return "&gt;";
        case '"':
          return "&quot;";
        default:
          return "&#39;";
      }
    });
  }

  private escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private highlightTitle(title: string, query: string) {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return this.escapeHtml(title);

    const escapedTitle = this.escapeHtml(title);
    const escapedQuery = this.escapeHtml(trimmedQuery);
    const pattern = new RegExp(this.escapeRegExp(escapedQuery), "gi");

    return escapedTitle.replace(pattern, (match) => `<mark>${match}</mark>`);
  }

  private removeLeadingTitle(excerpt: string, title: string) {
    if (!excerpt || typeof document === "undefined") return excerpt;

    const template = document.createElement("template");
    template.innerHTML = excerpt;
    const text = template.content.textContent ?? "";
    const prefixEnd = this.findTitlePrefixEnd(text, title);

    if (prefixEnd < 0) return excerpt;

    this.removeLeadingText(template.content, prefixEnd);
    this.trimLeadingText(template.content);

    return template.innerHTML.trim();
  }

  private findTitlePrefixEnd(text: string, title: string) {
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

  private removeLeadingText(root: DocumentFragment, count: number) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];

    while (walker.nextNode()) {
      nodes.push(walker.currentNode as Text);
    }

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

  private trimLeadingText(root: DocumentFragment) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);

    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const value = node.nodeValue ?? "";
      const trimmed = value.replace(/^\s+/, "");

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
