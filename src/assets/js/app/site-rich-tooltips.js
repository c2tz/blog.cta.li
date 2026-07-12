import { SITE_EVENTS } from "@/lib/site-contracts";
import { positionFloatingSurface, trackFloatingSurface } from "./site-floating-surface.js";

const TRIGGER_SELECTOR = "[data-rich-tooltip-trigger]";
const HOVER_OPEN_DELAY_MS = 180;
const HOVER_CLOSE_DELAY_MS = 100;
const TOUCH_HIDE_DELAY_MS = 3000;
const TOUCH_FOCUS_GUARD_MS = 500;

let controller;

function triggerFrom(target) {
  if (!(target instanceof Element)) return null;
  const trigger = target.closest(TRIGGER_SELECTOR);
  return trigger instanceof HTMLElement ? trigger : null;
}

function richTooltipSurfaceFrom(target) {
  if (!(target instanceof Element)) return null;
  const surface = target.closest("[data-site-rich-tooltip]");
  return surface instanceof HTMLElement ? surface : null;
}

function surfaceFor(trigger) {
  const id = trigger.dataset.richTooltipTrigger;
  const surface = id ? document.getElementById(id) : null;
  return surface instanceof HTMLElement && surface.hasAttribute("data-site-rich-tooltip")
    ? surface
    : null;
}

function popoverIsOpen(surface) {
  try {
    return surface.matches(":popover-open");
  } catch {
    return surface.dataset.open === "true";
  }
}

function describedByWith(element, id, add) {
  const tokens = new Set(
    (element.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean),
  );
  if (add) tokens.add(id);
  else tokens.delete(id);
  if (tokens.size > 0) element.setAttribute("aria-describedby", [...tokens].join(" "));
  else element.removeAttribute("aria-describedby");
}

class SiteRichTooltipController {
  constructor() {
    this.abortController = new AbortController();
    this.active = null;
    this.openTimer = 0;
    this.closeTimer = 0;
    this.touchTimer = 0;
    this.touchFocusGuardTimer = 0;
    this.pendingTouchFocusTarget = null;
    this.bindEvents();
  }

  bindEvents() {
    const capture = { capture: true, signal: this.abortController.signal };
    const options = { signal: this.abortController.signal };

    document.addEventListener("pointerover", this.handlePointerOver, capture);
    document.addEventListener("pointerout", this.handlePointerOut, capture);
    document.addEventListener("pointerdown", this.handlePointerDown, capture);
    document.addEventListener("focusin", this.handleFocusIn, capture);
    document.addEventListener("focusout", this.handleFocusOut, capture);
    document.addEventListener("keydown", this.handleKeydown, capture);
    document.addEventListener("astro:before-swap", this.handleBeforeSwap, options);
    document.addEventListener(SITE_EVENTS.tooltipHide, this.handleHideRequest, options);
  }

  enhance() {
    if (this.active && (!this.active.trigger.isConnected || !this.active.surface.isConnected)) {
      this.close();
    }

    document.querySelectorAll(TRIGGER_SELECTOR).forEach((candidate) => {
      if (!(candidate instanceof HTMLElement)) return;
      const surface = surfaceFor(candidate);
      if (!surface) return;

      candidate.classList.add("site-rich-tooltip-trigger");
      candidate.setAttribute("aria-controls", surface.id);
      candidate.setAttribute("aria-expanded", String(popoverIsOpen(surface)));
      candidate.removeAttribute("data-tooltip");
      candidate.removeAttribute("title");
      candidate.classList.remove("site-tooltip", "site-context-popover-trigger");
      if (candidate.localName === "button" && !candidate.querySelector(":scope > md-ripple")) {
        const ripple = document.createElement("md-ripple");
        ripple.setAttribute("aria-hidden", "true");
        candidate.prepend(ripple);
      }
      surface.querySelectorAll("img:not([loading])").forEach((image) => {
        image.setAttribute("loading", "lazy");
      });
      if (surface.dataset.richTooltipEnhanced === "true") return;

      surface.dataset.richTooltipEnhanced = "true";
      surface.addEventListener("toggle", this.handleSurfaceToggle, {
        signal: this.abortController.signal,
      });
    });
  }

  handlePointerOver = (event) => {
    if (event.pointerType === "touch" || event.pointerType === "pen") return;
    const surface = richTooltipSurfaceFrom(event.target);
    if (surface && surface === this.active?.surface) {
      this.clearCloseTimer();
      return;
    }
    const trigger = triggerFrom(event.target);
    if (!trigger) return;
    if (event.relatedTarget instanceof Node && trigger.contains(event.relatedTarget)) return;
    this.scheduleOpen(trigger);
  };

  handlePointerOut = (event) => {
    if (event.pointerType === "touch" || event.pointerType === "pen") return;
    const surface = richTooltipSurfaceFrom(event.target);
    if (surface) {
      if (event.relatedTarget instanceof Node && surface.contains(event.relatedTarget)) return;
      if (
        event.relatedTarget instanceof Node &&
        this.active?.trigger.contains(event.relatedTarget)
      ) {
        this.clearCloseTimer();
        return;
      }
      this.scheduleClose();
      return;
    }
    const trigger = triggerFrom(event.target);
    if (!trigger) return;
    if (event.relatedTarget instanceof Node && trigger.contains(event.relatedTarget)) return;
    if (event.relatedTarget instanceof Node && this.active?.surface.contains(event.relatedTarget)) {
      this.clearCloseTimer();
      return;
    }
    this.scheduleClose();
  };

  handlePointerDown = (event) => {
    if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
    if (richTooltipSurfaceFrom(event.target) === this.active?.surface) {
      if (this.touchTimer) window.clearTimeout(this.touchTimer);
      this.touchTimer = 0;
      return;
    }
    const trigger = triggerFrom(event.target);
    if (!trigger) {
      this.pendingTouchFocusTarget = null;
      this.close();
      return;
    }
    this.pendingTouchFocusTarget = trigger;
    if (this.touchFocusGuardTimer) window.clearTimeout(this.touchFocusGuardTimer);
    this.touchFocusGuardTimer = window.setTimeout(() => {
      this.touchFocusGuardTimer = 0;
      this.pendingTouchFocusTarget = null;
    }, TOUCH_FOCUS_GUARD_MS);
    this.open(trigger);
    if (this.touchTimer) window.clearTimeout(this.touchTimer);
    this.touchTimer = window.setTimeout(() => {
      this.touchTimer = 0;
      if (!trigger.matches(":focus, :focus-within")) this.close();
    }, TOUCH_HIDE_DELAY_MS);
  };

  handleFocusIn = (event) => {
    const trigger = triggerFrom(event.target);
    if (trigger && trigger === this.pendingTouchFocusTarget) {
      this.pendingTouchFocusTarget = null;
      if (this.touchFocusGuardTimer) window.clearTimeout(this.touchFocusGuardTimer);
      this.touchFocusGuardTimer = 0;
      return;
    }
    if (trigger) this.open(trigger);
  };

  handleFocusOut = (event) => {
    const trigger = triggerFrom(event.target);
    if (!trigger) return;
    if (event.relatedTarget instanceof Node && trigger.contains(event.relatedTarget)) return;
    this.scheduleClose();
  };

  handleKeydown = (event) => {
    if (event.key === "Escape") this.close();
  };

  handleSurfaceToggle = (event) => {
    const surface = event.currentTarget;
    if (!(surface instanceof HTMLElement) || popoverIsOpen(surface)) return;
    if (this.active?.surface !== surface) return;
    this.finishClose();
  };

  handleHideRequest = () => this.close();
  handleBeforeSwap = () => this.close();

  scheduleOpen(trigger) {
    this.clearOpenTimer();
    this.clearCloseTimer();
    this.openTimer = window.setTimeout(() => {
      this.openTimer = 0;
      this.open(trigger);
    }, HOVER_OPEN_DELAY_MS);
  }

  scheduleClose() {
    this.clearOpenTimer();
    this.clearCloseTimer();
    this.closeTimer = window.setTimeout(() => {
      this.closeTimer = 0;
      if (
        !this.active?.trigger.matches(":hover, :focus, :focus-within") &&
        !this.active?.surface.matches(":hover")
      ) {
        this.close();
      }
    }, HOVER_CLOSE_DELAY_MS);
  }

  open(trigger) {
    const surface = surfaceFor(trigger);
    if (!surface) return;
    this.clearTimers();

    if (this.active?.trigger === trigger && popoverIsOpen(surface)) return;
    this.close();
    document.dispatchEvent(
      new CustomEvent(SITE_EVENTS.tooltipHide, { detail: { simpleOnly: true } }),
    );

    surface.style.visibility = "hidden";
    try {
      surface.showPopover();
    } catch {
      surface.dataset.open = "true";
    }

    trigger.setAttribute("aria-expanded", "true");
    describedByWith(trigger, surface.id, true);
    this.active = {
      surface,
      stopTracking: trackFloatingSurface(surface, trigger, {
        gap: 12,
        placement: trigger.dataset.richTooltipPlacement || "top",
      }),
      trigger,
    };
    void positionFloatingSurface(surface, trigger, {
      gap: 12,
      placement: trigger.dataset.richTooltipPlacement || "top",
    });
  }

  close() {
    this.clearTimers();
    if (!this.active) return;
    const { surface, trigger } = this.active;

    try {
      if (popoverIsOpen(surface)) surface.hidePopover();
    } catch {
      delete surface.dataset.open;
    }
    trigger.setAttribute("aria-expanded", "false");
    describedByWith(trigger, surface.id, false);
    this.finishClose();
  }

  finishClose() {
    if (!this.active) return;
    this.active.stopTracking?.();
    this.active.surface.style.removeProperty("visibility");
    this.active.surface.removeAttribute("data-reference-hidden");
    this.active = null;
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
    if (this.touchTimer) window.clearTimeout(this.touchTimer);
    this.touchTimer = 0;
  }
}

export function initSiteRichTooltips() {
  controller ??= new SiteRichTooltipController();
  controller.enhance();
}
