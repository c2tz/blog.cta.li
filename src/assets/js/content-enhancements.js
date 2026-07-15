const COMPLEX_SHORTCODE_SELECTOR = [
  "[data-material-table]",
  "[data-material-tabs]",
  "md-elevated-button",
  "md-outlined-button",
  "md-outlined-select",
  "md-outlined-text-field",
  "md-primary-tab",
  "md-tabs",
].join(",");

async function loadContentEnhancements() {
  const prose = document.querySelector(".site-prose");
  if (!prose) return;

  const modules = [];
  if (prose.querySelector("pre > code")) {
    modules.push(import("@/assets/js/app/code-block-enhancer.js"));
  }

  if (prose.querySelector(COMPLEX_SHORTCODE_SELECTOR)) {
    modules.push(
      Promise.all([
        import("@/assets/js/material-web/content.js"),
        import("@/assets/js/app/material-shortcodes.js"),
      ]),
    );
  }

  await Promise.all(modules);
}

void loadContentEnhancements();
document.addEventListener("astro:page-load", () => void loadContentEnhancements());
