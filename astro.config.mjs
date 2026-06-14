import { defineConfig } from 'astro/config';

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';

import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';

export default defineConfig({
  site: 'https://ct-blog.cta.li/',

  integrations: [mdx(), sitemap(), react()],

  vite: {
    plugins: [tailwindcss()],
  },

  markdown: {
    shikiConfig: {
      themes: {
        light: 'light-plus',
        dark: 'dark-plus',
      },
      wrap: true,
    },

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
        const walk = (node) => {
          if (node && typeof node === 'object') {
            if (node.type === 'element' && node.tagName === 'img') {
              node.properties ||= {};
              node.properties['data-lightbox'] = '';
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
  },
});
