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

export default defineConfig({
  site: "https://ct-blog.cta.li/",
  build: {
    inlineStylesheets: "always",
  },
  devToolbar: {
    enabled: false,
  },
  integrations: [mdx()],
  vite: {
    customLogger: viteLogger,
    server: {
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
