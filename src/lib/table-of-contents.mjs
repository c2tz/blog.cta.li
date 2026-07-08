const TOC_SHORTCODE_PATTERN = /^\s*\{\{[<%]\s*toc\b([\s\S]*?)\s*[>%]\}\}\s*$/i;
const MARKDOWN_HEADING_PATTERN = /^\s{0,3}(#{2,4})\s+(.+?)\s*#*\s*$/;
const MARKDOWN_FENCE_PATTERN = /^\s*(`{3,}|~{3,})/;

const DISABLED_VALUES = new Set([
  "0",
  "false",
  "no",
  "non",
  "off",
  "disabled",
  "desactive",
  "désactivé",
]);
const ENABLED_VALUES = new Set(["1", "true", "yes", "oui", "on", "enabled", "active", "actif"]);

function sourceLines(source) {
  return source.replace(/\r\n?/g, "\n").split("\n");
}

function readBooleanPreference(value, fallback) {
  if (!value) return fallback;

  const normalized = value.trim().toLowerCase();
  if (DISABLED_VALUES.has(normalized)) return false;
  if (ENABLED_VALUES.has(normalized)) return true;

  return fallback;
}

function fencedMarkdownLines(source) {
  let fence;

  return sourceLines(source).map((line) => {
    const fenceMatch = line.match(MARKDOWN_FENCE_PATTERN);
    const insideFence = Boolean(fence);

    if (fenceMatch) {
      if (!fence) fence = fenceMatch[1][0];
      else if (fenceMatch[1].startsWith(fence)) fence = undefined;
    }

    return { insideFence, line };
  });
}

export function readTableOfContentsPreference(source) {
  for (const { insideFence, line } of fencedMarkdownLines(source)) {
    if (insideFence) continue;

    const match = line.match(TOC_SHORTCODE_PATTERN);
    if (!match) continue;

    const parameters = match[1]?.trim() ?? "";
    if (!parameters || parameters === "/") return true;

    const namedValue = parameters.match(
      /\b(?:enabled|active|actif|show|visible)\s*=\s*["']?([^"'\s/>]+)["']?/i,
    )?.[1];
    const positionalValue = parameters
      .replace(/\/$/, "")
      .trim()
      .split(/\s+/)
      .find((token) => !token.includes("="));

    return readBooleanPreference(namedValue ?? positionalValue, true);
  }

  return undefined;
}

function markdownHeadingText(value) {
  return value
    .replace(/\s+\{#[^}]+\}\s*$/, "")
    .replace(/\\([\\`*{}[\]()#+\-.!_>])/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/[*_~]/g, "")
    .trim();
}

function slugMarkdownHeading(text, occurrences = new Map()) {
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number} _-]/gu, "")
    .replace(/ /g, "-");
  const count = occurrences.get(slug);

  if (count === undefined) {
    occurrences.set(slug, 0);
    return slug;
  }

  const nextCount = count + 1;
  occurrences.set(slug, nextCount);
  return `${slug}-${nextCount}`;
}

export function extractTableOfContentsHeadings(source) {
  const headings = [];
  const occurrences = new Map();

  for (const { insideFence, line } of fencedMarkdownLines(source)) {
    if (insideFence) continue;

    const headingMatch = line.match(MARKDOWN_HEADING_PATTERN);
    if (!headingMatch) continue;

    const text = markdownHeadingText(headingMatch[2]);
    if (!text) continue;

    headings.push({
      depth: headingMatch[1].length,
      slug: slugMarkdownHeading(text, occurrences),
      text,
    });
  }

  return headings;
}

export function buildTableOfContents(items) {
  const root = [];
  const stack = [];

  for (const heading of items) {
    if (heading.depth < 2 || heading.depth > 4 || !heading.slug || !heading.text.trim()) continue;

    const item = {
      children: [],
      depth: heading.depth,
      slug: heading.slug,
      text: heading.text,
    };

    while (stack.length > 0 && stack[stack.length - 1].depth >= item.depth) stack.pop();
    const parent = stack[stack.length - 1];
    if (parent) parent.children.push(item);
    else root.push(item);
    stack.push(item);
  }

  return root;
}
