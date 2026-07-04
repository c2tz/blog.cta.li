import { hideSiteTooltip } from "../site-tooltips.js";

const FALLBACK_THUMB_RADIUS = "0px";

function getSlideThumb(slide) {
  const source = slide?.data?.element;
  if (!source) return null;
  return source.matches?.("img") ? source : source.querySelector?.("img");
}

function getDefaultThumbRadius() {
  return FALLBACK_THUMB_RADIUS;
}

function storeThumbRadius(img) {
  if (!img) return getDefaultThumbRadius();

  if (!img.dataset["lightboxThumbRadius"]) {
    img.dataset["lightboxThumbRadius"] =
      getComputedStyle(img).borderRadius || getDefaultThumbRadius();
  }

  return img.dataset["lightboxThumbRadius"];
}

function getThumbRadius(img) {
  return img?.dataset["lightboxThumbRadius"] || storeThumbRadius(img);
}

function clearThumbRadius(img) {
  if (!img) return;
  delete img.dataset["lightboxThumbRadius"];
}

function syncThumbRadiusTransition(img, pswp) {
  if (!img) return;
  const duration = pswp.element
    ? getComputedStyle(pswp.element).getPropertyValue("--pswp-transition-duration").trim()
    : "";
  img.style.transitionDuration = duration || "";
  img.style.transitionTimingFunction = "cubic-bezier(0.2, 0, 0, 1)";
}

function cleanupThumbRadiusTransition(img) {
  if (!img) return;
  img.style.removeProperty("transition-duration");
  img.style.removeProperty("transition-timing-function");
}

function transitionThumbRadiusFlat(img, pswp) {
  if (!img) return;
  storeThumbRadius(img);
  syncThumbRadiusTransition(img, pswp);
  img.getBoundingClientRect();
  img.classList.add("is-lightbox-radius-flat");
}

function hideThumbBehindLightbox(img, pswp) {
  if (!img) return;
  storeThumbRadius(img);
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
  const radius = getThumbRadius(img);
  img.classList.add("is-lightbox-radius-instant");
  img.style.borderRadius = radius;
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

export function initLightboxRadiusTransition(pswp) {
  let thumb = null;
  const flatThumbs = new Set();
  const hiddenThumbs = new Set();

  const keepThumbFlat = (img) => {
    if (!img) return;
    flatThumbs.add(img);
    transitionThumbRadiusFlat(img, pswp);
  };

  const hideThumb = (img) => {
    if (!img) return;
    hiddenThumbs.add(img);
    hideThumbBehindLightbox(img, pswp);
  };

  const revealThumb = (img) => {
    if (!img) return;
    img.classList.remove("is-lightbox-thumb-hidden", "is-lightbox-thumb-fade");
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

  const activateThumb = (img) => {
    resetInactiveThumbs(img);
    if (!img) return null;

    hideThumb(img);
    keepThumbFlat(img);
    thumb = img;

    return img;
  };

  pswp.on("contentAppendImage", ({ content }) => {
    const img = content?.element;
    if (!(img instanceof HTMLImageElement)) return;
    img.classList.add("pswp__img--radius-transition");
    img.style.borderRadius = getThumbRadius(getSlideThumb(content?.slide));
    requestAnimationFrame(() => {
      img.style.borderRadius = "0px";
    });
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
    transitionPhotoSwipeImageRadius(pswp, getThumbRadius(thumb));
  });

  pswp.on("closingAnimationEnd", () => {
    pswp.element?.classList.remove("pswp--closing");
    cleanupThumbRadiusTransition(thumb);
    restoreThumbRadiusInstant(thumb);
    revealThumbAfterClose(thumb, () => hiddenThumbs.delete(thumb));
    flatThumbs.delete(thumb);
  });

  pswp.on("destroy", () => {
    hideSiteTooltip();
    flatThumbs.forEach((img) => {
      restoreThumbRadiusInstant(img);
    });
    flatThumbs.clear();
    hiddenThumbs.forEach((img) => revealThumb(img));
    hiddenThumbs.clear();
    cleanupThumbRadiusTransition(thumb);
    thumb?.classList.remove(
      "is-lightbox-radius-flat",
      "is-lightbox-radius-instant",
      "is-lightbox-thumb-hidden",
      "is-lightbox-thumb-fade",
      "is-lightbox-closing",
    );
    thumb = null;
  });
}
