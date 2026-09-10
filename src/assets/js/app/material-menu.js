import { initMaterialMotion } from "./material-motion.js";

const MATERIAL_MENU_SELECTION_KEYS = new Set(["Enter", "Space"]);
const materialSelectStateOwners = new WeakSet();

/**
 * Mirrors the select's official lifecycle solely for the decorative chevron.
 *
 * @param {HTMLElement} owner
 */
function bindMaterialSelectState(owner) {
  if (!owner.matches("md-filled-select, md-outlined-select")) return;

  const onOpening = () => {
    owner.setAttribute("data-menu-open", "");
  };
  const onClosed = () => {
    owner.removeAttribute("data-menu-open");
  };

  owner.addEventListener("opening", onOpening);
  owner.addEventListener("closing", onClosed);
  owner.addEventListener("closed", onClosed);
}

/**
 * Enhances every Material menu/select present in a document or Astro page.
 *
 * @param {ParentNode} [root]
 */
export function initMaterialMenuEnhancements(root = document) {
  initMaterialMotion(root);
  root.querySelectorAll("md-menu, md-filled-select, md-outlined-select").forEach((owner) => {
    if (!(owner instanceof HTMLElement)) return;
    if (!materialSelectStateOwners.has(owner)) {
      materialSelectStateOwners.add(owner);
      bindMaterialSelectState(owner);
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
