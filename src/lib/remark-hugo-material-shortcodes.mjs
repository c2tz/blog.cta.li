import MATERIAL_SYMBOL_CODEPOINTS from "../generated/material-symbol-codepoints.json" with { type: "json" };

const SHORTCODE_PATTERN = /^\s*\{\{([<%])\s*([\s\S]*?)\s*([>%])\}\}\s*$/;

const ADMONITIONS = Object.freeze({
  note: { icon: "label", label: "Note" },
  abstract: { icon: "checklist", label: "Résumé" },
  info: { icon: "info", label: "Information" },
  tip: { icon: "tips-and-updates", label: "Astuce" },
  success: { icon: "check-circle", label: "Succès" },
  question: { icon: "help", label: "Question" },
  warning: { icon: "warning", label: "Attention" },
  failure: { icon: "error", label: "Échec" },
  danger: { icon: "bolt", label: "Danger" },
  bug: { icon: "bug-report", label: "Bug" },
  example: { icon: "science", label: "Exemple" },
  quote: { icon: "format-quote", label: "Citation" },
});

const MATERIAL_SYMBOL_ALIASES = Object.freeze({
  "children-face": "child-care",
});

const PAIRED_SHORTCODES = new Set(["admonition", "material-table", "tab", "tabs"]);

function textNode(value, data) {
  return data ? { type: "text", value, data } : { type: "text", value };
}

function elementNode(tagName, properties, children = []) {
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

function materialSymbolNode(name, file, { className = [], label } = {}) {
  const normalized = normalizeMaterialSymbolName(name);
  const codepoint = MATERIAL_SYMBOL_CODEPOINTS[normalized];
  if (!codepoint) file.fail(`Material Symbol inconnu : ${name}`);

  return textNode(String.fromCodePoint(codepoint), {
    hName: "span",
    hProperties: {
      ...(label ? { ariaLabel: label, role: "img" } : { ariaHidden: "true" }),
      className: ["material-symbols-rounded", "material-shortcode-icon", ...className],
      dataMaterialSymbol: String(name)
        .trim()
        .toLowerCase()
        .replace(/[\s_]+/g, "-"),
    },
  });
}

function paragraphText(node) {
  if (node?.type !== "paragraph" || !Array.isArray(node.children)) return null;
  if (!node.children.every((child) => child.type === "text")) return null;
  return node.children.map((child) => child.value).join("");
}

export function tokenizeHugoShortcode(source) {
  const tokens = [];
  let value = "";
  let quote = null;
  let quoteEnd = null;
  let escaped = false;

  const push = () => {
    if (!value) return;
    tokens.push(value);
    value = "";
  };

  for (const character of source.trim()) {
    if (escaped) {
      value += character;
      escaped = false;
      continue;
    }

    if (character === "\\" && quote !== "`") {
      escaped = true;
      continue;
    }

    if (quote) {
      if (character === quoteEnd) {
        quote = null;
        quoteEnd = null;
      } else value += character;
      continue;
    }

    if (['"', "'", "`", "“", "‘"].includes(character)) {
      quote = character;
      quoteEnd = character === "“" ? "”" : character === "‘" ? "’" : character;
      continue;
    }

    if (/\s/.test(character)) push();
    else value += character;
  }

  if (escaped) value += "\\";
  if (quote) throw new Error(`Guillemet non fermé dans le shortcode : ${source}`);
  push();
  return tokens;
}

export function parseHugoShortcode(source) {
  const match = source.match(SHORTCODE_PATTERN);
  if (!match || !((match[1] === "<" && match[3] === ">") || match[1] === match[3])) return null;

  let body = match[2].trim();
  const closing = body.startsWith("/");
  if (closing) body = body.slice(1).trim();
  const explicitSelfClosing = !closing && body.endsWith("/");
  if (explicitSelfClosing) body = body.slice(0, -1).trim();

  const [rawName, ...tokens] = tokenizeHugoShortcode(body);
  const name = rawName?.toLowerCase();
  if (!name) return null;
  if (closing && tokens.length) {
    throw new Error(`Le shortcode fermant ${name} ne peut pas recevoir de paramètres.`);
  }

  const named = {};
  const positional = [];
  for (const token of tokens) {
    const separator = token.indexOf("=");
    if (separator > 0) {
      named[token.slice(0, separator)] = token.slice(separator + 1);
    } else {
      positional.push(token);
    }
  }

  if (positional.length && Object.keys(named).length) {
    throw new Error(`Le shortcode ${name} mélange paramètres nommés et positionnels.`);
  }

  return {
    closing,
    delimiter: match[1],
    name,
    named,
    positional,
    selfClosing: explicitSelfClosing || (!closing && !PAIRED_SHORTCODES.has(name)),
  };
}

function markerFromNode(node) {
  const value = paragraphText(node);
  if (value === null) return null;
  return parseHugoShortcode(value);
}

function transformInlineShortcodes(node, file) {
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
      } else if (!shortcode.selfClosing || shortcode.name !== "icon") {
        file.fail(
          `Le shortcode ${shortcode.name} doit être isolé par une ligne vide. Seul icon peut être utilisé dans une phrase.`,
          node,
        );
      } else {
        transformed.push(createMaterialIcon(shortcode, file));
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

function booleanParameter(value, fallback = false) {
  if (value === undefined) return fallback;
  return !["0", "false", "no", "off", "non"].includes(String(value).toLowerCase());
}

function parameter(shortcode, name, position, fallback) {
  return shortcode.named[name] ?? shortcode.positional[position] ?? fallback;
}

function createAdmonition(shortcode, children, file) {
  const requestedType = String(parameter(shortcode, "type", 0, "note")).toLowerCase();
  const type = ADMONITIONS[requestedType] ? requestedType : "note";
  const definition = ADMONITIONS[type];
  const title = parameter(shortcode, "title", 1, definition.label);
  const icon = shortcode.named.icon ?? definition.icon;
  const collapsible = booleanParameter(shortcode.named.collapsible, false);
  const open = booleanParameter(shortcode.named.open, false);

  const titleChildren = [
    materialSymbolNode(icon, file, { className: ["material-admonition-icon"] }),
    textNode(String(title)),
  ];
  const titleNode = elementNode(
    collapsible ? "summary" : "div",
    { className: ["material-admonition-title"] },
    titleChildren,
  );

  return elementNode(
    collapsible ? "details" : "aside",
    {
      className: ["material-admonition", `material-admonition-${type}`],
      dataAdmonition: type,
      ...(collapsible && open ? { open: true } : {}),
    },
    [titleNode, elementNode("div", { className: ["material-admonition-content"] }, children)],
  );
}

function createMaterialIcon(shortcode, file) {
  const name = parameter(shortcode, "name", 0, "info");
  const label = shortcode.named.label;
  return materialSymbolNode(name, file, {
    className: ["material-shortcode-inline-icon"],
    label: label ? String(label) : undefined,
  });
}

function createTab(shortcode, children) {
  const title = String(parameter(shortcode, "title", 0, "Onglet"));
  return elementNode(
    "section",
    {
      className: ["material-tab-panel"],
      dataMaterialTab: "",
      dataTitle: title,
    },
    children,
  );
}

function createTabs(shortcode, children) {
  const label = String(parameter(shortcode, "label", 0, "Contenu à onglets"));
  return elementNode(
    "div",
    {
      ariaLabel: label,
      className: ["material-tabs"],
      dataMaterialTabs: "",
    },
    children,
  );
}

function createMaterialTable(shortcode, children) {
  return elementNode(
    "div",
    {
      className: ["material-data-table"],
      dataMaterialTable: "",
      dataFilter: String(booleanParameter(shortcode.named.filter, false)),
      dataPaginate: String(booleanParameter(shortcode.named.paginate, false)),
      dataPageSize: String(parameter(shortcode, "pageSize", 0, "10")),
      dataSort: String(booleanParameter(shortcode.named.sort, true)),
    },
    children,
  );
}

function renderShortcode(shortcode, children, file) {
  switch (shortcode.name) {
    case "admonition":
      return createAdmonition(shortcode, children, file);
    case "icon":
      return createMaterialIcon(shortcode, file);
    case "material-table":
      return createMaterialTable(shortcode, children);
    case "tab":
      return createTab(shortcode, children);
    case "tabs":
      return createTabs(shortcode, children);
    default:
      file.fail(`Shortcode Hugo inconnu : ${shortcode.name}`);
  }
}

function transformChildren(children, file) {
  children = expandAdjacentMarkerParagraphs(children);
  const output = [];

  for (let index = 0; index < children.length; index += 1) {
    const node = children[index];
    const marker = markerFromNode(node);

    if (!marker) {
      transformInlineShortcodes(node, file);
      if (Array.isArray(node.children)) node.children = transformChildren(node.children, file);
      output.push(node);
      continue;
    }

    if (marker.closing) file.fail(`Shortcode fermant inattendu : ${marker.name}`, node);
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
    const inner = transformChildren(children.slice(index + 1, closingIndex), file);
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
