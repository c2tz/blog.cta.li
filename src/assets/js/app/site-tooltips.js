import { SITE_EVENTS } from "@/lib/site-contracts";
import { positionFloatingSurface, trackFloatingSurface } from "./site-floating-surface.js";

const TOOLTIP_SELECTOR = "[data-tooltip]:not([data-context-popover-trigger])";
const SHOW_DELAY_MS = 180;
const HIDE_DELAY_MS = 100;
const TOUCH_HIDE_DELAY_MS = 3000;
const TOUCH_FOCUS_GUARD_MS = 500;
const INITIAL_DEVICE_PIXEL_RATIO = window.devicePixelRatio || 1;

let controller;

function tooltipTarget(start) {
  if (!(start instanceof Element)) return null;
  const target = start.closest(TOOLTIP_SELECTOR);
  if (!(target instanceof HTMLElement)) return null;
  if (!target.dataset.tooltip?.trim() || target.getAttribute("aria-hidden") === "true") return null;
  return target;
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

function syncTooltipDescription(element, id, add) {
  describedByWith(element, id, add);
  const shadowControl = element.shadowRoot?.querySelector(
    "button, a[href], input, select, textarea, [role='button']",
  );
  if (shadowControl instanceof HTMLElement) describedByWith(shadowControl, id, add);
}

function popoverIsOpen(surface) {
  try {
    return surface.matches(":popover-open");
  } catch {
    return surface.dataset.open === "true";
  }
}

class SiteTooltipController {
  constructor(surface) {
    this.surface = surface;
    this.abortController = new AbortController();
    this.activeTarget = null;
    this.showTimer = 0;
    this.hideTimer = 0;
    this.touchTimer = 0;
    this.touchFocusGuardTimer = 0;
    this.pendingTouchFocusTarget = null;
    this.stopTracking = null;
    this.activeCustomMode = null;
    this.finePointer = matchMedia("(hover: hover) and (pointer: fine)");
    this.nativeZoomFallback = false;
    this.bindEvents();
    this.observeDocument();
    this.syncVisualZoomMode(true);
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
    this.surface.addEventListener("pointerenter", this.handleSurfacePointerEnter, options);
    this.surface.addEventListener("pointerleave", this.handleSurfacePointerLeave, options);
    window.addEventListener("resize", this.handleVisualViewportResize, options);
    window.visualViewport?.addEventListener("resize", this.handleVisualViewportResize, options);
  }

  observeDocument() {
    this.observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "childList") {
          record.addedNodes.forEach((node) => {
            if (node instanceof Element) this.enhance(node);
          });
          continue;
        }

        const element = record.target;
        if (!(element instanceof HTMLElement)) continue;
        if (record.attributeName === "title") this.prepareTarget(element);
        if (
          record.attributeName === "data-tooltip" &&
          this.nativeZoomFallback &&
          element !== this.activeTarget
        ) {
          const message = element.dataset.tooltip?.trim();
          if (message && element.getAttribute("title") !== message) {
            element.setAttribute("title", message);
          } else if (!message) {
            element.removeAttribute("title");
            element.classList.remove("site-tooltip");
          }
        }
        if (element === this.activeTarget) this.refreshActiveTooltip();
      }
      if (this.activeTarget && !this.activeTarget.isConnected) this.hide();
    });
    this.observer.observe(document.documentElement, {
      attributeFilter: ["data-tooltip", "title"],
      attributes: true,
      childList: true,
      subtree: true,
    });
  }

  enhance(root = document) {
    if (root instanceof HTMLElement && root.matches("[title], [data-tooltip]")) {
      this.prepareTarget(root);
    }
    root.querySelectorAll?.("[title], [data-tooltip]").forEach((element) => {
      if (element instanceof HTMLElement) this.prepareTarget(element);
    });

    const footnoteBackrefs = [];
    if (root instanceof HTMLElement && root.matches("[data-footnote-backref]")) {
      footnoteBackrefs.push(root);
    }
    root.querySelectorAll?.("[data-footnote-backref]").forEach((backref) => {
      footnoteBackrefs.push(backref);
    });

    footnoteBackrefs.forEach((backref) => {
      if (!(backref instanceof HTMLElement)) return;
      backref.setAttribute("aria-label", "Retour au contenu");
      backref.dataset.tooltip = "Retour au contenu";
      backref.classList.add("site-tooltip");

      if (backref.dataset.footnoteEnhanced === "true") return;
      backref.dataset.footnoteEnhanced = "true";
      backref.addEventListener("click", () => {
        hideSiteTooltip();
        backref.blur?.();

        const hash = backref.getAttribute("href");
        if (!hash?.startsWith("#")) return;
        requestAnimationFrame(() => {
          let id;
          try {
            id = decodeURIComponent(hash.slice(1));
          } catch {
            return;
          }
          document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      });
    });
  }

  prepareTarget(element) {
    if (element.hasAttribute("data-context-popover-trigger")) {
      element.removeAttribute("data-tooltip");
      element.classList.remove("site-tooltip");
      return;
    }

    const title = element.getAttribute("title")?.trim();
    if (title) {
      if (element.matches("abbr") && !element.hasAttribute("aria-label")) {
        const abbreviation = element.textContent?.trim();
        element.setAttribute("aria-label", abbreviation ? `${abbreviation} — ${title}` : title);
      }
      if (element.dataset.tooltip !== title) element.dataset.tooltip = title;
      element.dataset.tooltipSource = "title";
      if (!this.nativeZoomFallback) element.removeAttribute("title");
    } else if (
      this.nativeZoomFallback &&
      element !== this.activeTarget &&
      element.dataset.tooltip?.trim()
    ) {
      const message = element.dataset.tooltip.trim();
      if (element.getAttribute("title") !== message) element.setAttribute("title", message);
    }

    if (!element.dataset.tooltip?.trim()) {
      element.classList.remove("site-tooltip");
      return;
    }

    element.classList.add("site-tooltip");
  }

  handlePointerOver = (event) => {
    if (!this.finePointer.matches || event.pointerType === "touch" || event.pointerType === "pen") {
      return;
    }
    const target = tooltipTarget(event.target);
    if (!target) return;
    if (event.relatedTarget instanceof Node && target.contains(event.relatedTarget)) return;
    this.scheduleShow(target, SHOW_DELAY_MS);
  };

  handlePointerOut = (event) => {
    if (!this.finePointer.matches || event.pointerType === "touch" || event.pointerType === "pen") {
      return;
    }
    const target = tooltipTarget(event.target);
    if (!target) return;
    if (event.relatedTarget instanceof Node && target.contains(event.relatedTarget)) return;
    if (event.relatedTarget === this.surface) return;
    this.scheduleHide();
  };

  handlePointerDown = (event) => {
    if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
    const target = tooltipTarget(event.target);
    if (!target) {
      this.hide();
      return;
    }
    this.pendingTouchFocusTarget = target;
    if (this.touchFocusGuardTimer) window.clearTimeout(this.touchFocusGuardTimer);
    this.touchFocusGuardTimer = window.setTimeout(() => {
      this.touchFocusGuardTimer = 0;
      this.pendingTouchFocusTarget = null;
    }, TOUCH_FOCUS_GUARD_MS);
    if (target.dataset.tooltipTouchGestures === "off") {
      this.hide();
      return;
    }
    this.show(target, { forceCustom: true });
    this.touchTimer = window.setTimeout(() => this.hide(), TOUCH_HIDE_DELAY_MS);
  };

  handleFocusIn = (event) => {
    const target = tooltipTarget(event.target);
    if (target && target === this.pendingTouchFocusTarget) {
      this.pendingTouchFocusTarget = null;
      if (this.touchFocusGuardTimer) window.clearTimeout(this.touchFocusGuardTimer);
      this.touchFocusGuardTimer = 0;
      return;
    }
    if (target) this.scheduleShow(target, 0, { forceCustom: true });
  };

  handleFocusOut = (event) => {
    const target = tooltipTarget(event.target);
    if (!target) return;
    if (event.relatedTarget instanceof Node && target.contains(event.relatedTarget)) return;
    this.scheduleHide();
  };

  handleKeydown = (event) => {
    if (event.key === "Escape") this.hide();
  };

  handleHideRequest = (event) => {
    if (event.detail?.simpleOnly === true || !event.detail) this.hide();
  };

  handleBeforeSwap = () => this.hide();

  handleSurfacePointerEnter = () => this.clearHideTimer();
  handleSurfacePointerLeave = () => this.scheduleHide();
  handleVisualViewportResize = () => this.syncVisualZoomMode();

  scheduleShow(target, delay, { forceCustom = false } = {}) {
    if (this.nativeZoomFallback && !forceCustom) return;
    this.clearShowTimer();
    this.clearHideTimer();
    this.showTimer = window.setTimeout(() => {
      this.showTimer = 0;
      this.show(target, { forceCustom });
    }, delay);
  }

  scheduleHide() {
    this.clearShowTimer();
    this.clearHideTimer();
    this.hideTimer = window.setTimeout(() => {
      this.hideTimer = 0;
      if (this.shouldKeepOpen()) return;
      this.hide();
    }, HIDE_DELAY_MS);
  }

  shouldKeepOpen() {
    if (!this.activeTarget) return false;
    return (
      this.activeTarget.matches(":hover, :focus, :focus-within") ||
      this.surface.matches(":hover, :focus-within")
    );
  }

  show(target, { forceCustom = false } = {}) {
    if (this.nativeZoomFallback && !forceCustom) return;
    const message = target.dataset.tooltip?.trim();
    if (!message || !target.isConnected) return;
    this.clearTimers();
    if (this.activeTarget && this.activeTarget !== target) this.hide();

    this.activeTarget = target;
    this.activeCustomMode = forceCustom ? "forced" : "hover";
    if (this.nativeZoomFallback && target.getAttribute("title") === message) {
      target.removeAttribute("title");
    }
    this.surface.textContent = message;
    this.surface.hidden = false;
    this.surface.removeAttribute("aria-hidden");
    syncTooltipDescription(target, this.surface.id, true);

    try {
      if (!popoverIsOpen(this.surface)) this.surface.showPopover();
    } catch {
      this.surface.dataset.open = "true";
    }

    this.stopTracking?.();
    this.stopTracking = trackFloatingSurface(this.surface, target, {
      gap: 6,
      placement: target.dataset.tooltipPlacement || "top",
    });
    positionFloatingSurface(this.surface, target, {
      gap: 6,
      placement: target.dataset.tooltipPlacement || "top",
    });
  }

  hide() {
    this.clearTimers();
    this.stopTracking?.();
    this.stopTracking = null;
    const target = this.activeTarget;
    this.detachActiveTarget();

    if (this.nativeZoomFallback && target?.isConnected) {
      const message = target.dataset.tooltip?.trim();
      if (message && target.getAttribute("title") !== message) {
        target.setAttribute("title", message);
      }
    }

    try {
      if (popoverIsOpen(this.surface)) this.surface.hidePopover();
    } catch {
      delete this.surface.dataset.open;
    }
    this.surface.setAttribute("aria-hidden", "true");
    this.surface.hidden = true;
    this.surface.textContent = "";
  }

  refreshActiveTooltip() {
    if (!this.activeTarget) return;
    const message = this.activeTarget.dataset.tooltip?.trim();
    if (!message) {
      this.hide();
      return;
    }
    this.surface.textContent = message;
    positionFloatingSurface(this.surface, this.activeTarget, {
      gap: 6,
      placement: this.activeTarget.dataset.tooltipPlacement || "top",
    });
  }

  detachActiveTarget() {
    if (!this.activeTarget) return;
    syncTooltipDescription(this.activeTarget, this.surface.id, false);
    this.activeTarget = null;
    this.activeCustomMode = null;
  }

  clearShowTimer() {
    if (this.showTimer) window.clearTimeout(this.showTimer);
    this.showTimer = 0;
  }

  clearHideTimer() {
    if (this.hideTimer) window.clearTimeout(this.hideTimer);
    this.hideTimer = 0;
  }

  clearTimers() {
    this.clearShowTimer();
    this.clearHideTimer();
    if (this.touchTimer) window.clearTimeout(this.touchTimer);
    this.touchTimer = 0;
  }

  syncVisualZoomMode(force = false) {
    const visualScale = window.visualViewport?.scale ?? 1;
    const pageScale = (window.devicePixelRatio || 1) / INITIAL_DEVICE_PIXEL_RATIO;
    const effectiveScale = Math.max(0.25, Math.min(4, visualScale * pageScale));
    const zoomed = Math.abs(effectiveScale - 1) > 0.01;
    this.surface.style.setProperty("--site-floating-zoom-compensation", String(1 / effectiveScale));
    if (!force && zoomed === this.nativeZoomFallback) return;

    this.nativeZoomFallback = zoomed;
    const keepCustom = Boolean(this.activeTarget && this.activeCustomMode === "forced");
    if (!keepCustom) this.hide();
    document.querySelectorAll(TOOLTIP_SELECTOR).forEach((candidate) => {
      if (!(candidate instanceof HTMLElement)) return;
      const message = candidate.dataset.tooltip?.trim();
      if (!message) return;
      if (keepCustom && candidate === this.activeTarget) {
        candidate.removeAttribute("title");
        return;
      }
      if (zoomed) {
        if (candidate.getAttribute("title") !== message) candidate.setAttribute("title", message);
      } else if (candidate.getAttribute("title") === message) {
        candidate.removeAttribute("title");
      }
    });

    if (keepCustom && this.activeTarget) {
      positionFloatingSurface(this.surface, this.activeTarget, {
        gap: 6,
        placement: this.activeTarget.dataset.tooltipPlacement || "top",
      });
    }
  }

  destroy() {
    this.abortController.abort();
    this.observer.disconnect();
    if (this.touchFocusGuardTimer) window.clearTimeout(this.touchFocusGuardTimer);
    this.hide();
  }
}

export function hideSiteTooltip() {
  document.dispatchEvent(new CustomEvent(SITE_EVENTS.tooltipHide));
}

export function initSiteTooltips() {
  const surface = document.getElementById("site-tooltip");
  if (!(surface instanceof HTMLElement)) return;
  if (controller?.surface !== surface) {
    controller?.destroy();
    controller = new SiteTooltipController(surface);
  }
  controller.enhance();
}
