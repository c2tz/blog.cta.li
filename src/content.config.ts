import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";
import { z } from "astro/zod";

const blog = defineCollection({
  loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
});

const info = defineCollection({
  loader: glob({ base: "./src/content/info", pattern: "**/*.{md,mdx}" }),
  schema: z.any(),
});

export const collections = { blog, info };
