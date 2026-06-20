import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  ComponentRef,
  EnvironmentInjector,
  createComponent,
  inject,
  input,
  signal,
} from "@angular/core";
import type { AfterViewInit, OnDestroy } from "@angular/core";
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from "@angular/material/icon";
import { MatSnackBar, MatSnackBarModule } from "@angular/material/snack-bar";

const COPY_FEEDBACK_DURATION_MS = 2200;

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    const selection = document.getSelection();
    const selectedRange = selection?.rangeCount ? selection.getRangeAt(0) : null;

    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.inset = "0 auto auto 0";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    let copied = false;
    try {
      copied = document.execCommand("copy");
    } finally {
      textarea.remove();
      if (selectedRange && selection) {
        selection.removeAllRanges();
        selection.addRange(selectedRange);
      }
    }

    return copied;
  }
}

@Component({
  selector: "site-code-copy-button",
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatSnackBarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      matIconButton
      type="button"
      class="code-copy-button site-icon-button"
      [class.is-copied]="state() === 'copied'"
      [class.is-error]="state() === 'error'"
      [attr.aria-label]="label()"
      (click)="copy()"
    >
      <mat-icon
        class="code-copy-button__icon code-copy-button__icon--copy"
        aria-hidden="true"
      >
        &#xE14D;
      </mat-icon>
      <mat-icon
        class="code-copy-button__icon code-copy-button__icon--check"
        aria-hidden="true"
      >
        &#xE5CA;
      </mat-icon>
    </button>
    <span class="sr-only code-copy-status" role="status" aria-live="polite">
      {{ status() }}
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
      width: 2.5rem;
      height: 2.5rem;
    }
  `,
})
class CodeCopyButtonComponent implements OnDestroy {
  readonly code = input("");
  readonly state = signal<"idle" | "copied" | "error">("idle");
  readonly status = signal("");
  private resetTimer = 0;
  private readonly snackBar = inject(MatSnackBar);

  readonly label = () => {
    if (this.state() === "copied") return "Copié";
    if (this.state() === "error") return "Erreur";
    return "Copier le code";
  };

  ngOnDestroy() {
    if (typeof window !== "undefined") {
      window.clearTimeout(this.resetTimer);
    }
  }

  async copy() {
    const copied = await copyToClipboard(this.code());
    this.state.set(copied ? "copied" : "error");
    const message = copied ? "Code copié" : "Impossible de copier le code";
    this.status.set(message);

    this.snackBar.open(message, undefined, {
      duration: COPY_FEEDBACK_DURATION_MS,
      horizontalPosition: "center",
      politeness: copied ? "polite" : "assertive",
      verticalPosition: "bottom",
    });

    window.clearTimeout(this.resetTimer);
    this.resetTimer = window.setTimeout(() => {
      this.state.set("idle");
      this.status.set("");
    }, COPY_FEEDBACK_DURATION_MS);
  }
}

interface MountedCopyButton {
  host: HTMLElement;
  ref: ComponentRef<CodeCopyButtonComponent>;
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

  constructor(
    private readonly appRef: ApplicationRef,
    private readonly environmentInjector: EnvironmentInjector,
  ) {}

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
      languageLabel.className = "code-lang";
      languageLabel.textContent = language;
      const actions = document.createElement("div");
      actions.className = "code-actions";
      const host = document.createElement("site-code-copy-button");

      actions.appendChild(host);
      header.append(languageLabel, actions);
      shell.insertBefore(header, pre);

      const ref = createComponent(CodeCopyButtonComponent, {
        environmentInjector: this.environmentInjector,
        hostElement: host,
      });
      ref.setInput("code", codeBlock.innerText);
      this.appRef.attachView(ref.hostView);
      ref.changeDetectorRef.detectChanges();
      this.mounted.push({ host, ref });
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
    this.appRef.detachView(mounted.ref.hostView);
    mounted.ref.destroy();
    mounted.host.remove();
  }
}
