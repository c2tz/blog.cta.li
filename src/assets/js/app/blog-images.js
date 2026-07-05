import { hideSiteTooltip } from "./site-tooltips.js";
import { fileNameFromURL } from "./url.js";

function isDialogImageCandidate(img) {
  return !img.closest("header, footer, nav, [data-no-image-dialog], a, button");
}

function setImageDialogLabel(img) {
  const filename = fileNameFromURL(img.currentSrc || img.src);
  img.setAttribute("aria-label", `Agrandir l'image : ${filename}`);
  img.setAttribute("title", filename);
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

      const imageRect = img.getBoundingClientRect();
      const isPriorityImage =
        img.loading === "eager" ||
        img.getAttribute("fetchpriority") === "high" ||
        (imageRect.bottom >= -240 && imageRect.top <= window.innerHeight + 240);

      img.dataset.imageDialog = "";
      img.dataset.imageDialogPrepared = "true";
      img.setAttribute("role", "button");
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
      img.loading = isPriorityImage ? "eager" : "lazy";
      if (isPriorityImage) {
        img.fetchPriority = "high";
        img.setAttribute("fetchpriority", "high");
      }
    });
  });
}

function revealBlogImage(img) {
  if (img.dataset.imageRevealState === "revealed") return;

  const finishReveal = () => {
    if (img.dataset.imageRevealState === "revealed") return;
    img.dataset.imageRevealState = "revealed";
    img.classList.remove("is-blog-image-pending");
    img.classList.add("is-blog-image-revealed");
  };

  if (!img.complete) {
    img.addEventListener(
      "load",
      () => {
        img
          .decode?.()
          .catch(() => {})
          .finally(finishReveal);
      },
      { once: true },
    );
    img.addEventListener("error", finishReveal, { once: true });
    return;
  }

  if (!img.naturalWidth) {
    finishReveal();
    return;
  }

  img
    .decode?.()
    .catch(() => {})
    .finally(finishReveal);
}

export function initBlogImageReveal() {
  const images = document.querySelectorAll(".site-prose img:not([data-no-image-reveal])");
  if (!images.length) return;

  const observer =
    "IntersectionObserver" in window
      ? new IntersectionObserver(
          (entries, imageObserver) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              imageObserver.unobserve(entry.target);
              revealBlogImage(entry.target);
            });
          },
          { rootMargin: "240px 0px" },
        )
      : null;

  images.forEach((img) => {
    if (img.dataset.imageRevealState) return;

    img.dataset.imageRevealState = "pending";
    img.classList.add("blog-image-reveal", "is-blog-image-pending");

    if (observer) observer.observe(img);
    else revealBlogImage(img);
  });
}
