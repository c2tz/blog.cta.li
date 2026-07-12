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
    customElements.whenDefined("md-fab"),
    customElements.whenDefined("md-filled-tonal-icon-button"),
    customElements.whenDefined("md-icon-button"),
  ]);

  if (!landing.isConnected) return;
  landing.dataset.controlsReady = "true";

  const loader = landing.querySelector("[data-konachan-loading]");
  const refreshButton = landing.querySelector("[data-konachan-refresh]");
  const refreshStatus = landing.querySelector("[data-konachan-status]");
  const picker = landing.querySelector("[data-konachan-rating-picker]");
  const trigger = picker?.querySelector("[data-konachan-rating-trigger]");
  const triggerIcon = trigger?.querySelector("md-icon");
  const actions = picker?.querySelector("[data-konachan-rating-actions]");
  const optionItems = [...(picker?.querySelectorAll("[data-konachan-rating-option]") ?? [])];
  let revealTimer = 0;
  let menuOpen = false;
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
      const triggerLabel = menuOpen
        ? "Fermer les niveaux Konachan"
        : `Niveau Konachan : ${current.label}`;
      trigger.title = triggerLabel;
      trigger.setAttribute("aria-label", triggerLabel);
      trigger.setAttribute("aria-expanded", String(menuOpen));
      trigger.classList.toggle("is-open", menuOpen);
      trigger.classList.toggle("is-safe", preference === "safe");
      trigger.classList.toggle("is-questionable", preference === "questionable");
      trigger.classList.toggle("is-explicit", preference === "explicit");
    }
    if (triggerIcon) triggerIcon.textContent = menuOpen ? "\uE5CD" : current.icon;
    for (const item of optionItems) {
      const rating = item.dataset.konachanRatingOption;
      const unavailable = rating === "explicit" && !detailed;
      const selected = rating === preference;
      item.hidden = unavailable || selected;
      item.setAttribute(
        "aria-label",
        `Choisir le niveau Konachan ${RATING_OPTIONS[rating]?.label ?? "inconnu"}`,
      );
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

  const visibleOptions = () => optionItems.filter((item) => !item.hidden);

  const focusOption = (edge) => {
    const available = visibleOptions();
    const item = edge === "last" ? available.at(-1) : available[0];
    item?.focus();
  };

  const moveOptionFocus = (item, direction) => {
    const available = visibleOptions();
    const currentIndex = available.indexOf(item);
    if (currentIndex < 0 || available.length === 0) return;
    available[(currentIndex + direction + available.length) % available.length]?.focus();
  };

  const openOptions = (focusEdge = null) => {
    if (!actions || menuOpen) return;
    menuOpen = true;
    renderRating();
    actions.hidden = false;
    actions.setAttribute("data-open", "");
    if (focusEdge) {
      window.requestAnimationFrame(() => {
        if (menuOpen) focusOption(focusEdge);
      });
    }
  };

  const closeOptions = ({ restoreFocus = false } = {}) => {
    if (!actions || !menuOpen) return;
    menuOpen = false;
    actions.hidden = true;
    actions.removeAttribute("data-open");
    renderRating();
    if (restoreFocus) trigger?.focus();
  };

  trigger?.addEventListener("click", () => {
    if (menuOpen) closeOptions();
    else openOptions();
  });
  trigger?.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuOpen) {
      event.preventDefault();
      closeOptions({ restoreFocus: true });
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    if (menuOpen) focusOption(event.key === "ArrowDown" ? "first" : "last");
    else openOptions(event.key === "ArrowDown" ? "first" : "last");
  });

  for (const item of optionItems) {
    item.addEventListener("click", () => {
      const next = normalizeRating(item.dataset.konachanRatingOption);
      if (!next || next === preference || (next === "explicit" && !detailed)) return;
      preference = next;
      persistPreference();
      emitRating();
      closeOptions({ restoreFocus: true });
    });
    item.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeOptions({ restoreFocus: true });
      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        moveOptionFocus(item, event.key === "ArrowDown" ? 1 : -1);
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        focusOption(event.key === "Home" ? "first" : "last");
      }
    });
  }
  picker?.addEventListener("focusout", (event) => {
    if (menuOpen && !picker.contains(event.relatedTarget)) closeOptions();
  });
  document.addEventListener("pointerdown", (event) => {
    if (menuOpen && !picker?.contains(event.target)) closeOptions();
  });
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
