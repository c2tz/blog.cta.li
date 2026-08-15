const MATERIAL_MENU_SELECTION_KEYS = new Set(["Enter", "Space"]);
const materialSelectStateOwners = new WeakSet();
const materialSelectIndicatorOwners = new WeakSet();

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
  owner.addEventListener("closed", onClosed);
}

/**
 * Mirrors Material Web's internal selected state onto the option host so the
 * shared trailing check can be styled without replacing the native select.
 *
 * @param {HTMLElement} owner
 */
function bindMaterialSelectIndicator(owner) {
  if (!owner.matches("md-filled-select, md-outlined-select")) return;

  let syncFrame = 0;
  const sync = () => {
    if (syncFrame) window.cancelAnimationFrame(syncFrame);
    syncFrame = window.requestAnimationFrame(() => {
      syncFrame = 0;
      const selectedValue = String(owner.value ?? owner.getAttribute("value") ?? "");
      owner.querySelectorAll("md-select-option").forEach((option) => {
        const optionValue = String(option.value ?? option.getAttribute("value") ?? "");
        const selected = optionValue === selectedValue;
        option.toggleAttribute("data-selected-option", selected);
      });
    });
  };

  owner.addEventListener("opened", sync);
  owner.addEventListener("input", sync);
  owner.addEventListener("change", sync);
  sync();
}

/**
 * Enhances every Material menu/select present in a document or Astro page.
 *
 * @param {ParentNode} [root]
 */
export function initMaterialMenuEnhancements(root = document) {
  root.querySelectorAll("md-menu, md-filled-select, md-outlined-select").forEach((owner) => {
    if (!(owner instanceof HTMLElement)) return;
    if (!materialSelectStateOwners.has(owner)) {
      materialSelectStateOwners.add(owner);
      bindMaterialSelectState(owner);
    }
    if (!materialSelectIndicatorOwners.has(owner)) {
      materialSelectIndicatorOwners.add(owner);
      bindMaterialSelectIndicator(owner);
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

/**
 * Gives an external trigger the same open, close and keyboard lifecycle used by
 * the theme menu. Positioning remains entirely owned by the official md-menu.
 *
 * @param {HTMLElement & { focus(options?: FocusOptions): void }} trigger
 * @param {HTMLElement & {
 *   open: boolean;
 *   defaultFocus: "first-item" | "last-item";
 *   close(): void;
 *   show(): void;
 *   activateNextItem(): HTMLElement | null;
 *   activatePreviousItem(): HTMLElement | null;
 * }} menu
 */
export function bindMaterialMenuTrigger(trigger, menu) {
  let menuReady = false;
  let menuClosing = false;
  let pendingOpen = null;
  let queuedNavigation = 0;

  const moveActiveItem = (direction) => {
    if (direction === 1) menu.activateNextItem();
    else menu.activatePreviousItem();
  };
  const flushQueuedNavigation = () => {
    while (queuedNavigation > 0) {
      moveActiveItem(1);
      queuedNavigation -= 1;
    }
    while (queuedNavigation < 0) {
      moveActiveItem(-1);
      queuedNavigation += 1;
    }
  };
  const openMenu = (defaultFocus) => {
    if (menuClosing) {
      pendingOpen = defaultFocus;
      return;
    }
    pendingOpen = null;
    menuReady = false;
    queuedNavigation = 0;
    menu.defaultFocus = defaultFocus;
    menu.show();
  };

  trigger.addEventListener("click", () => {
    if (menu.open) {
      pendingOpen = null;
      menu.close();
    } else {
      openMenu("first-item");
    }
  });
  trigger.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const target = event.key === "ArrowUp" ? "last-item" : "first-item";
    if (menu.open) {
      const direction = target === "first-item" ? 1 : -1;
      if (menuReady) moveActiveItem(direction);
      else queuedNavigation += direction;
    } else {
      openMenu(target);
    }
  });
  menu.addEventListener("opening", () => {
    menuClosing = false;
    menuReady = false;
    trigger.setAttribute("aria-expanded", "true");
  });
  menu.addEventListener("opened", () => {
    menuReady = true;
    trigger.setAttribute("aria-expanded", "true");
    flushQueuedNavigation();
  });
  menu.addEventListener("closing", () => {
    menuClosing = true;
    menuReady = false;
    queuedNavigation = 0;
    trigger.setAttribute("aria-expanded", "false");
  });
  menu.addEventListener("closed", () => {
    const reopenDefaultFocus = pendingOpen;
    pendingOpen = null;
    menuClosing = false;
    menuReady = false;
    queuedNavigation = 0;
    trigger.setAttribute("aria-expanded", "false");
    menu.defaultFocus = "first-item";
    if (!reopenDefaultFocus) return;
    window.requestAnimationFrame(() => {
      if (!menu.isConnected || menu.open || menuClosing) return;
      openMenu(reopenDefaultFocus);
    });
  });
}

/**
 * Keeps a top-layer popover pinned to an anchor inside a fixed dialog. Material
 * Web positions popovers in document coordinates, while dialog anchors use
 * viewport coordinates. Comparing their rendered rectangles every frame keeps
 * them aligned during page scroll, dialog scroll and Safari pinch zoom without
 * calling `reposition()`, which temporarily hides the menu while measuring it.
 *
 * @param {HTMLElement & {
 *   anchorElement: HTMLElement | null;
 *   open: boolean;
 * }} menu
 */
export function bindMaterialMenuAnchorTracking(menu) {
  let trackingFrame = 0;
  let translateX = 0;
  let translateY = 0;
  const pinToAnchor = () => {
    trackingFrame = 0;
    if (!menu.open) return;

    const surface = menu.shadowRoot?.querySelector(".menu");
    const anchor = menu.anchorElement;
    if (!(surface instanceof HTMLElement) || !(anchor instanceof HTMLElement)) {
      trackingFrame = window.requestAnimationFrame(pinToAnchor);
      return;
    }

    // The official controller may constrain the surface to the layout viewport.
    // This menu has only three options, so keep its natural height and choose
    // the roomier side of the visual viewport instead of introducing scrolling.
    surface.style.removeProperty("height");
    const surfaceRect = surface.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    if (surfaceRect.width > 0 && surfaceRect.height > 0) {
      const visualViewport = window.visualViewport;
      const viewportTop = visualViewport
        ? Number.isFinite(visualViewport.pageTop)
          ? visualViewport.pageTop - window.scrollY
          : visualViewport.offsetTop
        : 0;
      const viewportBottom = viewportTop + (visualViewport?.height ?? window.innerHeight);
      const spaceAbove = anchorRect.top - viewportTop;
      const spaceBelow = viewportBottom - anchorRect.bottom;
      const placeAbove = surfaceRect.height > spaceBelow && spaceAbove > spaceBelow;
      const targetTop = placeAbove ? anchorRect.top - surfaceRect.height : anchorRect.bottom;
      const deltaX = anchorRect.right - surfaceRect.right;
      const deltaY = targetTop - surfaceRect.top;
      if (Math.abs(deltaX) > 0.25 || Math.abs(deltaY) > 0.25) {
        translateX += deltaX;
        translateY += deltaY;
        surface.style.translate = `${translateX}px ${translateY}px`;
      }
    }

    trackingFrame = window.requestAnimationFrame(pinToAnchor);
  };
  const start = () => {
    if (trackingFrame) return;
    translateX = 0;
    translateY = 0;
    const surface = menu.shadowRoot?.querySelector(".menu");
    if (surface instanceof HTMLElement) surface.style.removeProperty("translate");
    trackingFrame = window.requestAnimationFrame(pinToAnchor);
  };
  const stop = () => {
    window.cancelAnimationFrame(trackingFrame);
    trackingFrame = 0;
    translateX = 0;
    translateY = 0;
    const surface = menu.shadowRoot?.querySelector(".menu");
    if (surface instanceof HTMLElement) surface.style.removeProperty("translate");
  };

  menu.addEventListener("opening", start);
  menu.addEventListener("closing", stop);
  menu.addEventListener("closed", stop);
  document.addEventListener("astro:before-swap", stop, { once: true });
}
