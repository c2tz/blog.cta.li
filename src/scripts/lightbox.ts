// src/scripts/lightbox.ts
import PhotoSwipeLightbox from "photoswipe/lightbox";
import "photoswipe/style.css";

function wrapMarkdownImages() {
  const containers = document.querySelectorAll(".prose, article, main");
  containers.forEach((container) => {
    const imgs = container.querySelectorAll<HTMLImageElement>("img:not([data-no-lightbox])");
    imgs.forEach((img) => {
      if (img.closest("a[data-pswp-item]")) return;
      if (!img.src) return;
      const a = document.createElement("a");
      a.href = img.src;
      a.setAttribute("data-pswp-item", "");

      const setSize = () => {
        const w = img.naturalWidth || parseInt(img.getAttribute("width") || "0") || 1400;
        const h = img.naturalHeight || parseInt(img.getAttribute("height") || "0") || 933;
        a.setAttribute("data-pswp-width", String(w));
        a.setAttribute("data-pswp-height", String(h));
      };

      if (img.complete) setSize();
      else img.addEventListener("load", () => { setSize(); try { (lightbox as any)?.refresh(); } catch {} });

      img.parentNode?.insertBefore(a, img);
      a.appendChild(img);
      img.style.cursor = "zoom-in";
      img.decoding = "async";
      const loadingAttr = img.getAttribute("loading");
      if (loadingAttr === "eager" || loadingAttr === "lazy") {
        img.loading = loadingAttr;
      } else {
        img.loading = "lazy";
      }
    });
  });
}

const lightbox = new PhotoSwipeLightbox({
  gallery: ".prose, article, main",
  children: "a[data-pswp-item]",
  pswpModule: () => import("photoswipe"),
  // Zoom plus sensible mais on garde le scroll du pavé tactile pour le pan
  initialZoomLevel: "fit",
  secondaryZoomLevel: (zoomLevel) => zoomLevel.fit * 2.5,
  maxZoomLevel: 5,
  // Ne pas activer wheelToZoom ici, sinon le scroll du pavé tactile devient un zoom
});

function fileNameFromURL(url: string) {
  try {
    const u = new URL(url, location.href);
    const name = u.pathname.split("/").pop() || "image";
    return decodeURIComponent(name);
  } catch {
    return "image";
  }
}

async function downloadViaFetch(url: string, filename: string) {
  const res = await fetch(url, { mode: "cors" });
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(blobUrl);
}

function attachFasterWheelZoom(pswp: any) {
  const SENSITIVITY = 0.5; // augmenter pour un zoom plus agressif
  const DURATION = 220;

  const onWheel = (e: WheelEvent) => {
    // Ne traiter que les gestes de pinch (souvent ctrl+wheel ou meta+wheel),
    // laisser le scroll normal servir au déplacement (pan)
    const isPinchGesture = e.ctrlKey || e.metaKey;
    if (!isPinchGesture) return;

    e.preventDefault();

    const slide = pswp.currSlide;
    if (!slide) return;

    const { min, max } = slide.zoomLevels;
    const current = pswp.currSlide.currZoomLevel || slide.zoomLevels.initial;
    const delta = e.deltaY || 0;
    const factor = Math.exp(-delta * (SENSITIVITY / 100));
    let next = current * factor;

    if (next < min) next = min;
    if (next > max) next = max;

    pswp.zoomTo(next, { x: e.clientX, y: e.clientY }, DURATION);
  };

  pswp.on("bindEvents", () => {
    pswp.element?.addEventListener("wheel", onWheel, { passive: false });
  });
  pswp.on("destroy", () => {
    pswp.element?.removeEventListener("wheel", onWheel as any);
  });
}

/* ---------- UI ICONES FULLSCREEN + FLECHES UNIQUEMENT ---------- */
lightbox.on("uiRegister", () => {
  const pswp = lightbox.pswp;
  if (!pswp) return;

  const ui = pswp.ui;
  if (!ui) return;

  attachFasterWheelZoom(pswp);
  const isMobile = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768;

  const css = `
    /* Icônes blanches + ombre visible sur fond clair */
    .pswp__button .pswp__icn {
      color: #fff;
      fill: currentColor;
      stroke: currentColor;
      text-shadow: 1px 1px 3px rgba(0,0,0,0.7);
      filter: drop-shadow(1px 1px 3px rgba(0,0,0,0.7));
    }
    .pswp__icn-shadow { display: none !important; }

    /* Cacher les boutons de zoom (desktop et mobile) */
    .pswp__button--zoom,
    .pswp__button--zoom-in,
    .pswp__button--zoom-out {
      display: none !important;
    }
    .pswp__button--close:not(.custom) {
      display: none !important;
    }

    /* Fullscreen tout à gauche */
    .pswp__button--fullscreen {
      order: -10;
      margin-inline-start: 12px;
    }
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  if (!isMobile) {
    ui.registerElement({
      name: "custom-fullscreen",
      order: 1,
      appendTo: "bar",
      isButton: true,
      tagName: "button",
      className: "pswp__button custom pswp__button--fullscreen",
      ariaLabel: "Plein écran",
      html: `
        <svg aria-hidden="true" class="pswp__icn" width="32" height="32" viewBox="0 -960 960 960">
          <path fill="currentColor"
            d="M120-120v-200h80v120h120v80H120Zm520 0v-80h120v-120h80v200H640ZM120-640v-200h200v80H200v120h-80Zm640 0v-120H640v-80h200v200h-80Z"/>
        </svg>
      `,
      onClick: (_e, el, pswp) => {
        const root = pswp.element || document.documentElement;
        if (!document.fullscreenElement) {
          root.requestFullscreen?.();
          el.innerHTML = `
            <svg aria-hidden="true" class="pswp__icn" width="32" height="32" viewBox="0 -960 960 960">
              <path fill="currentColor"
                d="M240-120v-120H120v-80h200v200h-80Zm400 0v-200h200v80H720v120h-80ZM120-640v-80h120v-120h80v200H120Zm520 0v-200h80v120h120v80H640Z"/>
            </svg>`;
        } else {
          document.exitFullscreen?.();
          el.innerHTML = `
            <svg aria-hidden="true" class="pswp__icn" width="32" height="32" viewBox="0 -960 960 960">
              <path fill="currentColor"
                d="M120-120v-200h80v120h120v80H120Zm520 0v-80h120v-120h80v200H640ZM120-640v-200h200v80H200v120h-80Zm640 0v-120H640v-80h200v200h-80Z"/>
            </svg>`;
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
    html: `
      <svg aria-hidden="true" class="pswp__icn" viewBox="0 -960 960 960" width="32" height="32">
        <path
          d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"
          fill="currentColor">
        </path>
      </svg>
    `,
    onClick: async (_e, _el, pswp) => {
      const src = pswp.currSlide?.data?.src as string | undefined;
      if (!src) return;
      const filename = fileNameFromURL(src);
      try {
        await downloadViaFetch(src, filename);
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
    html: `
      <svg aria-hidden="true" class="pswp__icn" xmlns="http://www.w3.org/2000/svg"
           viewBox="0 -960 960 960" width="32" height="32">
        <path fill="currentColor"
          d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/>
      </svg>
    `,
    onClick: (_e, _el, pswp) => pswp.close(),
  });
});

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded", () => {
  wrapMarkdownImages();
  lightbox.init();
});