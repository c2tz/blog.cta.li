import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";
import { z } from "astro/zod";

import { infoSchema } from "@/lib/content-schemas";

const blogTagSchema = z
  .string()
  .trim()
  .min(1, "A blog tag cannot be empty")
  .max(48, "A blog tag cannot exceed 48 characters")
  .regex(
    /^[\p{L}\p{N}][\p{L}\p{N}._+-]*$/u,
    "A blog tag must be URL-safe and cannot contain spaces",
  )
  .refine((tag) => tag !== "all", 'The reserved "all" tag is added automatically');

const blog = defineCollection({
  loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
  schema: z
    .object({
      title: z.string().trim().min(1).max(160),
      description: z.string().trim().min(1).max(320).optional(),
      listed: z.boolean().default(true),
      priority: z.number().int().min(0).max(100).optional(),
      tags: z
        .array(blogTagSchema)
        .max(12)
        .refine((tags) => new Set(tags).size === tags.length, "Blog tags must be unique")
        .default([]),
    })
    .refine((post) => post.listed === false || post.description !== undefined, {
      message: "A listed blog post requires a description",
      path: ["description"],
    }),
});

const info = defineCollection({
  loader: glob({ base: "./src/content/info", pattern: "**/*.{md,mdx}" }),
  schema: infoSchema,
});

export const collections = { blog, info };
