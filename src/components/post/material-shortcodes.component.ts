import {
  ApplicationRef,
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectionStrategy,
  Component,
  EnvironmentInjector,
  ViewEncapsulation,
  computed,
  createComponent,
  effect,
  inject,
  signal,
} from "@angular/core";
import type { AfterViewInit, ComponentRef, OnDestroy } from "@angular/core";
import { DomSanitizer } from "@angular/platform-browser";
import type { SafeHtml } from "@angular/platform-browser";
import { MaterialTextFieldValueDirective } from "@/components/material/material-text-field-value.directive";
import { materialControlValue } from "@/lib/material-web-events";

interface MaterialTabData {
  readonly html: SafeHtml;
  readonly title: string;
}

interface MaterialTableColumn {
  readonly key: string;
  readonly label: string;
}

interface MaterialHtmlValue {
  readonly html: SafeHtml;
  readonly text: string;
}

type MaterialTableRow = Record<string, MaterialHtmlValue>;
type SortDirection = "asc" | "desc";

interface MountedShortcode {
  readonly componentRef: ComponentRef<unknown>;
  readonly host: HTMLElement;
}

let shortcodeInstanceId = 0;

function textFromHtml(html: string) {
  const element = document.createElement("div");
  element.innerHTML = html;
  return element.textContent?.trim().toLocaleLowerCase("fr") ?? "";
}

@Component({
  selector: "site-material-tabs-view",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <md-tabs class="material-shortcode-tabs" [attr.aria-label]="label" (change)="selectTab($event)">
      @for (tab of tabs; track tab.title; let index = $index) {
        <md-primary-tab
          [active]="activeIndex() === index"
          [attr.id]="tabId(index)"
          [attr.aria-controls]="panelId(index)"
        >
          {{ tab.title }}
        </md-primary-tab>
      }
    </md-tabs>

    @for (tab of tabs; track tab.title; let index = $index) {
      <section
        class="material-shortcode-tab-panel"
        role="tabpanel"
        tabindex="0"
        [id]="panelId(index)"
        [attr.aria-labelledby]="tabId(index)"
        [hidden]="activeIndex() !== index"
      >
        <div class="material-shortcode-tab-content" [innerHTML]="tab.html"></div>
      </section>
    }
  `,
})
class MaterialTabsViewComponent {
  private readonly instanceId = ++shortcodeInstanceId;

  label = "Contenu à onglets";
  tabs: readonly MaterialTabData[] = [];
  readonly activeIndex = signal(0);

  selectTab(event: Event) {
    const index = (event.target as HTMLElement & { activeTabIndex?: number }).activeTabIndex;
    if (typeof index === "number") this.activeIndex.set(index);
  }

  tabId(index: number) {
    return `material-tabs-${this.instanceId}-tab-${index}`;
  }

  panelId(index: number) {
    return `material-tabs-${this.instanceId}-panel-${index}`;
  }
}

@Component({
  selector: "site-material-table-view",
  standalone: true,
  imports: [MaterialTextFieldValueDirective],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    @if (filterEnabled()) {
      <md-outlined-text-field
        class="material-shortcode-table-filter"
        type="search"
        label="Filtrer le tableau"
        autocomplete="off"
        [id]="filterId"
        [value]="filterValue()"
        [attr.aria-controls]="tableId"
        siteMaterialValue
        (siteMaterialValueChange)="setFilterValue($event)"
        (input)="applyFilter($event)"
        (keyup)="applyFilter($event)"
      ></md-outlined-text-field>
    }

    <p class="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {{ tableStatus() }}
    </p>
    <p class="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {{ sortStatus() }}
    </p>

    <div class="material-shortcode-table-scroll" tabindex="0">
      <table [id]="tableId" class="material-shortcode-table" aria-label="Tableau de données">
        <thead>
          <tr>
            @for (column of columns(); track column.key) {
              <th scope="col" [attr.aria-sort]="sortAria(column.key)">
                @if (sortEnabled()) {
                  <button
                    type="button"
                    class="material-shortcode-sort-button"
                    [class.material-shortcode-sort-active]="sortColumn() === column.key"
                    [attr.aria-label]="'Trier par ' + column.label"
                    (click)="toggleSort(column.key, column.label)"
                  >
                    <span>{{ column.label }}</span>
                    <md-icon aria-hidden="true">{{ sortIcon(column.key) }}</md-icon>
                    <md-ripple></md-ripple>
                  </button>
                } @else {
                  {{ column.label }}
                }
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of visibleRows(); track $index) {
            <tr>
              @for (column of columns(); track column.key) {
                <td><span [innerHTML]="row[column.key].html"></span></td>
              }
            </tr>
          } @empty {
            <tr>
              <td class="material-shortcode-table-empty" [attr.colspan]="columns().length">
                Aucun résultat.
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    @if (paginateEnabled()) {
      <nav class="material-shortcode-table-paginator" aria-label="Pagination du tableau">
        <div class="material-shortcode-page-size">
          <span>Lignes par page</span>
          <md-outlined-select
            label="Lignes par page"
            [value]="pageSize().toString()"
            [attr.aria-controls]="tableId"
            (change)="changePageSize($event)"
          >
            @for (size of pageSizeOptions(); track size) {
              <md-select-option [value]="size.toString()">
                <span slot="headline">{{ size }}</span>
              </md-select-option>
            }
          </md-outlined-select>
        </div>

        <span class="material-shortcode-range">{{ rangeLabel() }}</span>

        <div class="material-shortcode-page-actions">
          <md-icon-button
            type="button"
            aria-label="Première page"
            [attr.aria-controls]="tableId"
            [disabled]="!hasPreviousPage()"
            (click)="goToPage(0)"
          >
            <md-icon aria-hidden="true">&#xE5DC;</md-icon>
          </md-icon-button>
          <md-icon-button
            type="button"
            aria-label="Page précédente"
            [attr.aria-controls]="tableId"
            [disabled]="!hasPreviousPage()"
            (click)="goToPage(pageIndex() - 1)"
          >
            <md-icon aria-hidden="true">&#xE5CB;</md-icon>
          </md-icon-button>
          <md-icon-button
            type="button"
            aria-label="Page suivante"
            [attr.aria-controls]="tableId"
            [disabled]="!hasNextPage()"
            (click)="goToPage(pageIndex() + 1)"
          >
            <md-icon aria-hidden="true">&#xE5CC;</md-icon>
          </md-icon-button>
          <md-icon-button
            type="button"
            aria-label="Dernière page"
            [attr.aria-controls]="tableId"
            [disabled]="!hasNextPage()"
            (click)="goToPage(pageCount() - 1)"
          >
            <md-icon aria-hidden="true">&#xE5DD;</md-icon>
          </md-icon-button>
        </div>
      </nav>
    }
  `,
})
class MaterialTableViewComponent {
  private readonly instanceId = ++shortcodeInstanceId;

  readonly tableId = `material-table-${this.instanceId}`;
  readonly filterId = `material-table-${this.instanceId}-filter`;
  readonly columns = signal<readonly MaterialTableColumn[]>([]);
  readonly rows = signal<readonly MaterialTableRow[]>([]);
  readonly filterEnabled = signal(false);
  readonly paginateEnabled = signal(false);
  readonly sortEnabled = signal(true);
  readonly pageSize = signal(10);
  readonly pageSizeOptions = signal<readonly number[]>([5, 10, 25]);
  readonly pageIndex = signal(0);
  readonly filterValue = signal("");
  readonly sortColumn = signal<string | null>(null);
  readonly sortDirection = signal<SortDirection>("asc");
  readonly sortStatus = signal("");
  readonly normalizedFilter = computed(() => this.filterValue().trim().toLocaleLowerCase("fr"));
  readonly filteredRows = computed(() => {
    const filter = this.normalizedFilter();
    if (!filter) return this.rows();

    return this.rows().filter((row) =>
      this.columns().some((column) => row[column.key]?.text.includes(filter)),
    );
  });
  readonly sortedRows = computed(() => {
    const column = this.sortColumn();
    if (!column || !this.sortEnabled()) return this.filteredRows();

    const direction = this.sortDirection() === "asc" ? 1 : -1;
    return [...this.filteredRows()].sort(
      (left, right) =>
        (left[column]?.text ?? "").localeCompare(right[column]?.text ?? "", "fr", {
          numeric: true,
          sensitivity: "base",
        }) * direction,
    );
  });
  readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.filteredRows().length / this.pageSize())),
  );
  readonly visibleRows = computed(() => {
    if (!this.paginateEnabled()) return this.sortedRows();

    const start = this.pageIndex() * this.pageSize();
    return this.sortedRows().slice(start, start + this.pageSize());
  });
  readonly hasPreviousPage = computed(() => this.pageIndex() > 0);
  readonly hasNextPage = computed(() => this.pageIndex() + 1 < this.pageCount());
  readonly rangeLabel = computed(() => {
    const total = this.filteredRows().length;
    if (total === 0) return "0 sur 0";

    const start = this.pageIndex() * this.pageSize() + 1;
    const end = Math.min(start + this.visibleRows().length - 1, total);
    return `${start} - ${end} sur ${total}`;
  });
  readonly tableStatus = computed(() => {
    const total = this.filteredRows().length;
    if (total === 0) return "Aucun résultat.";
    if (!this.paginateEnabled()) return `${total} ligne${total > 1 ? "s" : ""}.`;

    const start = this.pageIndex() * this.pageSize() + 1;
    const end = Math.min(start + this.visibleRows().length - 1, total);
    return `Lignes ${start} à ${end} sur ${total}.`;
  });

  constructor() {
    effect(() => {
      const lastPage = this.pageCount() - 1;
      if (this.pageIndex() > lastPage) this.pageIndex.set(lastPage);
    });
  }

  configure(
    columns: readonly MaterialTableColumn[],
    rows: readonly MaterialTableRow[],
    options: { filter: boolean; paginate: boolean; pageSize: number; sort: boolean },
  ) {
    this.columns.set(columns);
    this.rows.set(rows);
    this.filterEnabled.set(options.filter);
    this.paginateEnabled.set(options.paginate);
    this.sortEnabled.set(options.sort);
    this.pageSize.set(options.pageSize);
    this.pageSizeOptions.set(
      [...new Set([5, 10, 25, options.pageSize])].sort((left, right) => left - right),
    );
    this.pageIndex.set(0);
    this.filterValue.set("");
    this.sortColumn.set(null);
  }

  applyFilter(event: Event) {
    this.setFilterValue(materialControlValue(event));
  }

  setFilterValue(value: string) {
    this.filterValue.set(value);
    this.pageIndex.set(0);
  }

  changePageSize(event: Event) {
    const nextSize = Number.parseInt(materialControlValue(event), 10);
    if (!Number.isFinite(nextSize) || nextSize <= 0) return;

    this.pageSize.set(nextSize);
    this.pageIndex.set(0);
  }

  goToPage(index: number) {
    this.pageIndex.set(Math.min(Math.max(0, index), this.pageCount() - 1));
  }

  toggleSort(column: string, label: string) {
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
    this.sortStatus.set(`Tableau trié par ${label}, ordre ${direction}.`);
  }

  sortAria(column: string) {
    if (!this.sortEnabled() || this.sortColumn() !== column) return null;
    return this.sortDirection() === "asc" ? "ascending" : "descending";
  }

  sortIcon(column: string) {
    if (this.sortColumn() !== column) return "\uE5D7";
    return this.sortDirection() === "asc" ? "\uE5D8" : "\uE5DB";
  }
}

@Component({
  selector: "site-material-shortcode-controller",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: "",
  styles: `
    :host {
      display: none;
    }
  `,
})
export class MaterialShortcodeControllerComponent implements AfterViewInit, OnDestroy {
  private readonly applicationRef = inject(ApplicationRef);
  private readonly environmentInjector = inject(EnvironmentInjector);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly mounted: MountedShortcode[] = [];
  private readonly handlePageLoad = () => this.enhance();

  ngAfterViewInit() {
    if (typeof document === "undefined") return;
    this.enhance();
    window.addEventListener("astro:page-load", this.handlePageLoad);
  }

  ngOnDestroy() {
    if (typeof window !== "undefined") {
      window.removeEventListener("astro:page-load", this.handlePageLoad);
    }
    for (const mounted of this.mounted.splice(0)) this.destroy(mounted);
  }

  private enhance() {
    this.removeDisconnected();
    this.mountTabs();
    this.mountTables();
  }

  private mountTabs() {
    document.querySelectorAll<HTMLElement>("[data-material-tabs]").forEach((host) => {
      if (host.dataset["angularMounted"] === "true") return;
      const tabs = Array.from(host.querySelectorAll<HTMLElement>(":scope > [data-material-tab]"))
        .map((panel) => {
          const html = panel.innerHTML;
          return {
            title: panel.dataset["title"]?.trim() || "Onglet",
            html,
            safeHtml: this.trustStaticHtml(html),
          };
        })
        .filter((tab) => tab.html.trim())
        .map(({ title, safeHtml }) => ({ title, html: safeHtml }));
      if (!tabs.length) return;

      const componentRef = createComponent(MaterialTabsViewComponent, {
        environmentInjector: this.environmentInjector,
        hostElement: host,
      });
      componentRef.instance.label = host.getAttribute("aria-label") || "Contenu à onglets";
      componentRef.instance.tabs = tabs;
      this.finishMount(host, componentRef);
    });
  }

  private mountTables() {
    document.querySelectorAll<HTMLElement>("[data-material-table]").forEach((host) => {
      if (host.dataset["angularMounted"] === "true") return;
      const source = host.querySelector<HTMLTableElement>(":scope > table");
      if (!source) return;

      const headings = Array.from(source.querySelectorAll<HTMLTableCellElement>("thead th"));
      const columns = headings.map((heading, index) => ({
        key: `column-${index}`,
        label: heading.textContent?.trim() || `Colonne ${index + 1}`,
      }));
      const rows = Array.from(source.querySelectorAll<HTMLTableRowElement>("tbody tr")).map((row) =>
        Object.fromEntries(
          columns.map((column, index) => {
            const html = row.cells.item(index)?.innerHTML.trim() ?? "";
            return [
              column.key,
              {
                html: this.trustStaticHtml(html),
                text: textFromHtml(html),
              },
            ];
          }),
        ),
      );
      if (!columns.length) return;

      const componentRef = createComponent(MaterialTableViewComponent, {
        environmentInjector: this.environmentInjector,
        hostElement: host,
      });
      componentRef.instance.configure(columns, rows, {
        filter: host.dataset["filter"] === "true",
        paginate: host.dataset["paginate"] === "true",
        pageSize: Math.max(1, Number.parseInt(host.dataset["pageSize"] || "10", 10) || 10),
        sort: host.dataset["sort"] !== "false",
      });
      this.finishMount(host, componentRef);
    });
  }

  private finishMount<T>(host: HTMLElement, componentRef: ComponentRef<T>) {
    host.dataset["angularMounted"] = "true";
    this.applicationRef.attachView(componentRef.hostView);
    componentRef.changeDetectorRef.detectChanges();
    this.mounted.push({ host, componentRef });
  }

  private trustStaticHtml(html: string) {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  private removeDisconnected() {
    for (let index = this.mounted.length - 1; index >= 0; index -= 1) {
      if (this.mounted[index].host.isConnected) continue;
      this.destroy(this.mounted[index]);
      this.mounted.splice(index, 1);
    }
  }

  private destroy(mounted: MountedShortcode) {
    this.applicationRef.detachView(mounted.componentRef.hostView);
    mounted.componentRef.destroy();
  }
}
