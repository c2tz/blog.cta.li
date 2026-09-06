import type { APIRoute } from "astro";
import { getCollection, type CollectionEntry } from "astro:content";
import satori from "satori";
import sharp from "sharp";

import { getContentEntryGitDates } from "@/lib/git-dates.mjs";
import { loadPostOgFonts } from "@/lib/post-og-fonts";
import { PostOgTemplate } from "@/lib/post-og-template";

export const GET: APIRoute = async ({ props }) => {
  const post = props as CollectionEntry<"blog">;
  const fonts = await loadPostOgFonts();
  const { createdAt } = getContentEntryGitDates("blog", post);

  const width = 1200;
  const height = 600;
  const svg = await satori(
    PostOgTemplate({ title: post.data.title, createdAt, tags: post.data.tags }),
    { fonts, height, width },
  );
  const image = await sharp(Buffer.from(svg)).resize(width, height).png().toBuffer();

  return new Response(image, {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": image.length.toString(),
      "Content-Type": "image/png",
    },
  });
};

export async function getStaticPaths() {
  const posts: CollectionEntry<"blog">[] = await getCollection("blog");
  return posts.map((post) => ({
    params: { slug: post.id },
    props: post,
  }));
}
