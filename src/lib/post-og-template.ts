import fs from "node:fs";
import { html } from "satori-html";

import { formatFrenchDate } from "@/lib/date-format.mjs";
import { SITE_TITLE } from "@/site-config";

const image = fs.readFileSync("./public/og.png");
const imageDataUrl = `data:image/png;base64,${image.toString("base64")}`;

type PostOgData = {
  title: string;
  createdAt?: string;
  tags?: string[];
};

function restoreText(node: ReturnType<typeof html>) {
  const children = node.props.children;
  if (typeof children === "string") {
    // satori-html escapes interpolated text, but Satori expects plain text in these nodes.
    node.props.children = children.replace(/&(?:amp|lt|gt);/g, (entity) =>
      entity === "&amp;" ? "&" : entity === "&lt;" ? "<" : ">",
    );
  } else if (Array.isArray(children)) {
    children.forEach(restoreText);
  } else if (children) {
    restoreText(children);
  }
  return node;
}

export function PostOgTemplate({ title, createdAt, tags = [] }: PostOgData) {
  const fontSize = title.length > 100 ? 42 : title.length > 55 ? 48 : 56;
  const titleLines = title.length > 100 ? 4 : 3;
  const dateLabel = createdAt ? `Créé le ${formatFrenchDate(createdAt)}` : "";
  const [firstTag = "", secondTag = ""] = tags
    .filter((tag) => tag !== "all")
    .slice(0, 2)
    .map((tag) => `#${tag}`);

  return restoreText(html`
    <div
      style="position: relative; height: 100%; width: 100%; display: flex; flex-direction: column; justify-content: space-between; padding: 60px; background-color: #fff; color: #0f172a; font-size: 32px; font-weight: 400; font-family: 'Google Sans', 'Google Sans Extended', sans-serif; font-feature-settings: 'liga' 1, 'calt' 1;"
    >
      <div
        style="display: flex; flex-direction: row; gap: 40px; align-items: center; flex-shrink: 0;"
      >
        <img style="width: 128px; height: 128px; border-radius: 12px;" src="${imageDataUrl}" />
        <div>${SITE_TITLE}</div>
      </div>
      <div
        style="position: absolute; left: 60px; right: 60px; top: 0; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center;"
      >
        <div
          data-og-title
          style="display: block; max-width: 100%; padding: 4px; font-size: ${fontSize}px; font-weight: 700; line-height: 1.125; text-align: center; word-break: break-word; line-clamp: ${titleLines}; overflow: hidden; text-overflow: ellipsis;"
        >
          ${title}
        </div>
      </div>
      <div
        style="display: flex; flex-shrink: 0; align-items: center; justify-content: space-between; gap: 32px; height: 40px; font-size: 26px; line-height: 1.25; color: #475569;"
      >
        <div data-og-date style="display: flex; flex-shrink: 0;">${dateLabel}</div>
        <div data-og-tags style="display: flex; align-items: center; gap: 20px; min-width: 0;">
          <div
            data-og-tag
            style="display: ${firstTag ? "block" : "none"}; max-width: 280px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"
          >
            ${firstTag}
          </div>
          <div
            data-og-tag
            style="display: ${secondTag ? "block" : "none"}; max-width: 280px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"
          >
            ${secondTag}
          </div>
        </div>
      </div>
    </div>
  `);
}
