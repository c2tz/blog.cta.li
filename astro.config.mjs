import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';

import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';

export default defineConfig({
  site: 'https://ct-blog.cta.li/',
  integrations: [mdx(), sitemap(), tailwind(), react()],

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
          behavior: 'wrap', // enveloppe le titre dans un <a>
          properties: {
            class: 'heading-link',
          },
        },
      ],

      // Plugin perso: ajoute data-lightbox à toutes les <img>
      () => (tree) => {
        const walk = (node) => {
          if (node && typeof node === 'object') {
            // Si c'est une balise <img>
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
