import type { APIRoute } from "astro";
import { satoriAstroOG } from "satori-astro";
import fs from "node:fs/promises";

import { HomeOgTemplate } from "@/components/OgTemplates";

export const GET: APIRoute = async ({ props }) => {
  const fontUrl = new URL("../../public/fonts/roboto-flex-v30-latin-regular.ttf", import.meta.url);
  const fontData = await fs.readFile(fontUrl);

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
