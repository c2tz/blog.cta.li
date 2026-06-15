import PhotoSwipeLightbox from "photoswipe/lightbox";
import PhotoSwipe from "photoswipe";
import "photoswipe/style.css";

function createIcon(className, path) {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 -960 960 960");
  icon.setAttribute("width", "16");
  icon.setAttribute("height", "16");
  icon.setAttribute("fill", "currentColor");
  icon.classList.add("code-icon", className);
  icon.innerHTML = `<path d="${path}"/>`;
  return icon;
}

const FULLSCREEN_ICON_PATH =
  "M120-120v-200h80v120h120v80H120Zm520 0v-80h120v-120h80v200H640ZM120-640v-200h200v80H200v120h-80Zm640 0v-120H640v-80h200v200h-80Z";
const CLOSE_FULLSCREEN_ICON_PATH =
  "m136-80-56-56 264-264H160v-80h320v320h-80v-184L136-80Zm344-400v-320h80v184l264-264 56 56-264 264h184v80H480Z";
const SCROLL_TOP_ICON_PATH =
  "M440-727 256-544l-56-56 280-280 280 280-56 57-184-184v287h-80v-287Zm0 487v-120h80v120h-80Zm0 160v-80h80v80h-80Z";

function getScrollProgress() {
  const doc = document.documentElement;
  const scrollTop = window.scrollY || doc.scrollTop || document.body.scrollTop || 0;
  const scrollable = Math.max(doc.scrollHeight - window.innerHeight, 1);

  return Math.min(100, Math.max(0, Math.round((scrollTop / scrollable) * 100)));
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    const selection = document.getSelection();
    const selectedRange =
      selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.inset = "0 auto auto 0";
    textarea.style.opacity = "0";

    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    let copied = false;
    try {
      copied = document.execCommand("copy");
    } finally {
      textarea.remove();
      if (selectedRange && selection) {
        selection.removeAllRanges();
        selection.addRange(selectedRange);
      }
    }

    return copied;
  }
}

function initCodeBlocks() {
  document.querySelectorAll("pre > code").forEach((codeBlock) => {
    const pre = codeBlock.parentElement;
    if (!pre || pre.dataset.styled === "1") return;
    pre.dataset.styled = "1";
    pre.removeAttribute("tabindex");

    const langClass = Array.from(codeBlock.classList).find((className) =>
      className.startsWith("language-"),
    );
    const preLangClass = Array.from(pre.classList).find((className) =>
      className.startsWith("language-"),
    );
    const dataLang =
      codeBlock.getAttribute("data-language") ||
      codeBlock.getAttribute("data-lang") ||
      pre.getAttribute("data-language") ||
      pre.getAttribute("data-lang");

    const lang =
      langClass?.replace("language-", "") ||
      preLangClass?.replace("language-", "") ||
      dataLang?.toLowerCase() ||
      "code";

    const shell = document.createElement("div");
    shell.className = "code-shell";
    pre.parentNode?.insertBefore(shell, pre);
    shell.appendChild(pre);

    const header = document.createElement("div");
    header.className = "code-header";

    const langEl = document.createElement("div");
    langEl.className = "code-lang";
    langEl.textContent = lang;

    const actions = document.createElement("div");
    actions.className = "code-actions";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "code-copy-btn";
    button.tabIndex = 0;
    button.setAttribute("aria-label", "Copier le code");
    button.setAttribute("aria-keyshortcuts", "Enter Space");

    const label = document.createElement("span");
    label.textContent = "Copier le code";

    const status = document.createElement("span");
    status.className = "sr-only code-copy-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");

    button.append(
      createIcon(
        "code-copy-icon",
        "M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z",
      ),
      createIcon(
        "code-check-icon",
        "M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z",
      ),
      createIcon(
        "code-error-icon",
        "M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm-40-160h80v-240h-80v240Zm40 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z",
      ),
      label,
    );

    button.addEventListener("click", async () => {
      const mark = (className, text) => {
        button.classList.remove("is-copied", "is-error");
        button.classList.add(className);
        label.textContent = text;
        button.setAttribute("aria-label", text);
        status.textContent = text;
        setTimeout(() => {
          button.classList.remove(className);
          label.textContent = "Copier le code";
          button.setAttribute("aria-label", "Copier le code");
        }, 1000);
      };

      const copied = await copyToClipboard(codeBlock.innerText);
      mark(copied ? "is-copied" : "is-error", copied ? "Copié" : "Erreur");
    });

    actions.appendChild(button);
    actions.appendChild(status);
    header.append(langEl, actions);
    shell.insertBefore(header, pre);
  });
}

function initTooltipGate() {
  const root = document.documentElement;
  if (root.classList.contains("tooltips-active")) return;

  const activate = () => {
    root.classList.add("tooltips-active");
    window.removeEventListener("pointerdown", activate);
    window.removeEventListener("pointermove", activate);
    window.removeEventListener("keydown", activate);
    window.removeEventListener("touchstart", activate);
  };

  window.addEventListener("pointerdown", activate, { once: true, passive: true });
  window.addEventListener("pointermove", activate, { once: true, passive: true });
  window.addEventListener("keydown", activate, { once: true });
  window.addEventListener("touchstart", activate, { once: true, passive: true });
}

function initSiteTooltips() {
  document.querySelectorAll("[title]").forEach((element) => {
    const title = element.getAttribute("title");
    if (!title) return;

    element.setAttribute("data-tooltip", title);
    element.removeAttribute("title");
    element.classList.add("site-tooltip");

    if (!element.hasAttribute("aria-label")) {
      element.setAttribute("aria-label", title);
    }

    if (
      !element.matches("a, button, input, select, textarea, summary") &&
      !element.hasAttribute("tabindex")
    ) {
      element.setAttribute("tabindex", "0");
    }
  });

  document.querySelectorAll("[data-footnote-backref]").forEach((backref) => {
    backref.setAttribute("aria-label", "Retour au contenu");
    backref.setAttribute("data-tooltip", "Retour au contenu");
    backref.classList.add("site-tooltip");

    if (!backref.dataset.footnoteEnhanced) {
      backref.dataset.footnoteEnhanced = "true";
      backref.addEventListener("click", () => {
        const hash = backref.getAttribute("href");
        if (!hash?.startsWith("#")) return;

        requestAnimationFrame(() => {
          const target = document.getElementById(decodeURIComponent(hash.slice(1)));
          if (target && !target.hasAttribute("tabindex")) {
            target.setAttribute("tabindex", "-1");
          }
          target?.scrollIntoView({ behavior: "smooth", block: "center" });
          target?.focus?.({ preventScroll: true });
        });
      });
    }
  });
}

function initBackToTopButton() {
  const existingButton = document.querySelector(".site-scroll-top");
  if (existingButton) {
    syncBackToTopButton(existingButton);
    return;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "site-scroll-top site-tooltip";
  button.setAttribute("aria-label", "Retour en haut");
  button.setAttribute("data-tooltip", "Retour en haut");
  button.innerHTML = `
    <span class="site-scroll-top__clip" aria-hidden="true">
      <span class="site-scroll-top__state"></span>
      <span class="site-scroll-top__ripple"></span>
    </span>
    <svg aria-hidden="true" viewBox="0 -960 960 960" focusable="false">
      <path d="${SCROLL_TOP_ICON_PATH}"></path>
    </svg>
    <span class="site-scroll-top__count" data-scroll-progress-count aria-hidden="true">0</span>
  `;

  button.addEventListener("pointerdown", (event) => {
    const rect = button.getBoundingClientRect();
    button.style.setProperty("--ripple-x", `${event.clientX - rect.left}px`);
    button.style.setProperty("--ripple-y", `${event.clientY - rect.top}px`);
    button.classList.remove("is-rippling");
    button.getBoundingClientRect();
    button.classList.add("is-rippling");
    window.setTimeout(() => button.classList.remove("is-rippling"), 480);
  });

  button.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  window.addEventListener("scroll", () => syncBackToTopButton(button), { passive: true });
  window.addEventListener("resize", () => syncBackToTopButton(button), { passive: true });
  document.body.appendChild(button);
  syncBackToTopButton(button);
}

function syncBackToTopButton(button) {
  const progress = getScrollProgress();
  const isVisible = window.scrollY > 100;
  const count = button.querySelector("[data-scroll-progress-count]");

  button.classList.toggle("is-visible", isVisible);
  button.tabIndex = isVisible ? 0 : -1;
  button.setAttribute("aria-label", `Retour en haut, progression ${progress} %`);
  if (count) count.textContent = String(progress);
}

function initScrollProgressBar() {
  const existingBar = document.querySelector(".site-scroll-progress");
  if (existingBar) {
    syncScrollProgressBar(existingBar);
    return;
  }

  const bar = document.createElement("div");
  bar.className = "site-scroll-progress";
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-label", "Progression de lecture");
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", "100");
  bar.innerHTML = '<span class="site-scroll-progress__bar"></span>';

  window.addEventListener("scroll", () => syncScrollProgressBar(bar), { passive: true });
  window.addEventListener("resize", () => syncScrollProgressBar(bar), { passive: true });
  document.body.appendChild(bar);
  syncScrollProgressBar(bar);
}

function syncScrollProgressBar(bar) {
  const progress = getScrollProgress();
  const fill = bar.querySelector(".site-scroll-progress__bar");

  bar.setAttribute("aria-valuenow", String(progress));
  fill?.style.setProperty("--scroll-progress", `${progress / 100}`);
}

function wrapMarkdownImages() {
  document.querySelectorAll(".site-prose").forEach((container) => {
    container
      .querySelectorAll("img:not([data-no-lightbox])")
      .forEach((img) => {
        if (img.closest("header, footer, nav, [data-no-lightbox], a")) return;
        if (!img.src) return;

        const link = document.createElement("a");
        link.href = img.src;
        link.tabIndex = 0;
        link.setAttribute("data-pswp-item", "");
        link.setAttribute(
          "aria-label",
          img.alt ? `Agrandir l'image : ${img.alt}` : `Agrandir l'image ${fileNameFromURL(img.src)}`,
        );

        link.addEventListener("keydown", (event) => {
          if (event.key !== " ") return;
          event.preventDefault();
          link.click();
        });

        const setSize = () => {
          const width =
            img.naturalWidth || parseInt(img.getAttribute("width") || "0") || 1400;
          const height =
            img.naturalHeight || parseInt(img.getAttribute("height") || "0") || 933;
          link.setAttribute("data-pswp-width", String(width));
          link.setAttribute("data-pswp-height", String(height));
        };

        if (img.complete) {
          setSize();
        } else {
          img.addEventListener("load", setSize, { once: true });
        }

        img.parentNode?.insertBefore(link, img);
        link.appendChild(img);
        img.decoding = "async";
        img.loading = img.loading === "eager" ? "eager" : "lazy";
      });
  });
}

function initKeyboardAccessibleTargets() {
  document.querySelectorAll("a[href]").forEach((link) => {
    if (!link.hasAttribute("tabindex")) link.setAttribute("tabindex", "0");
  });

  document.querySelectorAll("main :is(h1, h2, h3, h4, h5, h6)").forEach((heading) => {
    if (heading.closest("nav") || heading.querySelector("a[href]")) return;
    if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "0");
  });
}

function fileNameFromURL(url) {
  try {
    const parsed = new URL(url, location.href);
    return decodeURIComponent(parsed.pathname.split("/").pop() || "image");
  } catch {
    return "image";
  }
}

function enhancePhotoSwipeButton(button, label) {
  const topBar = button.closest(".pswp__top-bar");
  const contrastScope = topBar ? "bar" : "button";

  topBar?.classList.add("pswp__top-bar--contrast");
  button.setAttribute("aria-label", label);
  button.removeAttribute("title");
  button.dataset.tooltip = label;
  button.dataset.contrast = "true";
  button.dataset.contrastScope = contrastScope;
  button.setAttribute("type", "button");
  button.classList.add("pswp__button--contrast");
  button.style.setProperty("color", "#fff", "important");
  button.style.setProperty(
    "mix-blend-mode",
    contrastScope === "bar" ? "normal" : "difference",
    "important",
  );
  button.style.setProperty("overflow", "visible", "important");
  button.style.setProperty("filter", "none", "important");
  button.tabIndex = button.hasAttribute("disabled") ? -1 : 0;

  button.querySelectorAll(".pswp__icn, svg, path").forEach((icon) => {
    icon.style.setProperty("color", "#fff", "important");
    icon.style.setProperty("fill", "currentColor", "important");
    icon.style.setProperty(
      "mix-blend-mode",
      contrastScope === "bar" ? "normal" : "difference",
      "important",
    );
    icon.style.setProperty("filter", "none", "important");
    if (icon.hasAttribute("stroke")) {
      icon.style.setProperty("stroke", "currentColor", "important");
    }
  });

  if (!button.dataset.keyboardEnhanced) {
    button.dataset.keyboardEnhanced = "true";
    button.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      button.click();
    });
  }
}

async function downloadViaFetch(url, filename) {
  const res = await fetch(url, { mode: "cors" });
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}

function getSlideThumb(slide) {
  const source = slide?.data?.element;
  if (!source) return null;
  return source.matches?.("img") ? source : source.querySelector?.("img");
}

function syncThumbRadiusTransition(img, pswp) {
  if (!img) return;
  const duration = pswp.element
    ? getComputedStyle(pswp.element).getPropertyValue("--pswp-transition-duration").trim()
    : "";
  img.style.transitionDuration = duration || "";
  img.style.transitionTimingFunction = "cubic-bezier(0.4, 0, 0.22, 1)";
}

function cleanupThumbRadiusTransition(img) {
  if (!img) return;
  img.style.removeProperty("transition-duration");
  img.style.removeProperty("transition-timing-function");
}

function transitionThumbRadiusFlat(img, pswp) {
  if (!img) return;
  syncThumbRadiusTransition(img, pswp);
  img.getBoundingClientRect();
  img.classList.add("is-lightbox-radius-flat");
}

function hideThumbBehindLightbox(img, pswp) {
  if (!img) return;
  syncThumbRadiusTransition(img, pswp);
  img.getBoundingClientRect();
  img.classList.add("is-lightbox-thumb-hidden");
}

function revealThumbAfterClose(img, onDone) {
  if (!img) return;
  requestAnimationFrame(() => {
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
  img.classList.remove("is-lightbox-radius-flat");
  cleanupThumbRadiusTransition(img);
  requestAnimationFrame(() => img.classList.remove("is-lightbox-radius-instant"));
}

function transitionPhotoSwipeImageRadius(pswp, radius) {
  pswp.element?.querySelectorAll(".pswp__img").forEach((img) => {
    img.classList.add("pswp__img--radius-transition");
    img.style.borderRadius = radius;
  });
}

function initLightboxRadiusTransition(pswp) {
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

  pswp.on("contentAppendImage", ({ content }) => {
    const img = content?.element;
    if (!(img instanceof HTMLImageElement)) return;
    img.classList.add("pswp__img--radius-transition");
    img.style.borderRadius = "16px";
    requestAnimationFrame(() => {
      img.style.borderRadius = "0px";
    });
  });

  pswp.on("openingAnimationStart", () => {
    thumb = getSlideThumb(pswp.currSlide);
    hideThumb(thumb);
    keepThumbFlat(thumb);
    requestAnimationFrame(() => transitionPhotoSwipeImageRadius(pswp, "0px"));
  });

  pswp.on("closingAnimationStart", () => {
    thumb = getSlideThumb(pswp.currSlide) || thumb;
    resetInactiveThumbs(thumb);
    transitionPhotoSwipeImageRadius(pswp, "0px");
  });

  pswp.on("closingAnimationEnd", () => {
    cleanupThumbRadiusTransition(thumb);
    restoreThumbRadiusInstant(thumb);
    revealThumbAfterClose(thumb, () => hiddenThumbs.delete(thumb));
    flatThumbs.delete(thumb);
  });

  pswp.on("destroy", () => {
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
    );
    thumb = null;
  });
}

function syncFullscreenButton(button) {
  const isFullscreen = Boolean(document.fullscreenElement);
  const label = isFullscreen ? "Quitter le plein écran" : "Plein écran";
  const path = button.querySelector("path");

  path?.setAttribute("d", isFullscreen ? CLOSE_FULLSCREEN_ICON_PATH : FULLSCREEN_ICON_PATH);
  enhancePhotoSwipeButton(button, label);
}

function attachWheelZoom(pswp) {
  const onWheel = (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();

    const slide = pswp.currSlide;
    if (!slide) return;

    const current = slide.currZoomLevel || slide.zoomLevels.initial;
    const next = Math.min(
      slide.zoomLevels.max,
      Math.max(slide.zoomLevels.min, current * Math.exp(-(event.deltaY || 0) * 0.005)),
    );

    pswp.zoomTo(next, { x: event.clientX, y: event.clientY }, 220);
  };

  pswp.on("bindEvents", () => {
    pswp.element?.addEventListener("wheel", onWheel, { passive: false });
  });
  pswp.on("destroy", () => {
    pswp.element?.removeEventListener("wheel", onWheel);
  });
}

const lightbox = new PhotoSwipeLightbox({
  gallery: ".site-prose",
  children: "a[data-pswp-item]",
  pswpModule: PhotoSwipe,
  initialZoomLevel: "fit",
  secondaryZoomLevel: (zoomLevel) => zoomLevel.fit * 2.5,
  maxZoomLevel: 5,
  arrowPrevTitle: "Image précédente",
  arrowNextTitle: "Image suivante",
  closeTitle: "Fermer",
  zoomTitle: "Zoomer",
});

lightbox.on("uiRegister", () => {
  const pswp = lightbox.pswp;
  const ui = pswp?.ui;
  if (!pswp || !ui) return;

  attachWheelZoom(pswp);
  initLightboxRadiusTransition(pswp);

  const fullscreenButtons = new Set();
  const syncFullscreenButtons = () => {
    fullscreenButtons.forEach((button) => {
      if (!button.isConnected) {
        fullscreenButtons.delete(button);
        return;
      }

      syncFullscreenButton(button);
    });
  };

  document.addEventListener("fullscreenchange", syncFullscreenButtons);
  pswp.on("destroy", () => {
    document.removeEventListener("fullscreenchange", syncFullscreenButtons);
    fullscreenButtons.clear();
  });

  const localizeButtons = () => {
    const labels = {
      ".pswp__button--arrow--prev": "Image précédente",
      ".pswp__button--arrow--next": "Image suivante",
      ".pswp__button--close": "Fermer",
      ".pswp__button--zoom": "Zoomer",
      ".pswp__button--fullscreen": "Plein écran",
      ".pswp__button--download": "Télécharger",
    };

    for (const [selector, label] of Object.entries(labels)) {
      pswp.element?.querySelectorAll(selector).forEach((button) => {
        if (selector === ".pswp__button--fullscreen") {
          fullscreenButtons.add(button);
          syncFullscreenButton(button);
        } else {
          enhancePhotoSwipeButton(button, label);
        }
      });
    }
  };

  const enhanceButtons = () => requestAnimationFrame(localizeButtons);

  pswp.on("afterInit", enhanceButtons);
  pswp.on("bindEvents", enhanceButtons);
  pswp.on("change", enhanceButtons);

  if (!window.matchMedia("(pointer: coarse)").matches && window.innerWidth >= 768) {
    ui.registerElement({
      name: "custom-fullscreen",
      order: 1,
      appendTo: "bar",
      isButton: true,
      tagName: "button",
      className: "pswp__button custom pswp__button--fullscreen",
      ariaLabel: "Plein écran",
      html: `<svg aria-hidden="true" class="pswp__icn" width="32" height="32" viewBox="0 -960 960 960"><path fill="currentColor" d="${FULLSCREEN_ICON_PATH}"/></svg>`,
      onInit: (el) => {
        fullscreenButtons.add(el);
        syncFullscreenButton(el);
      },
      onClick: (_event, el, instance) => {
        const root = instance.element || document.documentElement;
        if (!document.fullscreenElement) {
          root.requestFullscreen?.()?.catch?.(() => {});
        } else {
          document.exitFullscreen?.()?.catch?.(() => {});
        }
        requestAnimationFrame(() => syncFullscreenButton(el));
      },
    });
  }

  ui.registerElement({
    name: "download",
    order: 110,
    appendTo: "bar",
    isButton: true,
    tagName: "button",
    className: "pswp__button pswp__button--download custom",
    ariaLabel: "Télécharger",
    html: '<svg aria-hidden="true" class="pswp__icn" viewBox="0 -960 960 960" width="32" height="32"><path d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z" fill="currentColor"/></svg>',
    onInit: (el) => enhancePhotoSwipeButton(el, "Télécharger"),
    onClick: async (_event, _el, instance) => {
      const src = instance.currSlide?.data?.src;
      if (!src) return;

      try {
        await downloadViaFetch(src, fileNameFromURL(src));
      } catch {
        window.open(src, "_blank", "noopener");
      }
    },
  });

  ui.registerElement({
    name: "custom-close",
    order: 120,
    appendTo: "bar",
    isButton: true,
    tagName: "button",
    className: "pswp__button custom pswp__button--close",
    ariaLabel: "Fermer",
    html: '<svg aria-hidden="true" class="pswp__icn" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="32" height="32"><path fill="currentColor" d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>',
    onInit: (el) => enhancePhotoSwipeButton(el, "Fermer"),
    onClick: (_event, _el, instance) => instance.close(),
  });
});

let isLightboxInitialized = false;

function initLightbox() {
  wrapMarkdownImages();

  if (isLightboxInitialized) {
    try {
      lightbox.refresh();
    } catch {}
    return;
  }

  lightbox.init();
  isLightboxInitialized = true;
}

function initApp() {
  initTooltipGate();
  initSiteTooltips();
  initCodeBlocks();
  initLightbox();
  initKeyboardAccessibleTargets();
  initScrollProgressBar();
  initBackToTopButton();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp, { once: true });
} else {
  initApp();
}

addEventListener("astro:page-load", initApp);
