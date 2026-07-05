import angular from "@analogjs/astro-angular";
import mdx from "@astrojs/mdx";
import { unified } from "@astrojs/markdown-remark";
import { defineConfig } from "astro/config";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";

const ANGULAR_DECORATOR_IMPORTS = new Set([
  "ChangeDetectionStrategy",
  "Component",
  "ViewEncapsulation",
]);

const VITE_OPTIMIZE_DEPS = [
  "@angular/cdk/a11y",
  "@angular/cdk/bidi",
  "@angular/cdk/dialog",
  "@angular/cdk/overlay",
  "@angular/cdk/portal",
  "@angular/cdk/scrolling",
  "@angular/core/rxjs-interop",
  "@angular/forms",
  "@angular/material/autocomplete",
  "@angular/material/badge",
  "@angular/material/button",
  "@angular/material/button-toggle",
  "@angular/material/chips",
  "@angular/material/core",
  "@angular/material/datepicker",
  "@angular/material/dialog",
  "@angular/material/divider",
  "@angular/material/expansion",
  "@angular/material/form-field",
  "@angular/material/icon",
  "@angular/material/input",
  "@angular/material/menu",
  "@angular/material/progress-bar",
  "@angular/material/progress-spinner",
  "@angular/material/select",
  "@angular/material/slide-toggle",
  "@angular/material/sort",
  "@angular/material/snack-bar",
  "@angular/material/table",
  "@angular/material/toolbar",
  "@angular/material/tooltip",
  "@material/material-color-utilities",
];

const MARKDOWN_IMAGE_SIZES = "(max-width: 832px) calc(100vw - 2rem), 800px";
const MARKDOWN_IMAGE_WIDTHS = [480, 640, 750, 828, 960, 1280, 1600, 1920, 2560, 3000, 3840];

function isCompiledAngularDecoratorWarning(warning) {
  return (
    warning.code === "UNUSED_EXTERNAL_IMPORT" &&
    warning.exporter === "@angular/core" &&
    warning.names?.every((name) => ANGULAR_DECORATOR_IMPORTS.has(name)) &&
    warning.ids?.every((id) => id.includes("/src/components/"))
  );
}

function isCompiledAngularMetadataImportWarning(warning) {
  return (
    warning.code === "UNUSED_EXTERNAL_IMPORT" &&
    (warning.exporter === "@angular/forms" || warning.exporter?.startsWith("@angular/material/")) &&
    warning.names?.every((name) => name.endsWith("Module")) &&
    warning.ids?.every((id) => id.includes("/src/components/"))
  );
}

function isKnownAngularSourcemapWarning(message) {
  return (
    typeof message === "string" &&
    message.includes("@angular+platform-server") &&
    message.includes("_server-chunk.mjs") &&
    message.includes("points to missing source files")
  );
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
    if (isKnownAngularSourcemapWarning(message)) return;
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

export default defineConfig({
  site: "https://ct-blog.cta.li/",
  build: {
    inlineStylesheets: "always",
  },
  devToolbar: {
    enabled: false,
  },
  integrations: [
    mdx(),
    angular({
      vite: {
        fastCompile: true,
        transformFilter: (_code, id) => id.includes("src/components"),
      },
    }),
  ],
  vite: {
    customLogger: viteLogger,
    server: {
      headers: {
        "Access-Control-Allow-Origin": "https://giscus.app",
        "Cross-Origin-Resource-Policy": "cross-origin",
        "X-Content-Type-Options": "nosniff",
      },
    },
    optimizeDeps: {
      force: true,
      include: VITE_OPTIMIZE_DEPS,
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
      rollupOptions: {
        onwarn(warning, warn) {
          if (
            !isCompiledAngularDecoratorWarning(warning) &&
            !isCompiledAngularMetadataImportWarning(warning)
          ) {
            warn(warning);
          }
        },
      },
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
      transformers: [removeCodeBlockTabindex],
    },
    processor: unified({
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
        () => (tree) => {
          let eagerMarkdownImageCount = 0;

          const walk = (node) => {
            if (!node || typeof node !== "object") return;

            if (node.type === "element" && node.tagName === "img") {
              node.properties ||= {};
              node.properties["data-image-dialog"] = "";
              node.properties.decoding = "async";
              node.properties.sizes = MARKDOWN_IMAGE_SIZES;
              node.properties.widths = MARKDOWN_IMAGE_WIDTHS;

              if (eagerMarkdownImageCount < 2) {
                node.properties.loading = "eager";
                if (eagerMarkdownImageCount === 0) node.properties.fetchpriority = "high";
                eagerMarkdownImageCount += 1;
              } else {
                node.properties.loading = "lazy";
              }
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
