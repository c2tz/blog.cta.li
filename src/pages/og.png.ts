import type { APIRoute } from "astro";
import { satoriAstroOG } from "satori-astro";
import fs from "node:fs/promises";
import path from "node:path";

import { HomeOgTemplate } from "@/components/OgTemplates";

export const GET: APIRoute = async ({ props }) => {
  const fontData = await fs.readFile(
    path.join(process.cwd(), "public/fonts/roboto-flex-v30-latin-regular.ttf")
  );

  return await satoriAstroOG({
    template: HomeOgTemplate(),
    width: 1200,
    height: 600,
  }).toResponse({
    satori: {
      fonts: [
        {
          name: "Roboto Flex",
          data: fontData,
          weight: 400,
          style: "normal",
        },
      ],
    },
  });
};
