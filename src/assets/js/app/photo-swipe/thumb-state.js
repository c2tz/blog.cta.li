import { hideSiteTooltip } from "../site-tooltips.js";

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

function flattenThumbRadius(img) {
  if (!img) return;
  storeThumbRadius(img);
  img.style.removeProperty("border-radius");
  img.getBoundingClientRect();
  img.classList.add("is-lightbox-radius-flat");
}

function hideThumbBehindLightbox(img) {
  if (!img) return;
  storeThumbRadius(img);
  img.getBoundingClientRect();
  img.classList.add("is-lightbox-thumb-hidden");
}

function revealThumbAfterClose(img, onDone) {
  if (!img) return;
  requestAnimationFrame(() => {
    img.getBoundingClientRect();
    img.classList.remove("is-lightbox-thumb-hidden");
    requestAnimationFrame(() => {
      img.getBoundingClientRect();
      img.classList.remove("is-lightbox-thumb-hidden", "is-lightbox-thumb-fade");
      onDone?.();
    });
  });
}

function restoreThumbRadiusInstant(img) {
  if (!img) return;
  img.classList.add("is-lightbox-radius-instant");
  img.style.borderRadius = getThumbRadius(img);
  img.classList.remove("is-lightbox-radius-flat");
  img.getBoundingClientRect();
  clearThumbRadius(img);
}

function setPhotoSwipeImageRadius(pswp, radius) {
  pswp.element?.querySelectorAll(".pswp__img:not(.pswp__img--placeholder)").forEach((img) => {
    img.style.borderRadius = radius;
  });
}

export function initLightboxRadiusState(pswp) {
  pswp.addFilter("useContentPlaceholder", () => false);
  pswp.addFilter("isKeepingPlaceholder", () => false);

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
    hideThumbBehindLightbox(img);
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
    thumb = getSlideThumb(pswp.currSlide);
    hideThumb(thumb);
    keepThumbFlat(thumb);
    requestAnimationFrame(() => setPhotoSwipeImageRadius(pswp, "0px"));
  });

  pswp.on("change", () => {
    if (!pswp.opener?.isOpen || pswp.opener?.isClosing) return;
    thumb = getSlideThumb(pswp.currSlide) || thumb;
    hideThumb(thumb);
    keepThumbFlat(thumb);
    setPhotoSwipeImageRadius(pswp, "0px");
  });

  pswp.on("closingAnimationStart", () => {
    hideSiteTooltip();
    thumb = getSlideThumb(pswp.currSlide) || thumb;
    resetInactiveThumbs(thumb);
    setPhotoSwipeImageRadius(pswp, getThumbRadius(thumb));
  });

  pswp.on("closingAnimationEnd", () => {
    restoreThumbRadiusInstant(thumb);
    flatThumbs.delete(thumb);
  });

  pswp.on("destroy", () => {
    const activeThumb = thumb;

    hideSiteTooltip();
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
