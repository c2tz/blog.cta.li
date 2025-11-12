import fs from "node:fs";

import { SITE_TITLE } from "@/consts";
const image = fs.readFileSync("./public/astro.png");
const imageDataUrl = `data:image/png;base64,${image.toString("base64")}`;

export function HomeOgTemplate() {
  return (
    <div
      style={{
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
        fontFamily: "Inter",
        letterSpacing: "-0.05em",
        fontFeatureSettings: "'liga' 1, 'calt' 1",
      }}
    >
      <img
        style={{ borderRadius: "12px" }}
        src={imageDataUrl}
        width="192"
        height="192"
      />
      <div>{SITE_TITLE}</div>
    </div>
  );
}

export function PostOgTemplate({ title }: { title: string }) {
  return (
    <div
      style={{
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
        fontFamily: "Inter",
        letterSpacing: "-0.05em",
        fontFeatureSettings: "'liga' 1, 'calt' 1",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          gap: "40px",
          alignItems: "center",
          position: "absolute",
          top: 60,
          left: 60,
        }}
      >
        <img
          style={{ borderRadius: "12px" }}
          src={imageDataUrl}
          width="128"
          height="128"
        />
        <div>{SITE_TITLE}</div>
      </div>
      <div
        style={{
          padding: "150px",
          marginTop: "150px",
          fontSize: 48,
          fontWeight: 600,
        }}
      >
        {title}
      </div>
    </div>
  );
}
