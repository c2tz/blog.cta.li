import { z } from "astro/zod";

const internalOrAbsoluteHref = z
  .string()
  .min(1)
  .refine((value) => value.startsWith("/") || URL.canParse(value), {
    message: "Expected an internal path or an absolute URL",
  });

export const infoSchema = z.object({
  heroTitle: z.string().min(1),
  heroLede: z.string().min(1),
  primaryActionLabel: z.string().min(1),
  primaryActionHref: internalOrAbsoluteHref,
  secondaryActionLabel: z.string().min(1),
  secondaryActionHref: internalOrAbsoluteHref,
  latestPostsTitle: z.string().min(1),
  tagsTitle: z.string().min(1),
});

export type InfoData = z.infer<typeof infoSchema>;
