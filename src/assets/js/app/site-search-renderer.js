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

export function renderSearchResults(container, results) {
  container.replaceChildren();

  for (const result of results) {
    const item = document.createElement("li");
    item.className = "site-search-panel-result";

    const body = document.createElement("div");
    body.className = "site-search-panel-result-body";

    const title = document.createElement("a");
    title.className = "site-search-panel-result-title";
    title.href = result.url;
    title.innerHTML = result.titleHtml;
    body.append(title);

    if (result.createdLabel || result.modifiedLabel) body.append(renderResultMeta(result));

    if (result.excerpt) {
      const excerpt = document.createElement("p");
      excerpt.className = "site-search-panel-result-excerpt";
      excerpt.innerHTML = result.excerpt;
      body.append(excerpt);
    }

    item.append(body);
    container.append(item);
  }
}
