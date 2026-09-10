import {
  ADMONITIONS,
  KNOWN_SHORTCODES,
  ADMONITION_TYPES,
  ADMONITION_ALIASES,
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

function finiteNumber(value, name, shortcodeName, file, { minimum = 0, maximum } = {}) {
  const number = Number.parseFloat(String(value));
  if (!Number.isFinite(number) || number < minimum || (maximum !== undefined && number > maximum)) {
    const range = maximum === undefined ? `au moins ${minimum}` : `entre ${minimum} et ${maximum}`;
    file.fail(
      `Valeur ${name} invalide pour ${shortcodeName} : \`${value}\`. Utilisez un nombre ${range}.`,
    );
  }
  return number;
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

  if (collapsible) titleChildren.push(materialExpansionIndicatorNode(file));

  return elementNode(
    collapsible ? "details" : "aside",
    {
      className: ["material-admonition", `material-admonition-${type}`],
      dataAdmonition: type,
      ...(collapsible && open ? { open: true } : {}),
    },
    [
      elementNode(
        collapsible ? "summary" : "div",
        { className: ["material-admonition-title"] },
        titleChildren,
      ),
      elementNode("div", { className: ["material-admonition-content"] }, children),
    ],
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

function createRichTooltipReference(shortcode, file) {
  const id = safeId(parameter(shortcode, "id", 0, undefined), "rich-tooltip-ref", file);
  const label = String(parameter(shortcode, "label", 1, "Afficher le détail"));
  return elementNode(
    "button",
    {
      ariaControls: id,
      ariaExpanded: "false",
      ariaHasPopup: "dialog",
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
      ariaLabelledBy: titleId,
      ariaModal: "false",
      className: ["material-rich-tooltip", "site-rich-tooltip"],
      dataSiteRichTooltip: "",
      id,
      popover: "manual",
      role: "dialog",
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
  if (shortcode.named.iconPosition === "end") {
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
      ...(iconNode ? [iconNode] : []),
      elementNode("span", { className: ["material-button-label"] }, content),
    ],
  );
}

function createProgress(shortcode, file) {
  const label = String(parameter(shortcode, "label", 0, "Progression"));
  const rawValue = shortcode.named.value ?? shortcode.named.percent ?? shortcode.positional[1];
  const indeterminate = booleanParameter(shortcode.named.indeterminate, rawValue === undefined);
  const fourColor = booleanParameter(shortcode.named.fourColor, false);
  const max = finiteNumber(shortcode.named.max ?? 100, "max", "progress", file, { minimum: 0.001 });

  if (indeterminate && rawValue !== undefined) {
    file.fail("Le shortcode progress ne peut pas combiner `indeterminate=true` et une valeur.");
  }
  if (!indeterminate && rawValue === undefined) {
    file.fail("Le shortcode progress déterminé exige une valeur.");
  }

  const properties = {
    ariaLabel: label,
    className: ["material-progress-indicator"],
    ...(indeterminate ? { indeterminate: true } : {}),
    ...(fourColor ? { "four-color": true } : {}),
    max,
  };

  if (!indeterminate) {
    const value = finiteNumber(rawValue, "value", "progress", file, { maximum: max });
    properties.value = value;
    if (shortcode.named.buffer !== undefined) {
      const buffer = finiteNumber(shortcode.named.buffer, "buffer", "progress", file, {
        maximum: max,
      });
      if (buffer < value) {
        file.fail("La valeur `buffer` de progress doit être supérieure à `value`.");
      }
      properties.buffer = buffer;
    }
  }

  return elementNode("md-linear-progress", properties);
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

function createVideo(shortcode, file) {
  const mediaUrl = (value, name) => {
    const source = safeUrl(value, "video", name, file);
    const parsed = new URL(source, "https://shortcode.local/");
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      source.startsWith("//")
    ) {
      file.fail(`video.${name} doit être une URL HTTPS sans identifiants ou un chemin local.`);
    }
    return source;
  };
  const src = mediaUrl(parameter(shortcode, "src", 0, undefined), "src");
  const poster = shortcode.named.poster ? mediaUrl(shortcode.named.poster, "poster") : undefined;
  const title = String(shortcode.named.title ?? "Vidéo").trim() || "Vidéo";
  return elementNode(
    "figure",
    {
      className: ["site-video", "not-prose"],
      dataVideoPlayer: "",
      dataVideoSrc: src,
      ...(poster ? { dataVideoPoster: poster } : {}),
      dataVideoTitle: title,
    },
    [
      elementNode("div", { className: ["site-video-stage"], dataVideoStage: "" }),
      elementNode("figcaption", {}, [textNode(title)]),
      elementNode("p", { className: ["site-video-status"], role: "status", hidden: true }),
      elementNode("noscript", {}, [
        elementNode("a", { href: src }, [textNode(`Ouvrir la vidéo : ${title}`)]),
      ]),
    ],
  );
}

export function renderShortcode(shortcode, children, file) {
  switch (shortcode.name) {
    case "admonition":
      return createAdmonition(shortcode, children, file);
    case "button":
      return createButton(shortcode, children, file);
    case "icon":
      return createMaterialIcon(shortcode, file);
    case "material-table":
      return createMaterialTable(shortcode, children);
    case "progress":
      return createProgress(shortcode, file);
    case "rich-tooltip":
      return createRichTooltip(shortcode, children, file);
    case "rich-tooltip-ref":
      return createRichTooltipReference(shortcode, file);
    case "tab":
      return createTab(shortcode, children);
    case "tabs":
      return createTabs(shortcode, children);
    case "video":
      return createVideo(shortcode, file);
    default:
      file.fail(
        `Shortcode Hugo inconnu : ${shortcode.name}. Shortcodes disponibles : ${optionList(KNOWN_SHORTCODES)}.`,
      );
  }
}
