export const LIGHTBOX_OPEN_DURATION = 460;
export const LIGHTBOX_CLOSE_DURATION = 280;

const OPEN_EASING = "cubic-bezier(0.2, 0, 0, 1)";
const CLOSE_EASING = "cubic-bezier(0.3, 0, 0.8, 0.15)";
const FALLBACK_RADIUS = "0px";

function getSlideThumb(slide) {
  const source = slide?.data?.element;
  if (!source) return null;
  return source.matches?.("img") ? source : source.querySelector?.("img");
}

function getVisibleSlideImage(pswp) {
  return pswp.currSlide?.content?.element instanceof HTMLImageElement
    ? pswp.currSlide.content.element
    : pswp.element?.querySelector(".pswp__img:not(.pswp__img--placeholder)");
}

function getTargetRect(pswp) {
  const image = getVisibleSlideImage(pswp);
  const imageRect = image?.getBoundingClientRect();
  if (imageRect?.width && imageRect.height) return imageRect;

  const containerRect = pswp.currSlide?.container?.getBoundingClientRect();
  if (containerRect?.width && containerRect.height) return containerRect;

  const slide = pswp.currSlide;
  const zoom = slide?.currZoomLevel || slide?.zoomLevels?.initial;
  if (!slide?.width || !slide.height || !zoom) return null;

  return {
    height: slide.height * zoom,
    left: slide.pan.x,
    top: slide.pan.y,
    width: slide.width * zoom,
  };
}

function getImageSource(image) {
  return image?.currentSrc || image?.src || "";
}

function getThumbRadius(thumb) {
  return thumb?.dataset["lightboxThumbRadius"] || getComputedStyle(thumb).borderRadius;
}

function createMotionLayer({ duration, easing, from, fromRadius, opening, source, to, toRadius }) {
  const layer = document.createElement("div");
  const image = document.createElement("img");
  const backdropOpacity = opening ? [0, 0.68] : [0.68, 0];
  const animationDuration = Math.max(0, duration - 16);

  layer.className = "lightbox-motion-layer";
  image.className = "lightbox-motion-image";
  image.alt = "";
  image.src = source;
  image.style.left = `${from.left}px`;
  image.style.top = `${from.top}px`;
  image.style.width = `${from.width}px`;
  image.style.height = `${from.height}px`;
  image.style.borderRadius = fromRadius;
  layer.append(image);
  document.body.append(layer);

  layer.animate(
    [
      { backgroundColor: `rgb(0 0 0 / ${backdropOpacity[0]})` },
      { backgroundColor: `rgb(0 0 0 / ${backdropOpacity[1]})` },
    ],
    { duration: animationDuration, easing, fill: "both" },
  );
  const imageKeyframes = [
    {
      borderRadius: fromRadius,
      height: `${from.height}px`,
      left: `${from.left}px`,
      top: `${from.top}px`,
      width: `${from.width}px`,
    },
    ...(!opening ? [{ borderRadius: toRadius, offset: 0.78 }] : []),
    {
      borderRadius: toRadius,
      height: `${to.height}px`,
      left: `${to.left}px`,
      top: `${to.top}px`,
      width: `${to.width}px`,
    },
  ];
  image.animate(imageKeyframes, {
    duration: animationDuration,
    easing,
    fill: "both",
  });

  return layer;
}

export function initLightboxMotion(pswp) {
  let motionLayer = null;

  const cleanup = () => {
    motionLayer?.remove();
    motionLayer = null;
    pswp.element?.classList.remove("pswp--custom-motion");
  };

  const play = ({ duration, easing, opening }) => {
    if (!duration || typeof Element.prototype.animate !== "function") return;

    const thumb = getSlideThumb(pswp.currSlide);
    const slideImage = getVisibleSlideImage(pswp);
    const thumbRect = thumb?.getBoundingClientRect();
    const slideRect = getTargetRect(pswp);
    if (!thumb || !thumbRect?.width || !thumbRect.height || !slideRect) return;

    const source = getImageSource(opening ? thumb : slideImage) || getImageSource(thumb);
    if (!source) return;

    cleanup();
    pswp.element?.classList.add("pswp--custom-motion");
    motionLayer = createMotionLayer({
      duration,
      easing,
      from: opening ? thumbRect : slideRect,
      fromRadius: opening ? getThumbRadius(thumb) : FALLBACK_RADIUS,
      opening,
      source,
      to: opening ? slideRect : thumbRect,
      toRadius: opening ? FALLBACK_RADIUS : getThumbRadius(thumb),
    });
  };

  pswp.on("openingAnimationStart", () => {
    play({
      duration: pswp.options.showAnimationDuration,
      easing: OPEN_EASING,
      opening: true,
    });
  });
  pswp.on("openingAnimationEnd", cleanup);
  pswp.on("closingAnimationStart", () => {
    play({
      duration: pswp.options.hideAnimationDuration,
      easing: CLOSE_EASING,
      opening: false,
    });
  });
  pswp.on("closingAnimationEnd", cleanup);
  pswp.on("destroy", cleanup);
}
