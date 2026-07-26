export function normalizeSelectedTags(value, limit) {
  const tags = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return [...new Set(tags.filter((tag) => typeof tag === "string"))].slice(0, limit);
}

export function dateValue(value) {
  const date = Date.parse(value ?? "");
  return Number.isNaN(date) ? Number.POSITIVE_INFINITY : date;
}

export function formatDate(value, formatter) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? undefined : formatter.format(date);
}

export function parseTags(value) {
  return (value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function parsePriority(value, maximum) {
  const priority = Number.parseInt(value ?? "0", 10);
  return Number.isNaN(priority) ? 0 : Math.min(maximum, Math.max(0, priority));
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => {
    if (character === "&") return "&amp;";
    if (character === "<") return "&lt;";
    if (character === ">") return "&gt;";
    if (character === '"') return "&quot;";
    return "&#39;";
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function highlightTitle(title, query) {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return escapeHtml(title);
  const escapedTitle = escapeHtml(title);
  const escapedQuery = escapeHtml(trimmedQuery);
  const pattern = new RegExp(escapeRegExp(escapedQuery), "gi");
  return escapedTitle.replace(pattern, (match) => `<mark>${match}</mark>`);
}

function findTitlePrefixEnd(text, title) {
  const normalizedTitle = title.trim().replace(/\s+/g, " ");
  let textIndex = 0;
  let titleIndex = 0;
  while (textIndex < text.length && /\s/.test(text[textIndex] ?? "")) textIndex++;

  while (textIndex < text.length && titleIndex < normalizedTitle.length) {
    const titleCharacter = normalizedTitle[titleIndex] ?? "";
    const textCharacter = text[textIndex] ?? "";
    if (/\s/.test(titleCharacter)) {
      if (!/\s/.test(textCharacter)) return -1;
      while (textIndex < text.length && /\s/.test(text[textIndex] ?? "")) textIndex++;
      while (titleIndex < normalizedTitle.length && /\s/.test(normalizedTitle[titleIndex] ?? "")) {
        titleIndex++;
      }
      continue;
    }
    if (textCharacter.toLocaleLowerCase() !== titleCharacter.toLocaleLowerCase()) return -1;
    textIndex++;
    titleIndex++;
  }

  return titleIndex === normalizedTitle.length ? textIndex : -1;
}

function removeLeadingText(root, count) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  let remaining = count;

  for (const node of nodes) {
    const value = node.nodeValue ?? "";
    if (remaining >= value.length) {
      node.nodeValue = "";
      remaining -= value.length;
      continue;
    }
    node.nodeValue = value.slice(remaining);
    break;
  }
}

function trimLeadingText(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const trimmed = (node.nodeValue ?? "").replace(/^\s*\.(?=\s|$)\s*/, "").replace(/^\s+/, "");
    if (!trimmed) {
      node.nodeValue = "";
      continue;
    }
    node.nodeValue = trimmed;
    break;
  }
  root.querySelectorAll("*").forEach((element) => {
    if (!element.textContent?.trim() && element.children.length === 0) element.remove();
  });
}

export function removeLeadingTitle(excerpt, title) {
  if (!excerpt) return excerpt;
  const template = document.createElement("template");
  template.innerHTML = excerpt;
  const text = template.content.textContent ?? "";
  const prefixEnd = findTitlePrefixEnd(text, title);
  if (prefixEnd < 0) return excerpt;
  removeLeadingText(template.content, prefixEnd);
  trimLeadingText(template.content);
  return template.innerHTML.trim();
}
