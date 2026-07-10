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

export function initHomeKonachanControlsFromDocument() {
  const config = readConfig();
  const landing = document.querySelector(".home-anime-landing");
  if (!config || !landing || landing.dataset.controlsReady === "true") return;
  landing.dataset.controlsReady = "true";

  const loader = landing.querySelector("[data-konachan-loading]");
  const refreshButton = landing.querySelector("[data-konachan-refresh]");
  const refreshStatus = landing.querySelector("[data-konachan-status]");
  const picker = landing.querySelector("[data-konachan-rating-picker]");
  const trigger = picker?.querySelector("[data-konachan-rating-trigger]");
  const triggerIcon = trigger?.querySelector("md-icon");
  const options = picker?.querySelector(".home-anime-rating-options");
  const optionButtons = [...(picker?.querySelectorAll("[data-konachan-rating-option]") ?? [])];
  let revealTimer = 0;
  let optionsOpen = false;
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

  const closeOptions = (restoreFocus = false) => {
    optionsOpen = false;
    picker?.classList.remove("is-open");
    trigger?.setAttribute("aria-expanded", "false");
    if (options) options.hidden = true;
    if (restoreFocus) trigger?.focus({ preventScroll: true });
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
    for (const button of optionButtons) {
      const rating = button.dataset.konachanRatingOption;
      const unavailable = rating === "explicit" && !detailed;
      button.hidden = rating === preference || unavailable;
      button.disabled = unavailable;
    }
  };

  const visibleOptions = () => optionButtons.filter((button) => !button.hidden && !button.disabled);

  const openOptions = (focusFirst = false) => {
    optionsOpen = true;
    picker?.classList.add("is-open");
    trigger?.setAttribute("aria-expanded", "true");
    if (options) options.hidden = false;
    if (focusFirst) requestAnimationFrame(() => visibleOptions()[0]?.focus());
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

  trigger?.addEventListener("click", () => {
    if (optionsOpen) closeOptions();
    else openOptions();
  });
  trigger?.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowRight") return;
    event.preventDefault();
    openOptions(true);
  });
  for (const button of optionButtons) {
    button.addEventListener("click", () => {
      const next = normalizeRating(button.dataset.konachanRatingOption);
      closeOptions(true);
      if (!next || next === preference || (next === "explicit" && !detailed)) return;
      preference = next;
      persistPreference();
      renderRating();
      emitRating();
    });
    button.addEventListener("keydown", (event) => {
      const items = visibleOptions();
      const current = items.indexOf(button);
      if (event.key === "Escape") {
        event.preventDefault();
        closeOptions(true);
        return;
      }
      if (!["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp", "End", "Home"].includes(event.key)) {
        return;
      }
      event.preventDefault();
      if (event.key === "Home") items[0]?.focus();
      else if (event.key === "End") items.at(-1)?.focus();
      else {
        const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
        items[(current + step + items.length) % items.length]?.focus();
      }
    });
  }
  document.addEventListener("pointerdown", (event) => {
    if (!optionsOpen || !picker || picker.contains(event.target)) return;
    closeOptions();
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
  closeOptions();
  renderRating();
}
