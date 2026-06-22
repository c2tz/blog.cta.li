import angular from "@analogjs/astro-angular";
import mdx from "@astrojs/mdx";
import { unified } from "@astrojs/markdown-remark";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";

const ANGULAR_DECORATOR_IMPORTS = new Set([
  "ChangeDetectionStrategy",
  "Component",
]);

function isCompiledAngularDecoratorWarning(warning) {
  return (
    warning.code === "UNUSED_EXTERNAL_IMPORT" &&
    warning.exporter === "@angular/core" &&
    warning.names?.every((name) => ANGULAR_DECORATOR_IMPORTS.has(name)) &&
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
    if (isKnownAngularSourcemapWarning(message)) return;
    this.hasWarned = true;
    console.warn(message);
  },
};

export default defineConfig({
  site: "https://ct-blog.cta.li/",
  devToolbar: {
    enabled: false,
  },
  integrations: [
    mdx(),
    sitemap(),
    angular({
      vite: {
        fastCompile: true,
        transformFilter: (_code, id) => id.includes("src/components"),
      },
    }),
  ],
  vite: {
    customLogger: viteLogger,
    build: {
      rollupOptions: {
        onwarn(warning, warn) {
          if (!isCompiledAngularDecoratorWarning(warning)) warn(warning);
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
      wrap: true,
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
          let firstMarkdownImage = true;

          const walk = (node) => {
            if (!node || typeof node !== "object") return;

            if (node.type === "element" && node.tagName === "img") {
              node.properties ||= {};
              node.properties["data-lightbox"] = "";
              node.properties.decoding = "async";

              if (firstMarkdownImage) {
                node.properties.loading = "eager";
                node.properties.fetchpriority = "high";
                firstMarkdownImage = false;
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
