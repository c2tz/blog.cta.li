import PhotoSwipeLightbox from "photoswipe/lightbox";
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
    button.setAttribute("aria-label", "Copier le code");

    const label = document.createElement("span");
    label.textContent = "Copier le code";

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
        setTimeout(() => {
          button.classList.remove(className);
          label.textContent = "Copier le code";
        }, 1000);
      };

      const copied = await copyToClipboard(codeBlock.innerText);
      mark(copied ? "is-copied" : "is-error", copied ? "Copié" : "Erreur");
    });

    actions.appendChild(button);
    header.append(langEl, actions);
    shell.insertBefore(header, pre);
  });
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
        link.setAttribute("data-pswp-item", "");

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

function fileNameFromURL(url) {
  try {
    const parsed = new URL(url, location.href);
    return decodeURIComponent(parsed.pathname.split("/").pop() || "image");
  } catch {
    return "image";
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
  pswpModule: () => import("photoswipe"),
  initialZoomLevel: "fit",
  secondaryZoomLevel: (zoomLevel) => zoomLevel.fit * 2.5,
  maxZoomLevel: 5,
});

lightbox.on("uiRegister", () => {
  const pswp = lightbox.pswp;
  const ui = pswp?.ui;
  if (!pswp || !ui) return;

  attachWheelZoom(pswp);

  if (!window.matchMedia("(pointer: coarse)").matches && window.innerWidth >= 768) {
    ui.registerElement({
      name: "custom-fullscreen",
      order: 1,
      appendTo: "bar",
      isButton: true,
      tagName: "button",
      className: "pswp__button custom pswp__button--fullscreen",
      ariaLabel: "Plein écran",
      html: '<svg aria-hidden="true" class="pswp__icn" width="32" height="32" viewBox="0 -960 960 960"><path fill="currentColor" d="M120-120v-200h80v120h120v80H120Zm520 0v-80h120v-120h80v200H640ZM120-640v-200h200v80H200v120h-80Zm640 0v-120H640v-80h200v200h-80Z"/></svg>',
      onClick: (_event, el, instance) => {
        const root = instance.element || document.documentElement;
        if (!document.fullscreenElement) {
          root.requestFullscreen?.();
        } else {
          document.exitFullscreen?.();
        }
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
  initCodeBlocks();
  initLightbox();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp, { once: true });
} else {
  initApp();
}

addEventListener("astro:page-load", initApp);
