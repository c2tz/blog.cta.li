import { SHORTCODE_PATTERN, INLINE_SHORTCODES } from "./remark-hugo-material-shortcodes/config.mjs";
import { optionList, textNode, paragraphText } from "./remark-hugo-material-shortcodes/ast.mjs";
import { parseHugoShortcode } from "./remark-hugo-material-shortcodes/parser.mjs";
import { renderShortcode } from "./remark-hugo-material-shortcodes/renderers.mjs";

export { parseHugoShortcode } from "./remark-hugo-material-shortcodes/parser.mjs";

function markerFromNode(node) {
  const value = paragraphText(node);
  if (value === null) return null;
  return parseHugoShortcode(value);
}

function transformInlineShortcodes(node, file, parents = []) {
  if (node?.type !== "paragraph" || !Array.isArray(node.children)) return;
  const pattern = /\{\{([<%])\s*([\s\S]*?)\s*([>%])\}\}/g;
  const transformed = [];

  for (const child of node.children) {
    if (child.type !== "text") {
      transformed.push(child);
      continue;
    }

    let cursor = 0;
    for (const match of child.value.matchAll(pattern)) {
      if (match.index > cursor) transformed.push(textNode(child.value.slice(cursor, match.index)));
      const shortcode = parseHugoShortcode(match[0]);
      if (!shortcode) {
        transformed.push(textNode(match[0]));
      } else if (!shortcode.selfClosing || !INLINE_SHORTCODES.has(shortcode.name)) {
        file.fail(
          `Le shortcode ${shortcode.name} doit être isolé par une ligne vide. Shortcodes inline autorisés : ${optionList(INLINE_SHORTCODES)}.`,
          node,
        );
      } else if (parents.includes("rich-tooltip") && shortcode.name === "rich-tooltip-ref") {
        file.fail("Un rich tooltip ne peut pas invoquer un autre rich tooltip.", node);
      } else {
        transformed.push(renderShortcode(shortcode, [], file));
      }
      cursor = match.index + match[0].length;
    }

    if (cursor === 0) transformed.push(child);
    else if (cursor < child.value.length) transformed.push(textNode(child.value.slice(cursor)));
  }

  node.children = transformed;
}

function expandAdjacentMarkerParagraphs(children) {
  return children.flatMap((node) => {
    const value = paragraphText(node);
    if (value === null || !value.includes("\n")) return [node];
    const lines = value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length < 2 || !lines.every((line) => SHORTCODE_PATTERN.test(line))) return [node];
    return lines.map((line) => ({ type: "paragraph", children: [textNode(line)] }));
  });
}

function transformChildren(children, file, parents = []) {
  children = expandAdjacentMarkerParagraphs(children);
  const output = [];

  for (let index = 0; index < children.length; index += 1) {
    const node = children[index];
    const marker = markerFromNode(node);

    if (!marker) {
      transformInlineShortcodes(node, file, parents);
      if (Array.isArray(node.children)) {
        node.children = transformChildren(node.children, file, parents);
      }
      output.push(node);
      continue;
    }

    if (marker.closing) file.fail(`Shortcode fermant inattendu : ${marker.name}`, node);
    if (
      parents.includes("rich-tooltip") &&
      (marker.name === "rich-tooltip" || marker.name === "rich-tooltip-ref")
    ) {
      file.fail("Un rich tooltip ne peut pas invoquer un autre rich tooltip.", node);
    }
    if (marker.selfClosing) {
      output.push(renderShortcode(marker, [], file));
      continue;
    }

    let depth = 1;
    let closingIndex = -1;
    for (let cursor = index + 1; cursor < children.length; cursor += 1) {
      const candidate = markerFromNode(children[cursor]);
      if (!candidate || candidate.name !== marker.name) continue;
      if (candidate.closing) depth -= 1;
      else if (!candidate.selfClosing) depth += 1;
      if (depth === 0) {
        closingIndex = cursor;
        break;
      }
    }

    if (closingIndex === -1) file.fail(`Shortcode ${marker.name} non fermé.`, node);
    const inner = transformChildren(children.slice(index + 1, closingIndex), file, [
      ...parents,
      marker.name,
    ]);
    output.push(renderShortcode(marker, inner, file));
    index = closingIndex;
  }

  return output;
}

export default function remarkHugoMaterialShortcodes() {
  return (tree, file) => {
    tree.children = transformChildren(tree.children, file);
  };
}
