import { hideSiteTooltip } from "./site-tooltips.js";
import { fileNameFromURL } from "./url.js";

export function wrapMarkdownImages() {
  document.querySelectorAll(".site-prose").forEach((container) => {
    container
      .querySelectorAll("img:not([data-no-lightbox])")
      .forEach((img) => {
        if (img.closest("header, footer, nav, [data-no-lightbox], a")) return;
        if (!img.src) return;
        const imageRect = img.getBoundingClientRect();
        const isPriorityImage =
          img.loading === "eager" ||
          img.getAttribute("fetchpriority") === "high" ||
          (imageRect.bottom >= -240 && imageRect.top <= window.innerHeight + 240);

        const initialSrc = img.currentSrc || img.src;
        const link = document.createElement("a");
        const setLightboxLabel = (src) => {
          const filename = fileNameFromURL(src);
          link.setAttribute("aria-label", `Agrandir l'image : ${filename}`);
          link.setAttribute("title", filename);
        };

        link.href = initialSrc;
        link.setAttribute("data-pswp-item", "");
        setLightboxLabel(initialSrc);

        link.addEventListener("keydown", (event) => {
          if (event.key !== " ") return;
          event.preventDefault();
          link.click();
        });
        link.addEventListener("click", hideSiteTooltip);

        const setSize = () => {
          const src = img.currentSrc || img.src;
          const width =
            img.naturalWidth || parseInt(img.getAttribute("width") || "0") || 1400;
          const height =
            img.naturalHeight || parseInt(img.getAttribute("height") || "0") || 933;
          link.href = src;
          link.setAttribute("data-pswp-width", String(width));
          link.setAttribute("data-pswp-height", String(height));
          setLightboxLabel(src);
        };

        if (img.complete) {
          setSize();
        } else {
          img.addEventListener("load", setSize, { once: true });
        }

        img.parentNode?.insertBefore(link, img);
        link.appendChild(img);
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
        img.decode?.().catch(() => {}).finally(finishReveal);
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

  img.decode?.().catch(() => {}).finally(finishReveal);
}

export function initBlogImageReveal() {
  const images = document.querySelectorAll(
    ".site-prose img:not([data-no-image-reveal])",
  );
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
