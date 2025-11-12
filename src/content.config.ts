import { file, glob } from 'astro/loaders';
import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  // Load Markdown and MDX files in the `src/content/blog/` directory.
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  // Type-check frontmatter using a schema
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    // Transform string to Date object
    pubDate: z.coerce.date(),
    // TODO: add modified date
    // modDate: z.coerce.date().optional(),
    tags: z.array(z.string()).optional(),
  }),
});

const info = defineCollection({
  loader: glob({ base: './src/content/info', pattern: '**/*.{md,mdx}' }),
  schema: z.any(),
});

export const collections = { blog, info };
