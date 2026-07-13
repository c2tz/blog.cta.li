import {
  MATERIAL_SYMBOL_CODEPOINTS,
  MATERIAL_SYMBOL_ALIASES,
  SHORTCODE_ALIASES,
} from "./config.mjs";

export function optionList(values) {
  return Array.from(values, (value) => `\`${value}\``).join(", ");
}

export function normalizeShortcodeName(name) {
  const normalized = String(name).toLowerCase();
  return SHORTCODE_ALIASES[normalized] ?? normalized;
}

export function textNode(value, data) {
  return data ? { type: "text", value, data } : { type: "text", value };
}

export function elementNode(tagName, properties, children = []) {
  return {
    type: "hugoMaterialElement",
    data: { hName: tagName, hProperties: properties },
    children,
  };
}

function normalizeMaterialSymbolName(name) {
  const normalized = String(name)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return (MATERIAL_SYMBOL_ALIASES[String(name).trim().toLowerCase()] ?? normalized).replace(
    /-/g,
    "_",
  );
}

export function materialSymbolNode(name, file, { className = [], label, slot } = {}) {
  const normalized = normalizeMaterialSymbolName(name);
  const codepoint = MATERIAL_SYMBOL_CODEPOINTS[normalized];
  if (!codepoint) {
    file.fail(
      `Material Symbol inconnu : ${name}. Vérifiez le nom dans src/generated/material-symbol-codepoints.json. ` +
        "Si le symbole existe mais s’affiche en carré, lancez pnpm update:material-symbols puis pnpm verify. " +
        "Si le symbole n’existe pas dans la carte, lancez pnpm update:material-symbol-map puis pnpm update:material-symbols.",
    );
  }

  return elementNode(
    "md-icon",
    {
      ...(label ? { ariaLabel: label, role: "img" } : { ariaHidden: "true" }),
      className: ["material-shortcode-icon", ...className],
      dataMaterialSymbol: String(name)
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, "-"),
      ...(slot ? { slot } : {}),
    },
    [textNode(String.fromCodePoint(codepoint))],
  );
}

export function materialExpansionIndicatorNode(file) {
  return materialSymbolNode("expand-more", file, {
    className: ["material-admonition-toggle-indicator", "material-admonition-toggle-icon"],
  });
}

export function paragraphText(node) {
  if (node?.type !== "paragraph" || !Array.isArray(node.children)) return null;
  const values = node.children.map((child) => {
    if (child.type === "text") return child.value;
    if (child.type === "link" && child.children?.every((nested) => nested.type === "text")) {
      return child.children.map((nested) => nested.value).join("");
    }
    return null;
  });
  return values.every((value) => value !== null) ? values.join("") : null;
}
