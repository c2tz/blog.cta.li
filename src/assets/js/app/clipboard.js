function restoreSelection(selection, selectedRange) {
  if (!selection || !selectedRange) return;

  try {
    selection.removeAllRanges();
    selection.addRange(selectedRange);
  } catch {
    selection.removeAllRanges();
  }
}

function copyLegacySelection() {
  try {
    /** @type {{ execCommand(command: string): boolean }} */
    const legacyDocument = document;
    return legacyDocument.execCommand("copy");
  } catch {
    return false;
  }
}

function copySelectedElement(source, selection) {
  const range = document.createRange();
  range.selectNodeContents(source);
  selection?.removeAllRanges();
  selection?.addRange(range);
  return copyLegacySelection();
}

/**
 * Copies text with the async Clipboard API first, preserving a selection while
 * using the legacy selection fallback for browsers that do not expose it.
 *
 * @param {string} text
 * @param {{ fallbackClassName?: string; fallbackSelectionSource?: Node }} [options]
 * @returns {Promise<boolean>}
 */
export async function copyTextToClipboard(
  text,
  { fallbackClassName, fallbackSelectionSource } = {},
) {
  try {
    if (!window.isSecureContext || !navigator.clipboard?.writeText) {
      throw new Error("Clipboard API unavailable");
    }
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    const selection = document.getSelection();
    const selectedRange = selection?.rangeCount ? selection.getRangeAt(0) : null;

    textarea.value = text;
    textarea.setAttribute("readonly", "");
    if (fallbackClassName) {
      textarea.className = fallbackClassName;
    } else {
      textarea.style.position = "fixed";
      textarea.style.inset = "0 auto auto 0";
      textarea.style.width = "1px";
      textarea.style.height = "1px";
      textarea.style.opacity = "0";
    }
    document.body.append(textarea);
    textarea.focus({ preventScroll: true });
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    try {
      return (
        copyLegacySelection() ||
        (fallbackSelectionSource ? copySelectedElement(fallbackSelectionSource, selection) : false)
      );
    } finally {
      textarea.remove();
      restoreSelection(selection, selectedRange);
    }
  }
}
