import {
  ChangeDetectionStrategy,
  Component,
  signal,
} from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";
import { MatIconButton } from "@angular/material/button";
import { MatIcon } from "@angular/material/icon";
import { MatTooltip } from "@angular/material/tooltip";

interface RefreshState {
  busy?: boolean;
  status?: string;
}

@Component({
  selector: "site-konachan-refresh-button",
  standalone: true,
  imports: [MatIconButton, MatIcon, MatTooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      matIconButton
      type="button"
      class="home-anime-refresh site-icon-button"
      [disabled]="busy()"
      [attr.aria-busy]="busy()"
      [attr.aria-label]="busy() ? 'Image en cours de chargement' : 'Changer l\\'image'"
      [matTooltip]="busy() ? 'Image en cours de chargement' : 'Changer l\\'image'"
      matTooltipPosition="below"
      (click)="refresh()"
    >
      <mat-icon aria-hidden="true">refresh</mat-icon>
    </button>
    <span class="sr-only" role="status" aria-live="polite" data-konachan-status>
      {{ status() }}
    </span>
  `,
})
export class KonachanRefreshButtonComponent implements OnInit, OnDestroy {
  readonly busy = signal(false);
  readonly status = signal("");

  private readonly handleRefreshState = (event: Event) => {
    const detail = (event as CustomEvent<RefreshState>).detail ?? {};

    if (typeof detail.busy === "boolean") this.busy.set(detail.busy);
    if (typeof detail.status === "string") this.status.set(detail.status);
  };

  ngOnInit() {
    if (typeof document === "undefined") return;
    document.addEventListener("konachan:refresh-state", this.handleRefreshState);
  }

  ngOnDestroy() {
    if (typeof document === "undefined") return;
    document.removeEventListener("konachan:refresh-state", this.handleRefreshState);
  }

  refresh() {
    if (this.busy() || typeof document === "undefined") return;

    document.dispatchEvent(new CustomEvent("site:tooltip-hide"));
    document.dispatchEvent(new CustomEvent("konachan:refresh-request"));
  }
}
