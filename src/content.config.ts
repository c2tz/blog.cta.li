import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";
import { z } from "astro/zod";

import {
  BLOG_POST_DESCRIPTION_MAX_LENGTH,
  BLOG_POST_MAX_TAGS,
  BLOG_POST_RESERVED_TAG,
  BLOG_POST_TAG_MAX_LENGTH,
  BLOG_POST_TAG_PATTERN,
  BLOG_POST_TITLE_MAX_LENGTH,
} from "@/lib/blog-content-contract.mjs";
import { infoSchema } from "@/lib/content-schemas";

const blogTagSchema = z
  .string()
  .trim()
  .min(1, "A blog tag cannot be empty")
  .max(BLOG_POST_TAG_MAX_LENGTH, `A blog tag cannot exceed ${BLOG_POST_TAG_MAX_LENGTH} characters`)
  .regex(BLOG_POST_TAG_PATTERN, "A blog tag must be URL-safe and cannot contain spaces")
  .refine(
    (tag) => tag !== BLOG_POST_RESERVED_TAG,
    `The reserved "${BLOG_POST_RESERVED_TAG}" tag is added automatically`,
  );

const blog = defineCollection({
  loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
  schema: z
    .object({
      title: z.string().trim().min(1).max(BLOG_POST_TITLE_MAX_LENGTH),
      description: z.string().trim().min(1).max(BLOG_POST_DESCRIPTION_MAX_LENGTH).optional(),
      listed: z.boolean().default(true),
      priority: z.number().int().min(0).max(100).optional(),
      tags: z
        .array(blogTagSchema)
        .max(BLOG_POST_MAX_TAGS)
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
