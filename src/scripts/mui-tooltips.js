import Tooltip from "@mui/material/Tooltip";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

const TOOLTIP_SELECTOR = "[data-tooltip]";
const TOUCH_POINTERS = new Set(["touch", "pen"]);
const TOUCH_HIDE_DELAY = 1800;
const TOUCH_FOCUS_SUPPRESS_MS = 900;

let tooltipRoot;

function getTooltipTarget(start) {
  if (!start || start.nodeType !== 1) return null;
  const target = start.closest(TOOLTIP_SELECTOR);
  if (!target || !target.isConnected || target.getAttribute("aria-hidden") === "true") {
    return null;
  }

  return target.dataset.tooltip ? target : null;
}

function getPlacement(target) {
  if (target.classList.contains("site-scroll-top")) return "left";
  if (target.classList.contains("pswp__button--arrow--next")) return "left";
  if (target.classList.contains("pswp__button--arrow--prev")) return "right";
  if (target.closest(".pswp__top-bar")) return "bottom";
  return target.dataset.tooltipPlacement || "top";
}

function TooltipLayer() {
  const targetRef = useRef(null);
  const popperRef = useRef(null);
  const touchHideTimerRef = useRef(0);
  const lastTouchStartedAtRef = useRef(0);
  const [tooltip, setTooltip] = useState({
    anchorEl: null,
    open: false,
    title: "",
    placement: "top",
  });

  const createVirtualAnchor = useCallback((target) => ({
    contextElement: target,
    getBoundingClientRect: () => target.getBoundingClientRect(),
  }), []);

  const clearTouchHideTimer = useCallback(() => {
    if (!touchHideTimerRef.current) return;
    window.clearTimeout(touchHideTimerRef.current);
    touchHideTimerRef.current = 0;
  }, []);

  const hide = useCallback(() => {
    clearTouchHideTimer();
    targetRef.current = null;
    setTooltip((current) => ({ ...current, anchorEl: null, open: false }));
  }, [clearTouchHideTimer]);

  const scheduleTouchHide = useCallback(() => {
    clearTouchHideTimer();
    touchHideTimerRef.current = window.setTimeout(() => {
      touchHideTimerRef.current = 0;
      hide();
    }, TOUCH_HIDE_DELAY);
  }, [clearTouchHideTimer, hide]);

  const updatePopper = useCallback(() => {
    popperRef.current?.forceUpdate?.();
    popperRef.current?.update?.();
  }, []);

  const updateRect = useCallback(() => {
    const target = targetRef.current;
    if (!target?.isConnected) {
      hide();
      return;
    }

    setTooltip((current) => ({
      ...current,
      title: target.dataset.tooltip || "",
      placement: getPlacement(target),
    }));
    updatePopper();
    requestAnimationFrame(updatePopper);
  }, [hide, updatePopper]);

  const show = useCallback((target, options = {}) => {
    const title = target.dataset.tooltip;
    if (!title) return;

    clearTouchHideTimer();
    targetRef.current = target;
    setTooltip({
      anchorEl: createVirtualAnchor(target),
      open: true,
      title,
      placement: getPlacement(target),
    });
    requestAnimationFrame(updatePopper);
    if (options.temporary) scheduleTouchHide();
  }, [clearTouchHideTimer, createVirtualAnchor, scheduleTouchHide, updatePopper]);

  useEffect(() => {
    const handlePointerOver = (event) => {
      if (TOUCH_POINTERS.has(event.pointerType)) return;
      const target = getTooltipTarget(event.target);
      if (!target || target === targetRef.current) return;
      show(target);
    };

    const handlePointerOut = (event) => {
      const target = targetRef.current;
      if (!target) return;
      const nextTarget = event.relatedTarget;
      if (nextTarget?.nodeType === 1 && target.contains(nextTarget)) return;
      hide();
    };

    const handleFocusIn = (event) => {
      if (Date.now() - lastTouchStartedAtRef.current < TOUCH_FOCUS_SUPPRESS_MS) {
        return;
      }

      const target = getTooltipTarget(event.target);
      if (target) show(target);
    };

    const handlePointerDown = (event) => {
      const target = getTooltipTarget(event.target);
      if (TOUCH_POINTERS.has(event.pointerType)) {
        lastTouchStartedAtRef.current = Date.now();
        if (target) {
          show(target, { temporary: true });
        } else {
          hide();
        }
        return;
      }

      if (target) show(target);
    };

    const handleFocusOut = (event) => {
      const target = targetRef.current;
      if (!target) return;
      const nextTarget = event.relatedTarget;
      if (nextTarget?.nodeType === 1 && target.contains(nextTarget)) return;
      hide();
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") hide();
    };

    document.addEventListener("pointerover", handlePointerOver, true);
    document.addEventListener("pointerout", handlePointerOut, true);
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("focusin", handleFocusIn, true);
    document.addEventListener("focusout", handleFocusOut, true);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("site:tooltip-hide", hide);
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", hide);
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);
    window.visualViewport?.addEventListener("resize", updateRect);
    window.visualViewport?.addEventListener("scroll", updateRect);

    return () => {
      document.removeEventListener("pointerover", handlePointerOver, true);
      document.removeEventListener("pointerout", handlePointerOut, true);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("focusin", handleFocusIn, true);
      document.removeEventListener("focusout", handleFocusOut, true);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("site:tooltip-hide", hide);
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
      window.visualViewport?.removeEventListener("resize", updateRect);
      window.visualViewport?.removeEventListener("scroll", updateRect);
    };
  }, [hide, show, updateRect]);

  return React.createElement(
    Tooltip,
    {
      arrow: true,
      disableInteractive: true,
      open: tooltip.open && Boolean(tooltip.title),
      placement: tooltip.placement,
      title: tooltip.title,
      slotProps: {
        popper: {
          anchorEl: tooltip.anchorEl,
          popperRef,
          popperOptions: {
            modifiers: [
              {
                name: "preventOverflow",
                options: {
                  padding: 10,
                },
              },
              {
                name: "flip",
                options: {
                  padding: 10,
                },
              },
            ],
          },
          sx: {
            pointerEvents: "none",
            zIndex: 200000,
          },
        },
        tooltip: {
          sx: {
            maxWidth: "min(24rem, calc(100vw - 24px))",
            overflowWrap: "anywhere",
            borderRadius: "4px",
            bgcolor: "#616161",
            color: "#fff",
            font: "400 0.75rem/1.3 var(--site-font)",
            letterSpacing: 0,
          },
        },
        arrow: {
          sx: {
            color: "#616161",
          },
        },
      },
    },
    React.createElement("span", {
      "aria-hidden": "true",
      style: {
        position: "fixed",
        inset: "0 auto auto 0",
        width: 1,
        height: 1,
        pointerEvents: "none",
      },
    }),
  );
}

export function initMuiTooltips() {
  if (tooltipRoot) return;

  const mount = document.createElement("div");
  mount.id = "mui-tooltip-layer";
  mount.setAttribute("aria-hidden", "true");
  document.body.appendChild(mount);

  tooltipRoot = createRoot(mount);
  tooltipRoot.render(React.createElement(TooltipLayer));
}
