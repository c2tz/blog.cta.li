import fs from "node:fs";
import { createElement as h } from "react";
import { SITE_TITLE } from "@/consts";

const image = fs.readFileSync("./public/og.png");
const imageDataUrl = `data:image/png;base64,${image.toString("base64")}`;

export function HomeOgTemplate() {
  return h(
    "div",
    {
      style: {
        position: "relative",
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "20px",
        justifyContent: "center",
        backgroundColor: "#fff",
        color: "#0f172a",
        fontSize: 48,
        fontWeight: 600,
        fontFamily: "'Roboto Flex', sans-serif",
        letterSpacing: "-0.05em",
        fontFeatureSettings: "'liga' 1, 'calt' 1",
      },
    },
    h("img", {
      style: { borderRadius: "12px" },
      src: imageDataUrl,
      width: 192,
      height: 192,
    }),
    h("div", null, SITE_TITLE),
  );
}

export function PostOgTemplate({ title }: { title: string }) {
  return h(
    "div",
    {
      style: {
        position: "relative",
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#fff",
        color: "#0f172a",
        fontSize: 32,
        fontWeight: 600,
        fontFamily: "'Roboto Flex', sans-serif",
        fontFeatureSettings: "'liga' 1, 'calt' 1",
      },
    },
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "row",
          gap: "40px",
          alignItems: "center",
          position: "absolute",
          top: 60,
          left: 60,
        },
      },
      h("img", {
        style: { borderRadius: "12px" },
        src: imageDataUrl,
        width: 128,
        height: 128,
      }),
      h("div", null, SITE_TITLE),
    ),
    h(
      "div",
      {
        style: {
          padding: "150px",
          marginTop: "150px",
          fontSize: 48,
          fontWeight: 600,
        },
      },
      title,
    ),
  );
}
