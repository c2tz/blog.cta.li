import { hideSiteTooltip } from "./site-tooltips.js";
import { fileNameFromURL } from "./url.js";

function isDialogImageCandidate(img) {
  return !img.closest("header, footer, nav, [data-no-image-dialog], a, button");
}

function setImageDialogLabel(img) {
  const filename = fileNameFromURL(img.currentSrc || img.src);
  const label = img.alt.trim() || img.title.trim() || img.dataset.tooltip?.trim() || filename;
  img.setAttribute("aria-label", `Agrandir l’image : ${label}`);
  img.dataset.tooltip = label;
  img.dataset.tooltipAnchor = "cursor";
  img.removeAttribute("title");
}

export function prepareBlogImageDialogs() {
  document.querySelectorAll(".site-prose").forEach((container) => {
    container.querySelectorAll("img:not([data-no-image-dialog])").forEach((img) => {
      if (!isDialogImageCandidate(img)) return;
      if (!img.src) return;
      if (img.dataset.imageDialogPrepared === "true") {
        setImageDialogLabel(img);
        return;
      }

      img.dataset.imageDialog = "";
      img.dataset.imageDialogPrepared = "true";
      img.setAttribute("role", "button");
      img.setAttribute("aria-haspopup", "dialog");
      if (!img.hasAttribute("tabindex")) img.tabIndex = 0;
      setImageDialogLabel(img);

      const setSize = () => {
        setImageDialogLabel(img);
      };

      if (img.complete) {
        setSize();
      } else {
        img.addEventListener("load", setSize, { once: true });
      }

      if (!img.dataset.imageDialogTooltipBound) {
        img.dataset.imageDialogTooltipBound = "true";
        img.addEventListener("click", hideSiteTooltip);
      }

      img.decoding = "async";
    });
  });
}
