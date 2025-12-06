/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'media', // active le mode sombre automatique selon le système
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      typography: (theme) => ({
        DEFAULT: {
          css: {
            /* LISTES : texte + puces en noir */
            color: '#000',
            li: {
              color: '#000',
            },
            'ul > li::marker': {
              color: '#000',
            },
            'ol > li::marker': {
              color: '#000',
            },

            /* Ton style existant pour <code> inline */
            code: {
              marginLeft: theme('spacing.1'),
              marginRight: theme('spacing.1'),
              padding: theme('spacing')['0.5'],
              borderRadius: theme('spacing.1'),
              border: `1px solid ${theme('colors.gray.300')}`,
              fontWeight: 'normal',
              fontFamily: '"SF Mono", "Roboto Mono", Menlo, monospace',
            },
            'code::before': {
              content: "''",
            },
            'code::after': {
              content: "''",
            },

            /* Ton style existant pour <pre><code> */
            pre: {
              code: {
                marginLeft: 0,
                marginRight: 0,
                border: 0,
                borderRadius: 0,
              },
            },
          },
        },

        /* Variante sombre utilisée par .prose-invert */
        invert: {
          css: {
            /* LISTES : texte + puces en blanc */
            color: '#fff',
            li: {
              color: '#fff',
            },
            'ul > li::marker': {
              color: '#fff',
            },
            'ol > li::marker': {
              color: '#fff',
            },
          },
        },
      }),
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
