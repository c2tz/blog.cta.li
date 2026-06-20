import fs from "node:fs";
import { html } from "satori-html";

import { SITE_TITLE } from "@/consts";

const image = fs.readFileSync("./public/og.png");
const imageDataUrl = `data:image/png;base64,${image.toString("base64")}`;

export function HomeOgTemplate() {
  return html`
    <div
      style="position: relative; height: 100%; width: 100%; display: flex; flex-direction: column; align-items: center; gap: 20px; justify-content: center; background-color: #fff; color: #0f172a; font-size: 48px; font-weight: 600; font-family: 'Roboto Flex', sans-serif; letter-spacing: -0.05em; font-feature-settings: 'liga' 1, 'calt' 1;"
    >
      <img
        style="width: 192px; height: 192px; border-radius: 12px;"
        src="${imageDataUrl}"
      />
      <div>${SITE_TITLE}</div>
    </div>
  `;
}

export function PostOgTemplate({ title }: { title: string }) {
  return html`
    <div
      style="position: relative; height: 100%; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: #fff; color: #0f172a; font-size: 32px; font-weight: 600; font-family: 'Roboto Flex', sans-serif; font-feature-settings: 'liga' 1, 'calt' 1;"
    >
      <div
        style="display: flex; flex-direction: row; gap: 40px; align-items: center; position: absolute; top: 60px; left: 60px;"
      >
        <img
          style="width: 128px; height: 128px; border-radius: 12px;"
          src="${imageDataUrl}"
        />
        <div>${SITE_TITLE}</div>
      </div>
      <div style="padding: 150px; margin-top: 150px; font-size: 48px; font-weight: 600;">
        ${title}
      </div>
    </div>
  `;
}
