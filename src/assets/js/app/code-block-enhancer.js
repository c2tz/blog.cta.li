const COPY_FEEDBACK_DURATION_MS = 2200;
const COPY_ICON = "\uE14D";
const COPIED_ICON = "\uE5CA";
const ERROR_ICON = "\uE000";
const COPY_LABEL = "Copier le code source";
const TOOLTIP_HIDE_EVENT = "site:tooltip-hide";

const mountedControls = new Map();

let enhanceFrame = 0;
let installed = false;
let mutationObserver = null;
let observedProse = null;

function matchingCodeBlocks(root) {
  const matches = root instanceof Element && root.matches("pre > code") ? [root] : [];
  return [...matches, ...root.querySelectorAll("pre > code")];
}

function restoreSelection(selection, selectedRange) {
  if (!selection || !selectedRange) return;

  try {
    selection.removeAllRanges();
    selection.addRange(selectedRange);
  } catch {
    selection.removeAllRanges();
  }
}

function copySelectedCodeBlock(source) {
  const selection = document.getSelection();
  const selectedRange = selection?.rangeCount ? selection.getRangeAt(0) : null;
  const range = document.createRange();
  range.selectNodeContents(source);
  selection?.removeAllRanges();
  selection?.addRange(range);

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    selection?.removeAllRanges();
    restoreSelection(selection, selectedRange);
  }
}

async function copyToClipboard(text, source) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
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
    } catch {
      copied = false;
    } finally {
      textarea.remove();
      restoreSelection(selection, selectedRange);
    }

    return copied || (source ? copySelectedCodeBlock(source) : false);
  }
}

function setCopyState(control, state) {
  const { button, icon, status } = control;
  const copied = state === "copied";
  const error = state === "error";
  const tooltip = copied ? "Code copié" : error ? "Erreur de copie" : COPY_LABEL;

  button.classList.toggle("code-copy-button-copied", copied);
  button.classList.toggle("code-copy-button-error", error);
  button.setAttribute("aria-label", tooltip);
  button.setAttribute("title", tooltip);
  button.dataset.tooltip = tooltip;
  icon.textContent = copied ? COPIED_ICON : error ? ERROR_ICON : COPY_ICON;
  status.textContent = copied ? "Code copié" : error ? "Impossible de copier le code" : "";
}

function createCopyControl(codeBlock) {
  const button = document.createElement("md-icon-button");
  const icon = document.createElement("md-icon");
  const status = document.createElement("span");
  const control = { button, cleanup: null, icon, resetTimer: 0, status };

  button.className = "code-copy-button site-tooltip";
  button.setAttribute("type", "button");
  button.dataset.tooltipPlacement = "top";
  button.dataset.tooltipTouchGestures = "off";
  icon.setAttribute("aria-hidden", "true");
  status.className = "sr-only";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.setAttribute("aria-atomic", "true");
  button.appendChild(icon);
  setCopyState(control, "idle");

  const handleCopy = async () => {
    document.dispatchEvent(new CustomEvent(TOOLTIP_HIDE_EVENT));
    const copied = await copyToClipboard(codeBlock.innerText, codeBlock);
    setCopyState(control, copied ? "copied" : "error");
    window.clearTimeout(control.resetTimer);
    control.resetTimer = window.setTimeout(() => {
      control.resetTimer = 0;
      setCopyState(control, "idle");
    }, COPY_FEEDBACK_DURATION_MS);
  };

  button.addEventListener("click", handleCopy);
  control.cleanup = () => {
    window.clearTimeout(control.resetTimer);
    button.removeEventListener("click", handleCopy);
  };
  return control;
}

function watchCodeBlockOverflow(shell, pre, codeBlock) {
  let animationFrame = 0;
  const update = () => {
    animationFrame = 0;
    const scrollable = pre.scrollWidth > pre.clientWidth + 1;
    shell.toggleAttribute("data-scrollable", scrollable);
  };
  const schedule = () => {
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
    animationFrame = window.requestAnimationFrame(update);
  };

  schedule();
  const resizeObserver =
    typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
  resizeObserver?.observe(pre);
  resizeObserver?.observe(codeBlock);
  window.addEventListener("resize", schedule, { passive: true });

  return () => {
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
    resizeObserver?.disconnect();
    window.removeEventListener("resize", schedule);
  };
}

function removeDisconnectedControls() {
  mountedControls.forEach((mounted, button) => {
    if (button.isConnected) return;
    mounted.copyControl.cleanup?.();
    mounted.overflowCleanup?.();
    mountedControls.delete(button);
  });
}

function enhanceCodeBlock(codeBlock) {
  const pre = codeBlock.parentElement;
  if (!pre || pre.dataset.styled === "1" || !pre.parentNode) return;

  pre.dataset.styled = "1";
  pre.removeAttribute("tabindex");
  pre.style.removeProperty("overflow-x");

  const shell = document.createElement("div");
  shell.className = "code-shell";
  if (codeBlock.querySelectorAll(":scope > .line").length === 1) {
    shell.dataset.singleLine = "true";
  }
  pre.parentNode.insertBefore(shell, pre);
  shell.appendChild(pre);

  const actions = document.createElement("div");
  const copyControl = createCopyControl(codeBlock);
  actions.className = "code-actions";
  actions.append(copyControl.button, copyControl.status);
  shell.appendChild(actions);

  mountedControls.set(copyControl.button, {
    copyControl,
    overflowCleanup: watchCodeBlockOverflow(shell, pre, codeBlock),
  });
}

function observeCurrentProse() {
  const prose = document.querySelector(".site-prose");
  if (prose === observedProse && prose?.isConnected) return;

  mutationObserver?.disconnect();
  observedProse = prose;
  if (!prose) return;

  mutationObserver = new MutationObserver(() => scheduleCodeBlockEnhancement());
  mutationObserver.observe(prose, { childList: true, subtree: true });
}

function scheduleCodeBlockEnhancement() {
  if (enhanceFrame) return;
  enhanceFrame = window.requestAnimationFrame(() => {
    enhanceFrame = 0;
    initCodeBlockEnhancer();
  });
}

function initCodeBlockEnhancer(root = document) {
  if (typeof document === "undefined" || !root?.querySelectorAll) return;
  removeDisconnectedControls();
  matchingCodeBlocks(root).forEach(enhanceCodeBlock);
  observeCurrentProse();
}

function installCodeBlockEnhancer() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const enhance = () => initCodeBlockEnhancer();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enhance, { once: true });
  } else {
    enhance();
  }
  window.addEventListener("astro:page-load", enhance);
}

installCodeBlockEnhancer();
