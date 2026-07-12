import {
  SITE_COOKIE_NAMES,
  SITE_EVENTS,
  SITE_LEGACY_COOKIE_NAMES,
  SITE_LEGACY_STORAGE_KEYS,
  SITE_STORAGE_KEYS,
} from "@/lib/site-contracts";

const CONSENT_MAX_AGE_SECONDS = 31_536_000;
const BACKGROUND_INTERACTION_SELECTORS = [".site-header", ".site-main", ".site-footer"];
const DIALOG_FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "md-elevated-button:not([disabled])",
  "md-filled-button:not([disabled])",
  "md-filled-tonal-button:not([disabled])",
  "md-outlined-button:not([disabled])",
  "md-text-button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");
const MATERIAL_BUTTON_TAG_NAMES = new Set([
  "md-elevated-button",
  "md-filled-button",
  "md-filled-tonal-button",
  "md-outlined-button",
  "md-text-button",
]);
const STATUS_LABELS = {
  accepted: "Autorisés",
  rejected: "Refusés",
  unset: "Aucun choix enregistré",
};

function readCookie(name) {
  const encodedName = `${encodeURIComponent(name)}=`;
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(encodedName));

  if (!cookie) return null;

  try {
    return decodeURIComponent(cookie.slice(encodedName.length));
  } catch {
    return null;
  }
}

function writeCookie(name, value) {
  document.cookie = [
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    `Max-Age=${CONSENT_MAX_AGE_SECONDS}`,
    "Path=/",
    "SameSite=Lax",
  ].join("; ");
}

function expireCookie(name) {
  document.cookie = `${encodeURIComponent(name)}=; Max-Age=0; Path=/; SameSite=Lax`;
}

function readConsent() {
  try {
    const current = localStorage.getItem(SITE_STORAGE_KEYS.cookieConsent);
    const legacy = localStorage.getItem(SITE_LEGACY_STORAGE_KEYS.cookieConsent);
    const raw = current ?? legacy;
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1) return null;

    if (current === null && legacy !== null) {
      localStorage.setItem(SITE_STORAGE_KEYS.cookieConsent, legacy);
      localStorage.removeItem(SITE_LEGACY_STORAGE_KEYS.cookieConsent);
    }

    return parsed;
  } catch {
    return null;
  }
}

function readStoredChoice() {
  const consent = readConsent();
  if (consent) return consent.functionality ? "accepted" : "rejected";

  const cookie =
    readCookie(SITE_COOKIE_NAMES.cookieConsent) ??
    readCookie(SITE_LEGACY_COOKIE_NAMES.cookieConsent);
  return cookie === "accepted" || cookie === "rejected" ? cookie : "unset";
}

function writeConsent(choice) {
  const functionality = choice === "accepted";
  const state = {
    functionality,
    updatedAt: new Date().toISOString(),
    version: 1,
  };

  try {
    localStorage.setItem(SITE_STORAGE_KEYS.cookieConsent, JSON.stringify(state));
    localStorage.removeItem(SITE_LEGACY_STORAGE_KEYS.cookieConsent);
  } catch {}

  writeCookie(SITE_COOKIE_NAMES.cookieConsent, choice);
  expireCookie(SITE_LEGACY_COOKIE_NAMES.cookieConsent);
}

function resetConsent() {
  try {
    localStorage.removeItem(SITE_STORAGE_KEYS.cookieConsent);
    localStorage.removeItem(SITE_LEGACY_STORAGE_KEYS.cookieConsent);
  } catch {}

  expireCookie(SITE_COOKIE_NAMES.cookieConsent);
  expireCookie(SITE_LEGACY_COOKIE_NAMES.cookieConsent);
}

function readExplicitContentAcknowledgement() {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(SITE_STORAGE_KEYS.explicitContentAcknowledgement) || "null",
    );
    if (parsed?.version === 1 && parsed.acknowledged === true) return parsed;
  } catch {}

  if (readCookie(SITE_COOKIE_NAMES.explicitContentAcknowledgement) === "acknowledged") {
    return {
      acknowledged: true,
      updatedAt: new Date().toISOString(),
      version: 1,
    };
  }

  return null;
}

function writeExplicitContentAcknowledgement() {
  const state = {
    acknowledged: true,
    updatedAt: new Date().toISOString(),
    version: 1,
  };

  try {
    localStorage.setItem(SITE_STORAGE_KEYS.explicitContentAcknowledgement, JSON.stringify(state));
  } catch {}

  writeCookie(SITE_COOKIE_NAMES.explicitContentAcknowledgement, "acknowledged");
}

function exposeConsentApi() {
  window.cookieConsent = {
    acceptedService: (service, category) =>
      category === "functionality" &&
      ["giscus", "ipgeo", "speed-insights"].includes(service) &&
      Boolean(readConsent()?.functionality),
    isCategoryAccepted: (category) =>
      category === "necessary" ||
      (category === "functionality" && Boolean(readConsent()?.functionality)),
  };
}

function setBackgroundInteractionDisabled(disabled) {
  for (const selector of BACKGROUND_INTERACTION_SELECTORS) {
    document.querySelector(selector)?.toggleAttribute("inert", disabled);
  }
}

function isFocusableElement(element) {
  const style = getComputedStyle(element);

  return (
    (element.tabIndex >= 0 || MATERIAL_BUTTON_TAG_NAMES.has(element.localName)) &&
    !element.hasAttribute("disabled") &&
    element.getAttribute("aria-hidden") !== "true" &&
    style.display !== "none" &&
    style.visibility !== "hidden"
  );
}

class SiteCookieConsentBanner extends HTMLElement {
  #activeNotice = null;
  #cookieConsentPending = false;
  #explicitContentPending = false;
  #focusFrame = 0;

  #handleConsentChange = () => {
    const pending = readConsent() === null;
    if (pending === this.#cookieConsentPending) return;

    this.#cookieConsentPending = pending;
    this.#showNextNotice();
  };

  #handleKeydown = (event) => {
    if (!this.#activeNotice) return;

    if (event.key === "Escape" && this.#activeNotice === "privacy") {
      this.#saveConsent("rejected");
      return;
    }

    if (event.key === "Tab" && this.#activeNotice === "explicit-content") {
      this.#trapFocus(event);
    }
  };

  #handleFocusIn = (event) => {
    if (this.#activeNotice !== "explicit-content") return;

    const dialog = this.querySelector(".cookie-consent");
    if (event.target instanceof Node && dialog?.contains(event.target)) return;

    this.#focusInitialAction();
  };

  connectedCallback() {
    if (this.dataset.cookieConsentReady === "true") return;

    this.dataset.cookieConsentReady = "true";
    exposeConsentApi();
    expireCookie(SITE_LEGACY_COOKIE_NAMES.cookieConsent);
    document.dispatchEvent(new Event(SITE_EVENTS.consentChange));

    this.#explicitContentPending = readExplicitContentAcknowledgement() === null;
    this.#cookieConsentPending = readConsent() === null;
    document.addEventListener(SITE_EVENTS.consentChange, this.#handleConsentChange);
    window.addEventListener("focusin", this.#handleFocusIn, true);
    window.addEventListener("keydown", this.#handleKeydown, true);
    this.#showNextNotice();
  }

  disconnectedCallback() {
    document.removeEventListener(SITE_EVENTS.consentChange, this.#handleConsentChange);
    window.removeEventListener("focusin", this.#handleFocusIn, true);
    window.removeEventListener("keydown", this.#handleKeydown, true);
    if (this.#focusFrame) cancelAnimationFrame(this.#focusFrame);
    this.#unlockPage();
    delete this.dataset.cookieConsentReady;
  }

  #showNextNotice() {
    const nextNotice = this.#explicitContentPending
      ? "explicit-content"
      : this.#cookieConsentPending
        ? "privacy"
        : null;

    this.querySelector("[data-cookie-active-notice]")?.remove();
    this.#activeNotice = nextNotice;
    this.dataset.activeNotice = nextNotice ?? "";

    if (!nextNotice) {
      this.#unlockPage();
      return;
    }

    const template = this.querySelector(`[data-cookie-template="${nextNotice}"]`);
    if (!(template instanceof HTMLTemplateElement)) return;

    this.append(template.content.cloneNode(true));
    this.#bindNoticeActions();

    if (nextNotice === "explicit-content") {
      document.documentElement.classList.add(
        "interaction-disabled",
        "consent-prelock",
        "consent-visible",
      );
      setBackgroundInteractionDisabled(true);
      this.#focusInitialAction();
    } else {
      this.#unlockPage();
    }
  }

  #bindNoticeActions() {
    this.querySelector(".cookie-consent-backdrop")?.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      this.#focusInitialAction();
    });

    this.querySelector("[data-cookie-action='leave']")?.addEventListener("click", () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.assign("https://www.cta.li/");
      }
    });

    this.querySelector("[data-cookie-action='acknowledge']")?.addEventListener("click", () => {
      writeExplicitContentAcknowledgement();
      this.#explicitContentPending = false;
      document.dispatchEvent(new Event(SITE_EVENTS.explicitContentChange));
      this.#showNextNotice();
    });

    this.querySelector("[data-cookie-action='reject']")?.addEventListener("click", () => {
      this.#saveConsent("rejected");
    });

    this.querySelector("[data-cookie-action='accept']")?.addEventListener("click", () => {
      this.#saveConsent("accepted");
    });
  }

  #saveConsent(choice) {
    writeConsent(choice);
    exposeConsentApi();
    this.#cookieConsentPending = false;
    document.dispatchEvent(new Event(SITE_EVENTS.consentChange));
    this.#showNextNotice();
  }

  #unlockPage() {
    document.documentElement.classList.remove(
      "interaction-disabled",
      "consent-prelock",
      "consent-visible",
    );
    setBackgroundInteractionDisabled(false);
  }

  #getFocusableDialogElements() {
    return Array.from(this.querySelectorAll(`.cookie-consent ${DIALOG_FOCUSABLE_SELECTOR}`)).filter(
      isFocusableElement,
    );
  }

  #focusInitialAction() {
    if (this.#focusFrame) cancelAnimationFrame(this.#focusFrame);

    customElements.whenDefined("md-text-button").then(() => {
      if (this.#activeNotice !== "explicit-content") return;

      this.#focusFrame = requestAnimationFrame(() => {
        this.#focusFrame = 0;
        this.#getFocusableDialogElements()[0]?.focus();
      });
    });
  }

  #trapFocus(event) {
    const elements = this.#getFocusableDialogElements();
    if (elements.length === 0) return;

    const activeIndex = elements.indexOf(document.activeElement);
    const nextIndex = event.shiftKey
      ? activeIndex <= 0
        ? elements.length - 1
        : activeIndex - 1
      : activeIndex === -1 || activeIndex >= elements.length - 1
        ? 0
        : activeIndex + 1;

    event.preventDefault();
    elements[nextIndex].focus();
  }
}

class SiteCookiePreferences extends HTMLElement {
  #choice = "unset";
  #feedbackTimer = 0;

  #handleClick = (event) => {
    const choiceControl =
      event.target instanceof Element
        ? event.target.closest("[data-cookie-preference-choice]")
        : null;
    const choice = choiceControl?.dataset.cookiePreferenceChoice;

    if (choice === "accepted" || choice === "rejected") {
      this.#writeChoice(choice);
    } else if (choice === "unset") {
      this.#resetChoice();
    }
  };

  connectedCallback() {
    if (this.dataset.cookiePreferencesReady === "true") return;

    this.dataset.cookiePreferencesReady = "true";
    this.#choice = readStoredChoice();
    this.#syncView(this.#choice === "unset" ? null : this.#choice);
    this.addEventListener("click", this.#handleClick);
    document.dispatchEvent(new Event("site:cookie-preferences-ready"));
  }

  disconnectedCallback() {
    this.removeEventListener("click", this.#handleClick);
    this.#clearFeedbackTimer();
    delete this.dataset.cookiePreferencesReady;
  }

  #writeChoice(choice) {
    this.#clearFeedbackTimer();
    writeConsent(choice);
    this.#choice = choice;
    this.#syncView(
      choice,
      choice === "accepted" ? "Services optionnels autorisés." : "Services optionnels refusés.",
    );
    document.dispatchEvent(new Event(SITE_EVENTS.consentChange));
  }

  #resetChoice() {
    this.#clearFeedbackTimer();
    resetConsent();
    this.#choice = "unset";
    this.#syncView(null, "Choix des services optionnels réinitialisé.");
    document.dispatchEvent(new Event(SITE_EVENTS.consentChange));
  }

  #syncView(selectedChoice, feedback = "") {
    const status = this.querySelector("[data-cookie-preferences-status]");
    const feedbackElement = this.querySelector("[data-cookie-preferences-feedback]");
    const panel = this.querySelector(".cookie-preferences-panel");

    if (status) status.textContent = STATUS_LABELS[this.#choice];
    if (feedbackElement) feedbackElement.textContent = feedback;
    if (panel) panel.dataset.cookiePreferenceState = this.#choice;
    this.#syncSelection(selectedChoice);
  }

  #syncSelection(selectedChoice) {
    for (const control of this.querySelectorAll("[data-cookie-preference-choice]")) {
      if (control.dataset.cookiePreferenceChoice === "unset") {
        control.removeAttribute("data-selected");
        control.toggleAttribute("disabled", this.#choice === "unset");
        continue;
      }
      const selected = control.dataset.cookiePreferenceChoice === selectedChoice;
      control.toggleAttribute("data-selected", selected);
    }
  }

  #clearFeedbackTimer() {
    if (!this.#feedbackTimer) return;
    window.clearTimeout(this.#feedbackTimer);
    this.#feedbackTimer = 0;
  }
}

export function defineCookieConsentControls() {
  if (!customElements.get("site-cookie-consent-banner")) {
    customElements.define("site-cookie-consent-banner", SiteCookieConsentBanner);
  }

  if (!customElements.get("site-cookie-preferences")) {
    customElements.define("site-cookie-preferences", SiteCookiePreferences);
  }
}
