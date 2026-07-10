import {
  ApplicationRef,
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectionStrategy,
  Component,
  EnvironmentInjector,
  createComponent,
  inject,
  signal,
} from "@angular/core";
import type { AfterViewInit, ComponentRef, OnDestroy } from "@angular/core";
import { MatSnackBar } from "@angular/material/snack-bar";
import { SITE_EVENTS } from "@/lib/site-contracts";

const COPY_FEEDBACK_DURATION_MS = 2200;
const COPY_ICON = "\uE14D";
const COPIED_ICON = "\uE5CA";
const ERROR_ICON = "\uE000";

function restoreSelection(selection: Selection | null, selectedRange: Range | null) {
  if (!selection || !selectedRange) return;

  selection.removeAllRanges();
  selection.addRange(selectedRange);
}

function copySelectedCodeBlock(source: HTMLElement) {
  const selection = document.getSelection();
  const selectedRange = selection?.rangeCount ? selection.getRangeAt(0) : null;
  const range = document.createRange();

  range.selectNodeContents(source);
  selection?.removeAllRanges();
  selection?.addRange(range);

  try {
    return document.execCommand("copy");
  } finally {
    selection?.removeAllRanges();
    restoreSelection(selection ?? null, selectedRange);
  }
}

async function copyToClipboard(text: string, source?: HTMLElement) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    const selection = document.getSelection();
    const selectedRange = selection?.rangeCount ? selection.getRangeAt(0) : null;

    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.className = "code-copy-fallback-input";
    document.body.appendChild(textarea);
    textarea.focus({ preventScroll: true });
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    let copied = false;
    try {
      copied = document.execCommand("copy");
    } finally {
      textarea.remove();
      restoreSelection(selection ?? null, selectedRange);
    }

    return copied || (source ? copySelectedCodeBlock(source) : false);
  }
}

interface MountedCopyButton {
  host: HTMLElement;
  componentRef: ComponentRef<CodeCopyButtonComponent>;
  cleanup?: () => void;
}

@Component({
  selector: "site-code-copy-button",
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <md-icon-button
      type="button"
      class="code-copy-button"
      [class.code-copy-button-copied]="state() === 'copied'"
      [class.code-copy-button-error]="state() === 'error'"
      [attr.aria-label]="label()"
      [attr.title]="tooltip()"
      (click)="copyCode()"
    >
      <md-icon aria-hidden="true">{{ icon() }}</md-icon>
    </md-icon-button>
    <span class="sr-only" role="status" aria-live="polite">{{ status() }}</span>
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    .code-copy-button {
      --md-icon-button-focus-icon-color: var(--site-text);
      --md-icon-button-hover-icon-color: var(--site-text);
      --md-icon-button-hover-state-layer-color: var(--site-text);
      --md-icon-button-icon-color: var(--site-muted);
      --md-icon-button-pressed-icon-color: var(--site-text);
      --md-icon-button-pressed-state-layer-color: var(--site-text);
      pointer-events: auto;
    }

    .code-copy-button-copied {
      --md-icon-button-focus-icon-color: var(--md-sys-color-primary);
      --md-icon-button-hover-icon-color: var(--md-sys-color-primary);
      --md-icon-button-hover-state-layer-color: var(--md-sys-color-primary);
      --md-icon-button-icon-color: var(--md-sys-color-primary);
      --md-icon-button-pressed-icon-color: var(--md-sys-color-primary);
      --md-icon-button-pressed-state-layer-color: var(--md-sys-color-primary);
    }

    .code-copy-button-error {
      --md-icon-button-focus-icon-color: var(--md-sys-color-error);
      --md-icon-button-hover-icon-color: var(--md-sys-color-error);
      --md-icon-button-hover-state-layer-color: var(--md-sys-color-error);
      --md-icon-button-icon-color: var(--md-sys-color-error);
      --md-icon-button-pressed-icon-color: var(--md-sys-color-error);
      --md-icon-button-pressed-state-layer-color: var(--md-sys-color-error);
    }
  `,
})
class CodeCopyButtonComponent implements OnDestroy {
  private readonly snackBar = inject(MatSnackBar);

  code = "";
  source: HTMLElement | null = null;

  readonly state = signal<"idle" | "copied" | "error">("idle");
  readonly status = signal("");
  readonly icon = signal(COPY_ICON);
  readonly label = signal("Copier le code");
  readonly tooltip = signal("Copier le code source");

  private resetTimer = 0;

  ngOnDestroy() {
    if (typeof window !== "undefined") window.clearTimeout(this.resetTimer);
  }

  async copyCode() {
    document.dispatchEvent(new CustomEvent(SITE_EVENTS.tooltipHide));

    const copied = await copyToClipboard(this.code, this.source ?? undefined);
    const state = copied ? "copied" : "error";

    this.state.set(state);
    this.status.set(copied ? "Code copié" : "Impossible de copier le code");
    this.icon.set(copied ? COPIED_ICON : ERROR_ICON);
    this.label.set(copied ? "Copié" : "Erreur de copie");
    this.tooltip.set(copied ? "Code copié" : "Erreur de copie");

    if (copied) {
      this.snackBar.open("Code copié", undefined, {
        duration: COPY_FEEDBACK_DURATION_MS,
        horizontalPosition: "center",
        verticalPosition: "bottom",
      });
    }

    if (typeof window === "undefined") return;

    window.clearTimeout(this.resetTimer);
    this.resetTimer = window.setTimeout(() => this.reset(), COPY_FEEDBACK_DURATION_MS);
  }

  private reset() {
    this.resetTimer = 0;
    this.state.set("idle");
    this.status.set("");
    this.icon.set(COPY_ICON);
    this.label.set("Copier le code");
    this.tooltip.set("Copier le code source");
  }
}

@Component({
  selector: "site-code-block-enhancer",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: "",
  styles: `
    :host {
      display: none;
    }
  `,
})
export class CodeBlockEnhancerComponent implements AfterViewInit, OnDestroy {
  private readonly applicationRef = inject(ApplicationRef);
  private readonly environmentInjector = inject(EnvironmentInjector);
  private readonly mounted: MountedCopyButton[] = [];
  private readonly handlePageLoad = () => this.enhance();
  private mutationObserver?: MutationObserver;
  private enhanceFrame = 0;

  ngAfterViewInit() {
    if (typeof document === "undefined") return;
    this.enhance();
    window.addEventListener("astro:page-load", this.handlePageLoad);
    const prose = document.querySelector(".site-prose");
    if (prose) {
      this.mutationObserver = new MutationObserver(() => this.scheduleEnhance());
      this.mutationObserver.observe(prose, { childList: true, subtree: true });
    }
  }

  ngOnDestroy() {
    if (typeof window !== "undefined") {
      window.removeEventListener("astro:page-load", this.handlePageLoad);
      window.cancelAnimationFrame(this.enhanceFrame);
    }
    this.mutationObserver?.disconnect();
    for (const mounted of this.mounted.splice(0)) this.destroy(mounted);
  }

  private scheduleEnhance() {
    if (this.enhanceFrame) return;
    this.enhanceFrame = window.requestAnimationFrame(() => {
      this.enhanceFrame = 0;
      this.enhance();
    });
  }

  private enhance() {
    this.removeDisconnectedButtons();

    document.querySelectorAll<HTMLElement>("pre > code").forEach((codeBlock) => {
      const pre = codeBlock.parentElement;
      if (!pre || pre.dataset["styled"] === "1" || !pre.parentNode) return;

      pre.dataset["styled"] = "1";
      pre.removeAttribute("tabindex");
      pre.style.removeProperty("overflow-x");

      const shell = document.createElement("div");
      shell.className = "code-shell";
      if (codeBlock.querySelectorAll(":scope > .line").length === 1) {
        shell.dataset["singleLine"] = "true";
      }
      pre.parentNode.insertBefore(shell, pre);
      shell.appendChild(pre);

      const actions = document.createElement("div");
      actions.className = "code-actions";
      const host = document.createElement("site-code-copy-button");
      const cleanup = this.watchCodeBlockOverflow(shell, pre, codeBlock);
      const componentRef = createComponent(CodeCopyButtonComponent, {
        environmentInjector: this.environmentInjector,
        hostElement: host,
      });

      componentRef.instance.code = codeBlock.innerText;
      componentRef.instance.source = codeBlock;
      this.applicationRef.attachView(componentRef.hostView);
      componentRef.changeDetectorRef.detectChanges();

      actions.appendChild(host);
      shell.appendChild(actions);

      this.mounted.push({ host, componentRef, cleanup });
    });
  }

  private watchCodeBlockOverflow(shell: HTMLElement, pre: HTMLElement, codeBlock: HTMLElement) {
    if (typeof window === "undefined") return undefined;

    let animationFrame = 0;
    const update = () => {
      animationFrame = 0;
      const isScrollable = pre.scrollWidth > pre.clientWidth + 1;
      if (isScrollable) {
        shell.dataset["scrollable"] = "true";
      } else {
        delete shell.dataset["scrollable"];
      }
    };
    const schedule = () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(update);
    };

    schedule();

    const resizeObserver =
      typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(schedule);
    resizeObserver?.observe(pre);
    resizeObserver?.observe(codeBlock);
    window.addEventListener("resize", schedule, { passive: true });

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", schedule);
    };
  }

  private removeDisconnectedButtons() {
    for (let index = this.mounted.length - 1; index >= 0; index -= 1) {
      const mounted = this.mounted[index];
      if (mounted.host.isConnected) continue;
      this.mounted.splice(index, 1);
      this.destroy(mounted);
    }
  }

  private destroy(mounted: MountedCopyButton) {
    mounted.cleanup?.();
    this.applicationRef.detachView(mounted.componentRef.hostView);
    mounted.componentRef.destroy();
    mounted.host.remove();
  }
}
