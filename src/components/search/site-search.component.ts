import { ChangeDetectionStrategy, Component, Injector, inject } from "@angular/core";
import { MatIconButton } from "@angular/material/button";
import { MatIcon } from "@angular/material/icon";
import { MatTooltip } from "@angular/material/tooltip";

@Component({
  selector: "site-search-trigger",
  standalone: true,
  imports: [MatIcon, MatIconButton, MatTooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      matIconButton
      type="button"
      class="site-search-trigger-button"
      matTooltip="Rechercher"
      matTooltipPosition="below"
      aria-label="Rechercher"
      aria-haspopup="dialog"
      (click)="open()"
    >
      <mat-icon aria-hidden="true">{{ searchIcon }}</mat-icon>
    </button>
  `,
  styles: `
    :host {
      display: block;
      width: 2.5rem;
      height: 2.5rem;
      flex: 0 0 2.5rem;
    }
  `,
})
export class SiteSearchTriggerComponent {
  readonly searchIcon = "\uE8B6";
  private readonly injector = inject(Injector);

  async open() {
    const [{ MatDialog }, { SiteSearchDialogComponent }] = await Promise.all([
      import("@angular/material/dialog"),
      import("./site-search-panel.component"),
    ]);
    const dialog = this.injector.get(MatDialog);

    dialog.open(SiteSearchDialogComponent, {
      ariaLabel: "Recherche",
      autoFocus: false,
      maxWidth: "calc(100vw - 2rem)",
      panelClass: "site-search-dialog-panel",
      restoreFocus: true,
      width: "min(50rem, calc(100vw - 2rem))",
    });
  }
}
