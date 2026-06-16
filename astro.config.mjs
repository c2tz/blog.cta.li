import { defineConfig } from 'astro/config';

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import angular from '@analogjs/astro-angular';
import { unified } from '@astrojs/markdown-remark';

import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import remarkGitDates from './src/remark/remarkGitDates.mjs';

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
    if (
      typeof message === 'string' &&
      message.includes('"ChangeDetectionStrategy" and "Component"') &&
      message.includes('"@angular/core"') &&
      message.includes('"src/components/CookieConsentBanner.component.ts"')
    ) {
      return;
    }

    this.hasWarned = true;
    console.warn(message);
  },
};

export default defineConfig({
  site: 'https://ct-blog.cta.li/',
  devToolbar: {
    enabled: false,
  },

  integrations: [
    mdx(),
    sitemap(),
    react(),
    angular({
      vite: {
        fastCompile: true,
        transformFilter: (_code, id) =>
          id.includes('src/components'),
      },
    }),
  ],

  vite: {
    customLogger: viteLogger,
    plugins: [tailwindcss()],
  },

  markdown: {
    syntaxHighlight: 'shiki',
    shikiConfig: {
      themes: {
        light: 'light-plus',
        dark: 'dark-plus',
      },
      defaultColor: false,
      wrap: true,
    },
    processor: unified({
      remarkPlugins: [remarkGitDates],
      rehypePlugins: [
        rehypeSlug,
        [
          rehypeAutolinkHeadings,
          {
            behavior: 'wrap',
            properties: {
              class: 'heading-link',
            },
          },
        ],

        () => (tree) => {
          let firstMarkdownImage = true;

          const walk = (node) => {
            if (node && typeof node === 'object') {
              if (node.type === 'element' && node.tagName === 'img') {
                node.properties ||= {};
                node.properties['data-lightbox'] = '';
                node.properties.decoding = 'async';

                if (firstMarkdownImage) {
                  node.properties.loading = 'eager';
                  node.properties.fetchpriority = 'high';
                  firstMarkdownImage = false;
                } else {
                  node.properties.loading = 'lazy';
                }
              }

              if (Array.isArray(node.children)) {
                for (const child of node.children) {
                  walk(child);
                }
              }
            }
          };

          walk(tree);
        },
      ],
    }),
  },
});
