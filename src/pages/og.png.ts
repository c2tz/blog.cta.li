import type { APIRoute } from "astro";
import { satoriAstroOG } from "satori-astro";
import fs from "node:fs/promises";

import { HomeOgTemplate } from "@/components/OgTemplates";

export const GET: APIRoute = async ({ props }) => {
  const fontData = await fs.readFile('./public/Inter-SemiBold.woff');

  return await satoriAstroOG({
    template: HomeOgTemplate(),
    width: 1200,
    height: 600,
  }).toResponse({
    satori: {
      fonts: [
        {
          name: "Inter",
          data: fontData,
          weight: 600,
          style: "normal",
        },
      ],
    },
  });
};
