import MATERIAL_SYMBOL_CODEPOINTS from "../../generated/material-symbol-codepoints.json" with { type: "json" };
export { MATERIAL_SYMBOL_CODEPOINTS };

export const SHORTCODE_PATTERN = /^\s*\{\{([<%])\s*([\s\S]*?)\s*([>%])\}\}\s*$/;

export const ADMONITIONS = Object.freeze({
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

export const MATERIAL_SYMBOL_ALIASES = Object.freeze({
  "children-face": "child-care",
});

export const SHORTCODE_ALIASES = Object.freeze({
  badge: "inline-badge",
  callout: "admonition",
  counter: "inline-badge",
  indicator: "inline-badge",
  key: "kbd",
  keys: "kbd",
});

export const PAIRED_SHORTCODES = new Set([
  "admonition",
  "annotation",
  "annotations",
  "button",
  "card",
  "cards",
  "material-table",
  "rich-tooltip",
  "shiki",
  "tab",
  "tabs",
]);
export const INLINE_SHORTCODES = new Set([
  "abbr",
  "annotation-ref",
  "icon",
  "inline-badge",
  "kbd",
  "rich-tooltip-ref",
]);
export const KNOWN_SHORTCODES = Object.freeze([
  "abbr",
  "admonition",
  "annotation",
  "annotation-ref",
  "annotations",
  "button",
  "card",
  "cards",
  "figure",
  "icon",
  "inline-badge",
  "kbd",
  "material-table",
  "progress",
  "rich-tooltip",
  "rich-tooltip-ref",
  "shiki",
  "tab",
  "tabs",
]);

export const ADMONITION_TYPES = Object.freeze(
  Object.entries(ADMONITIONS)
    .filter(([, definition]) => !definition.canonical)
    .map(([type]) => type),
);
export const ADMONITION_ALIASES = Object.freeze(
  Object.entries(ADMONITIONS)
    .filter(([, definition]) => definition.canonical)
    .map(([type]) => type),
);

export const TONES = Object.freeze({
  danger: "danger",
  error: "danger",
  info: "info",
  neutral: "neutral",
  success: "success",
  warning: "warning",
});
export const TONE_VALUES = Object.freeze(["neutral", "info", "success", "warning", "danger"]);
export const BUTTON_TAGS = Object.freeze({
  elevated: "md-elevated-button",
  filled: "md-filled-button",
  outlined: "md-outlined-button",
  text: "md-text-button",
  tonal: "md-filled-tonal-button",
});
export const BUTTON_VARIANTS = Object.freeze(Object.keys(BUTTON_TAGS));
