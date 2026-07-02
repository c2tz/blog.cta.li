import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  EnvironmentInjector,
  createComponent,
  inject,
  signal,
} from "@angular/core";
import type { AfterViewInit, ComponentRef, OnDestroy } from "@angular/core";
import { MatIconButton } from "@angular/material/button";
import { MatIcon } from "@angular/material/icon";
import { MatTooltip } from "@angular/material/tooltip";
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
}

@Component({
  selector: "site-code-copy-button",
  standalone: true,
  imports: [MatIconButton, MatIcon, MatTooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      matIconButton
      type="button"
      class="code-copy-button"
      [class.code-copy-button-copied]="state() === 'copied'"
      [class.code-copy-button-error]="state() === 'error'"
      [attr.aria-label]="label()"
      [matTooltip]="tooltip()"
      matTooltipPosition="below"
      (click)="copyCode()"
    >
      <mat-icon aria-hidden="true">{{ icon() }}</mat-icon>
    </button>
    <span class="sr-only" role="status" aria-live="polite">{{ status() }}</span>
  `,
  styles: `
    :host {
      display: inline-flex;
      width: 2.5rem;
      height: 2.5rem;
      flex: 0 0 2.5rem;
    }
  `,
})
export class CodeCopyButtonComponent implements OnDestroy {
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
    this.removeDisconnectedButtons();

    document.querySelectorAll<HTMLElement>("pre > code").forEach((codeBlock) => {
      const pre = codeBlock.parentElement;
      if (!pre || pre.dataset["styled"] === "1" || !pre.parentNode) return;

      pre.dataset["styled"] = "1";
      pre.removeAttribute("tabindex");

      const langClass = [...codeBlock.classList].find((name) => name.startsWith("language-"));
      const preLangClass = [...pre.classList].find((name) => name.startsWith("language-"));
      const dataLang =
        codeBlock.getAttribute("data-language") ||
        codeBlock.getAttribute("data-lang") ||
        pre.getAttribute("data-language") ||
        pre.getAttribute("data-lang");
      const language =
        langClass?.replace("language-", "") ||
        preLangClass?.replace("language-", "") ||
        dataLang?.toLowerCase() ||
        "code";

      const shell = document.createElement("div");
      shell.className = "code-shell";
      pre.parentNode.insertBefore(shell, pre);
      shell.appendChild(pre);

      const header = document.createElement("div");
      header.className = "code-header";
      const languageLabel = document.createElement("div");
      languageLabel.className = "code-language";
      languageLabel.textContent = language;
      const actions = document.createElement("div");
      actions.className = "code-actions";
      const host = document.createElement("site-code-copy-button");
      const componentRef = createComponent(CodeCopyButtonComponent, {
        environmentInjector: this.environmentInjector,
        hostElement: host,
      });

      componentRef.instance.code = codeBlock.innerText;
      componentRef.instance.source = codeBlock;
      this.applicationRef.attachView(componentRef.hostView);
      componentRef.changeDetectorRef.detectChanges();

      actions.appendChild(host);
      header.append(languageLabel, actions);
      shell.insertBefore(header, pre);

      this.mounted.push({ host, componentRef });
    });
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
    this.applicationRef.detachView(mounted.componentRef.hostView);
    mounted.componentRef.destroy();
    mounted.host.remove();
  }
}
