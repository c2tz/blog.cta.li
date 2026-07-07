import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  EnvironmentInjector,
  ViewChild,
  ViewEncapsulation,
  createComponent,
  inject,
  signal,
} from "@angular/core";
import type { AfterViewInit, ComponentRef, OnDestroy } from "@angular/core";
import { MatFormField, MatLabel } from "@angular/material/form-field";
import { MatInput } from "@angular/material/input";
import { MatPaginator, MatPaginatorModule } from "@angular/material/paginator";
import { MatSort, MatSortModule } from "@angular/material/sort";
import { MatTableDataSource, MatTableModule } from "@angular/material/table";
import { MatTabsModule } from "@angular/material/tabs";

interface MaterialTabData {
  readonly html: string;
  readonly title: string;
}

interface MaterialTableColumn {
  readonly key: string;
  readonly label: string;
}

type MaterialTableRow = Record<string, string>;

interface MountedShortcode {
  readonly componentRef: ComponentRef<unknown>;
  readonly host: HTMLElement;
}

function textFromHtml(html: string) {
  const element = document.createElement("div");
  element.innerHTML = html;
  return element.textContent?.trim().toLocaleLowerCase("fr") ?? "";
}

@Component({
  selector: "site-material-tabs-view",
  standalone: true,
  imports: [MatTabsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <mat-tab-group
      class="material-shortcode-tabs"
      animationDuration="180ms"
      [attr.aria-label]="label"
      preserveContent
    >
      @for (tab of tabs; track tab.title) {
        <mat-tab [label]="tab.title">
          <div class="material-shortcode-tab-content" [innerHTML]="tab.html"></div>
        </mat-tab>
      }
    </mat-tab-group>
  `,
})
export class MaterialTabsViewComponent {
  label = "Contenu à onglets";
  tabs: readonly MaterialTabData[] = [];
}

@Component({
  selector: "site-material-table-view",
  standalone: true,
  imports: [MatFormField, MatInput, MatLabel, MatPaginatorModule, MatSortModule, MatTableModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    @if (filterEnabled()) {
      <mat-form-field
        class="material-shortcode-table-filter"
        appearance="outline"
        subscriptSizing="dynamic"
      >
        <mat-label>Filtrer le tableau</mat-label>
        <input matInput type="search" autocomplete="off" (input)="applyFilter($event)" />
      </mat-form-field>
    }

    <div class="material-shortcode-table-scroll" tabindex="0">
      <table
        mat-table
        matSort
        [dataSource]="dataSource"
        class="material-shortcode-table"
        aria-label="Tableau de données"
      >
        @for (column of columns; track column.key) {
          <ng-container [matColumnDef]="column.key">
            <th
              mat-header-cell
              *matHeaderCellDef
              [mat-sort-header]="column.key"
              [disabled]="!sortEnabled()"
              scope="col"
            >
              {{ column.label }}
            </th>
            <td mat-cell *matCellDef="let row">
              <span [innerHTML]="row[column.key]"></span>
            </td>
          </ng-container>
        }

        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
        <tr *matNoDataRow>
          <td class="material-shortcode-table-empty" [attr.colspan]="displayedColumns.length">
            Aucun résultat.
          </td>
        </tr>
      </table>
    </div>

    @if (paginateEnabled()) {
      <mat-paginator
        class="material-shortcode-table-paginator"
        aria-label="Pagination du tableau"
        [pageSize]="pageSize()"
        [pageSizeOptions]="pageSizeOptions()"
        showFirstLastButtons
      />
    }
  `,
})
export class MaterialTableViewComponent implements AfterViewInit {
  @ViewChild(MatSort) private sort?: MatSort;
  @ViewChild(MatPaginator) private paginator?: MatPaginator;

  readonly dataSource = new MatTableDataSource<MaterialTableRow>();
  readonly filterEnabled = signal(false);
  readonly paginateEnabled = signal(false);
  readonly sortEnabled = signal(true);
  readonly pageSize = signal(10);
  readonly pageSizeOptions = signal<readonly number[]>([5, 10, 25]);
  columns: readonly MaterialTableColumn[] = [];
  displayedColumns: readonly string[] = [];

  constructor() {
    this.dataSource.filterPredicate = (row, filter) =>
      this.displayedColumns.some((key) => textFromHtml(row[key] ?? "").includes(filter));
    this.dataSource.sortingDataAccessor = (row, key) => textFromHtml(row[key] ?? "");
  }

  ngAfterViewInit() {
    this.connectControls();
  }

  configure(
    columns: readonly MaterialTableColumn[],
    rows: readonly MaterialTableRow[],
    options: { filter: boolean; paginate: boolean; pageSize: number; sort: boolean },
  ) {
    this.columns = columns;
    this.displayedColumns = columns.map((column) => column.key);
    this.dataSource.data = [...rows];
    this.filterEnabled.set(options.filter);
    this.paginateEnabled.set(options.paginate);
    this.sortEnabled.set(options.sort);
    this.pageSize.set(options.pageSize);
    this.pageSizeOptions.set([...new Set([5, 10, 25, options.pageSize])].sort((a, b) => a - b));
    queueMicrotask(() => this.connectControls());
  }

  applyFilter(event: Event) {
    const value = (event.target as HTMLInputElement).value.trim().toLocaleLowerCase("fr");
    this.dataSource.filter = value;
    this.dataSource.paginator?.firstPage();
  }

  private connectControls() {
    if (this.sortEnabled() && this.sort) this.dataSource.sort = this.sort;
    if (this.paginateEnabled() && this.paginator) this.dataSource.paginator = this.paginator;
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
        .map((panel) => ({
          title: panel.dataset["title"]?.trim() || "Onglet",
          html: panel.innerHTML,
        }))
        .filter((tab) => tab.html.trim());
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
          columns.map((column, index) => [
            column.key,
            row.cells.item(index)?.innerHTML.trim() ?? "",
          ]),
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
