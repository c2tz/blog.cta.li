import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  ViewEncapsulation,
  computed,
  signal,
} from "@angular/core";
import type { AfterViewInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { MatButton, MatIconButton } from "@angular/material/button";
import { MatChipsModule } from "@angular/material/chips";
import { MatDialogModule } from "@angular/material/dialog";
import { MatIcon, MatIconModule } from "@angular/material/icon";
import { MatProgressBarModule } from "@angular/material/progress-bar";
import { MatSelectModule } from "@angular/material/select";
import { MatTooltip } from "@angular/material/tooltip";
import { debounceTime, distinctUntilChanged } from "rxjs";

interface PagefindResultData {
  excerpt?: string;
  meta?: {
    created?: string;
    modified?: string;
    priority?: string;
    tags?: string;
    title?: string;
  };
  title?: string;
  url: string;
}

interface PagefindResultRef {
  data: () => Promise<PagefindResultData>;
  score: number;
}

type PagefindFilterCounts = Record<string, Record<string, number>>;
type PagefindSortDirection = "asc" | "desc";
type SearchSortMode = "relevance" | "created-desc" | "title-asc";

interface PagefindSearchOptions {
  filters?: Record<string, string | string[] | { all: string[] } | { any: string[] }>;
  sort?: Record<string, PagefindSortDirection>;
}

interface PagefindResponse {
  filters?: PagefindFilterCounts;
  results: PagefindResultRef[];
  totalFilters?: PagefindFilterCounts;
  unfilteredResultCount?: number;
}

interface PagefindModule {
  filters: () => Promise<PagefindFilterCounts>;
  search: (query: string | null, options?: PagefindSearchOptions) => Promise<PagefindResponse>;
}

declare global {
  interface Window {
    __pagefindModule?: PagefindModule;
  }
}

interface SearchResult {
  createdAt?: string;
  createdLabel?: string;
  excerpt: string;
  modifiedAt?: string;
  modifiedLabel?: string;
  priority: number;
  score: number;
  tags: string[];
  title: string;
  titleHtml: string;
  url: string;
}

interface TagFilter {
  count: number;
  value: string;
}

const PAGEFIND_LOADER_PATH = "/pagefind-loader.js";
const PAGEFIND_LOADED_EVENT = "site:pagefind-loaded";
const MIN_QUERY_LENGTH = 2;
const RESULT_LIMIT = 12;
const EXPANDED_RESULT_FETCH_LIMIT = 100;
const TAG_FILTER_LIMIT = 18;
const MAX_SELECTED_TAGS = 3;
const SEARCH_TIMEOUT_MS = 12000;
const MAX_PRIORITY = 100;
const RELEVANCE_PRIORITY_WEIGHT = 0.01;
const SORT_OPTIONS: Array<{ label: string; value: SearchSortMode }> = [
  { label: "Pertinence", value: "relevance" },
  { label: "Récent", value: "created-desc" },
  { label: "Nom", value: "title-asc" },
];

function isSearchSortMode(value: unknown): value is SearchSortMode {
  return SORT_OPTIONS.some((option) => option.value === value);
}

function loadPagefindScript() {
  return new Promise<void>((resolve, reject) => {
    if (window.__pagefindModule) {
      resolve();
      return;
    }

    let script = document.querySelector<HTMLScriptElement>(
      `script[src="${PAGEFIND_LOADER_PATH}"]`,
    );

    const handleLoaded = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("pagefind_loader_failed"));
    };
    const cleanup = () => {
      window.removeEventListener(PAGEFIND_LOADED_EVENT, handleLoaded);
      script?.removeEventListener("error", handleError);
    };

    window.addEventListener(PAGEFIND_LOADED_EVENT, handleLoaded, { once: true });

    if (script) {
      script.addEventListener("error", handleError, { once: true });
      return;
    }

    script = document.createElement("script");
    script.type = "module";
    script.async = true;
    script.src = PAGEFIND_LOADER_PATH;
    script.addEventListener("error", handleError, { once: true });
    document.head.append(script);
  });
}

async function loadPagefindModule() {
  if (window.__pagefindModule) return window.__pagefindModule;

  await loadPagefindScript();
  if (!window.__pagefindModule) throw new Error("pagefind_module_unavailable");

  return window.__pagefindModule;
}

@Component({
  selector: "site-search-panel",
  standalone: true,
  imports: [
    MatButton,
    MatChipsModule,
    MatIconButton,
    MatIconModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTooltip,
    ReactiveFormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <form class="site-search-panel-form" role="search" (submit)="submit($event)">
      <div class="site-search-panel-field">
        <mat-icon class="site-search-panel-leading-icon" aria-hidden="true">{{ searchIcon }}</mat-icon>
        <input
          #searchInput
          class="site-search-panel-input"
          type="search"
          autocomplete="off"
          spellcheck="false"
          aria-label="Mot-clé, titre ou contenu"
          aria-controls="site-search-panel-results site-search-panel-tags"
          aria-describedby="site-search-panel-status site-search-panel-filter-limit"
          placeholder="Mot-clé, titre ou contenu"
          [formControl]="query"
        />

        @if (hasSearchText()) {
          <button
            matIconButton
            class="site-search-panel-clear-search"
            type="button"
            matTooltip="Effacer la recherche"
            matTooltipPosition="below"
            aria-label="Effacer la recherche"
            (click)="clearSearch()"
          >
            <mat-icon aria-hidden="true">{{ closeIcon }}</mat-icon>
          </button>
        }

        <span class="site-search-panel-divider" aria-hidden="true"></span>
        <div class="site-search-panel-sort">
          <mat-select
            class="site-search-panel-sort-select"
            aria-label="Trier les résultats"
            panelClass="site-search-panel-sort-menu"
            panelWidth="14rem"
            hideSingleSelectionIndicator
            [value]="sortMode()"
            (selectionChange)="setSortMode($event.value)"
          >
            <mat-select-trigger>
              <span class="site-search-panel-sort-trigger">
                <span class="site-search-panel-sort-label">Tri par</span>
                <span class="site-search-panel-sort-value">{{ sortLabel() }}</span>
              </span>
            </mat-select-trigger>
            @for (option of sortOptions; track option.value) {
              <mat-option [value]="option.value">
                <span class="site-search-panel-sort-option">
                  <span>{{ option.label }}</span>
                  @if (option.value === sortMode()) {
                    <mat-icon aria-hidden="true">{{ doneIcon }}</mat-icon>
                  }
                </span>
              </mat-option>
            }
          </mat-select>
        </div>

      </div>
    </form>

    @if (status() || loading() || hasFilterState()) {
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
            <button
              matButton="tonal"
              class="site-search-panel-filter-button site-search-panel-clear-filters"
              type="button"
              aria-label="Effacer les filtres sélectionnés"
              (click)="clearFilters()"
            >
              <mat-icon aria-hidden="true">{{ closeIcon }}</mat-icon>
              <span>Filtres</span>
            </button>
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
        @if (loading()) {
          <mat-progress-bar
            class="site-search-panel-progress"
            aria-label="Recherche en cours"
            mode="indeterminate"
          />
        }
      </div>
    }

    <div class="site-search-panel-filters">
      @if (tagFilters().length > 0) {
        <mat-chip-listbox
          id="site-search-panel-tags"
          class="site-search-panel-tags"
          multiple
          aria-label="Filtrer par tags"
          [value]="selectedTags()"
          (change)="setSelectedTags($event.value)"
        >
          @for (tag of tagFilters(); track tag.value) {
            <mat-chip-option
              [disabled]="isTagDisabled(tag.value)"
              [value]="tag.value"
              [attr.aria-label]="tagAriaLabel(tag.value)"
              (click)="releaseTouchFocus($event)"
            >
              #{{ tag.value }}
            </mat-chip-option>
          }
        </mat-chip-listbox>
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
                  <mat-icon
                    [matTooltip]="createdTooltip"
                    matTooltipPosition="below"
                    [attr.aria-label]="createdTooltip"
                  >
                    {{ createdIcon }}
                  </mat-icon>
                  <time [attr.datetime]="result.createdAt">{{ result.createdLabel }}</time>
                </span>
              }
              @if (result.createdLabel && result.modifiedLabel) {
                <span class="site-search-panel-result-meta-separator" aria-hidden="true">·</span>
              }
              @if (result.modifiedLabel) {
                <span>
                  <mat-icon
                    [matTooltip]="modifiedTooltip"
                    matTooltipPosition="below"
                    [attr.aria-label]="modifiedTooltip"
                  >
                    {{ modifiedIcon }}
                  </mat-icon>
                  <time [attr.datetime]="result.modifiedAt">{{ result.modifiedLabel }}</time>
                </span>
              }
            </div>
            @if (result.excerpt) {
              <p class="site-search-panel-result-excerpt" [innerHTML]="result.excerpt"></p>
            }
          </div>
          <a
            matIconButton
            class="site-search-panel-result-arrow"
            [href]="result.url"
            [attr.aria-label]="'Ouvrir ' + result.title"
          >
            <mat-icon aria-hidden="true">{{ arrowIcon }}</mat-icon>
          </a>
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
      grid-template-columns: auto minmax(0, 1fr) auto auto minmax(11rem, 11rem);
      align-items: center;
      min-height: 3.5rem;
      width: 100%;
      box-sizing: border-box;
      gap: 0.45rem;
      overflow: hidden;
      padding-inline: 1rem 0;
      border: 0;
      border-radius: 1.75rem;
      background: color-mix(in srgb, var(--site-muted) 10%, transparent);
      color: var(--site-text);
      transition:
        background-color 160ms ease,
        box-shadow 160ms ease;
    }

    .site-search-panel-field:has(.site-search-panel-input:focus) {
      background: color-mix(in srgb, var(--site-muted) 10%, transparent);
      box-shadow: 0 0 0 2px var(--site-link);
    }

    .site-search-panel-leading-icon {
      grid-column: 1;
      width: 1.5rem;
      height: 1.5rem;
      color: var(--site-muted);
      font-size: 1.5rem;
    }

    .site-search-panel-input {
      grid-column: 2;
      min-width: 0;
      border: 0;
      outline: 0;
      background: transparent;
      color: var(--site-text);
      font: inherit;
      font-size: 16px;
      -webkit-text-size-adjust: 100%;
      text-size-adjust: 100%;
    }

    .site-search-panel-input::placeholder {
      color: var(--site-muted);
    }

    .site-search-panel-input::-webkit-search-cancel-button,
    .site-search-panel-input::-webkit-search-decoration {
      display: none;
      appearance: none;
      -webkit-appearance: none;
    }

    .site-search-panel-clear-search.mat-mdc-icon-button {
      --mat-icon-button-state-layer-size: 2rem;
      --mat-icon-button-state-layer-color: var(--site-muted);
      --mat-icon-button-hover-state-layer-opacity: 0.12;
      --mat-icon-button-focus-state-layer-opacity: 0.12;
      --mat-icon-button-pressed-state-layer-opacity: 0.18;
      --mdc-icon-button-state-layer-size: 2rem;
      grid-column: 3;
      justify-self: end;
      width: 2rem;
      height: 2rem;
      padding: 0;
      border-radius: 9999px;
      background: transparent;
      color: var(--site-muted);
      cursor: pointer;
      transition:
        color 140ms ease;
    }

    .site-search-panel-clear-search.mat-mdc-icon-button:is(:hover, :focus-visible) {
      background: transparent;
      color: var(--site-text);
    }

    .site-search-panel-clear-search.mat-mdc-icon-button:focus-visible {
      outline: 2px solid color-mix(in srgb, var(--site-link) 45%, transparent);
      outline-offset: 2px;
    }

    .site-search-panel-clear-search .mat-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.15rem;
      height: 1.15rem;
      font-size: 1.15rem;
      line-height: 1;
      transform: translateY(1px);
    }

    .site-search-panel-divider {
      grid-column: 4;
      align-self: stretch;
      width: 1px;
      height: auto;
      margin-block: 0.55rem;
      background: var(--site-border);
    }

    .site-search-panel-sort {
      grid-column: 5;
      display: grid;
      position: relative;
      align-self: stretch;
      align-content: center;
      justify-self: stretch;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
      padding: 0 0.95rem;
      border-radius: 0 1.75rem 1.75rem 0;
      background: transparent;
      cursor: pointer;
      row-gap: 0.05rem;
    }

    .site-search-panel-sort::before {
      position: absolute;
      inset: 0.35rem 0.55rem 0.35rem 0.5rem;
      display: block;
      border-radius: 8px;
      background: color-mix(in srgb, var(--site-muted) 10%, transparent);
      content: "";
      opacity: 0;
      pointer-events: none;
      transition: opacity 160ms ease;
    }

    .site-search-panel-sort:hover::before {
      opacity: 1;
    }

    .site-search-panel-sort-label {
      color: var(--site-muted);
      font-size: 0.75rem;
      line-height: 1.1;
    }

    .site-search-panel-sort-select {
      position: absolute;
      inset: 0.35rem 0.55rem 0.35rem 0.5rem;
      z-index: 2;
      box-sizing: border-box;
      width: auto !important;
      color: var(--site-text);
      font-size: 0.95rem;
      font-weight: 650;
    }

    .site-search-panel-sort-select .mat-mdc-select-trigger {
      position: absolute;
      inset: 0;
      align-items: center;
      box-sizing: border-box;
      height: 100%;
      min-height: 0;
      padding-inline: 1.2rem 2.45rem;
    }

    .site-search-panel-sort-select .mat-mdc-select-value {
      display: flex;
      align-items: center;
    }

    .site-search-panel-sort-trigger {
      display: grid;
      align-content: center;
      min-width: 0;
      gap: 0.05rem;
    }

    .site-search-panel-sort-value {
      color: var(--site-text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .site-search-panel-sort-select .mat-mdc-select-arrow-wrapper {
      position: absolute;
      top: 50%;
      right: 1.05rem;
      transform: translateY(-50%);
    }

    .site-search-panel-sort-menu.mat-mdc-select-panel {
      min-width: 14rem;
      --mat-select-panel-background-color: var(--site-bg);
      --mat-option-label-text-color: var(--site-text);
      --mat-option-selected-state-label-text-color: var(--site-text);
      --mat-option-hover-state-layer-color: var(--site-tonal-container);
      --mat-option-focus-state-layer-color: var(--site-tonal-container);
      --mat-option-selected-state-layer-color: transparent;
      background: var(--site-bg);
      color: var(--site-text);
    }

    .site-search-panel-sort-menu .mat-mdc-option {
      min-height: 3.25rem;
      color: var(--site-text);
      cursor: pointer;
      font-size: 0.95rem;
    }

    .site-search-panel-sort-menu .mat-mdc-option .mdc-list-item__primary-text {
      color: var(--site-text);
    }

    .site-search-panel-sort-menu .mat-mdc-option-pseudo-checkbox {
      --mat-pseudo-checkbox-minimal-selected-checkmark-color: var(--site-link);
    }

    .site-search-panel-sort-option {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      width: 100%;
      min-width: 0;
    }

    .site-search-panel-sort-option .mat-icon {
      flex: 0 0 auto;
      width: 1.4rem;
      height: 1.4rem;
      color: var(--site-link);
      font-size: 1.4rem;
      line-height: 1;
    }

    .site-search-panel-progress.mat-mdc-progress-bar {
      width: 100%;
      height: 0.18rem;
      overflow: hidden;
      border-radius: 9999px;
      --mdc-linear-progress-active-indicator-color: var(--site-link);
      --mdc-linear-progress-track-color: color-mix(
        in srgb,
        var(--site-link) 16%,
        transparent
      );
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
    }

    .site-search-panel-tags .mdc-evolution-chip-set__chips {
      flex-wrap: wrap;
      margin: 0;
    }

    .site-search-panel-tags .mat-mdc-chip-option {
      --site-search-chip-selected-bg: var(--site-link-container);
      --site-search-chip-selected-fg: var(--site-on-link-container);
      --site-search-chip-label-fg: var(--site-muted);
      --site-search-chip-outline: color-mix(in srgb, var(--site-link) 78%, transparent);
      --mdc-chip-container-color: transparent;
      --mdc-chip-container-height: 2rem;
      --mdc-chip-elevated-container-color: transparent;
      --mdc-chip-flat-selected-container-color: var(--site-search-chip-selected-bg);
      --mdc-chip-label-text-color: var(--site-search-chip-label-fg);
      --mdc-chip-outline-color: var(--site-search-chip-outline);
      --mdc-chip-selected-container-color: var(--site-search-chip-selected-bg);
      --mdc-chip-selected-label-text-color: var(--site-search-chip-selected-fg);
      --mdc-chip-with-icon-selected-icon-color: var(--site-search-chip-selected-fg);
      --mat-chip-focus-outline-color: var(--site-search-chip-outline);
      --mat-chip-focus-state-layer-opacity: 0;
      --mat-chip-hover-state-layer-opacity: 0.08;
      --mat-chip-label-text-color: var(--site-search-chip-label-fg);
      --mat-chip-outline-color: var(--site-search-chip-outline);
      --mat-chip-pressed-state-layer-opacity: 0.08;
      --mat-chip-selected-container-color: var(--site-search-chip-selected-bg);
      --mat-chip-selected-focus-state-layer-opacity: 0;
      --mat-chip-selected-hover-state-layer-opacity: 0.08;
      --mat-chip-selected-label-text-color: var(--site-search-chip-selected-fg);
      --mat-chip-selected-pressed-state-layer-opacity: 0.08;
      --mat-chip-selected-trailing-icon-color: var(--site-search-chip-selected-fg);
      --mat-chip-with-icon-icon-color: var(--site-search-chip-label-fg);
      --mat-chip-with-icon-selected-icon-color: var(--site-search-chip-selected-fg);
      --mat-chip-with-selected-icon-selected-icon-color: var(--site-search-chip-selected-fg);
      --mat-chip-hover-state-layer-color: var(--site-search-chip-label-fg);
      --mat-chip-focus-state-layer-color: var(--site-search-chip-label-fg);
      --mat-chip-selected-hover-state-layer-color: var(--site-search-chip-selected-fg);
      --mat-chip-selected-focus-state-layer-color: var(--site-search-chip-selected-fg);
      flex: 0 0 auto;
      font-size: 0.88rem;
      touch-action: manipulation;
    }

    .site-search-panel-tags .mat-mdc-chip-option.mdc-evolution-chip--disabled {
      opacity: 0.52;
    }

    .site-search-panel-tags
      .mat-mdc-chip-option:is(.mat-mdc-chip-selected, .mdc-evolution-chip--selected) {
      --mdc-chip-container-color: var(--site-search-chip-selected-bg);
      --mdc-chip-elevated-container-color: var(--site-search-chip-selected-bg);
      --mdc-chip-outline-color: transparent;
      --mat-chip-elevated-selected-container-color: var(--site-search-chip-selected-bg);
      background-color: var(--site-search-chip-selected-bg);
      color: var(--site-search-chip-selected-fg);
    }

    .site-search-panel-tags
      .mat-mdc-chip-option:is(.mat-mdc-chip-selected, .mdc-evolution-chip--selected)
      .mdc-evolution-chip__action {
      background-color: transparent;
    }

    .site-search-panel-tags
      .mat-mdc-chip-option:is(.mat-mdc-chip-selected, .mdc-evolution-chip--selected)
      .mat-mdc-chip-focus-overlay {
      opacity: 0;
    }

    .site-search-panel-tags
      .mat-mdc-chip-option:not(.mat-mdc-chip-selected):not(.mdc-evolution-chip--selected)
      .mat-mdc-chip-focus-overlay {
      opacity: 0;
    }

    .site-search-panel-tags
      .mat-mdc-chip-option:not(.mat-mdc-chip-selected):not(.mdc-evolution-chip--selected) {
      --mdc-chip-container-color: transparent;
      --mdc-chip-elevated-container-color: transparent;
      --mdc-chip-outline-color: var(--site-search-chip-outline);
      --mat-chip-focus-outline-color: var(--site-search-chip-outline);
      background-color: transparent;
      border-color: var(--site-search-chip-outline);
      color: var(--site-search-chip-label-fg);
      outline-color: var(--site-search-chip-outline);
    }

    .site-search-panel-filter-button.mat-mdc-button-base {
      flex: 0 0 auto;
      min-width: max-content;
      height: 2.25rem;
      padding-inline: 0.75rem;
      border-radius: 9999px;
    }

    .site-search-panel-filter-button .mat-icon {
      width: 1.15rem;
      height: 1.15rem;
      font-size: 1.15rem;
    }

    .site-search-panel-clear-filters.mat-mdc-button-base {
      color: var(--site-link);
    }

    .site-search-panel-state {
      display: grid;
      justify-items: start;
      gap: 0.5rem;
      min-height: 2.5rem;
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
      grid-template-columns: minmax(0, 1fr) auto;
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

    .site-search-panel-result-meta .mat-icon {
      width: 1rem;
      height: 1rem;
      font-size: 1rem;
    }

    .site-search-panel-result-excerpt {
      margin-block: 0.5rem 0;
      color: var(--site-text);
      font-size: 0.94rem;
      line-height: 1.55;
    }

    .site-search-panel-result-arrow.mat-mdc-icon-button {
      --mat-icon-button-state-layer-size: 2.5rem;
      --mat-icon-button-state-layer-color: var(--site-link);
      --mat-icon-button-hover-state-layer-opacity: 0.1;
      --mat-icon-button-focus-state-layer-opacity: 0.12;
      --mat-icon-button-pressed-state-layer-opacity: 0.16;
      --mdc-icon-button-state-layer-size: 2.5rem;
      position: relative;
      width: 2.5rem;
      height: 2.5rem;
      padding: 0;
      color: var(--site-muted);
    }

    .site-search-panel-result-arrow.mat-mdc-icon-button:is(:hover, :focus-visible) {
      color: var(--site-link);
    }

    .site-search-panel-result-arrow.mat-mdc-icon-button .mat-icon {
      position: absolute;
      top: 50%;
      left: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 1.45rem;
      height: 1.45rem;
      font-size: 1.45rem;
      line-height: 1;
      transform: translate(-50%, -50%);
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
        grid-template-columns: auto minmax(0, 1fr) auto;
      }

      .site-search-panel-divider,
      .site-search-panel-sort {
        display: none;
      }

      .site-search-panel-result {
        grid-template-columns: 1fr;
      }

      .site-search-panel-result-arrow {
        display: none;
      }
    }

    @media (max-width: 720px), (pointer: coarse) {
      .site-search-panel-filters {
        overflow-x: auto;
        scrollbar-width: thin;
      }

      .site-search-panel-tags .mdc-evolution-chip-set__chips {
        flex-wrap: nowrap;
      }

      .site-search-panel-tags .mat-mdc-chip-option {
        --mat-chip-focus-state-layer-opacity: 0;
        --mat-chip-hover-state-layer-opacity: 0;
        --mat-chip-pressed-state-layer-opacity: 0;
        --mat-chip-selected-focus-state-layer-opacity: 0;
        --mat-chip-selected-hover-state-layer-opacity: 0;
        --mat-chip-selected-pressed-state-layer-opacity: 0;
      }

      .site-search-panel-tags .mat-mdc-chip-focus-overlay {
        opacity: 0 !important;
      }
    }

    @media (max-width: 520px) {
      .site-search-panel-field {
        min-height: 3rem;
        padding-inline: 0.75rem 0.9rem;
        border-radius: 1.5rem;
      }

      .site-search-panel-input {
        font-size: 16px;
      }

      .site-search-panel-state {
        min-height: 2rem;
      }
    }
  `,
})
export class SiteSearchPanelComponent implements AfterViewInit {
  @ViewChild("searchInput") private searchInput?: ElementRef<HTMLInputElement>;

  readonly arrowIcon = "\uE5C8";
  readonly hasFilterState = computed(() => {
    return this.selectedTags().length > 0;
  });
  readonly hasSearchText = computed(() => this.queryValue().trim().length > 0);
  readonly selectedTagLimitReached = computed(() => {
    return this.selectedTags().length >= MAX_SELECTED_TAGS;
  });
  readonly loading = signal(false);
  readonly query = new FormControl("", { nonNullable: true });
  readonly queryValue = signal("");
  readonly results = signal<SearchResult[]>([]);
  readonly selectedTags = signal<string[]>([]);
  readonly sortMode = signal<SearchSortMode>("relevance");
  readonly tagFilters = signal<TagFilter[]>([]);
  readonly closeIcon = "\uE5CD";
  readonly createdIcon = "\uE89C";
  readonly createdTooltip = "Création du post";
  readonly doneIcon = "\uE876";
  readonly modifiedIcon = "\uF88C";
  readonly modifiedTooltip = "Dernière modification du post";
  readonly searchIcon = "\uE8B6";
  readonly sortOptions = SORT_OPTIONS;
  readonly sortLabel = computed(() => {
    return this.sortOptions.find((option) => option.value === this.sortMode())?.label ?? "Pertinence";
  });
  readonly status = signal("Tape au moins deux caractères ou choisis un filtre.");

  private readonly dateFormatter = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  private filtersLoaded = false;
  private allTagFilterCounts?: Record<string, number>;
  private pagefind?: Promise<PagefindModule>;
  private requestId = 0;

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
    ) return;

    this.selectedTags.set(nextTags);
    void this.search(this.query.value.trim());
  }

  isTagDisabled(tag: string) {
    return this.selectedTagLimitReached() && !this.selectedTags().includes(tag);
  }

  tagAriaLabel(tag: string) {
    return this.selectedTags().includes(tag)
      ? `Retirer le tag ${tag}`
      : `Ajouter le tag ${tag}`;
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

    try {
      const pagefind = await this.loadPagefind();
      const filters = await pagefind.filters();
      this.allTagFilterCounts = filters["tag"];
      this.setTagFilterCounts(filters["tag"]);
    } catch {
      this.tagFilters.set([]);
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

    if (query.length > 0 && query.length < MIN_QUERY_LENGTH) {
      this.loading.set(false);
      this.results.set([]);
      this.setTagFilterCounts(this.allTagFilterCounts);
      this.status.set("Encore un caractère.");
      return;
    }

    if (!query && !hasActiveFilters) {
      this.loading.set(false);
      this.results.set([]);
      this.setTagFilterCounts(this.allTagFilterCounts);
      this.status.set("Tape au moins deux caractères ou choisis un filtre.");
      return;
    }

    this.loading.set(true);
    this.status.set("Recherche...");

    try {
      const pagefind = await this.withSearchTimeout(this.loadPagefind());
      const response = await this.withSearchTimeout(
        pagefind.search(
          query || null,
          this.pagefindSearchOptions(),
        ),
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
      if (currentRequest === this.requestId) this.loading.set(false);
    }
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
      return [...results].sort((left, right) => left.title.localeCompare(right.title, "fr", {
        numeric: true,
        sensitivity: "base",
      }));
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
        while (titleIndex < normalizedTitle.length && /\s/.test(normalizedTitle[titleIndex] ?? "")) {
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

@Component({
  selector: "site-search-dialog",
  standalone: true,
  imports: [MatDialogModule, MatIcon, MatIconButton, SiteSearchPanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="site-search-dialog-header">
      <h2 mat-dialog-title>Recherche</h2>
      <button matIconButton type="button" mat-dialog-close aria-label="Fermer la recherche">
        <mat-icon aria-hidden="true">{{ closeIcon }}</mat-icon>
      </button>
    </div>

    <mat-dialog-content>
      <site-search-panel />
    </mat-dialog-content>
  `,
  styles: `
    .site-search-dialog-panel .mat-mdc-dialog-container,
    .site-search-dialog-panel .mat-mdc-dialog-surface {
      border-radius: var(--image-radius);
    }

    .site-search-dialog-panel .mat-mdc-dialog-container {
      max-height: inherit;
    }

    .site-search-dialog-panel .mat-mdc-dialog-surface {
      background: var(--site-bg);
      color: var(--site-text);
      overflow: hidden;
    }

    .site-search-dialog-panel .mat-mdc-dialog-content {
      max-height: min(72vh, 42rem);
      overflow: auto;
      overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch;
    }

    .site-search-dialog-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding-inline-end: 0.75rem;
    }

    .site-search-dialog-header [mat-dialog-title] {
      margin: 0;
      font-family: var(--site-heading-font);
    }

    @media (max-width: 720px), (pointer: coarse) {
      .site-search-dialog-panel.cdk-overlay-pane {
        position: fixed !important;
        top: calc(0.75rem + env(safe-area-inset-top, 0px)) !important;
        right: calc(0.75rem + env(safe-area-inset-right, 0px)) !important;
        left: calc(0.75rem + env(safe-area-inset-left, 0px)) !important;
        width: auto !important;
        max-width: none !important;
        max-height: calc(
          100dvh - 1.5rem - env(safe-area-inset-top, 0px) -
            env(safe-area-inset-bottom, 0px)
        ) !important;
        transform: none !important;
      }

      .site-search-dialog-panel .mat-mdc-dialog-container,
      .site-search-dialog-panel .mat-mdc-dialog-surface {
        max-height: inherit;
      }

      .site-search-dialog-panel .mat-mdc-dialog-content {
        max-height: calc(
          100dvh - 7.5rem - env(safe-area-inset-top, 0px) -
            env(safe-area-inset-bottom, 0px)
        );
      }
    }
  `,
})
export class SiteSearchDialogComponent {
  readonly closeIcon = "\uE5CD";
}
