function renderDateMeta(iconValue, tooltip, dateTime, label) {
  const wrapper = document.createElement("span");
  const icon = document.createElement("md-icon");
  icon.textContent = iconValue;
  icon.dataset.tooltip = tooltip;
  icon.setAttribute("aria-label", tooltip);
  const time = document.createElement("time");
  if (dateTime) time.dateTime = dateTime;
  time.textContent = label;
  wrapper.append(icon, time);
  return wrapper;
}

function renderResultMeta(result) {
  const meta = document.createElement("div");
  meta.className = "site-search-panel-result-meta";

  if (result.createdLabel) {
    meta.append(
      renderDateMeta("\uE89C", "Création du post", result.createdAt, result.createdLabel),
    );
  }

  if (result.createdLabel && result.modifiedLabel) {
    const separator = document.createElement("span");
    separator.className = "site-search-panel-result-meta-separator";
    separator.setAttribute("aria-hidden", "true");
    separator.textContent = "·";
    meta.append(separator);
  }

  if (result.modifiedLabel) {
    meta.append(
      renderDateMeta(
        "\uF88C",
        "Dernière modification du post",
        result.modifiedAt,
        result.modifiedLabel,
      ),
    );
  }

  return meta;
}

function appendSafeSearchMarkup(container, markup) {
  const template = document.createElement("template");
  template.innerHTML = String(markup ?? "");

  const appendNodes = (source, target) => {
    source.childNodes.forEach((node) => {
      if (node.nodeType === 3) {
        target.append(document.createTextNode(node.nodeValue ?? ""));
        return;
      }
      if (!(node instanceof HTMLElement)) return;
      if (["SCRIPT", "STYLE", "TEMPLATE"].includes(node.tagName)) return;

      if (node.tagName === "MARK") {
        const mark = document.createElement("mark");
        appendNodes(node, mark);
        target.append(mark);
        return;
      }

      appendNodes(node, target);
    });
  };

  appendNodes(template.content, container);
}

function safeSearchResultUrl(value) {
  try {
    const url = new URL(String(value ?? ""), document.baseURI);
    if (!["http:", "https:"].includes(url.protocol) || url.origin !== location.origin) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

function captureSearchFocus(container, attribute, onFocusRemoved) {
  const value = container.contains(document.activeElement)
    ? document.activeElement.getAttribute(attribute)
    : null;
  return () => {
    if (value === null) return;
    const replacement = [...container.querySelectorAll(`[${attribute}]`)].find(
      (element) => element.getAttribute(attribute) === value && !element.disabled,
    );
    const displacedFocus = document.activeElement;
    // Material controls need their shadow button to finish rendering before
    // focus can be restored. Keep a newer user focus choice if it changes.
    void Promise.resolve(replacement?.updateComplete).then(() => {
      if (document.activeElement !== displacedFocus) return;
      if (replacement) replacement.focus({ preventScroll: true });
      else onFocusRemoved();
    });
  };
}

export function renderSearchFilters(
  container,
  tags,
  { selectedTags, maxSelectedTags, onToggle, onFocusRemoved },
) {
  const restoreFocus = captureSearchFocus(container, "data-search-tag", onFocusRemoved);
  container.replaceChildren();
  container.hidden = tags.length === 0;
  const selectedTagLimitReached = selectedTags.length >= maxSelectedTags;
  for (const tag of tags) {
    const chip = document.createElement("md-filter-chip");
    const selected = selectedTags.includes(tag.value);
    chip.dataset.searchTag = tag.value;
    chip.textContent = `#${tag.value}`;
    chip.selected = selected;
    chip.disabled = selectedTagLimitReached && !selected;
    chip.setAttribute(
      "aria-label",
      selected ? `Retirer le tag ${tag.value}` : `Ajouter le tag ${tag.value}`,
    );
    chip.addEventListener("click", (event) => onToggle(tag.value, event));
    container.append(chip);
  }
  restoreFocus();
}

export function renderSearchResults(container, results, onFocusRemoved) {
  const restoreFocus = captureSearchFocus(container, "href", onFocusRemoved);
  container.replaceChildren();

  for (const result of results) {
    const resultUrl = safeSearchResultUrl(result.url);
    if (!resultUrl) continue;

    const item = document.createElement("li");
    item.className = "site-search-panel-result";

    const body = document.createElement("div");
    body.className = "site-search-panel-result-body";

    const title = document.createElement("a");
    title.className = "site-search-panel-result-title";
    title.href = resultUrl;
    appendSafeSearchMarkup(title, result.titleHtml);
    body.append(title);

    if (result.createdLabel || result.modifiedLabel) body.append(renderResultMeta(result));

    if (result.excerpt) {
      const excerpt = document.createElement("p");
      excerpt.className = "site-search-panel-result-excerpt";
      appendSafeSearchMarkup(excerpt, result.excerpt);
      body.append(excerpt);
    }

    item.append(body);
    container.append(item);
  }
  restoreFocus();
}
