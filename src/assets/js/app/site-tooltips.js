import { SITE_EVENTS } from "@/lib/site-contracts";

export function hideSiteTooltip() {
  document.dispatchEvent(new CustomEvent(SITE_EVENTS.tooltipHide));
}

export function initSiteTooltips() {
  document.querySelectorAll("[title]").forEach((element) => {
    const title = element.getAttribute("title");
    if (!title) return;

    element.setAttribute("data-tooltip", title);
    element.classList.add("site-tooltip");

    if (!element.hasAttribute("aria-label")) {
      element.setAttribute("aria-label", title);
    }

    if (
      !element.matches("a, button, input, select, textarea, summary") &&
      element.getAttribute("tabindex") === "0"
    ) {
      element.removeAttribute("tabindex");
    }
  });

  document.querySelectorAll("[data-tooltip]").forEach((element) => {
    const tooltip = element.getAttribute("data-tooltip");
    if (tooltip && !element.hasAttribute("title")) element.setAttribute("title", tooltip);
  });

  document.querySelectorAll("[data-footnote-backref]").forEach((backref) => {
    backref.setAttribute("aria-label", "Retour au contenu");
    backref.setAttribute("data-tooltip", "Retour au contenu");
    backref.setAttribute("title", "Retour au contenu");
    backref.classList.add("site-tooltip");

    if (!backref.dataset.footnoteEnhanced) {
      backref.dataset.footnoteEnhanced = "true";
      backref.addEventListener("click", () => {
        hideSiteTooltip();
        backref.blur?.();

        const hash = backref.getAttribute("href");
        if (!hash?.startsWith("#")) return;

        requestAnimationFrame(() => {
          const target = document.getElementById(decodeURIComponent(hash.slice(1)));
          target?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      });
    }
  });

  document.querySelectorAll(".site-prose a[href^='#user-content-fn-']").forEach((ref) => {
    if (ref.hasAttribute("data-footnote-backref")) return;

    ref.setAttribute("aria-label", "Voir l'explication");
    ref.setAttribute("data-tooltip", "Voir l'explication");
    ref.setAttribute("title", "Voir l'explication");
    ref.classList.add("site-tooltip", "footnote-ref-tooltip");
  });
}
