import siteTooltipStyles from "@/assets/css/components/site-tooltips.scss?inline";
import { SITE_EVENTS } from "@/lib/site-contracts";
import { areSiteAnimationsEnabled } from "./site-motion.js";

const TOOLTIP_SELECTOR =
  "[data-tooltip]:not([data-context-popover-trigger]):not([data-rich-tooltip-trigger])";
const TOOLTIP_CANDIDATE_SELECTOR = "[data-tooltip], [title]";
const SHOW_DELAY_MS = 180;
const HIDE_DELAY_MS = 100;
const TOUCH_HIDE_DELAY_MS = 3000;
const TOUCH_FOCUS_GUARD_MS = 500;

let controller;
let floatingSurfacePromise;

function ensureSiteTooltipStyles() {
  if (document.querySelector("style[data-site-tooltip-styles]")) return;

  const style = document.createElement("style");
  style.dataset.siteTooltipStyles = "";
  style.textContent = siteTooltipStyles;
  document.head.append(style);
}

function loadFloatingSurface() {
  floatingSurfacePromise ??= import("./site-floating-surface.js").catch((error) => {
    floatingSurfacePromise = undefined;
    throw error;
  });
  return floatingSurfacePromise;
}

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

function ownsOpenInteractiveSurface(target) {
  return (
    target.hasAttribute("data-tooltip-suppress-expanded") &&
    (target.getAttribute("aria-expanded") === "true" ||
      target.getAttribute("data-aria-expanded") === "true")
  );
}

function virtualReference(target, point) {
  return {
    contextElement: target,
    getBoundingClientRect() {
      return {
        bottom: point.y,
        height: 0,
        left: point.x,
        right: point.x,
        top: point.y,
        width: 0,
        x: point.x,
        y: point.y,
      };
    },
  };
}

class SiteTooltipController {
  constructor(surface) {
    this.surface = surface;
    this.abortController = new AbortController();
    this.activeTarget = null;
    this.activeMode = null;
    this.activeReason = null;
    this.showTimer = 0;
    this.hideTimer = 0;
    this.touchTimer = 0;
    this.touchFocusGuardTimer = 0;
    this.pendingTouchFocusTarget = null;
    this.pendingVirtualTarget = null;
    this.pendingVirtualPoint = null;
    this.lastPointerPoint = null;
    this.virtualSuppressedUntilMove = false;
    this.stopTracking = null;
    this.showRequest = 0;
    this.finePointer = matchMedia("(hover: hover) and (pointer: fine)");
    this.bindEvents();
    this.observeDocument();
  }

  bindEvents() {
    const capture = { capture: true, signal: this.abortController.signal };
    const passiveCapture = { capture: true, passive: true, signal: this.abortController.signal };
    const options = { signal: this.abortController.signal };

    document.addEventListener("pointerover", this.handlePointerOver, capture);
    document.addEventListener("pointermove", this.handlePointerMove, passiveCapture);
    document.addEventListener("pointerout", this.handlePointerOut, capture);
    document.addEventListener("pointerdown", this.handlePointerDown, capture);
    document.addEventListener("focusin", this.handleFocusIn, capture);
    document.addEventListener("focusout", this.handleFocusOut, capture);
    document.addEventListener("keydown", this.handleKeydown, capture);
    document.addEventListener("opening", this.handleInteractiveSurfaceChange, capture);
    document.addEventListener("opened", this.handleInteractiveSurfaceChange, capture);
    document.addEventListener("closing", this.handleInteractiveSurfaceChange, capture);
    document.addEventListener("closed", this.handleInteractiveSurfaceClosed, capture);
    document.addEventListener("scroll", this.handleDocumentScroll, passiveCapture);
    document.addEventListener("wheel", this.handleDocumentScroll, passiveCapture);
    document.addEventListener("astro:before-swap", this.handleBeforeSwap, options);
    document.addEventListener(SITE_EVENTS.tooltipHide, this.handleHideRequest, options);
    window.addEventListener("resize", this.handleViewportChange, options);
    window.addEventListener("scroll", this.handleDocumentScroll, {
      passive: true,
      signal: this.abortController.signal,
    });
    window.visualViewport?.addEventListener("resize", this.handleViewportChange, options);
    window.visualViewport?.addEventListener("scroll", this.handleViewportChange, options);
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
        if (record.attributeName === "data-tooltip" || record.attributeName === "title") {
          this.prepareTarget(element);
        }
        if (element === this.activeTarget) this.refreshActiveTooltip();
      }
      if (this.activeTarget && !this.activeTarget.isConnected) this.hide();
    });
    this.observer.observe(document.documentElement, {
      attributeFilter: ["aria-expanded", "data-aria-expanded", "data-tooltip", "title"],
      attributes: true,
      childList: true,
      subtree: true,
    });
  }

  enhance(root = document) {
    if (root instanceof HTMLElement && root.matches(TOOLTIP_CANDIDATE_SELECTOR)) {
      this.prepareTarget(root);
    }
    root.querySelectorAll?.(TOOLTIP_CANDIDATE_SELECTOR).forEach((element) => {
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
          document.getElementById(id)?.scrollIntoView({
            behavior: areSiteAnimationsEnabled() ? "smooth" : "instant",
            block: "center",
          });
        });
      });
    });
  }

  prepareTarget(element) {
    if (!document.body?.contains(element)) return;

    // An embedded comments document needs an accessible name, not a tooltip
    // spanning the iframe. Giscus can restore its title after initialization.
    if (element.matches("iframe.giscus-frame")) {
      element.setAttribute("aria-label", "Commentaires");
      element.removeAttribute("title");
      element.removeAttribute("data-tooltip");
      element.classList.remove("site-tooltip");
      return;
    }

    if (
      element.hasAttribute("data-context-popover-trigger") ||
      element.hasAttribute("data-rich-tooltip-trigger")
    ) {
      element.removeAttribute("data-tooltip");
      element.removeAttribute("title");
      element.classList.remove("site-tooltip");
      return;
    }

    const nativeTitle = element.getAttribute("title")?.trim();
    if (!element.dataset.tooltip?.trim() && nativeTitle) element.dataset.tooltip = nativeTitle;
    const message = element.dataset.tooltip?.trim();
    if (!message) {
      element.classList.remove("site-tooltip");
      return;
    }

    if (element.hasAttribute("title")) element.removeAttribute("title");
    if (element.matches("abbr") && !element.hasAttribute("aria-label")) {
      const abbreviation = element.textContent?.trim();
      element.setAttribute("aria-label", abbreviation ? `${abbreviation} — ${message}` : message);
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
    if (target.dataset.tooltipAnchor === "cursor") {
      if (this.virtualSuppressedUntilMove) return;
      this.recordPointerMovement(event);
      this.scheduleVirtualShow(target, event);
      return;
    }
    this.scheduleShow(target, SHOW_DELAY_MS, "hover");
  };

  handlePointerMove = (event) => {
    if (!this.finePointer.matches || event.pointerType === "touch" || event.pointerType === "pen") {
      return;
    }
    const moved = this.recordPointerMovement(event);
    const target = tooltipTarget(event.target);
    if (target?.dataset.tooltipAnchor === "cursor") {
      if (!moved) return;
      this.virtualSuppressedUntilMove = false;
      this.scheduleVirtualShow(target, event);
    } else if (this.pendingVirtualTarget || this.activeMode === "virtual") {
      this.hide();
      if (moved) this.virtualSuppressedUntilMove = false;
    }
  };

  handlePointerOut = (event) => {
    if (!this.finePointer.matches || event.pointerType === "touch" || event.pointerType === "pen") {
      return;
    }
    const target = tooltipTarget(event.target);
    if (!target) return;
    if (event.relatedTarget instanceof Node && target.contains(event.relatedTarget)) return;
    if (target.dataset.tooltipAnchor === "cursor") {
      this.hide();
      return;
    }
    this.scheduleHide();
  };

  handlePointerDown = (event) => {
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
    if (event.pointerType !== "touch" && event.pointerType !== "pen") {
      this.hide();
      return;
    }
    if (target.dataset.tooltipTouchGestures === "off") {
      this.hide();
      return;
    }
    this.show(target);
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
    if (
      target?.hasAttribute("data-tooltip-suppress-pointer-focus") &&
      document.documentElement.dataset.focusModality !== "keyboard"
    ) {
      this.hide();
      return;
    }
    if (target) this.scheduleShow(target, 0, "focus");
  };

  handleFocusOut = (event) => {
    const target = tooltipTarget(event.target);
    if (!target) return;
    if (event.relatedTarget instanceof Node && target.contains(event.relatedTarget)) return;
    this.scheduleHide();
  };

  handleKeydown = (event) => {
    if (event.key === "Escape" || event.key === "Enter" || event.key === " ") this.hide();
  };

  handleInteractiveSurfaceChange = () => this.hide();

  handleInteractiveSurfaceClosed = () => {
    this.hide();
    requestAnimationFrame(() => this.hide());
  };

  handleDocumentScroll = () => {
    this.virtualSuppressedUntilMove = true;
    if (this.pendingVirtualTarget || this.activeMode === "virtual") this.hide();
  };

  handleViewportChange = () => {
    this.virtualSuppressedUntilMove = true;
    if (this.pendingVirtualTarget || this.activeMode === "virtual") {
      this.hide();
      return;
    }
    if (this.activeMode === "anchor") this.refreshActiveTooltip();
  };

  handleHideRequest = (event) => {
    if (event.detail?.simpleOnly === true || !event.detail) this.hide();
  };

  handleBeforeSwap = () => this.hide();

  recordPointerMovement(event) {
    const point = { x: event.clientX, y: event.clientY };
    const previous = this.lastPointerPoint;
    this.lastPointerPoint = point;
    return !previous || Math.hypot(point.x - previous.x, point.y - previous.y) > 0.5;
  }

  scheduleVirtualShow(target, event) {
    this.clearShowTimer();
    this.clearHideTimer();
    void loadFloatingSurface().catch(() => undefined);
    if (this.activeMode === "virtual") this.hide();
    this.pendingVirtualTarget = target;
    this.pendingVirtualPoint = { x: event.clientX, y: event.clientY };
    this.showTimer = window.setTimeout(() => {
      this.showTimer = 0;
      const pendingTarget = this.pendingVirtualTarget;
      const point = this.pendingVirtualPoint;
      this.pendingVirtualTarget = null;
      this.pendingVirtualPoint = null;
      if (pendingTarget && point) this.show(pendingTarget, { point, reason: "virtual" });
    }, SHOW_DELAY_MS);
  }

  scheduleShow(target, delay, reason) {
    this.clearShowTimer();
    this.clearHideTimer();
    void loadFloatingSurface().catch(() => undefined);
    this.pendingVirtualTarget = null;
    this.pendingVirtualPoint = null;
    this.showTimer = window.setTimeout(() => {
      this.showTimer = 0;
      this.show(target, { reason });
    }, delay);
  }

  scheduleHide() {
    this.clearShowTimer();
    this.clearHideTimer();
    this.hideTimer = window.setTimeout(() => {
      this.hideTimer = 0;
      const remainsActive =
        this.activeReason === "focus"
          ? this.activeTarget?.matches(":focus, :focus-within")
          : this.activeTarget?.matches(":hover");
      if (!remainsActive) this.hide();
    }, HIDE_DELAY_MS);
  }

  async show(target, { point, reason = "touch" } = {}) {
    const message = target.dataset.tooltip?.trim();
    if (!message || !target.isConnected || ownsOpenInteractiveSurface(target)) return;
    this.clearTimers();
    if (this.activeTarget && this.activeTarget !== target) this.hide();
    const request = ++this.showRequest;

    let floatingSurface;
    try {
      floatingSurface = await loadFloatingSurface();
    } catch {
      return;
    }
    if (request !== this.showRequest || !target.isConnected || ownsOpenInteractiveSurface(target)) {
      return;
    }

    const reference = point ? virtualReference(target, point) : target;
    const activeReason =
      this.activeTarget === target && this.activeReason === "focus" && reason === "hover"
        ? "focus"
        : reason;
    this.activeTarget = target;
    this.activeMode = point ? "virtual" : "anchor";
    this.activeReason = activeReason;
    this.surface.textContent = message;
    this.surface.hidden = false;
    this.surface.style.visibility = "hidden";
    this.surface.removeAttribute("aria-hidden");
    syncTooltipDescription(target, this.surface.id, true);

    try {
      if (!popoverIsOpen(this.surface)) this.surface.showPopover();
    } catch {
      this.surface.dataset.open = "true";
    }

    this.stopTracking?.();
    this.stopTracking = point
      ? null
      : floatingSurface.trackFloatingSurface(this.surface, reference, {
          gap: 6,
          placement: target.dataset.tooltipPlacement || "top",
        });
    void floatingSurface.positionFloatingSurface(this.surface, reference, {
      gap: point ? 8 : 6,
      placement: target.dataset.tooltipPlacement || "top",
    });
  }

  hide() {
    this.showRequest += 1;
    this.clearTimers();
    this.stopTracking?.();
    this.stopTracking = null;
    this.pendingVirtualTarget = null;
    this.pendingVirtualPoint = null;
    this.detachActiveTarget();

    try {
      if (popoverIsOpen(this.surface)) this.surface.hidePopover();
    } catch {
      delete this.surface.dataset.open;
    }
    this.surface.setAttribute("aria-hidden", "true");
    this.surface.hidden = true;
    this.surface.textContent = "";
    this.surface.style.removeProperty("visibility");
    this.surface.removeAttribute("data-reference-hidden");
  }

  refreshActiveTooltip() {
    if (!this.activeTarget) return;
    const message = this.activeTarget.dataset.tooltip?.trim();
    if (!message || ownsOpenInteractiveSurface(this.activeTarget)) {
      this.hide();
      return;
    }
    this.surface.textContent = message;
    if (this.activeMode === "anchor") {
      const target = this.activeTarget;
      void loadFloatingSurface()
        .then(({ positionFloatingSurface }) => {
          if (this.activeTarget !== target) return;
          return positionFloatingSurface(this.surface, target, {
            gap: 6,
            placement: target.dataset.tooltipPlacement || "top",
          });
        })
        .catch(() => undefined);
    }
  }

  detachActiveTarget() {
    if (!this.activeTarget) return;
    syncTooltipDescription(this.activeTarget, this.surface.id, false);
    this.activeTarget = null;
    this.activeMode = null;
    this.activeReason = null;
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

  destroy() {
    this.abortController.abort();
    this.observer.disconnect();
    if (this.touchFocusGuardTimer) window.clearTimeout(this.touchFocusGuardTimer);
    this.hide();
  }
}

export function hideSiteTooltip(detail) {
  document.dispatchEvent(new CustomEvent(SITE_EVENTS.tooltipHide, { detail }));
}

export function showSiteTooltip(target) {
  if (controller && target instanceof HTMLElement) controller.show(target, { reason: "focus" });
}

export function initSiteTooltips() {
  const surface = document.getElementById("site-tooltip");
  if (!(surface instanceof HTMLElement)) return;
  ensureSiteTooltipStyles();
  if (controller?.surface !== surface) {
    controller?.destroy();
    controller = new SiteTooltipController(surface);
  }
  controller.enhance();
}
