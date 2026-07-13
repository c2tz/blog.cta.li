import {
  ADMONITIONS,
  KNOWN_SHORTCODES,
  ADMONITION_TYPES,
  ADMONITION_ALIASES,
  TONES,
  TONE_VALUES,
  BUTTON_TAGS,
  BUTTON_VARIANTS,
} from "./config.mjs";
import {
  optionList,
  textNode,
  elementNode,
  materialSymbolNode,
  materialExpansionIndicatorNode,
} from "./ast.mjs";

function booleanParameter(value, fallback = false) {
  if (value === undefined) return fallback;
  return !["0", "false", "no", "off", "non"].includes(String(value).toLowerCase());
}

function parameter(shortcode, name, position, fallback) {
  return shortcode.named[name] ?? shortcode.positional[position] ?? fallback;
}

function safeUrl(value, shortcodeName, parameterName, file, { allowMail = false } = {}) {
  const source = String(value ?? "").trim();
  if (!source) {
    file.fail(`Le paramètre ${parameterName} du shortcode ${shortcodeName} est obligatoire.`);
  }

  try {
    const parsed = new URL(source, "https://shortcode.local/");
    const allowedProtocols = allowMail ? ["http:", "https:", "mailto:"] : ["http:", "https:"];
    if (!allowedProtocols.includes(parsed.protocol)) throw new Error("unsupported_protocol");
  } catch {
    file.fail(`URL invalide pour ${shortcodeName}.${parameterName} : \`${source}\`.`);
  }

  return source;
}

function safeId(value, shortcodeName, file) {
  const id = String(value ?? "").trim();
  if (!/^[A-Za-z][\w:.-]*$/.test(id)) {
    file.fail(
      `Identifiant invalide pour ${shortcodeName} : \`${id}\`. Utilisez une lettre puis lettres, chiffres, tirets ou underscores.`,
    );
  }
  return id;
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

function createAbbreviation(shortcode, file) {
  const text = parameter(shortcode, "text", 0, undefined);
  const title = parameter(shortcode, "title", 1, undefined);
  if (!text || !title) {
    file.fail(
      'Le shortcode abbr exige `text` et `title`, par exemple {{< abbr text="API" title="Interface de programmation" />}}.',
    );
  }

  return elementNode(
    "abbr",
    {
      ariaLabel: `${String(text)} — ${String(title)}`,
      className: ["material-abbreviation"],
      dataTooltip: String(title),
    },
    [textNode(String(text))],
  );
}

function createAnnotationReference(shortcode, file) {
  const id = safeId(parameter(shortcode, "id", 0, undefined), "annotation-ref", file);
  const label = String(parameter(shortcode, "label", 1, id));
  return elementNode("sup", { className: ["material-annotation-reference"] }, [
    elementNode(
      "button",
      {
        ariaControls: id,
        ariaExpanded: "false",
        ariaHasPopup: "dialog",
        ariaLabel: `Afficher l’annotation ${label}`,
        className: ["site-context-popover-trigger"],
        dataContextPopoverTrigger: id,
        dataSiteContextTrigger: id,
        popoverTarget: id,
        popoverTargetAction: "toggle",
        type: "button",
      },
      [textNode(label)],
    ),
  ]);
}

function createAnnotations(shortcode, children) {
  const label = String(parameter(shortcode, "label", 0, "Annotations"));
  return elementNode(
    "section",
    {
      ariaLabel: label,
      className: ["material-annotations"],
      dataMaterialAnnotations: "",
    },
    children,
  );
}

function createAnnotation(shortcode, children, file) {
  const id = safeId(parameter(shortcode, "id", 0, undefined), "annotation", file);
  const label = String(parameter(shortcode, "label", 1, id));
  const title = String(shortcode.named.title ?? `Annotation ${label}`);
  const titleId = `${id}-title`;
  return elementNode(
    "dialog",
    {
      ariaLabelledBy: titleId,
      ariaModal: "false",
      className: ["material-annotation", "site-context-popover"],
      dataNoImageDialog: "",
      dataSiteContextPopover: "",
      id,
      popover: "auto",
      role: "dialog",
    },
    [
      elementNode(
        "div",
        {
          ariaLevel: 2,
          className: ["material-annotation-title", "site-context-popover-title"],
          id: titleId,
          role: "heading",
        },
        [textNode(title)],
      ),
      elementNode(
        "div",
        { className: ["material-annotation-content", "site-context-popover-content"] },
        children,
      ),
    ],
  );
}

function createRichTooltipReference(shortcode, file) {
  const id = safeId(parameter(shortcode, "id", 0, undefined), "rich-tooltip-ref", file);
  const label = String(parameter(shortcode, "label", 1, "Afficher le détail"));
  return elementNode(
    "button",
    {
      ariaControls: id,
      ariaExpanded: "false",
      className: ["material-rich-tooltip-trigger", "site-rich-tooltip-trigger"],
      dataRichTooltipTrigger: id,
      dataSiteRichTooltipTrigger: "",
      type: "button",
    },
    [textNode(label)],
  );
}

function createRichTooltip(shortcode, children, file) {
  const id = safeId(parameter(shortcode, "id", 0, undefined), "rich-tooltip", file);
  const title = String(shortcode.named.title ?? "Information complémentaire");
  const titleId = `${id}-title`;
  return elementNode(
    "div",
    {
      className: ["material-rich-tooltip", "site-rich-tooltip"],
      dataNoImageDialog: "",
      dataSiteRichTooltip: "",
      id,
      popover: "manual",
      role: "tooltip",
    },
    [
      elementNode(
        "div",
        {
          className: ["material-rich-tooltip-title", "site-rich-tooltip-title"],
          id: titleId,
        },
        [textNode(title)],
      ),
      elementNode(
        "div",
        { className: ["material-rich-tooltip-content", "site-rich-tooltip-content"] },
        children,
      ),
    ],
  );
}

function createButton(shortcode, children, file) {
  const href = safeUrl(parameter(shortcode, "href", 0, undefined), "button", "href", file, {
    allowMail: true,
  });
  const requestedVariant = String(shortcode.named.variant ?? "filled").toLowerCase();
  if (!BUTTON_VARIANTS.includes(requestedVariant)) {
    file.fail(
      `Variante de bouton inconnue : \`${requestedVariant}\`. Valeurs possibles : ${optionList(BUTTON_VARIANTS)}.`,
    );
  }

  const label = shortcode.named.label;
  const icon = shortcode.named.icon;
  const iconPosition = shortcode.named.iconPosition === "end" ? "end" : "start";
  if (icon && iconPosition === "end") {
    file.fail(
      'Material Web ne prend pas en charge les icônes terminales sur les boutons-liens. Utilisez iconPosition="start".',
    );
  }
  if (
    children.length > 0 &&
    (children.length !== 1 ||
      children[0]?.type !== "paragraph" ||
      children[0].children.some((child) => child.type === "break"))
  ) {
    file.fail(
      "Le libellé d’un bouton doit tenir sur une seule ligne Markdown. Utilisez un paragraphe court ou le paramètre `label`.",
    );
  }
  const content = children.length ? children[0].children : label ? [textNode(String(label))] : [];
  if (!content.length) {
    file.fail("Le shortcode button doit contenir un libellé Markdown ou recevoir `label`.");
  }

  const iconNode = icon
    ? materialSymbolNode(icon, file, {
        className: ["material-button-icon"],
        slot: "icon",
      })
    : null;
  const target = shortcode.named.target === "_blank" ? "_blank" : undefined;
  return elementNode(
    BUTTON_TAGS[requestedVariant],
    {
      className: ["material-button"],
      ...(iconNode ? { hasIcon: true } : {}),
      href,
      ...(target ? { target } : {}),
    },
    [
      ...(iconNode && iconPosition === "start" ? [iconNode] : []),
      elementNode("span", { className: ["material-button-label"] }, content),
    ],
  );
}

function createCards(shortcode, children, file) {
  const rawColumns = Number.parseInt(String(parameter(shortcode, "columns", 0, "3")), 10);
  if (!Number.isInteger(rawColumns) || rawColumns < 1 || rawColumns > 4) {
    file.fail("Le shortcode cards accepte entre 1 et 4 colonnes.");
  }
  return elementNode(
    "div",
    {
      className: ["material-card-grid"],
      dataColumns: rawColumns,
      style: `--material-card-columns: ${rawColumns}`,
    },
    children,
  );
}

function createCard(shortcode, children, file) {
  const title = parameter(shortcode, "title", 0, undefined);
  if (!title) file.fail("Le shortcode card exige un paramètre `title`.");
  const hrefValue = shortcode.named.href;
  const href = hrefValue
    ? safeUrl(hrefValue, "card", "href", file, { allowMail: true })
    : undefined;
  const icon = shortcode.named.icon;
  const headingChildren = [
    ...(icon ? [materialSymbolNode(icon, file, { className: ["material-card-icon"] })] : []),
    textNode(String(title)),
  ];
  const heading = href
    ? elementNode("a", { className: ["material-card-link"], href }, headingChildren)
    : elementNode("span", { className: ["material-card-title-text"] }, headingChildren);

  return elementNode("article", { className: ["material-card"] }, [
    elementNode("h3", { className: ["material-card-title"] }, [heading]),
    ...(children.length
      ? [elementNode("div", { className: ["material-card-content"] }, children)]
      : []),
  ]);
}

function createFigure(shortcode, file) {
  const src = safeUrl(parameter(shortcode, "src", 0, undefined), "figure", "src", file);
  const alt = String(parameter(shortcode, "alt", 1, ""));
  const caption = shortcode.named.caption;
  const width = Number.parseInt(String(shortcode.named.width ?? ""), 10);
  const height = Number.parseInt(String(shortcode.named.height ?? ""), 10);
  return elementNode("figure", { className: ["material-figure"] }, [
    elementNode("img", {
      alt,
      className: ["material-figure-image"],
      decoding: "async",
      ...(Number.isFinite(height) && height > 0 ? { height } : {}),
      loading: "lazy",
      src,
      ...(Number.isFinite(width) && width > 0 ? { width } : {}),
    }),
    ...(caption
      ? [
          elementNode("figcaption", { className: ["material-figure-caption"] }, [
            textNode(String(caption)),
          ]),
        ]
      : []),
  ]);
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
      className: ["material-progress", `material-progress-${tone}`],
      dataTone: tone,
    },
    [
      elementNode("div", { className: ["material-progress-header"] }, [
        elementNode("span", { className: ["material-progress-label"] }, [textNode(label)]),
        elementNode("span", { className: ["material-progress-value"] }, [textNode(valueLabel)]),
      ]),
      elementNode("md-linear-progress", {
        ariaLabel: label,
        className: ["material-progress-indicator", `material-progress-indicator-${tone}`],
        max: 1,
        value: roundedValue / 100,
      }),
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

export function renderShortcode(shortcode, children, file) {
  switch (shortcode.name) {
    case "abbr":
      return createAbbreviation(shortcode, file);
    case "admonition":
      return createAdmonition(shortcode, children, file);
    case "annotation":
      return createAnnotation(shortcode, children, file);
    case "annotation-ref":
      return createAnnotationReference(shortcode, file);
    case "annotations":
      return createAnnotations(shortcode, children);
    case "button":
      return createButton(shortcode, children, file);
    case "card":
      return createCard(shortcode, children, file);
    case "cards":
      return createCards(shortcode, children, file);
    case "figure":
      return createFigure(shortcode, file);
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
    case "rich-tooltip":
      return createRichTooltip(shortcode, children, file);
    case "rich-tooltip-ref":
      return createRichTooltipReference(shortcode, file);
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
