import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";
import { z } from "astro/zod";

import { infoSchema } from "@/lib/content-schemas";

const blog = defineCollection({
  loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    priority: z.number().int().min(0).max(100).optional(),
    tags: z.array(z.string()).optional(),
  }),
});

const info = defineCollection({
  loader: glob({ base: "./src/content/info", pattern: "**/*.{md,mdx}" }),
  schema: infoSchema,
});

export const collections = { blog, info };
