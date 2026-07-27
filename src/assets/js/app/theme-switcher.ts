import themeMenuStyles from "@/assets/css/components/theme-menu.scss?inline";
import { bindMaterialMenuSelection } from "@/assets/js/app/material-menu";
import {
  readMaterialDynamicColorEnabled,
  readMaterialDynamicColorPalette,
  setMaterialDynamicColorEnabled,
  syncMaterialDynamicColor,
} from "@/assets/js/app/material-dynamic-color";
import { SITE_EVENTS, SITE_LEGACY_STORAGE_KEYS, SITE_STORAGE_KEYS } from "@/lib/site-contracts";

type ThemePreference = "system" | "light" | "dark";
type MaterialMenu = HTMLElement & {
  open: boolean;
  defaultFocus: "first-item" | "last-item";
  close(): void;
  show(): void;
  activateNextItem(): HTMLElement;
  activatePreviousItem(): HTMLElement;
};
type MaterialSwitch = HTMLElement & { disabled: boolean; selected: boolean };
const labels: Record<ThemePreference, string> = {
  system: "Système",
  light: "Clair",
  dark: "Sombre",
};
const icons: Record<ThemePreference, string> = {
  system: "\uE1AB",
  light: "\uE3AA",
  dark: "\uE3A6",
};

function ensureThemeMenuStyles() {
  if (document.querySelector("style[data-theme-menu-styles]")) return;

  const style = document.createElement("style");
  style.dataset.themeMenuStyles = "";
  style.textContent = themeMenuStyles;
  document.head.append(style);
}

const isPreference = (value: string | null): value is ThemePreference =>
  value === "system" || value === "light" || value === "dark";

async function enhanceThemeSwitcher(root: HTMLElement) {
  if (root.dataset.enhanced === "true" || root.dataset.enhancing === "true") return;
  ensureThemeMenuStyles();
  root.dataset.enhancing = "true";

  await Promise.all([
    customElements.whenDefined("md-icon-button"),
    customElements.whenDefined("md-menu"),
    customElements.whenDefined("md-menu-item"),
    customElements.whenDefined("md-switch"),
  ]);

  if (!root.isConnected) return;
  delete root.dataset.enhancing;
  root.dataset.enhanced = "true";

  const trigger = root.querySelector<HTMLElement>(".site-theme-trigger");
  const triggerIcon = root.querySelector<HTMLElement>("[data-theme-trigger-icon]");
  const menu = root.querySelector<MaterialMenu>(".site-theme-menu");
  const dynamicColorControls = root.querySelectorAll<HTMLElement>("[data-dynamic-color-control]");
  const dynamicColorRow = root.querySelector<HTMLElement>("[data-dynamic-color-option]");
  const dynamicColorSupport = root.querySelector<HTMLElement>("[data-dynamic-color-support]");
  const dynamicColorSwitch = root.querySelector<MaterialSwitch>(".site-theme-dynamic-color-switch");
  const status = root.querySelector<HTMLElement>("[data-theme-status]");
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  if (!trigger || !triggerIcon || !menu) return;

  let preference: ThemePreference = "system";

  const renderDynamicColor = () => {
    if (!dynamicColorRow || !dynamicColorSwitch || !dynamicColorSupport) return;

    const detailed = document.documentElement.dataset.homeDetailView === "true";
    const palette = readMaterialDynamicColorPalette();
    const enabled = readMaterialDynamicColorEnabled();
    const available = Boolean(palette);

    dynamicColorControls.forEach((control) => {
      control.hidden = !detailed;
    });
    dynamicColorSwitch.disabled = !available;
    const selected = Boolean(enabled && detailed && available);
    dynamicColorSwitch.toggleAttribute("selected", selected);
    dynamicColorSwitch.selected = selected;
    dynamicColorSupport.hidden = available;
    dynamicColorSupport.textContent = available ? "" : "Chargez d’abord une image sur l’accueil";

    dynamicColorSwitch.setAttribute("aria-label", "Couleur dynamique");
  };

  const render = () => {
    const label = labels[preference];
    trigger.dataset.tooltip = `Thème : ${label}`;
    trigger.setAttribute("aria-label", `Thème : ${label}`);
    triggerIcon.textContent = icons[preference];

    root.querySelectorAll<HTMLElement>("[data-theme-option]").forEach((item) => {
      const selected = item.dataset.themeOption === preference;
      item.toggleAttribute("data-theme-selected", selected);
      const optionLabel = labels[item.dataset.themeOption as ThemePreference];
      item.setAttribute("aria-label", `${optionLabel}${selected ? ", thème sélectionné" : ""}`);
      const radio = item.querySelector<HTMLElement>(".site-theme-radio-icon");
      if (radio) radio.textContent = selected ? "\uE837" : "\uE836";
      const selectedLabel = item.querySelector<HTMLElement>("[data-theme-selected-label]");
      if (selectedLabel) selectedLabel.hidden = !selected;
    });
    renderDynamicColor();
  };

  const apply = (persist: boolean) => {
    const resolved =
      preference === "system" ? (systemTheme.matches ? "dark" : "light") : preference;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themePreference = preference;
    document.documentElement.style.colorScheme = resolved;
    if (persist) {
      try {
        localStorage.setItem(SITE_STORAGE_KEYS.themePreference, preference);
      } catch {}
    }
    syncMaterialDynamicColor();
    render();
  };

  const sync = () => {
    let stored: string | null = null;
    try {
      const current = localStorage.getItem(SITE_STORAGE_KEYS.themePreference);
      const legacy = localStorage.getItem(SITE_LEGACY_STORAGE_KEYS.themePreference);
      stored = isPreference(current) ? current : legacy;
      if (!isPreference(current) && isPreference(legacy)) {
        localStorage.setItem(SITE_STORAGE_KEYS.themePreference, legacy);
      }
      if (legacy !== null) localStorage.removeItem(SITE_LEGACY_STORAGE_KEYS.themePreference);
    } catch {}
    preference = isPreference(stored) ? stored : "system";
    apply(false);
  };

  let menuReady = false;
  let menuClosing = false;
  let pendingOpen: MaterialMenu["defaultFocus"] | null = null;
  let queuedNavigation = 0;

  const moveActiveItem = (direction: 1 | -1) => {
    if (direction === 1) menu.activateNextItem();
    else menu.activatePreviousItem();
  };

  const flushQueuedNavigation = () => {
    while (queuedNavigation > 0) {
      moveActiveItem(1);
      queuedNavigation -= 1;
    }
    while (queuedNavigation < 0) {
      moveActiveItem(-1);
      queuedNavigation += 1;
    }
  };

  const openMenu = (defaultFocus: MaterialMenu["defaultFocus"]) => {
    if (menuClosing) {
      pendingOpen = defaultFocus;
      return;
    }
    pendingOpen = null;
    menuReady = false;
    queuedNavigation = 0;
    menu.defaultFocus = defaultFocus;
    menu.show();
  };

  trigger.addEventListener("click", () => {
    if (menu.open) {
      pendingOpen = null;
      menu.close();
    } else {
      openMenu("first-item");
    }
  });
  trigger.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const target = event.key === "ArrowUp" ? "last-item" : "first-item";
    if (menu.open) {
      const direction = target === "first-item" ? 1 : -1;
      if (menuReady) moveActiveItem(direction);
      else queuedNavigation += direction;
    } else {
      openMenu(target);
    }
  });
  menu.addEventListener("opening", () => {
    menuClosing = false;
    menuReady = false;
    trigger.setAttribute("aria-expanded", "true");
  });
  menu.addEventListener("opened", () => {
    menuReady = true;
    trigger.setAttribute("aria-expanded", "true");
    flushQueuedNavigation();
  });
  menu.addEventListener("closing", () => {
    menuClosing = true;
    menuReady = false;
    queuedNavigation = 0;
    trigger.setAttribute("aria-expanded", "false");
  });
  menu.addEventListener("closed", () => {
    const reopenDefaultFocus = pendingOpen;
    pendingOpen = null;
    menuClosing = false;
    menuReady = false;
    queuedNavigation = 0;
    trigger.setAttribute("aria-expanded", "false");
    menu.defaultFocus = "first-item";
    if (!reopenDefaultFocus) return;
    window.requestAnimationFrame(() => {
      if (!menu.isConnected || menu.open || menuClosing) return;
      openMenu(reopenDefaultFocus);
    });
  });
  bindMaterialMenuSelection(menu, (item) => {
    const next = item.dataset.themeOption ?? null;
    if (!isPreference(next)) return;
    preference = next;
    apply(true);
    if (status) status.textContent = `Thème ${labels[preference]} activé`;
  });
  dynamicColorSwitch?.addEventListener("click", (event) => {
    if (dynamicColorSwitch.disabled) return;
    event.preventDefault();
    const state = setMaterialDynamicColorEnabled(!readMaterialDynamicColorEnabled());
    renderDynamicColor();
    if (status) {
      status.textContent = state.active
        ? "Couleur dynamique activée"
        : "Couleur dynamique désactivée";
    }
  });
  systemTheme.addEventListener("change", () => {
    if (preference === "system") apply(false);
  });
  document.addEventListener(SITE_EVENTS.homeDetailViewChange, () => {
    syncMaterialDynamicColor();
    renderDynamicColor();
  });
  document.addEventListener(SITE_EVENTS.materialDynamicColorChange, renderDynamicColor);
  window.addEventListener("pageshow", sync);
  sync();
}

const init = () =>
  document
    .querySelectorAll<HTMLElement>("[data-theme-switcher]")
    .forEach((root) => void enhanceThemeSwitcher(root));

init();
document.addEventListener("astro:page-load", init);
