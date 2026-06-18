const TOOLTIP_SELECTOR = "[data-tooltip]";
const TOUCH_POINTERS = new Set(["touch", "pen"]);
const TOUCH_HIDE_DELAY = 6000;
const TOUCH_FOCUS_SUPPRESS_MS = 900;
const VIEWPORT_MARGIN = 10;
const TOOLTIP_GAP = 10;

let isInitialized = false;
let tooltipLayer;
let tooltipText;
let touchHideTimer = 0;
let lastTouchStartedAt = 0;
let placementFrame = 0;
let activeTarget = null;

function getTooltipTarget(start) {
  if (!start || start.nodeType !== 1) return null;
  const target = start.closest(TOOLTIP_SELECTOR);
  if (!target || !target.isConnected || target.getAttribute("aria-hidden") === "true") {
    return null;
  }

  return target.dataset.tooltip ? target : null;
}

function getPlacement(target) {
  if (target.classList.contains("pswp__button--arrow--next")) return "left";
  if (target.classList.contains("pswp__button--arrow--prev")) return "right";
  if (target.closest(".pswp__top-bar")) return "bottom";
  return target.dataset.tooltipPlacement || "top";
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getViewportBox() {
  const viewport = window.visualViewport;
  const left = viewport?.offsetLeft || 0;
  const top = viewport?.offsetTop || 0;
  const width = viewport?.width || window.innerWidth;
  const height = viewport?.height || window.innerHeight;

  return {
    bottom: top + height,
    height,
    left,
    right: left + width,
    top,
    width,
  };
}

function ensureLayer() {
  if (tooltipLayer) return tooltipLayer;

  tooltipLayer = document.createElement("div");
  tooltipLayer.id = "site-tooltip-layer";
  tooltipLayer.className = "site-tooltip-layer";
  tooltipLayer.hidden = true;
  tooltipLayer.innerHTML = `
    <div class="site-tooltip-box" role="tooltip">
      <span class="site-tooltip-text"></span>
      <span class="site-tooltip-arrow" aria-hidden="true"></span>
    </div>
  `;
  document.body.appendChild(tooltipLayer);
  tooltipText = tooltipLayer.querySelector(".site-tooltip-text");
  return tooltipLayer;
}

function clearTouchHideTimer() {
  if (!touchHideTimer) return;
  window.clearTimeout(touchHideTimer);
  touchHideTimer = 0;
}

function hideTooltip() {
  clearTouchHideTimer();
  activeTarget = null;
  if (placementFrame) {
    window.cancelAnimationFrame(placementFrame);
    placementFrame = 0;
  }
  if (tooltipLayer) tooltipLayer.hidden = true;
}

function scheduleTouchHide() {
  clearTouchHideTimer();
  touchHideTimer = window.setTimeout(() => {
    touchHideTimer = 0;
    hideTooltip();
  }, TOUCH_HIDE_DELAY);
}

function placeTooltip() {
  placementFrame = 0;
  if (!activeTarget?.isConnected) {
    hideTooltip();
    return;
  }

  const title = activeTarget.dataset.tooltip || "";
  if (!title) {
    hideTooltip();
    return;
  }

  const layer = ensureLayer();
  tooltipText.textContent = title;
  layer.hidden = false;

  const placement = getPlacement(activeTarget);
  const viewport = getViewportBox();
  layer.style.maxWidth = `${Math.max(48, viewport.width - VIEWPORT_MARGIN * 2)}px`;

  const targetRect = activeTarget.getBoundingClientRect();
  const layerRect = layer.getBoundingClientRect();
  const targetLeft = targetRect.left + viewport.left;
  const targetTop = targetRect.top + viewport.top;
  const targetRight = targetRect.right + viewport.left;
  const targetBottom = targetRect.bottom + viewport.top;
  const centerX = targetLeft + targetRect.width / 2;
  const centerY = targetTop + targetRect.height / 2;
  const minLeft = viewport.left + VIEWPORT_MARGIN;
  const minTop = viewport.top + VIEWPORT_MARGIN;
  const maxLeft = viewport.right - layerRect.width - VIEWPORT_MARGIN;
  const maxTop = viewport.bottom - layerRect.height - VIEWPORT_MARGIN;
  let left = centerX - layerRect.width / 2;
  let top = targetTop - layerRect.height - TOOLTIP_GAP;

  if (placement === "bottom") {
    top = targetBottom + TOOLTIP_GAP;
  } else if (placement === "left") {
    left = targetLeft - layerRect.width - TOOLTIP_GAP;
    top = centerY - layerRect.height / 2;
  } else if (placement === "right") {
    left = targetRight + TOOLTIP_GAP;
    top = centerY - layerRect.height / 2;
  }

  left = clamp(left, minLeft, Math.max(minLeft, maxLeft));
  top = clamp(top, minTop, Math.max(minTop, maxTop));

  layer.dataset.placement = placement;
  layer.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;

  const arrowX = clamp(centerX - left, 12, Math.max(12, layerRect.width - 12));
  const arrowY = clamp(centerY - top, 12, Math.max(12, layerRect.height - 12));
  layer.style.setProperty("--tooltip-arrow-x", `${Math.round(arrowX)}px`);
  layer.style.setProperty("--tooltip-arrow-y", `${Math.round(arrowY)}px`);
}

function requestPlacement() {
  if (!activeTarget || placementFrame) return;
  placementFrame = window.requestAnimationFrame(placeTooltip);
}

function showTooltip(target, options = {}) {
  const title = target.dataset.tooltip;
  if (!title) return;

  clearTouchHideTimer();
  activeTarget = target;
  ensureLayer();
  placeTooltip();
  if (options.temporary) scheduleTouchHide();
}

function handlePointerOver(event) {
  if (TOUCH_POINTERS.has(event.pointerType)) return;
  const target = getTooltipTarget(event.target);
  if (!target || target === activeTarget) return;
  showTooltip(target);
}

function handlePointerOut(event) {
  if (TOUCH_POINTERS.has(event.pointerType)) return;

  const target = activeTarget;
  if (!target) return;
  const nextTarget = event.relatedTarget;
  if (nextTarget?.nodeType === 1 && target.contains(nextTarget)) return;
  hideTooltip();
}

function handleFocusIn(event) {
  if (Date.now() - lastTouchStartedAt < TOUCH_FOCUS_SUPPRESS_MS) return;

  const target = getTooltipTarget(event.target);
  if (target) showTooltip(target);
}

function handleFocusOut(event) {
  if (Date.now() - lastTouchStartedAt < TOUCH_FOCUS_SUPPRESS_MS) return;

  const target = activeTarget;
  if (!target) return;
  const nextTarget = event.relatedTarget;
  if (nextTarget?.nodeType === 1 && target.contains(nextTarget)) return;
  hideTooltip();
}

function handlePointerDown(event) {
  const target = getTooltipTarget(event.target);
  if (TOUCH_POINTERS.has(event.pointerType)) {
    lastTouchStartedAt = Date.now();
    if (target) {
      showTooltip(target, { temporary: true });
    } else {
      hideTooltip();
    }
    return;
  }

  if (target) showTooltip(target);
}

function handleKeyDown(event) {
  if (event.key === "Escape") hideTooltip();
}

export function initMuiTooltips() {
  if (isInitialized) return;
  isInitialized = true;

  ensureLayer();
  document.addEventListener("pointerover", handlePointerOver, true);
  document.addEventListener("pointerout", handlePointerOut, true);
  document.addEventListener("pointerdown", handlePointerDown, true);
  document.addEventListener("focusin", handleFocusIn, true);
  document.addEventListener("focusout", handleFocusOut, true);
  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("site:tooltip-hide", hideTooltip);
  document.addEventListener("visibilitychange", hideTooltip);
  window.addEventListener("pagehide", hideTooltip);
  window.addEventListener("scroll", requestPlacement, true);
  window.addEventListener("resize", requestPlacement);
  window.visualViewport?.addEventListener("resize", requestPlacement);
  window.visualViewport?.addEventListener("scroll", requestPlacement);
}
