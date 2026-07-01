import { ChangeDetectionStrategy, Component } from "@angular/core";
import type { AfterViewInit, OnDestroy } from "@angular/core";
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
  resetTimer: number;
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

  private async copyCode(
    button: HTMLButtonElement,
    status: HTMLElement,
    code: string,
    codeBlock: HTMLElement,
  ) {
    document.dispatchEvent(new CustomEvent(SITE_EVENTS.tooltipHide));

    const copied = await copyToClipboard(code, codeBlock);
    const message = copied ? "Code copié" : "Impossible de copier le code";
    const icon = button.querySelector<HTMLElement>(".material-symbols-rounded");
    const mounted = this.mounted.find((entry) => entry.host === button);

    button.setAttribute("aria-label", copied ? "Copié" : "Erreur de copie");
    button.classList.toggle("code-copy-button-copied", copied);
    button.classList.toggle("code-copy-button-error", !copied);
    if (icon) icon.textContent = copied ? COPIED_ICON : ERROR_ICON;
    status.textContent = message;

    if (mounted) {
      window.clearTimeout(mounted.resetTimer);
      mounted.resetTimer = window.setTimeout(() => {
        this.resetCopyButton(button, status);
        mounted.resetTimer = 0;
      }, COPY_FEEDBACK_DURATION_MS);
    }
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
      const host = document.createElement("button");
      host.type = "button";
      host.className = "code-copy-button";
      host.setAttribute("aria-label", "Copier le code");
      host.title = "Copier le code source";

      const icon = document.createElement("span");
      icon.className = "material-symbols-rounded";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = COPY_ICON;

      const status = document.createElement("span");
      status.className = "sr-only";
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");

      host.append(icon);
      host.addEventListener(
        "click",
        () => void this.copyCode(host, status, codeBlock.innerText, codeBlock),
      );

      actions.appendChild(host);
      actions.appendChild(status);
      header.append(languageLabel, actions);
      shell.insertBefore(header, pre);

      this.mounted.push({ host, resetTimer: 0 });
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
    if (typeof window !== "undefined") window.clearTimeout(mounted.resetTimer);
    mounted.host.remove();
  }

  private resetCopyButton(button: HTMLButtonElement, status: HTMLElement) {
    const icon = button.querySelector<HTMLElement>(".material-symbols-rounded");

    button.setAttribute("aria-label", "Copier le code");
    button.classList.remove("code-copy-button-copied", "code-copy-button-error");
    if (icon) icon.textContent = COPY_ICON;
    status.textContent = "";
  }
}
