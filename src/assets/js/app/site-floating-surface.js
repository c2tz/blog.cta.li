const DEFAULT_GAP = 8;
const VIEWPORT_MARGIN = 12;

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function viewportBounds() {
  const viewport = window.visualViewport;
  const left = viewport?.offsetLeft ?? 0;
  const top = viewport?.offsetTop ?? 0;

  return {
    bottom: top + (viewport?.height ?? window.innerHeight),
    left,
    right: left + (viewport?.width ?? window.innerWidth),
    top,
  };
}

function placementOrder(preferred) {
  if (preferred === "bottom") return ["bottom", "top", "right", "left"];
  if (preferred === "left") return ["left", "right", "top", "bottom"];
  if (preferred === "right") return ["right", "left", "top", "bottom"];
  return ["top", "bottom", "right", "left"];
}

function coordinates(placement, anchor, surface, gap) {
  if (placement === "bottom") {
    return {
      left: anchor.left + (anchor.width - surface.width) / 2,
      top: anchor.bottom + gap,
    };
  }
  if (placement === "left") {
    return {
      left: anchor.left - surface.width - gap,
      top: anchor.top + (anchor.height - surface.height) / 2,
    };
  }
  if (placement === "right") {
    return {
      left: anchor.right + gap,
      top: anchor.top + (anchor.height - surface.height) / 2,
    };
  }

  return {
    left: anchor.left + (anchor.width - surface.width) / 2,
    top: anchor.top - surface.height - gap,
  };
}

function fitsViewport(point, surface, viewport) {
  return (
    point.left >= viewport.left + VIEWPORT_MARGIN &&
    point.top >= viewport.top + VIEWPORT_MARGIN &&
    point.left + surface.width <= viewport.right - VIEWPORT_MARGIN &&
    point.top + surface.height <= viewport.bottom - VIEWPORT_MARGIN
  );
}

export function positionFloatingSurface(
  surface,
  anchor,
  { gap = DEFAULT_GAP, placement = "top" } = {},
) {
  if (!(surface instanceof HTMLElement) || !(anchor instanceof HTMLElement)) return;
  if (!surface.isConnected || !anchor.isConnected) return;

  const anchorRect = anchor.getBoundingClientRect();
  const viewport = viewportBounds();
  surface.style.setProperty(
    "--site-floating-viewport-width",
    `${Math.max(0, viewport.right - viewport.left)}px`,
  );
  surface.style.setProperty(
    "--site-floating-viewport-height",
    `${Math.max(0, viewport.bottom - viewport.top)}px`,
  );
  const surfaceRect = surface.getBoundingClientRect();
  const orderedPlacements = placementOrder(placement);
  let selectedPlacement = orderedPlacements[0];
  let point = coordinates(selectedPlacement, anchorRect, surfaceRect, gap);

  for (const candidate of orderedPlacements) {
    const candidatePoint = coordinates(candidate, anchorRect, surfaceRect, gap);
    if (!fitsViewport(candidatePoint, surfaceRect, viewport)) continue;
    selectedPlacement = candidate;
    point = candidatePoint;
    break;
  }

  const maximumLeft = Math.max(
    viewport.left + VIEWPORT_MARGIN,
    viewport.right - surfaceRect.width - VIEWPORT_MARGIN,
  );
  const maximumTop = Math.max(
    viewport.top + VIEWPORT_MARGIN,
    viewport.bottom - surfaceRect.height - VIEWPORT_MARGIN,
  );
  const left = clamp(point.left, viewport.left + VIEWPORT_MARGIN, maximumLeft);
  const top = clamp(point.top, viewport.top + VIEWPORT_MARGIN, maximumTop);
  const anchorCenter = anchorRect.left + anchorRect.width / 2 - left;

  surface.dataset.placement = selectedPlacement;
  surface.style.setProperty("--site-floating-anchor-x", `${Math.round(anchorCenter)}px`);
  surface.style.left = `${Math.round(left)}px`;
  surface.style.top = `${Math.round(top)}px`;
}

export function trackFloatingSurface(surface, anchor, options) {
  let frame = 0;
  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      positionFloatingSurface(surface, anchor, options);
    });
  };
  const resizeObserver = new ResizeObserver(schedule);

  resizeObserver.observe(surface);
  resizeObserver.observe(anchor);
  window.addEventListener("resize", schedule);
  window.addEventListener("scroll", schedule, true);
  window.visualViewport?.addEventListener("resize", schedule);
  window.visualViewport?.addEventListener("scroll", schedule);
  schedule();

  return () => {
    if (frame) cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    window.removeEventListener("resize", schedule);
    window.removeEventListener("scroll", schedule, true);
    window.visualViewport?.removeEventListener("resize", schedule);
    window.visualViewport?.removeEventListener("scroll", schedule);
  };
}
