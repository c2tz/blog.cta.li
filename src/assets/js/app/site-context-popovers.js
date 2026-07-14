import { SITE_EVENTS } from "@/lib/site-contracts";
import { positionFloatingSurface, trackFloatingSurface } from "./site-floating-surface.js";

const TRIGGER_SELECTOR = "[data-context-popover-trigger]";
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");
const HOVER_OPEN_DELAY_MS = 180;
const HOVER_CLOSE_DELAY_MS = 180;

let controller;

function triggerFrom(target) {
  if (!(target instanceof Element)) return null;
  const trigger = target.closest(TRIGGER_SELECTOR);
  return trigger instanceof HTMLElement ? trigger : null;
}

function surfaceFor(trigger) {
  const id = trigger.dataset.contextPopoverTrigger;
  const surface = id ? document.getElementById(id) : null;
  return surface instanceof HTMLDialogElement ? surface : null;
}

function popoverIsOpen(surface) {
  try {
    return surface.matches(":popover-open") || surface.open;
  } catch {
    return surface.open;
  }
}

function stripCloneIds(root) {
  root.removeAttribute?.("id");
  root.querySelectorAll?.("[id]").forEach((element) => element.removeAttribute("id"));
  root
    .querySelectorAll?.("[data-footnote-backref], .data-footnote-backref")
    .forEach((element) => element.remove());
}

function enhanceFootnotePreviews() {
  const pageKey = location.pathname;
  const footnoteSources = new Map();
  document
    .querySelectorAll("[data-generated-footnote-popover]")
    .forEach((surface) => surface.getAttribute("data-page-key") === pageKey || surface.remove());

  document
    .querySelectorAll(".site-prose a[href^='#user-content-fn-']:not([data-footnote-backref])")
    .forEach((reference, index) => {
      if (!(reference instanceof HTMLElement)) return;
      const existingId = reference.dataset.contextPopoverTrigger;

      const hash = reference.getAttribute("href");
      if (!hash) return;
      let targetId;
      try {
        targetId = decodeURIComponent(hash.slice(1));
      } catch {
        return;
      }
      const note = document.getElementById(targetId);
      if (!note) return;

      const source = note.closest(".footnotes");
      const sourceState =
        source instanceof HTMLElement
          ? (footnoteSources.get(source) ?? { enhanced: 0, references: 0 })
          : null;
      if (sourceState) {
        sourceState.references += 1;
        footnoteSources.set(source, sourceState);
      }

      const suffix = targetId.replace(/[^a-z0-9_-]+/gi, "-");
      const id = `site-footnote-popover-${suffix}-${index + 1}`;
      const titleId = `${id}-title`;
      const label = reference.textContent?.trim() || String(index + 1);
      const dialog = document.createElement("dialog");
      const title = document.createElement("h2");
      const content = document.createElement("div");

      if (existingId && document.getElementById(existingId)) {
        if (sourceState) sourceState.enhanced += 1;
        return;
      }

      const clone = note.cloneNode(true);

      if (!(clone instanceof HTMLElement)) return;
      stripCloneIds(clone);
      title.id = titleId;
      title.textContent = `Note ${label}`;
      title.className = "site-context-popover-title";
      content.className = "site-context-popover-content";
      while (clone.firstChild) content.append(clone.firstChild);

      dialog.id = id;
      dialog.className = "site-context-popover site-footnote-popover";
      dialog.setAttribute("popover", "auto");
      dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "false");
      dialog.setAttribute("aria-labelledby", titleId);
      dialog.setAttribute("data-generated-footnote-popover", "");
      dialog.setAttribute("data-no-image-dialog", "");
      dialog.setAttribute("data-site-context-popover", "");
      dialog.setAttribute("data-page-key", pageKey);
      dialog.append(title, content);
      document.body.append(dialog);

      reference.dataset.contextPopoverTrigger = id;
      reference.setAttribute("data-site-context-trigger", "");
      reference.setAttribute("aria-controls", id);
      reference.setAttribute("aria-haspopup", "dialog");
      reference.setAttribute("aria-expanded", "false");
      reference.setAttribute("aria-label", `Afficher la note ${label}`);
      reference.removeAttribute("data-tooltip");
      reference.removeAttribute("title");
      reference.classList.remove("site-tooltip");
      reference.classList.add("site-context-popover-trigger", "footnote-ref-tooltip");
      if (sourceState) sourceState.enhanced += 1;
    });

  footnoteSources.forEach(({ enhanced, references }, source) => {
    if (references && enhanced === references) source.dataset.footnotesEnhanced = "true";
  });
}

class SiteContextPopoverController {
  constructor() {
    this.abortController = new AbortController();
    this.active = null;
    this.openTimer = 0;
    this.closeTimer = 0;
    this.focusRestoreTimer = 0;
    this.suppressedFocusTarget = null;
    this.bindEvents();
  }

  bindEvents() {
    const capture = { capture: true, signal: this.abortController.signal };
    const options = { signal: this.abortController.signal };

    document.addEventListener("pointerover", this.handlePointerOver, capture);
    document.addEventListener("pointerout", this.handlePointerOut, capture);
    document.addEventListener("focusin", this.handleFocusIn, capture);
    document.addEventListener("focusout", this.handleFocusOut, capture);
    document.addEventListener("click", this.handleClick, capture);
    document.addEventListener("keydown", this.handleKeydown, capture);
    document.addEventListener("pointerdown", this.handleOutsidePointerDown, capture);
    document.addEventListener("astro:before-swap", this.handleBeforeSwap, options);
    document.addEventListener(SITE_EVENTS.tooltipHide, this.handleHideRequest, options);
  }

  enhance() {
    enhanceFootnotePreviews();
    if (this.active && (!this.active.trigger.isConnected || !this.active.surface.isConnected)) {
      this.close();
    }
    document.querySelectorAll(TRIGGER_SELECTOR).forEach((candidate) => {
      if (!(candidate instanceof HTMLElement)) return;
      const surface = surfaceFor(candidate);
      if (!surface) return;

      candidate.classList.add("site-context-popover-trigger");
      candidate.setAttribute("aria-controls", surface.id);
      candidate.setAttribute("aria-haspopup", "dialog");
      candidate.setAttribute("aria-expanded", String(popoverIsOpen(surface)));
      candidate.removeAttribute("data-tooltip");
      candidate.removeAttribute("title");
      candidate.classList.remove("site-tooltip");
      surface.querySelectorAll("img:not([loading])").forEach((image) => {
        image.setAttribute("loading", "lazy");
      });
      if (surface.dataset.contextPopoverEnhanced === "true") return;

      surface.dataset.contextPopoverEnhanced = "true";
      surface.addEventListener("toggle", this.handleSurfaceToggle, {
        signal: this.abortController.signal,
      });
    });
  }

  handlePointerOver = (event) => {
    if (event.pointerType === "touch" || event.pointerType === "pen") return;
    const trigger = triggerFrom(event.target);
    if (trigger) {
      if (event.relatedTarget instanceof Node && trigger.contains(event.relatedTarget)) return;
      this.scheduleOpen(trigger);
      return;
    }

    if (this.active?.surface.contains(event.target)) this.clearCloseTimer();
  };

  handlePointerOut = (event) => {
    if (event.pointerType === "touch" || event.pointerType === "pen") return;
    const trigger = triggerFrom(event.target);
    if (trigger && event.relatedTarget instanceof Node && trigger.contains(event.relatedTarget)) {
      return;
    }
    if (this.active?.pinned) return;
    if (this.containsActiveNode(event.relatedTarget)) return;
    this.scheduleClose();
  };

  handleFocusIn = (event) => {
    const trigger = triggerFrom(event.target);
    if (trigger) {
      if (trigger === this.suppressedFocusTarget) return;
      this.open(trigger, { pinned: false });
      return;
    }
    if (this.active?.surface.contains(event.target)) this.clearCloseTimer();
  };

  handleFocusOut = (event) => {
    if (this.active?.pinned || this.containsActiveNode(event.relatedTarget)) return;
    this.scheduleClose();
  };

  handleClick = (event) => {
    const trigger = triggerFrom(event.target);
    if (!trigger) return;
    const surface = surfaceFor(trigger);
    if (!surface) return;

    event.preventDefault();
    event.stopPropagation();
    const wasPinned = this.active?.trigger === trigger && this.active.pinned;
    if (wasPinned) {
      this.close({ restoreFocus: true });
      return;
    }

    this.open(trigger, { pinned: true });
    if (event.detail === 0) requestAnimationFrame(() => this.focusSurface(surface));
  };

  handleKeydown = (event) => {
    if (event.key === "Escape" && this.active) {
      event.preventDefault();
      event.stopPropagation();
      this.close({ restoreFocus: true });
      return;
    }

    if (event.key !== " ") return;
    const trigger = triggerFrom(event.target);
    if (!trigger || trigger.matches("button, input")) return;
    event.preventDefault();
    this.open(trigger, { pinned: true });
    requestAnimationFrame(() => {
      const surface = surfaceFor(trigger);
      if (surface) this.focusSurface(surface);
    });
  };

  handleOutsidePointerDown = (event) => {
    if (!this.active || this.containsActiveNode(event.target)) return;
    this.close();
  };

  handleSurfaceToggle = (event) => {
    const surface = event.currentTarget;
    if (!(surface instanceof HTMLDialogElement) || popoverIsOpen(surface)) return;
    if (this.active?.surface !== surface) return;
    const { trigger } = this.active;
    this.finishClose();
    trigger.setAttribute("aria-expanded", "false");
  };

  handleHideRequest = (event) => {
    if (!event.detail?.simpleOnly) this.close();
  };
  handleBeforeSwap = () => this.close();

  scheduleOpen(trigger) {
    this.clearOpenTimer();
    this.clearCloseTimer();
    this.openTimer = window.setTimeout(() => {
      this.openTimer = 0;
      this.open(trigger, { pinned: false });
    }, HOVER_OPEN_DELAY_MS);
  }

  open(trigger, { pinned }) {
    const surface = surfaceFor(trigger);
    if (!surface) return;
    this.clearTimers();
    const activeBeforeOpen = document.activeElement;

    if (this.active?.trigger === trigger && popoverIsOpen(surface)) {
      this.active.pinned ||= pinned;
      trigger.setAttribute("aria-expanded", "true");
      return;
    }

    this.close();
    document.dispatchEvent(
      new CustomEvent(SITE_EVENTS.tooltipHide, { detail: { simpleOnly: true } }),
    );

    try {
      surface.showPopover();
    } catch {
      try {
        surface.show();
      } catch {
        return;
      }
    }

    const shouldRestorePreviewFocus = !pinned && surface.contains(document.activeElement);

    trigger.setAttribute("aria-expanded", "true");
    surface.dataset.openReason = pinned ? "pinned" : "preview";
    this.active = {
      pinned,
      surface,
      stopTracking: trackFloatingSurface(surface, trigger, {
        gap: 12,
        placement: trigger.dataset.contextPopoverPlacement || "top",
      }),
      trigger,
    };
    positionFloatingSurface(surface, trigger, {
      gap: 12,
      placement: trigger.dataset.contextPopoverPlacement || "top",
    });

    if (shouldRestorePreviewFocus) {
      queueMicrotask(() => {
        if (this.active?.surface !== surface || this.active.pinned) return;
        if (
          activeBeforeOpen instanceof HTMLElement &&
          activeBeforeOpen !== document.body &&
          activeBeforeOpen.isConnected
        ) {
          activeBeforeOpen.focus({ preventScroll: true });
        } else if (surface.contains(document.activeElement)) {
          document.activeElement.blur();
        }
      });
    }
  }

  close({ restoreFocus = false } = {}) {
    this.clearTimers();
    if (!this.active) return;
    const { surface, trigger } = this.active;
    const shouldRestoreFocus = restoreFocus && trigger.isConnected;
    if (shouldRestoreFocus) this.suppressFocusOpen(trigger);

    try {
      if (surface.matches(":popover-open")) surface.hidePopover();
      else if (surface.open) surface.close();
    } catch {
      if (surface.open) surface.close();
    }
    trigger.setAttribute("aria-expanded", "false");
    this.finishClose();
    if (shouldRestoreFocus) requestAnimationFrame(() => trigger.focus({ preventScroll: true }));
  }

  finishClose() {
    if (!this.active) return;
    this.active.stopTracking?.();
    delete this.active.surface.dataset.openReason;
    this.active = null;
  }

  focusSurface(surface) {
    const focusable = surface.querySelector(FOCUSABLE_SELECTOR);
    if (focusable instanceof HTMLElement) {
      focusable.focus({ preventScroll: true });
      return;
    }
    surface.setAttribute("tabindex", "-1");
    surface.focus({ preventScroll: true });
  }

  containsActiveNode(node) {
    if (!(node instanceof Node) || !this.active) return false;
    return this.active.trigger.contains(node) || this.active.surface.contains(node);
  }

  scheduleClose() {
    this.clearOpenTimer();
    this.clearCloseTimer();
    this.closeTimer = window.setTimeout(() => {
      this.closeTimer = 0;
      if (!this.active?.pinned && !this.shouldKeepPreviewOpen()) this.close();
    }, HOVER_CLOSE_DELAY_MS);
  }

  shouldKeepPreviewOpen() {
    if (!this.active) return false;
    return (
      this.active.trigger.matches(":hover, :focus, :focus-within") ||
      this.active.surface.matches(":hover, :focus-within")
    );
  }

  clearOpenTimer() {
    if (this.openTimer) window.clearTimeout(this.openTimer);
    this.openTimer = 0;
  }

  clearCloseTimer() {
    if (this.closeTimer) window.clearTimeout(this.closeTimer);
    this.closeTimer = 0;
  }

  clearTimers() {
    this.clearOpenTimer();
    this.clearCloseTimer();
  }

  suppressFocusOpen(trigger) {
    if (this.focusRestoreTimer) window.clearTimeout(this.focusRestoreTimer);
    this.suppressedFocusTarget = trigger;
    this.focusRestoreTimer = window.setTimeout(() => {
      this.focusRestoreTimer = 0;
      this.suppressedFocusTarget = null;
    }, 160);
  }
}

export function initSiteContextPopovers() {
  controller ??= new SiteContextPopoverController();
  controller.enhance();
}
