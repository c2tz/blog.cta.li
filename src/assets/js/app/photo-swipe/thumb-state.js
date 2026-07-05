import { hideSiteTooltip } from "../site-tooltips.js";

const FALLBACK_THUMB_RADIUS = "0px";

function getSlideThumb(slide) {
  const source = slide?.data?.element;
  if (!source) return null;
  return source.matches?.("img") ? source : source.querySelector?.("img");
}

function getThumbRadius(img) {
  if (!img) return FALLBACK_THUMB_RADIUS;

  if (!img.dataset["lightboxThumbRadius"]) {
    img.dataset["lightboxThumbRadius"] =
      getComputedStyle(img).borderRadius || FALLBACK_THUMB_RADIUS;
  }

  return img.dataset["lightboxThumbRadius"];
}

function clearThumbRadius(img) {
  if (!img) return;
  delete img.dataset["lightboxThumbRadius"];
}

function syncThumbRadiusTransition(img, pswp) {
  if (!img || !pswp?.element) return;
  const duration = getComputedStyle(pswp.element)
    .getPropertyValue("--pswp-transition-duration")
    .trim();
  img.style.transitionDuration = duration || "";
  img.style.transitionTimingFunction = "cubic-bezier(0.2, 0, 0, 1)";
}

function cleanupThumbRadiusTransition(img) {
  if (!img) return;
  img.style.removeProperty("transition-duration");
  img.style.removeProperty("transition-timing-function");
}

function flattenThumbRadius(img) {
  if (!img) return;
  getThumbRadius(img);
  img.style.removeProperty("border-radius");
  img.getBoundingClientRect();
  img.classList.add("is-lightbox-radius-flat");
}

function hideThumbBehindLightbox(img, pswp) {
  if (!img) return;
  getThumbRadius(img);
  syncThumbRadiusTransition(img, pswp);
  img.getBoundingClientRect();
  img.classList.add("is-lightbox-thumb-hidden");
}

function revealThumbAfterClose(img, onDone) {
  if (!img) return;
  requestAnimationFrame(() => {
    img.getBoundingClientRect();
    img.classList.remove(
      "is-lightbox-thumb-hidden",
      "is-lightbox-thumb-fade",
      "is-lightbox-closing",
    );
    requestAnimationFrame(() => {
      img.classList.remove("is-lightbox-radius-instant");
      img.style.removeProperty("border-radius");
      onDone?.();
    });
  });
}

function restoreThumbRadiusInstant(img) {
  if (!img) return;
  img.classList.add("is-lightbox-radius-instant");
  img.style.borderRadius = getThumbRadius(img);
  img.classList.remove("is-lightbox-radius-flat", "is-lightbox-closing");
  cleanupThumbRadiusTransition(img);
  img.getBoundingClientRect();
  clearThumbRadius(img);
}

function transitionPhotoSwipeImageRadius(pswp, radius, { instant = false } = {}) {
  pswp.element?.querySelectorAll(".pswp__img:not(.pswp__img--placeholder)").forEach((img) => {
    img.classList.add("pswp__img--radius-transition");
    img.classList.toggle("pswp__img--radius-instant", instant);
    img.style.borderRadius = radius;
    if (instant) {
      img.getBoundingClientRect();
      requestAnimationFrame(() => img.classList.remove("pswp__img--radius-instant"));
    }
  });
}

export function initLightboxRadiusState(pswp) {
  let thumb = null;
  const flatThumbs = new Set();
  const hiddenThumbs = new Set();

  const keepThumbFlat = (img) => {
    if (!img) return;
    flatThumbs.add(img);
    flattenThumbRadius(img);
  };

  const hideThumb = (img) => {
    if (!img) return;
    hiddenThumbs.add(img);
    hideThumbBehindLightbox(img, pswp);
  };

  const activateThumb = (img) => {
    if (!img) return null;
    thumb = img;
    hideThumb(img);
    keepThumbFlat(img);
    return img;
  };

  const revealThumb = (img) => {
    if (!img) return;
    img.classList.remove("is-lightbox-thumb-hidden");
    hiddenThumbs.delete(img);
  };

  const resetInactiveThumbs = (activeThumb) => {
    flatThumbs.forEach((img) => {
      if (img === activeThumb) return;
      restoreThumbRadiusInstant(img);
      revealThumb(img);
      flatThumbs.delete(img);
    });
  };

  pswp.on("contentAppendImage", ({ content }) => {
    const img = content?.element;
    if (!(img instanceof HTMLImageElement)) return;
    img.style.borderRadius = "0px";
  });

  pswp.on("openingAnimationStart", () => {
    hideSiteTooltip();
    activateThumb(getSlideThumb(pswp.currSlide));
    requestAnimationFrame(() => transitionPhotoSwipeImageRadius(pswp, "0px"));
  });

  pswp.on("change", () => {
    if (!pswp.opener?.isOpen || pswp.opener?.isClosing) return;
    activateThumb(getSlideThumb(pswp.currSlide));
    transitionPhotoSwipeImageRadius(pswp, "0px");
  });

  pswp.on("closingAnimationStart", () => {
    hideSiteTooltip();
    pswp.element?.classList.add("pswp--closing");
    thumb = activateThumb(getSlideThumb(pswp.currSlide)) || thumb;
    thumb?.classList.add("is-lightbox-closing");
    resetInactiveThumbs(thumb);
    transitionPhotoSwipeImageRadius(pswp, getThumbRadius(thumb));
  });

  pswp.on("closingAnimationEnd", () => {
    pswp.element?.classList.remove("pswp--closing");
    restoreThumbRadiusInstant(thumb);
    flatThumbs.delete(thumb);
  });

  pswp.on("destroy", () => {
    const activeThumb = thumb;

    hideSiteTooltip();
    pswp.element?.classList.remove("pswp--closing");
    flatThumbs.forEach((img) => {
      restoreThumbRadiusInstant(img);
    });
    flatThumbs.clear();
    hiddenThumbs.forEach((img) => {
      if (img === activeThumb) return;
      revealThumb(img);
    });
    hiddenThumbs.delete(activeThumb);
    if (activeThumb) {
      revealThumbAfterClose(activeThumb);
    }
    thumb = null;
  });
}
