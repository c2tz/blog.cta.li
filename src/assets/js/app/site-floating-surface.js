import { autoUpdate, computePosition, flip, hide, offset, shift, size } from "@floating-ui/dom";

const DEFAULT_GAP = 8;
const VIEWPORT_MARGIN = 12;
const updateTokens = new WeakMap();

function isReference(reference) {
  return Boolean(reference && typeof reference.getBoundingClientRect === "function");
}

function isConnectedReference(reference) {
  if (reference instanceof Element) return reference.isConnected;
  return !reference?.contextElement || reference.contextElement.isConnected;
}

function normalizePlacement(placement) {
  if (placement === "bottom" || placement === "left" || placement === "right") return placement;
  return "top";
}

export async function positionFloatingSurface(
  surface,
  reference,
  { gap = DEFAULT_GAP, placement = "top" } = {},
) {
  if (!(surface instanceof HTMLElement) || !isReference(reference)) return;
  if (!surface.isConnected || !isConnectedReference(reference)) return;

  const token = (updateTokens.get(surface) ?? 0) + 1;
  updateTokens.set(surface, token);

  const result = await computePosition(reference, surface, {
    middleware: [
      offset(gap),
      flip({ padding: VIEWPORT_MARGIN }),
      shift({ padding: VIEWPORT_MARGIN }),
      size({
        padding: VIEWPORT_MARGIN,
        apply({ availableHeight, availableWidth, elements }) {
          elements.floating.style.setProperty(
            "--site-floating-available-width",
            `${Math.max(0, availableWidth)}px`,
          );
          elements.floating.style.setProperty(
            "--site-floating-available-height",
            `${Math.max(0, availableHeight)}px`,
          );
        },
      }),
      hide({ strategy: "referenceHidden" }),
    ],
    placement: normalizePlacement(placement),
    strategy: "fixed",
  });

  if (updateTokens.get(surface) !== token || !surface.isConnected) return;

  const referenceHidden = result.middlewareData.hide?.referenceHidden === true;
  surface.toggleAttribute("data-reference-hidden", referenceHidden);
  surface.style.visibility = referenceHidden ? "hidden" : "visible";
  surface.dataset.placement = result.placement.split("-")[0];
  surface.style.left = `${result.x}px`;
  surface.style.top = `${result.y}px`;
}

export function trackFloatingSurface(surface, reference, options) {
  if (!(surface instanceof HTMLElement) || !isReference(reference)) return () => {};

  const update = () => void positionFloatingSurface(surface, reference, options);
  const cleanup = autoUpdate(reference, surface, update, {
    ancestorResize: true,
    ancestorScroll: true,
    elementResize: true,
    layoutShift: true,
  });

  update();
  return () => {
    updateTokens.set(surface, (updateTokens.get(surface) ?? 0) + 1);
    cleanup();
  };
}
