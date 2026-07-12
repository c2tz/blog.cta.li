const MATERIAL_MENU_SELECTION_KEYS = new Set(["Enter", "Space"]);
const MATERIAL_MENU_NAVIGATION_KEYS = new Set(["ArrowDown", "ArrowUp", "End", "Home"]);
const materialMenuFocusOwners = new WeakSet();
const materialSelectReopenOwners = new WeakSet();
const MATERIAL_SELECT_OPEN_KEYS = new Set([
  "ArrowDown",
  "ArrowUp",
  "End",
  "Enter",
  "Home",
  " ",
  "Space",
  "Spacebar",
]);

function isCoarseTouchPointer() {
  return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
}

/**
 * Keeps the primary focus contour contextual: once on open, then while the
 * keyboard moves between items. Pointer selection clears the forced contour;
 * Material Web still owns the actual focus and arrow-key navigation.
 *
 * @param {HTMLElement} owner
 * @param {AddEventListenerOptions} [options]
 * @returns {() => void}
 */
function bindMaterialMenuFocusIndicator(owner, options) {
  const itemSelector = owner.matches("md-filled-select, md-outlined-select")
    ? "md-select-option"
    : "md-menu-item";
  let focusFrame = 0;

  const items = () => Array.from(owner.querySelectorAll(itemSelector));
  const clearIndicator = () => {
    if (focusFrame) window.cancelAnimationFrame(focusFrame);
    focusFrame = 0;
    items().forEach((item) => item.removeAttribute("data-menu-focus-indicator"));
  };
  const showActiveIndicator = () => {
    clearIndicator();
    if (isCoarseTouchPointer()) return;

    focusFrame = window.requestAnimationFrame(() => {
      focusFrame = 0;
      const menuItems = items();
      const activeItem =
        menuItems.find((item) => item.matches(":focus-within")) ??
        menuItems.find((item) => item.tabIndex === 0);
      activeItem?.setAttribute("data-menu-focus-indicator", "");
    });
  };
  const handleKeydown = (event) => {
    if (MATERIAL_MENU_NAVIGATION_KEYS.has(event.key)) showActiveIndicator();
  };

  owner.addEventListener("opened", showActiveIndicator, options);
  owner.addEventListener("keydown", handleKeydown, options);
  owner.addEventListener("pointerdown", clearIndicator, options);
  owner.addEventListener("closed", clearIndicator, options);

  return () => {
    clearIndicator();
    owner.removeEventListener("opened", showActiveIndicator, options);
    owner.removeEventListener("keydown", handleKeydown, options);
    owner.removeEventListener("pointerdown", clearIndicator, options);
    owner.removeEventListener("closed", clearIndicator, options);
  };
}

/**
 * Material selects set `open` to false before their close animation completes.
 * Queue a second activation until `closed` so a quick reopen cannot be lost.
 *
 * @param {HTMLElement} owner
 */
function bindMaterialSelectReopen(owner) {
  if (!owner.matches("md-filled-select, md-outlined-select")) return;

  let closing = false;
  let pendingOpen = false;
  const queuePointerReopen = () => {
    if (closing) pendingOpen = true;
  };
  const queueKeyboardReopen = (event) => {
    if (closing && MATERIAL_SELECT_OPEN_KEYS.has(event.key)) pendingOpen = true;
  };
  const onOpening = () => {
    closing = false;
  };
  const onClosing = () => {
    closing = true;
  };
  const onClosed = () => {
    const shouldReopen = pendingOpen;
    pendingOpen = false;
    closing = false;
    if (!shouldReopen) return;

    window.requestAnimationFrame(() => {
      if (!owner.isConnected || owner.open) return;
      if (typeof owner.showPicker === "function") owner.showPicker();
      else owner.open = true;
    });
  };

  owner.addEventListener("pointerdown", queuePointerReopen, true);
  owner.addEventListener("keydown", queueKeyboardReopen, true);
  owner.addEventListener("opening", onOpening);
  owner.addEventListener("closing", onClosing);
  owner.addEventListener("closed", onClosed);

  return () => {
    owner.removeEventListener("pointerdown", queuePointerReopen, true);
    owner.removeEventListener("keydown", queueKeyboardReopen, true);
    owner.removeEventListener("opening", onOpening);
    owner.removeEventListener("closing", onClosing);
    owner.removeEventListener("closed", onClosed);
  };
}

/**
 * Enhances every Material menu/select present in a document or Astro page.
 *
 * @param {ParentNode} [root]
 */
export function initMaterialMenuFocusIndicators(root = document) {
  root.querySelectorAll("md-menu, md-filled-select, md-outlined-select").forEach((owner) => {
    if (!(owner instanceof HTMLElement) || materialMenuFocusOwners.has(owner)) return;
    materialMenuFocusOwners.add(owner);
    bindMaterialMenuFocusIndicator(owner);
    if (!materialSelectReopenOwners.has(owner)) {
      materialSelectReopenOwners.add(owner);
      bindMaterialSelectReopen(owner);
    }
  });
}

/**
 * @typedef {{
 *   initiator?: unknown;
 *   reason?: { kind?: unknown; key?: unknown };
 * }} MaterialMenuCloseDetail
 */

/**
 * Returns the action item selected through Material Web's canonical menu
 * event. Select options are deliberately excluded because md-select owns their
 * selection lifecycle.
 *
 * @param {Event} event
 * @param {HTMLElement} menu
 * @returns {HTMLElement | null}
 */
function getMaterialMenuSelectionItem(event, menu) {
  if (!(event instanceof CustomEvent)) return null;

  /** @type {MaterialMenuCloseDetail} */
  const detail = event.detail ?? {};
  const item = detail.initiator;
  const reason = detail.reason;
  if (!(item instanceof HTMLElement) || item.localName !== "md-menu-item") return null;
  if (!menu.contains(item)) return null;
  if (
    item.hasAttribute("disabled") ||
    item.getAttribute("aria-disabled") === "true" ||
    ("disabled" in item && item.disabled === true)
  ) {
    return null;
  }

  if (reason?.kind === "click-selection") return item;
  if (
    reason?.kind === "keydown" &&
    typeof reason.key === "string" &&
    MATERIAL_MENU_SELECTION_KEYS.has(reason.key)
  ) {
    return item;
  }

  return null;
}

/**
 * Binds one action dispatcher to a Material menu for pointer, Enter and Space
 * selection. Material Web already handles arrows, Escape, closing and focus.
 *
 * @param {HTMLElement} menu
 * @param {(item: HTMLElement, event: CustomEvent<MaterialMenuCloseDetail>) => void} onSelect
 * @param {AddEventListenerOptions} [options]
 * @returns {() => void}
 */
export function bindMaterialMenuSelection(menu, onSelect, options) {
  /** @param {Event} event */
  const handleCloseMenu = (event) => {
    const item = getMaterialMenuSelectionItem(event, menu);
    if (!item) return;
    onSelect(item, /** @type {CustomEvent<MaterialMenuCloseDetail>} */ (event));
  };

  menu.addEventListener("close-menu", handleCloseMenu, options);
  return () => menu.removeEventListener("close-menu", handleCloseMenu, options);
}
