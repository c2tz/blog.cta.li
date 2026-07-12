import { bindMaterialMenuSelection } from "./material-menu.js";

const RATING_OPTIONS = {
  safe: { icon: "\uEF80", label: "Safe" },
  questionable: { icon: "\uF8EA", label: "Questionnable" },
  explicit: { icon: "\uF8FD", label: "Explicit" },
};

function readConfig() {
  const element = document.getElementById("home-konachan-config");
  if (!element?.textContent) return null;
  try {
    return JSON.parse(element.textContent).konachanClientConfig ?? null;
  } catch {
    return null;
  }
}

function readCookie(name) {
  const prefix = `${encodeURIComponent(name)}=`;
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  if (!cookie) return null;
  try {
    return decodeURIComponent(cookie.slice(prefix.length));
  } catch {
    return null;
  }
}

function normalizeRating(value) {
  if (value === "safe" || value === "questionable" || value === "explicit") return value;
  return value === "sensitive" ? "questionable" : null;
}

export async function initHomeKonachanControlsFromDocument() {
  const config = readConfig();
  const landing = document.querySelector(".home-anime-landing");
  if (!config || !landing || landing.dataset.controlsReady) return;
  landing.dataset.controlsReady = "pending";

  await Promise.all([
    customElements.whenDefined("md-circular-progress"),
    customElements.whenDefined("md-filled-tonal-icon-button"),
    customElements.whenDefined("md-icon-button"),
    customElements.whenDefined("md-menu"),
    customElements.whenDefined("md-menu-item"),
  ]);

  if (!landing.isConnected) return;
  landing.dataset.controlsReady = "true";

  const loader = landing.querySelector("[data-konachan-loading]");
  const refreshButton = landing.querySelector("[data-konachan-refresh]");
  const refreshStatus = landing.querySelector("[data-konachan-status]");
  const picker = landing.querySelector("[data-konachan-rating-picker]");
  const trigger = picker?.querySelector("[data-konachan-rating-trigger]");
  const triggerIcon = trigger?.querySelector("md-icon");
  const menu = picker?.querySelector("md-menu");
  const optionItems = [...(picker?.querySelectorAll("[data-konachan-rating-option]") ?? [])];
  let revealTimer = 0;
  let menuReady = false;
  let menuClosing = false;
  let pendingOpen = null;
  let queuedNavigation = 0;
  let detailed =
    document.documentElement.dataset.homeDetailView === "true" ||
    document.body.dataset.homeDetailView === "true";

  const readPreference = () => {
    let value = null;
    try {
      value =
        localStorage.getItem(config.ratingStorageKey) ??
        localStorage.getItem(config.legacyRatingStorageKey);
    } catch {}
    value ??= readCookie(config.ratingCookieName) ?? readCookie(config.legacyRatingCookieName);
    const normalized = normalizeRating(value);
    return normalized === "explicit" ? "safe" : (normalized ?? "safe");
  };
  let preference = readPreference();

  const persistPreference = () => {
    const stored = preference === "explicit" ? "safe" : preference;
    try {
      localStorage.setItem(config.ratingStorageKey, stored);
      localStorage.removeItem(config.legacyRatingStorageKey);
    } catch {}
    document.cookie = `${encodeURIComponent(config.ratingCookieName)}=${stored}; Max-Age=31536000; Path=/; SameSite=Lax`;
    document.cookie = `${encodeURIComponent(config.legacyRatingCookieName)}=; Max-Age=0; Path=/; SameSite=Lax`;
  };

  const renderRating = () => {
    const current = RATING_OPTIONS[preference];
    if (trigger) {
      trigger.title = current.label;
      trigger.setAttribute("aria-label", current.label);
      trigger.classList.toggle("is-safe", preference === "safe");
      trigger.classList.toggle("is-questionable", preference === "questionable");
      trigger.classList.toggle("is-explicit", preference === "explicit");
    }
    if (triggerIcon) triggerIcon.textContent = current.icon;
    for (const item of optionItems) {
      const rating = item.dataset.konachanRatingOption;
      const unavailable = rating === "explicit" && !detailed;
      const selected = rating === preference;
      item.hidden = unavailable;
      item.disabled = unavailable;
      item.toggleAttribute("data-rating-selected", selected);
      item.setAttribute(
        "aria-label",
        `${RATING_OPTIONS[rating]?.label ?? "Niveau Konachan"}${
          selected ? ", niveau sélectionné" : ""
        }`,
      );
      const selectedIcon = item.querySelector("[data-konachan-rating-selected-icon]");
      if (selectedIcon) selectedIcon.hidden = !selected;
    }
  };

  const emitRating = () => {
    document.dispatchEvent(
      new CustomEvent(config.events.ratingChange, {
        detail: {
          ratingPreference: preference,
          allowSensitive: preference !== "safe",
          allowExplicit: preference === "explicit",
        },
      }),
    );
  };

  const moveActiveItem = (direction) => {
    if (!menu) return;
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

  const openOptions = (defaultFocus = "first-item") => {
    if (!menu) return;
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

  const closeOptions = () => {
    pendingOpen = null;
    if (menu?.open) menu.close();
  };

  menu?.addEventListener("opening", () => {
    menuClosing = false;
    menuReady = false;
    trigger?.setAttribute("aria-expanded", "true");
  });
  menu?.addEventListener("opened", () => {
    menuReady = true;
    trigger?.setAttribute("aria-expanded", "true");
    flushQueuedNavigation();
  });
  menu?.addEventListener("closing", () => {
    menuClosing = true;
    menuReady = false;
    queuedNavigation = 0;
    trigger?.setAttribute("aria-expanded", "false");
  });
  menu?.addEventListener("closed", () => {
    const reopenDefaultFocus = pendingOpen;
    pendingOpen = null;
    menuClosing = false;
    menuReady = false;
    queuedNavigation = 0;
    trigger?.setAttribute("aria-expanded", "false");
    menu.defaultFocus = "first-item";
    if (!reopenDefaultFocus) return;
    window.requestAnimationFrame(() => {
      if (!menu.isConnected || menu.open || menuClosing) return;
      openOptions(reopenDefaultFocus);
    });
  });
  trigger?.addEventListener("click", () => {
    if (!menu) return;
    if (menu.open) closeOptions();
    else openOptions();
  });
  trigger?.addEventListener("keydown", (event) => {
    if (!menu || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return;
    event.preventDefault();
    const direction = event.key === "ArrowDown" ? 1 : -1;
    if (menuClosing) {
      pendingOpen = direction === 1 ? "first-item" : "last-item";
    } else if (menu.open) {
      if (menuReady) moveActiveItem(direction);
      else queuedNavigation += direction;
    } else {
      openOptions(direction === 1 ? "first-item" : "last-item");
    }
  });
  if (menu) {
    bindMaterialMenuSelection(menu, (item) => {
      const next = normalizeRating(item.dataset.konachanRatingOption);
      if (!next || next === preference || (next === "explicit" && !detailed)) return;
      preference = next;
      persistPreference();
      renderRating();
      emitRating();
    });
  }
  document.addEventListener(config.events.refreshState, (event) => {
    const busy = Boolean(event.detail?.busy);
    if (revealTimer) window.clearTimeout(revealTimer);
    revealTimer = 0;
    if (refreshButton) {
      refreshButton.disabled = busy;
      refreshButton.setAttribute("aria-busy", String(busy));
      const label = busy ? "Actualisation de l'image en cours" : "Actualiser l'image";
      refreshButton.title = label;
      refreshButton.setAttribute("aria-label", label);
    }
    if (refreshStatus && typeof event.detail?.status === "string") {
      refreshStatus.textContent = event.detail.status;
    }
    if (!busy) {
      if (loader) loader.hidden = true;
      return;
    }
    revealTimer = window.setTimeout(() => {
      revealTimer = 0;
      if (landing.getAttribute("aria-busy") === "true" && loader) loader.hidden = false;
    }, 200);
  });
  document.addEventListener("home:detail-view-change", (event) => {
    detailed = Boolean(event.detail?.detailed);
    if (!detailed && preference === "explicit") {
      preference = "safe";
      persistPreference();
      emitRating();
    }
    closeOptions();
    renderRating();
  });
  refreshButton?.addEventListener("click", () => {
    if (refreshButton.disabled) return;
    document.dispatchEvent(new CustomEvent(config.events.tooltipHide));
    document.dispatchEvent(new CustomEvent(config.events.refreshRequest));
  });

  persistPreference();
  trigger?.setAttribute("aria-expanded", "false");
  renderRating();
}
