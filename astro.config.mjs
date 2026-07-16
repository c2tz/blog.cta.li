import mdx from "@astrojs/mdx";
import { unified } from "@astrojs/markdown-remark";
import {
  transformerMetaHighlight,
  transformerMetaWordHighlight,
  transformerNotationDiff,
  transformerNotationErrorLevel,
  transformerNotationFocus,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
  transformerRemoveNotationEscape,
} from "@shikijs/transformers";
import { defineConfig } from "astro/config";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";
import { getFileGitDates } from "./src/lib/git-dates.mjs";
import remarkHugoMaterialShortcodes from "./src/lib/remark-hugo-material-shortcodes.mjs";

const IMAGE_GIT_DATES_CACHE = new Map();

function getLocalImageGitDates(src, markdownPath) {
  if (
    !markdownPath ||
    typeof src !== "string" ||
    !src ||
    URL.canParse(src) ||
    src.startsWith("/")
  ) {
    return null;
  }

  const imagePath = resolve(dirname(markdownPath), src.split(/[?#]/, 1)[0]);
  if (!existsSync(imagePath)) return null;

  if (!IMAGE_GIT_DATES_CACHE.has(imagePath)) {
    IMAGE_GIT_DATES_CACHE.set(imagePath, getFileGitDates(imagePath));
  }

  return IMAGE_GIT_DATES_CACHE.get(imagePath);
}

function isKnownViteOxcEsbuildWarning(message) {
  return (
    typeof message === "string" &&
    message.includes("Both esbuild and oxc options were set") &&
    message.includes("{ jsxDev: true }")
  );
}

const viteLogger = {
  hasWarned: false,
  hasErrorLogged: () => false,
  clearScreen: () => {},
  info: (message) => console.info(message),
  error: (message) => console.error(message),
  warnOnce(message) {
    this.warn(message);
  },
  warn(message) {
    if (isKnownViteOxcEsbuildWarning(message)) return;
    this.hasWarned = true;
    console.warn(message);
  },
};

const removeCodeBlockTabindex = {
  name: "remove-code-block-tabindex",
  pre(node) {
    delete node.properties?.tabindex;
    delete node.properties?.tabIndex;
  },
};

const SHIKI_NOTATION_OPTIONS = { matchAlgorithm: "v3" };

// Intent listeners already warm deferred entry points. Vite's dependency
// preloader otherwise adds links for modules evaluated by the base graph;
// WebKit flags those duplicates as unused and the requests carry no value.
const disableRedundantClientModulePreloads = {
  name: "disable-redundant-client-module-preloads",
  generateBundle: {
    order: "pre",
    handler() {
      if (this.environment.name === "client") {
        this.environment.config.build.modulePreload = false;
      }
    },
  },
};

export default defineConfig({
  site: "https://ct-blog.cta.li/",
  server: {
    host: true,
    port: 4321,
  },
  build: {
    inlineStylesheets: "never",
  },
  devToolbar: {
    enabled: false,
  },
  integrations: [mdx()],
  vite: {
    customLogger: viteLogger,
    plugins: [disableRedundantClientModulePreloads],
    optimizeDeps: {
      include: [
        "@floating-ui/dom",
        "@material/material-color-utilities",
        "@material/web/button/elevated-button.js",
        "@material/web/button/filled-button.js",
        "@material/web/button/filled-tonal-button.js",
        "@material/web/button/outlined-button.js",
        "@material/web/button/text-button.js",
        "@material/web/chips/assist-chip.js",
        "@material/web/chips/chip-set.js",
        "@material/web/chips/filter-chip.js",
        "@material/web/dialog/dialog.js",
        "@material/web/divider/divider.js",
        "@material/web/fab/fab.js",
        "@material/web/icon/icon.js",
        "@material/web/iconbutton/filled-tonal-icon-button.js",
        "@material/web/iconbutton/icon-button.js",
        "@material/web/menu/menu-item.js",
        "@material/web/menu/menu.js",
        "@material/web/progress/circular-progress.js",
        "@material/web/progress/linear-progress.js",
        "@material/web/select/filled-select.js",
        "@material/web/select/outlined-select.js",
        "@material/web/select/select-option.js",
        "@material/web/switch/switch.js",
        "@material/web/tabs/primary-tab.js",
        "@material/web/tabs/tabs.js",
        "@material/web/textfield/filled-text-field.js",
        "@material/web/textfield/outlined-text-field.js",
      ],
    },
    server: {
      strictPort: true,
      headers: {
        "Access-Control-Allow-Origin": "https://giscus.app",
        "Cross-Origin-Resource-Policy": "cross-origin",
        "X-Content-Type-Options": "nosniff",
      },
    },
    css: {
      preprocessorOptions: {
        scss: {
          loadPaths: ["node_modules"],
        },
      },
    },
    build: {
      cssMinify: "esbuild",
    },
  },
  markdown: {
    syntaxHighlight: "shiki",
    shikiConfig: {
      themes: {
        light: "light-plus",
        dark: "dark-plus",
      },
      defaultColor: false,
      wrap: false,
      transformers: [
        transformerNotationDiff(SHIKI_NOTATION_OPTIONS),
        transformerNotationHighlight(SHIKI_NOTATION_OPTIONS),
        transformerNotationWordHighlight(SHIKI_NOTATION_OPTIONS),
        transformerNotationFocus(SHIKI_NOTATION_OPTIONS),
        transformerNotationErrorLevel(SHIKI_NOTATION_OPTIONS),
        transformerMetaHighlight(),
        transformerMetaWordHighlight(),
        transformerRemoveNotationEscape(),
        removeCodeBlockTabindex,
      ],
    },
    processor: unified({
      remarkPlugins: [remarkHugoMaterialShortcodes],
      rehypePlugins: [
        rehypeSlug,
        [
          rehypeAutolinkHeadings,
          {
            behavior: "wrap",
            properties: {
              class: "heading-link",
            },
          },
        ],
        () => (tree, file) => {
          const walk = (node) => {
            if (!node || typeof node !== "object") return;

            if (node.type === "element" && node.tagName === "img") {
              node.properties ||= {};
              node.properties["data-image-dialog"] = "";
              node.properties.decoding = "async";
              const imageGitDates = getLocalImageGitDates(node.properties.src, file.path);
              if (imageGitDates?.createdAt) {
                node.properties["data-image-created-at"] = imageGitDates.createdAt;
              }
              if (imageGitDates?.lastModified) {
                node.properties["data-image-modified-at"] = imageGitDates.lastModified;
              }
              node.properties.loading = "lazy";
            }

            if (!Array.isArray(node.children)) return;
            for (const child of node.children) walk(child);
          };

          walk(tree);
        },
      ],
    }),
  },
});
