const KEYBOARD_MODALITY_KEYS = new Set([
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "End",
  "Enter",
  "Escape",
  "Home",
  "PageDown",
  "PageUp",
  " ",
  "Space",
  "Spacebar",
  "Tab",
]);

let installed = false;

/**
 * Exposes the active input modality to CSS so Material Web focus rings cannot
 * remain visible after pointer input. Menus own their explicit first-item
 * indicator separately.
 */
export function initFocusModality() {
  if (installed) return;
  installed = true;

  const root = document.documentElement;
  const useKeyboard = (event) => {
    if (!KEYBOARD_MODALITY_KEYS.has(event.key)) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    root.dataset.focusModality = "keyboard";
  };
  const usePointer = () => {
    root.dataset.focusModality = "pointer";
  };

  window.addEventListener("keydown", useKeyboard, true);
  window.addEventListener("pointerdown", usePointer, true);
}
