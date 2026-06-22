import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  signal,
} from "@angular/core";
import type { AfterViewInit, OnDestroy } from "@angular/core";
import {
  MatTooltip,
  type TooltipPosition,
} from "@angular/material/tooltip";

const TOOLTIP_SELECTOR = "[data-tooltip]";
const TOUCH_HIDE_DELAY = 6000;

function getTarget(start: EventTarget | null) {
  const element = start instanceof Element ? start : null;
  const target = element?.closest<HTMLElement>(TOOLTIP_SELECTOR) ?? null;
  if (!target?.dataset["tooltip"] || target.getAttribute("aria-hidden") === "true") {
    return null;
  }
  return target;
}

function getPosition(target: HTMLElement): TooltipPosition {
  const placement = target.dataset["tooltipPlacement"];
  if (placement === "bottom") return "below";
  if (placement === "left" || placement === "right") return placement;
  return "above";
}

@Component({
  selector: "site-global-tooltip",
  standalone: true,
  imports: [MatTooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      #origin
      class="site-global-tooltip-origin"
      [matTooltip]="message()"
      [matTooltipPosition]="position()"
      [matTooltipShowDelay]="120"
      [matTooltipHideDelay]="0"
      matTooltipTouchGestures="off"
      aria-hidden="true"
    ></span>
  `,
  styles: `
    :host {
      position: static;
      pointer-events: none;
    }

    .site-global-tooltip-origin {
      position: absolute;
      z-index: -1;
      display: block;
      pointer-events: none;
    }
  `,
})
export class GlobalTooltipComponent implements AfterViewInit, OnDestroy {
  @ViewChild("origin", { read: ElementRef }) private origin?: ElementRef<HTMLElement>;
  @ViewChild(MatTooltip) private tooltip?: MatTooltip;

  readonly message = signal("");
  readonly position = signal<TooltipPosition>("above");

  private activeTarget: HTMLElement | null = null;
  private showFrame = 0;
  private touchTimer = 0;

  private readonly handlePointerOver = (event: PointerEvent) => {
    if (event.pointerType === "touch" || event.pointerType === "pen") return;
    const target = getTarget(event.target);
    if (target && target !== this.activeTarget) this.show(target);
  };

  private readonly handlePointerOut = (event: PointerEvent) => {
    if (event.pointerType === "touch" || event.pointerType === "pen") return;
    const related = event.relatedTarget;
    if (related instanceof Node && this.activeTarget?.contains(related)) return;
    this.hide();
  };

  private readonly handlePointerDown = (event: PointerEvent) => {
    const target = getTarget(event.target);
    if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
    if (target) this.show(target, true);
    else this.hide();
  };

  private readonly handleFocusIn = (event: FocusEvent) => {
    const target = getTarget(event.target);
    if (target) this.show(target);
  };

  private readonly handleFocusOut = (event: FocusEvent) => {
    const related = event.relatedTarget;
    if (related instanceof Node && this.activeTarget?.contains(related)) return;
    this.hide();
  };

  private readonly handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") this.hide();
  };

  private readonly handleViewportChange = () => {
    if (!this.activeTarget) return;
    this.syncOrigin(this.activeTarget);
    this.tooltip?.hide(0);
    this.tooltip?.show(0);
  };

  private readonly handleHideRequest = () => this.hide();

  ngAfterViewInit() {
    if (typeof document === "undefined") return;

    document.addEventListener("pointerover", this.handlePointerOver, true);
    document.addEventListener("pointerout", this.handlePointerOut, true);
    document.addEventListener("pointerdown", this.handlePointerDown, true);
    document.addEventListener("focusin", this.handleFocusIn, true);
    document.addEventListener("focusout", this.handleFocusOut, true);
    document.addEventListener("keydown", this.handleKeyDown);
    document.addEventListener("site:tooltip-hide", this.handleHideRequest);
    window.addEventListener("resize", this.handleViewportChange);
    window.visualViewport?.addEventListener("resize", this.handleViewportChange);
  }

  ngOnDestroy() {
    if (typeof document === "undefined") return;

    document.removeEventListener("pointerover", this.handlePointerOver, true);
    document.removeEventListener("pointerout", this.handlePointerOut, true);
    document.removeEventListener("pointerdown", this.handlePointerDown, true);
    document.removeEventListener("focusin", this.handleFocusIn, true);
    document.removeEventListener("focusout", this.handleFocusOut, true);
    document.removeEventListener("keydown", this.handleKeyDown);
    document.removeEventListener("site:tooltip-hide", this.handleHideRequest);
    window.removeEventListener("resize", this.handleViewportChange);
    window.visualViewport?.removeEventListener("resize", this.handleViewportChange);
    this.clearTimers();
  }

  private show(target: HTMLElement, temporary = false) {
    this.clearTimers();
    this.activeTarget = target;
    this.message.set(target.dataset["tooltip"] ?? "");
    this.position.set(getPosition(target));
    this.syncOrigin(target);

    this.showFrame = requestAnimationFrame(() => {
      this.showFrame = 0;
      this.tooltip?.show(0);
    });

    if (temporary) {
      this.touchTimer = window.setTimeout(() => this.hide(), TOUCH_HIDE_DELAY);
    }
  }

  private hide() {
    this.clearTimers();
    this.activeTarget = null;
    this.tooltip?.hide(0);
  }

  private syncOrigin(target: HTMLElement) {
    const origin = this.origin?.nativeElement;
    if (!origin) return;
    const rect = target.getBoundingClientRect();
    origin.style.left = `${rect.left + window.scrollX}px`;
    origin.style.top = `${rect.top + window.scrollY}px`;
    origin.style.width = `${rect.width}px`;
    origin.style.height = `${rect.height}px`;
  }

  private clearTimers() {
    if (this.showFrame) cancelAnimationFrame(this.showFrame);
    if (this.touchTimer) window.clearTimeout(this.touchTimer);
    this.showFrame = 0;
    this.touchTimer = 0;
  }
}
