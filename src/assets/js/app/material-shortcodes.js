import { initMaterialMenuEnhancements } from "./material-menu.js";

const SORT_ICON = "\uE5D7";
const SORT_ASCENDING_ICON = "\uE5D8";
const SORT_DESCENDING_ICON = "\uE5DB";

const PAGINATOR_ACTIONS = Object.freeze([
  { action: "first", icon: "\uE5DC", label: "Première page" },
  { action: "previous", icon: "\uE5CB", label: "Page précédente" },
  { action: "next", icon: "\uE5CC", label: "Page suivante" },
  { action: "last", icon: "\uE5DD", label: "Dernière page" },
]);

let shortcodeInstanceId = 0;
let installed = false;

function matchingElements(root, selector) {
  const matches = root instanceof Element && root.matches(selector) ? [root] : [];
  return [...matches, ...root.querySelectorAll(selector)];
}

function createLiveStatus() {
  const status = document.createElement("p");
  status.className = "sr-only";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.setAttribute("aria-atomic", "true");
  return status;
}

function materialControlValue(event) {
  const candidates = [event.composedPath()[0], event.target, event.currentTarget];

  for (const candidate of candidates) {
    if (typeof candidate?.value === "string") return candidate.value;
  }

  return "";
}

function setControlDisabled(control, disabled) {
  control.disabled = disabled;
  control.toggleAttribute("disabled", disabled);
}

function enhanceTabs(host) {
  if (host.dataset.materialEnhanced === "true") return;

  const sourcePanels = Array.from(host.querySelectorAll(":scope > [data-material-tab]"));
  if (!sourcePanels.length) return;

  const instanceId = ++shortcodeInstanceId;
  const tabBar = document.createElement("md-tabs");
  tabBar.className = "material-shortcode-tabs";
  tabBar.setAttribute("aria-label", host.getAttribute("aria-label") || "Contenu à onglets");

  const tabs = [];
  const panels = [];

  sourcePanels.forEach((sourcePanel, index) => {
    const tabId = `material-tabs-${instanceId}-tab-${index}`;
    const panelId = `material-tabs-${instanceId}-panel-${index}`;
    const title = sourcePanel.dataset.title?.trim() || "Onglet";

    const tab = document.createElement("md-primary-tab");
    tab.id = tabId;
    tab.setAttribute("aria-controls", panelId);
    tab.textContent = title;
    tabBar.appendChild(tab);
    tabs.push(tab);

    const content = document.createElement("div");
    content.className = "material-shortcode-tab-content";
    content.append(...sourcePanel.childNodes);

    sourcePanel.className = "material-shortcode-tab-panel";
    sourcePanel.id = panelId;
    sourcePanel.setAttribute("role", "tabpanel");
    sourcePanel.setAttribute("tabindex", "0");
    sourcePanel.setAttribute("aria-labelledby", tabId);
    sourcePanel.replaceChildren(content);
    panels.push(sourcePanel);
  });

  const selectTab = (requestedIndex) => {
    const index = Math.min(Math.max(0, Number(requestedIndex) || 0), tabs.length - 1);
    tabs.forEach((tab, tabIndex) => {
      const active = tabIndex === index;
      tab.active = active;
      tab.toggleAttribute("active", active);
      panels[tabIndex].hidden = !active;
    });
  };

  tabBar.addEventListener("change", () => selectTab(tabBar.activeTabIndex));
  host.replaceChildren(tabBar, ...panels);
  host.dataset.materialEnhanced = "true";
  selectTab(0);
}

function tableRows(source, columnCount) {
  return Array.from(source.querySelectorAll("tbody tr")).map((row) =>
    Array.from({ length: columnCount }, (_, index) => {
      const cell = row.cells.item(index);
      return {
        html: cell?.innerHTML.trim() ?? "",
        text: cell?.textContent?.trim().toLocaleLowerCase("fr") ?? "",
      };
    }),
  );
}

function enhanceTable(host) {
  if (host.dataset.materialEnhanced === "true") return;

  const source = host.querySelector(":scope > table");
  if (!source) return;

  const columns = Array.from(source.querySelectorAll("thead th"), (heading, index) => ({
    key: index,
    label: heading.textContent?.trim() || `Colonne ${index + 1}`,
  }));
  if (!columns.length) return;

  const rows = tableRows(source, columns.length);
  const filterEnabled = host.dataset.filter === "true";
  const paginateEnabled = host.dataset.paginate === "true";
  const sortEnabled = host.dataset.sort !== "false";
  const configuredPageSize = Number.parseInt(host.dataset.pageSize || "10", 10);
  const pageSizeOptions = [...new Set([5, 10, 25, Math.max(1, configuredPageSize || 10)])].sort(
    (left, right) => left - right,
  );
  const instanceId = ++shortcodeInstanceId;
  const tableId = `material-table-${instanceId}`;
  const filterId = `${tableId}-filter`;
  const state = {
    filter: "",
    pageIndex: 0,
    pageSize: Math.max(1, configuredPageSize || 10),
    sortColumn: null,
    sortDirection: "asc",
  };

  const tableStatus = createLiveStatus();
  const sortStatus = createLiveStatus();
  const scroll = document.createElement("div");
  const table = document.createElement("table");
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  const body = document.createElement("tbody");
  const headerControls = [];

  scroll.className = "material-shortcode-table-scroll";
  scroll.tabIndex = 0;
  table.id = tableId;
  table.className = "material-shortcode-table";
  table.setAttribute("aria-label", source.getAttribute("aria-label") || "Tableau de données");

  columns.forEach((column) => {
    const heading = document.createElement("th");
    heading.scope = "col";

    if (sortEnabled) {
      const button = document.createElement("button");
      const label = document.createElement("span");
      const icon = document.createElement("md-icon");
      const ripple = document.createElement("md-ripple");

      button.type = "button";
      button.className = "material-shortcode-sort-button";
      button.setAttribute("aria-label", `Trier par ${column.label}`);
      label.textContent = column.label;
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = SORT_ICON;
      button.append(label, icon, ripple);
      heading.appendChild(button);
      headerControls.push({ button, column, heading, icon });
    } else {
      heading.textContent = column.label;
    }

    headRow.appendChild(heading);
  });

  head.appendChild(headRow);
  table.append(head, body);
  scroll.appendChild(table);

  let filterField = null;
  let range = null;
  let pageSizeSelect = null;
  const pageActions = new Map();
  const content = [tableStatus, sortStatus, scroll];

  if (filterEnabled) {
    filterField = document.createElement("md-outlined-text-field");
    filterField.id = filterId;
    filterField.name = filterId;
    filterField.className = "site-table-filter-field material-shortcode-table-filter";
    filterField.type = "search";
    filterField.label = "Filtrer le tableau";
    filterField.autocomplete = "off";
    filterField.value = "";
    filterField.setAttribute("aria-controls", tableId);
    content.unshift(filterField);
  }

  if (paginateEnabled) {
    const paginator = document.createElement("nav");
    const pageSizeContainer = document.createElement("div");
    const pageSizeLabel = document.createElement("span");
    const actionContainer = document.createElement("div");

    paginator.className = "material-shortcode-table-paginator";
    paginator.setAttribute("aria-label", "Pagination du tableau");
    pageSizeContainer.className = "material-shortcode-page-size";
    pageSizeLabel.textContent = "Lignes par page";
    pageSizeSelect = document.createElement("md-outlined-select");
    pageSizeSelect.id = `${tableId}-page-size`;
    pageSizeSelect.name = `${tableId}-page-size`;
    pageSizeSelect.className = "site-material-select site-table-page-size-select";
    pageSizeSelect.setAttribute("aria-label", "Lignes par page");
    pageSizeSelect.value = String(state.pageSize);
    pageSizeSelect.setAttribute("aria-controls", tableId);
    pageSizeSelect.setAttribute("menu-positioning", "popover");

    pageSizeOptions.forEach((size) => {
      const option = document.createElement("md-select-option");
      const headline = document.createElement("span");
      const label = document.createElement("span");
      const check = document.createElement("md-icon");
      option.className = "site-material-select-option";
      option.value = String(size);
      option.displayText = String(size);
      option.selected = size === state.pageSize;
      headline.slot = "headline";
      headline.className = "site-material-option-content";
      label.textContent = String(size);
      check.className = "site-material-menu-check";
      check.setAttribute("aria-hidden", "true");
      check.textContent = "\uE5CA";
      headline.append(label, check);
      option.append(headline);
      pageSizeSelect.appendChild(option);
    });

    range = document.createElement("span");
    range.className = "material-shortcode-range";
    actionContainer.className = "material-shortcode-page-actions";

    PAGINATOR_ACTIONS.forEach(({ action, icon, label }) => {
      const button = document.createElement("md-icon-button");
      const buttonIcon = document.createElement("md-icon");
      button.setAttribute("type", "button");
      button.setAttribute("aria-label", label);
      button.setAttribute("aria-controls", tableId);
      buttonIcon.setAttribute("aria-hidden", "true");
      buttonIcon.textContent = icon;
      button.appendChild(buttonIcon);
      actionContainer.appendChild(button);
      pageActions.set(action, button);
    });

    pageSizeContainer.append(pageSizeLabel, pageSizeSelect);
    paginator.append(pageSizeContainer, range, actionContainer);
    content.push(paginator);
  }

  const filteredRows = () => {
    const filter = state.filter.trim().toLocaleLowerCase("fr");
    if (!filter) return rows;
    return rows.filter((row) => row.some((cell) => cell.text.includes(filter)));
  };

  const sortedRows = (filtered) => {
    if (state.sortColumn === null || !sortEnabled) return filtered;
    const direction = state.sortDirection === "asc" ? 1 : -1;
    return [...filtered].sort(
      (left, right) =>
        left[state.sortColumn].text.localeCompare(right[state.sortColumn].text, "fr", {
          numeric: true,
          sensitivity: "base",
        }) * direction,
    );
  };

  const render = () => {
    const filtered = filteredRows();
    const sorted = sortedRows(filtered);
    const pageCount = Math.max(1, Math.ceil(filtered.length / state.pageSize));
    state.pageIndex = Math.min(state.pageIndex, pageCount - 1);
    const start = paginateEnabled ? state.pageIndex * state.pageSize : 0;
    const visible = paginateEnabled ? sorted.slice(start, start + state.pageSize) : sorted;

    body.replaceChildren();
    if (visible.length) {
      visible.forEach((row) => {
        const tableRow = document.createElement("tr");
        row.forEach((cell) => {
          const tableCell = document.createElement("td");
          const value = document.createElement("span");
          value.innerHTML = cell.html;
          tableCell.appendChild(value);
          tableRow.appendChild(tableCell);
        });
        body.appendChild(tableRow);
      });
    } else {
      const emptyRow = document.createElement("tr");
      const emptyCell = document.createElement("td");
      emptyCell.className = "material-shortcode-table-empty";
      emptyCell.colSpan = columns.length;
      emptyCell.textContent = "Aucun résultat.";
      emptyRow.appendChild(emptyCell);
      body.appendChild(emptyRow);
    }

    headerControls.forEach(({ button, column, heading, icon }) => {
      const active = state.sortColumn === column.key;
      button.classList.toggle("material-shortcode-sort-active", active);
      heading.removeAttribute("aria-sort");
      if (active) {
        heading.setAttribute(
          "aria-sort",
          state.sortDirection === "asc" ? "ascending" : "descending",
        );
      }
      icon.textContent = active
        ? state.sortDirection === "asc"
          ? SORT_ASCENDING_ICON
          : SORT_DESCENDING_ICON
        : SORT_ICON;
    });

    if (!filtered.length) {
      tableStatus.textContent = "Aucun résultat.";
    } else if (!paginateEnabled) {
      tableStatus.textContent = `${filtered.length} ligne${filtered.length > 1 ? "s" : ""}.`;
    } else {
      tableStatus.textContent = `Lignes ${start + 1} à ${Math.min(start + visible.length, filtered.length)} sur ${filtered.length}.`;
    }

    if (paginateEnabled) {
      range.textContent = filtered.length
        ? `${start + 1} - ${Math.min(start + visible.length, filtered.length)} sur ${filtered.length}`
        : "0 sur 0";
      setControlDisabled(pageActions.get("first"), state.pageIndex === 0);
      setControlDisabled(pageActions.get("previous"), state.pageIndex === 0);
      setControlDisabled(pageActions.get("next"), state.pageIndex + 1 >= pageCount);
      setControlDisabled(pageActions.get("last"), state.pageIndex + 1 >= pageCount);
    }
  };

  headerControls.forEach(({ button, column }) => {
    button.addEventListener("click", () => {
      if (state.sortColumn !== column.key) {
        state.sortColumn = column.key;
        state.sortDirection = "asc";
      } else if (state.sortDirection === "asc") {
        state.sortDirection = "desc";
      } else {
        state.sortColumn = null;
        state.sortDirection = "asc";
      }

      sortStatus.textContent =
        state.sortColumn === null
          ? "Tri désactivé."
          : `Tableau trié par ${column.label}, ordre ${state.sortDirection === "asc" ? "croissant" : "décroissant"}.`;
      render();
    });
  });

  filterField?.addEventListener("input", (event) => {
    state.filter = materialControlValue(event);
    state.pageIndex = 0;
    render();
  });

  pageSizeSelect?.addEventListener("change", (event) => {
    const pageSize = Number.parseInt(materialControlValue(event), 10);
    if (!Number.isFinite(pageSize) || pageSize <= 0) return;
    state.pageSize = pageSize;
    state.pageIndex = 0;
    render();
  });

  pageActions.get("first")?.addEventListener("click", () => {
    state.pageIndex = 0;
    render();
  });
  pageActions.get("previous")?.addEventListener("click", () => {
    state.pageIndex = Math.max(0, state.pageIndex - 1);
    render();
  });
  pageActions.get("next")?.addEventListener("click", () => {
    state.pageIndex += 1;
    render();
  });
  pageActions.get("last")?.addEventListener("click", () => {
    state.pageIndex = Math.max(0, Math.ceil(filteredRows().length / state.pageSize) - 1);
    render();
  });

  host.replaceChildren(...content);
  initMaterialMenuEnhancements(host);
  host.dataset.materialEnhanced = "true";
  render();
}

async function initMaterialShortcodes(root = document) {
  if (typeof document === "undefined" || !root?.querySelectorAll) return;
  await Promise.all(
    [
      "md-icon",
      "md-icon-button",
      "md-outlined-select",
      "md-outlined-text-field",
      "md-primary-tab",
      "md-ripple",
      "md-select-option",
      "md-tabs",
    ].map((tagName) => customElements.whenDefined(tagName)),
  );
  matchingElements(root, "[data-material-tabs]").forEach(enhanceTabs);
  matchingElements(root, "[data-material-table]").forEach(enhanceTable);
}

function installMaterialShortcodes() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const enhance = () => void initMaterialShortcodes();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enhance, { once: true });
  } else {
    enhance();
  }
  window.addEventListener("astro:page-load", enhance);
}

installMaterialShortcodes();
