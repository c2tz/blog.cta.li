import MATERIAL_SYMBOL_CODEPOINTS from "../generated/material-symbol-codepoints.json" with { type: "json" };

const SHORTCODE_PATTERN = /^\s*\{\{([<%])\s*([\s\S]*?)\s*([>%])\}\}\s*$/;

const ADMONITIONS = Object.freeze({
  note: { icon: "note", label: "Note" },
  abstract: { icon: "summarize", label: "Résumé" },
  summary: { canonical: "abstract", icon: "summarize", label: "Résumé" },
  tldr: { canonical: "abstract", icon: "summarize", label: "Résumé" },
  info: { icon: "info", label: "Information" },
  todo: { canonical: "info", icon: "task-alt", label: "À faire" },
  tip: { icon: "lightbulb", label: "Astuce" },
  hint: { canonical: "tip", icon: "lightbulb", label: "Indice" },
  important: { canonical: "tip", icon: "priority-high", label: "Important" },
  success: { icon: "check-circle", label: "Succès" },
  check: { canonical: "success", icon: "check-circle", label: "Succès" },
  done: { canonical: "success", icon: "task-alt", label: "Terminé" },
  question: { icon: "question-mark", label: "Question" },
  help: { canonical: "question", icon: "help", label: "Aide" },
  faq: { canonical: "question", icon: "contact-support", label: "FAQ" },
  warning: { icon: "warning", label: "Attention" },
  attention: { canonical: "warning", icon: "warning", label: "Attention" },
  caution: { canonical: "warning", icon: "warning", label: "Prudence" },
  failure: { icon: "dangerous", label: "Échec" },
  fail: { canonical: "failure", icon: "dangerous", label: "Échec" },
  missing: { canonical: "failure", icon: "unknown-document", label: "Manquant" },
  danger: { icon: "report", label: "Danger" },
  error: { canonical: "danger", icon: "error", label: "Erreur" },
  bug: { icon: "bug-report", label: "Bug" },
  example: { icon: "science", label: "Exemple" },
  quote: { icon: "format-quote", label: "Citation" },
  cite: { canonical: "quote", icon: "format-quote", label: "Citation" },
});

const MATERIAL_SYMBOL_ALIASES = Object.freeze({
  "children-face": "child-care",
});

const SHORTCODE_ALIASES = Object.freeze({
  badge: "inline-badge",
  callout: "admonition",
  counter: "inline-badge",
  indicator: "inline-badge",
  key: "kbd",
  keys: "kbd",
});

const PAIRED_SHORTCODES = new Set(["admonition", "material-table", "shiki", "tab", "tabs"]);
const INLINE_SHORTCODES = new Set(["icon", "inline-badge", "kbd"]);
const KNOWN_SHORTCODES = Object.freeze([
  "admonition",
  "icon",
  "inline-badge",
  "kbd",
  "material-table",
  "progress",
  "shiki",
  "tab",
  "tabs",
]);

const ADMONITION_TYPES = Object.freeze(
  Object.entries(ADMONITIONS)
    .filter(([, definition]) => !definition.canonical)
    .map(([type]) => type),
);
const ADMONITION_ALIASES = Object.freeze(
  Object.entries(ADMONITIONS)
    .filter(([, definition]) => definition.canonical)
    .map(([type]) => type),
);

const TONES = Object.freeze({
  danger: "danger",
  error: "danger",
  info: "info",
  neutral: "neutral",
  success: "success",
  warning: "warning",
});
const TONE_VALUES = Object.freeze(["neutral", "info", "success", "warning", "danger"]);

function optionList(values) {
  return Array.from(values, (value) => `\`${value}\``).join(", ");
}

function normalizeShortcodeName(name) {
  const normalized = String(name).toLowerCase();
  return SHORTCODE_ALIASES[normalized] ?? normalized;
}

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
  if (!codepoint) {
    file.fail(
      `Material Symbol inconnu : ${name}. Vérifiez le nom dans src/generated/material-symbol-codepoints.json. ` +
        "Si le symbole existe mais s’affiche en carré, lancez pnpm update:material-symbols puis pnpm verify. " +
        "Si le symbole n’existe pas dans la carte, lancez pnpm update:material-symbol-map puis pnpm update:material-symbols.",
    );
  }

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

function materialExpansionIndicatorNode(file) {
  return materialSymbolNode("expand-more", file, {
    className: ["material-admonition-toggle-indicator", "material-admonition-toggle-icon"],
  });
}

function paragraphText(node) {
  if (node?.type !== "paragraph" || !Array.isArray(node.children)) return null;
  if (!node.children.every((child) => child.type === "text")) return null;
  return node.children.map((child) => child.value).join("");
}

function tokenizeHugoShortcode(source) {
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
  const name = rawName ? normalizeShortcodeName(rawName) : undefined;
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
      } else if (!shortcode.selfClosing || !INLINE_SHORTCODES.has(shortcode.name)) {
        file.fail(
          `Le shortcode ${shortcode.name} doit être isolé par une ligne vide. Shortcodes inline autorisés : ${optionList(INLINE_SHORTCODES)}.`,
          node,
        );
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

function booleanParameter(value, fallback = false) {
  if (value === undefined) return fallback;
  return !["0", "false", "no", "off", "non"].includes(String(value).toLowerCase());
}

function parameter(shortcode, name, position, fallback) {
  return shortcode.named[name] ?? shortcode.positional[position] ?? fallback;
}

function canonicalTone(value, shortcodeName, file) {
  const requestedTone = String(value ?? "neutral").toLowerCase();
  const tone = TONES[requestedTone];
  if (!tone) {
    file.fail(
      `Ton inconnu pour ${shortcodeName} : \`${requestedTone}\`. Valeurs possibles : ${optionList(TONE_VALUES)}.`,
    );
  }

  return tone;
}

function createAdmonition(shortcode, children, file) {
  const requestedType = String(parameter(shortcode, "type", 0, "note")).toLowerCase();
  const definition = ADMONITIONS[requestedType];
  if (!definition) {
    file.fail(
      `Type d’admonition inconnu : \`${requestedType}\`. Valeurs possibles : ${optionList(ADMONITION_TYPES)}. Alias acceptés : ${optionList(ADMONITION_ALIASES)}.`,
    );
  }

  const type = definition.canonical ?? requestedType;
  const title = parameter(shortcode, "title", 1, definition.label);
  const icon = shortcode.named.icon ?? definition.icon;
  const collapsible = booleanParameter(shortcode.named.collapsible, false);
  const open = booleanParameter(shortcode.named.open, false);

  const titleChildren = [
    materialSymbolNode(icon, file, { className: ["material-admonition-icon"] }),
    textNode(String(title)),
  ];
  if (collapsible) {
    titleChildren.push(materialExpansionIndicatorNode(file));
  }
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

function createInlineBadge(shortcode, file) {
  const label = parameter(shortcode, "label", 0, undefined);
  const value = parameter(shortcode, "value", 1, undefined);
  const tone = canonicalTone(shortcode.named.tone, "inline-badge", file);
  if (!label && !value) {
    file.fail(
      'Le shortcode inline-badge doit recevoir au moins `label` ou `value`, par exemple {{< inline-badge label="API" value="v2" />}}.',
    );
  }

  return elementNode(
    "span",
    {
      className: ["material-inline-badge", `material-inline-badge-${tone}`],
      dataTone: tone,
    },
    [
      ...(label
        ? [
            elementNode("span", { className: ["material-inline-badge-label"] }, [
              textNode(String(label)),
            ]),
          ]
        : []),
      ...(value
        ? [
            elementNode("span", { className: ["material-inline-badge-value"] }, [
              textNode(String(value)),
            ]),
          ]
        : []),
    ],
  );
}

function createKbd(shortcode, file) {
  const keys = [
    ...shortcode.positional,
    ...(shortcode.named.key ? [shortcode.named.key] : []),
    ...(shortcode.named.value ? [shortcode.named.value] : []),
  ]
    .map((key) => String(key).trim())
    .filter(Boolean);
  if (!keys.length) {
    file.fail('Le shortcode kbd doit recevoir une touche, par exemple {{< kbd "Ctrl" />}}.');
  }

  if (keys.length === 1) {
    return elementNode("kbd", { className: ["material-kbd"] }, [textNode(keys[0])]);
  }

  return elementNode(
    "span",
    { className: ["material-kbd-sequence"], role: "group", ariaLabel: keys.join(" + ") },
    keys.flatMap((key, index) => [
      ...(index ? [textNode(" + ")] : []),
      elementNode("kbd", { className: ["material-kbd"] }, [textNode(key)]),
    ]),
  );
}

function createProgress(shortcode, file) {
  const label = String(parameter(shortcode, "label", 0, "Progression"));
  const rawValue = parameter(shortcode, "value", 1, shortcode.named.percent ?? "0");
  const value = Number.parseFloat(String(rawValue));
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    file.fail(`Valeur progress invalide : \`${rawValue}\`. Utilisez un nombre entre 0 et 100.`);
  }

  const tone = canonicalTone(shortcode.named.tone, "progress", file);
  const roundedValue = Math.round(value * 10) / 10;
  const valueLabel = `${Number.isInteger(roundedValue) ? roundedValue.toFixed(0) : roundedValue}%`;

  return elementNode(
    "div",
    {
      ariaLabel: label,
      ariaValueMax: 100,
      ariaValueMin: 0,
      ariaValueNow: roundedValue,
      className: ["material-progress", `material-progress-${tone}`],
      dataTone: tone,
      role: "progressbar",
    },
    [
      elementNode("div", { className: ["material-progress-header"] }, [
        elementNode("span", { className: ["material-progress-label"] }, [textNode(label)]),
        elementNode("span", { className: ["material-progress-value"] }, [textNode(valueLabel)]),
      ]),
      elementNode("span", { ariaHidden: "true", className: ["material-progress-track"] }, [
        elementNode("span", {
          className: ["material-progress-fill"],
          style: `width: ${roundedValue}%`,
        }),
      ]),
    ],
  );
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

function findFirstCodeNode(children) {
  return children.find((child) => child?.type === "code");
}

function mergeCodeMeta(...values) {
  return values
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

function createShiki(shortcode, children, file) {
  const codeNode = findFirstCodeNode(children);
  if (!codeNode) {
    file.fail(
      "Le shortcode shiki doit contenir un bloc de code fenced Markdown, par exemple ```ts ... ```.",
    );
  }

  const lang = parameter(shortcode, "lang", 0, undefined);
  const meta = shortcode.named.meta;
  const title = shortcode.named.title ?? shortcode.named.filename ?? shortcode.named.file;
  const filename = shortcode.named.filename ?? shortcode.named.file;
  const caption = shortcode.named.caption;
  const icon = shortcode.named.icon ?? "terminal";

  if (lang) codeNode.lang = String(lang);
  if (meta) codeNode.meta = mergeCodeMeta(codeNode.meta, meta);

  const shikiChildren = [];
  if (title || filename) {
    shikiChildren.push(
      elementNode("figcaption", { className: ["material-shiki-header"] }, [
        materialSymbolNode(icon, file, {
          className: ["material-shiki-icon"],
        }),
        elementNode("span", { className: ["material-shiki-title"] }, [
          textNode(String(title ?? filename)),
        ]),
        ...(filename && filename !== title
          ? [
              elementNode("span", { className: ["material-shiki-filename"] }, [
                textNode(String(filename)),
              ]),
            ]
          : []),
      ]),
    );
  }

  shikiChildren.push(...children);
  if (caption) {
    shikiChildren.push(
      elementNode("figcaption", { className: ["material-shiki-caption"] }, [
        textNode(String(caption)),
      ]),
    );
  }

  return elementNode(
    "figure",
    {
      className: ["material-shiki"],
      dataShikiShortcode: "",
    },
    shikiChildren,
  );
}

function renderShortcode(shortcode, children, file) {
  switch (shortcode.name) {
    case "admonition":
      return createAdmonition(shortcode, children, file);
    case "icon":
      return createMaterialIcon(shortcode, file);
    case "inline-badge":
      return createInlineBadge(shortcode, file);
    case "kbd":
      return createKbd(shortcode, file);
    case "material-table":
      return createMaterialTable(shortcode, children);
    case "progress":
      return createProgress(shortcode, file);
    case "shiki":
      return createShiki(shortcode, children, file);
    case "tab":
      return createTab(shortcode, children);
    case "tabs":
      return createTabs(shortcode, children);
    default:
      file.fail(
        `Shortcode Hugo inconnu : ${shortcode.name}. Shortcodes disponibles : ${optionList(KNOWN_SHORTCODES)}.`,
      );
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
