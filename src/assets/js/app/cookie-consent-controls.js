import {
  SITE_COOKIE_NAMES,
  SITE_EVENTS,
  SITE_LEGACY_COOKIE_NAMES,
  SITE_LEGACY_STORAGE_KEYS,
  SITE_STORAGE_KEYS,
} from "@/lib/site-contracts";
import {
  OPTIONAL_SERVICE_IDS,
  OPTIONAL_SERVICES_CONSENT_VERSION,
  areAllOptionalServicesEnabled,
  countEnabledOptionalServices,
  createOptionalServices,
  createOptionalServicesConsent,
  normalizeOptionalServicesConsent,
  optionalServicesFromLegacyConsent,
} from "@/lib/optional-services-consent.mjs";
import { parseVersionedState, readCookieValue, serializeCookie } from "./site-persistence.js";

const BACKGROUND_INTERACTION_SELECTORS = [".site-header", ".site-main", ".site-footer"];
const DIALOG_FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "md-elevated-button:not([disabled])",
  "md-filled-button:not([disabled])",
  "md-filled-tonal-button:not([disabled])",
  "md-outlined-button:not([disabled])",
  "md-text-button:not([disabled])",
  "md-outlined-text-field:not([disabled])",
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
function readCookie(name) {
  return readCookieValue(document.cookie, name);
}

function writeCookie(name, value) {
  document.cookie = serializeCookie(name, value);
}

function expireCookie(name) {
  document.cookie = serializeCookie(name, "", { maxAgeSeconds: 0 });
}

function parseCurrentConsent(value) {
  return normalizeOptionalServicesConsent(
    parseVersionedState(value, OPTIONAL_SERVICES_CONSENT_VERSION),
  );
}

function readCurrentStorageConsent() {
  try {
    return parseCurrentConsent(localStorage.getItem(SITE_STORAGE_KEYS.cookieConsent));
  } catch {
    return null;
  }
}

function readCurrentCookieConsent() {
  return parseCurrentConsent(readCookie(SITE_COOKIE_NAMES.cookieConsent));
}

function readLegacyStorageServices() {
  try {
    for (const key of [
      SITE_LEGACY_STORAGE_KEYS.cookieConsentV1,
      SITE_LEGACY_STORAGE_KEYS.cookieConsent,
    ]) {
      const services = optionalServicesFromLegacyConsent(
        parseVersionedState(localStorage.getItem(key)),
      );
      if (services) return services;
    }
  } catch {}

  return null;
}

function readLegacyCookieServices() {
  for (const name of [
    SITE_LEGACY_COOKIE_NAMES.cookieConsentV1,
    SITE_LEGACY_COOKIE_NAMES.cookieConsent,
  ]) {
    const choice = readCookie(name);
    if (choice === "accepted") {
      return optionalServicesFromLegacyConsent({ functionality: true, version: 1 });
    }
    if (choice === "rejected") return createOptionalServices(false);
  }

  return null;
}

function clearLegacyConsentStorage() {
  try {
    localStorage.removeItem(SITE_LEGACY_STORAGE_KEYS.cookieConsentV1);
    localStorage.removeItem(SITE_LEGACY_STORAGE_KEYS.cookieConsent);
  } catch {}
}

function clearLegacyConsentCookies() {
  const cookies = document.cookie.split(";").map((cookie) => cookie.trim());
  for (const name of [
    SITE_LEGACY_COOKIE_NAMES.cookieConsentV1,
    SITE_LEGACY_COOKIE_NAMES.cookieConsent,
  ]) {
    if (cookies.some((cookie) => cookie.startsWith(`${encodeURIComponent(name)}=`))) {
      expireCookie(name);
    }
  }
}

function writeConsentServices(services) {
  const consent = createOptionalServicesConsent(services);
  if (!consent) return null;

  try {
    localStorage.setItem(SITE_STORAGE_KEYS.cookieConsent, JSON.stringify(consent));
    clearLegacyConsentStorage();
  } catch {}

  writeCookie(SITE_COOKIE_NAMES.cookieConsent, JSON.stringify(consent));
  clearLegacyConsentCookies();
  return consent;
}

function readConsent() {
  const current = readCurrentStorageConsent() ?? readCurrentCookieConsent();
  if (current) {
    clearLegacyConsentStorage();
    clearLegacyConsentCookies();
    return current;
  }

  const legacyServices = readLegacyStorageServices() ?? readLegacyCookieServices();
  return legacyServices ? writeConsentServices(legacyServices) : null;
}

function choiceForServices(services) {
  if (!services) return "unset";

  const enabledCount = countEnabledOptionalServices(services);
  if (enabledCount === 0) return "rejected";
  if (enabledCount === OPTIONAL_SERVICE_IDS.length) return "accepted";
  return "custom";
}

function statusLabelForServices(services) {
  if (!services) return "Aucun choix enregistré";

  const enabledCount = countEnabledOptionalServices(services);
  if (enabledCount === 0) return "Aucun service autorisé";
  if (enabledCount === OPTIONAL_SERVICE_IDS.length) return "Tous les services autorisés";
  return `${enabledCount} service${enabledCount > 1 ? "s" : ""} autorisé${
    enabledCount > 1 ? "s" : ""
  } sur ${OPTIONAL_SERVICE_IDS.length}`;
}

function readStoredChoice() {
  return choiceForServices(readConsent()?.services);
}

function functionalityConsentAccepted() {
  return areAllOptionalServicesEnabled(readConsent()?.services);
}

function serviceConsentAccepted(service) {
  return Boolean(readConsent()?.services?.[service]);
}

function writeConsent(choice) {
  return writeConsentServices(createOptionalServices(choice === "accepted"));
}

function resetConsent() {
  try {
    localStorage.removeItem(SITE_STORAGE_KEYS.cookieConsent);
  } catch {}

  clearLegacyConsentStorage();
  expireCookie(SITE_COOKIE_NAMES.cookieConsent);
  clearLegacyConsentCookies();
}

function readExplicitContentAcknowledgement() {
  try {
    const parsed = parseVersionedState(
      localStorage.getItem(SITE_STORAGE_KEYS.explicitContentAcknowledgement),
    );
    if (parsed?.acknowledged === true) return parsed;
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
      OPTIONAL_SERVICE_IDS.includes(service) &&
      serviceConsentAccepted(service),
    isCategoryAccepted: (category) =>
      category === "necessary" || (category === "functionality" && functionalityConsentAccepted()),
  };
}

function setBackgroundInteractionDisabled(disabled) {
  for (const selector of BACKGROUND_INTERACTION_SELECTORS) {
    document.querySelector(selector)?.toggleAttribute("inert", disabled);
  }
}

function isFocusableElement(element) {
  const visible =
    typeof element.checkVisibility !== "function" ||
    element.checkVisibility({ checkVisibilityCSS: true });

  return (
    (element.tabIndex >= 0 || MATERIAL_BUTTON_TAG_NAMES.has(element.localName)) &&
    !element.hasAttribute("disabled") &&
    !element.matches(":disabled") &&
    element.getAttribute("aria-disabled") !== "true" &&
    !element.closest('[inert], [hidden], [aria-hidden="true"]') &&
    visible
  );
}

class SiteCookieConsentBanner extends HTMLElement {
  #activeNotice = null;
  #cookieConsentPending = false;
  #explicitContentPending = false;
  #focusFrame = 0;
  #focusRequest = 0;

  #handleConsentChange = () => {
    const pending = readStoredChoice() === "unset";
    if (pending === this.#cookieConsentPending) return;

    this.#cookieConsentPending = pending;
    this.#showNextNotice();
  };

  #handleKeydown = (event) => {
    if (!this.#activeNotice) return;

    if (
      ["Tab", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)
    ) {
      // The notice can render before Material upgrades its buttons. Keep the
      // queued initial focus until there is a visible action to navigate to.
      if (
        this.#activeNotice === "explicit-content" &&
        this.#getFocusableDialogElements().length === 0
      ) {
        event.preventDefault();
        return;
      }
      // A backdrop pointerdown may still have an initial-focus frame queued.
      // Once the user navigates, keyboard navigation is authoritative: do
      // not let that older frame move focus back to the first action.
      this.#cancelFocusRequest();
      if (
        this.#activeNotice === "explicit-content" &&
        (event.key === "ArrowDown" || event.key === "ArrowUp")
      ) {
        const elements = this.#getFocusableDialogElements();
        const activeIndex = elements.indexOf(document.activeElement);
        if (activeIndex !== -1) {
          event.preventDefault();
          const offset = event.key === "ArrowDown" ? 1 : -1;
          elements[(activeIndex + offset + elements.length) % elements.length].focus();
          return;
        }
      }
      if (event.key === "Tab" && this.#activeNotice === "explicit-content") this.#trapFocus(event);
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
    readConsent();
    exposeConsentApi();
    document.dispatchEvent(new Event(SITE_EVENTS.consentChange));

    this.#explicitContentPending = readExplicitContentAcknowledgement() === null;
    this.#cookieConsentPending = readStoredChoice() === "unset";
    document.addEventListener(SITE_EVENTS.consentChange, this.#handleConsentChange);
    window.addEventListener("focusin", this.#handleFocusIn, true);
    window.addEventListener("keydown", this.#handleKeydown, true);
    this.#showNextNotice();
  }

  disconnectedCallback() {
    document.removeEventListener(SITE_EVENTS.consentChange, this.#handleConsentChange);
    window.removeEventListener("focusin", this.#handleFocusIn, true);
    window.removeEventListener("keydown", this.#handleKeydown, true);
    this.#cancelFocusRequest();
    this.#unlockPage();
    delete this.dataset.cookieConsentReady;
  }

  #showNextNotice() {
    const continueKeyboardFocus =
      document.documentElement.dataset.focusModality === "keyboard" &&
      this.contains(document.activeElement);
    const nextNotice = this.#explicitContentPending
      ? "explicit-content"
      : this.#cookieConsentPending
        ? "privacy"
        : null;

    const currentNotice = this.querySelector("[data-cookie-active-notice]");
    const adoptBootNotice =
      nextNotice === "explicit-content" && currentNotice?.hasAttribute("data-cookie-boot-notice");
    if (!adoptBootNotice) currentNotice?.remove();
    this.#activeNotice = nextNotice;
    this.dataset.activeNotice = nextNotice ?? "";

    if (!nextNotice) {
      this.#unlockPage();
      this.#cancelFocusRequest();
      if (continueKeyboardFocus) document.querySelector("#main-content")?.focus();
      return;
    }

    if (!adoptBootNotice) {
      const template = this.querySelector(`[data-cookie-template="${nextNotice}"]`);
      if (!(template instanceof HTMLTemplateElement)) return;
      this.append(template.content.cloneNode(true));
    }
    this.#bindNoticeActions();
    currentNotice?.removeAttribute("data-cookie-boot-notice");

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
      if (continueKeyboardFocus) this.#focusInitialAction();
    }
  }

  #bindNoticeActions() {
    this.querySelector(".cookie-consent-backdrop")?.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      this.#focusInitialAction();
    });

    this.querySelector("[data-cookie-action='leave']")?.addEventListener("click", () => {
      window.location.assign("https://www.cta.li/");
    });

    const acknowledgeButton = this.querySelector("[data-cookie-action='acknowledge']");
    if (this.querySelector("[data-cookie-age]")) {
      void import("./explicit-content-age.js")
        .then(({ bindExplicitContentAge }) => bindExplicitContentAge(this))
        .catch(() => undefined);
    }

    acknowledgeButton?.addEventListener("click", () => {
      writeExplicitContentAcknowledgement();
      this.#explicitContentPending = false;
      document.dispatchEvent(new Event(SITE_EVENTS.explicitContentChange));
      this.#showNextNotice();
    });

    this.querySelectorAll("[data-cookie-action='reject']").forEach((button) => {
      button.addEventListener("click", () => this.#saveConsent("rejected"));
    });

    this.querySelectorAll("[data-cookie-action='accept']").forEach((button) => {
      button.addEventListener("click", () => this.#saveConsent("accepted"));
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
    this.#cancelFocusRequest();
    const focusRequest = this.#focusRequest;
    const notice = this.#activeNotice;
    if (!notice) return;

    customElements.whenDefined("md-text-button").then(() => {
      if (
        focusRequest !== this.#focusRequest ||
        !this.isConnected ||
        this.#activeNotice !== notice
      ) {
        return;
      }

      this.#focusFrame = requestAnimationFrame(() => {
        this.#focusFrame = 0;
        if (
          focusRequest !== this.#focusRequest ||
          !this.isConnected ||
          this.#activeNotice !== notice
        ) {
          return;
        }
        this.#getFocusableDialogElements()[0]?.focus();
      });
    });
  }

  #cancelFocusRequest() {
    this.#focusRequest += 1;
    if (!this.#focusFrame) return;

    cancelAnimationFrame(this.#focusFrame);
    this.#focusFrame = 0;
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
  #services = null;

  #handleClick = (event) => {
    const actionControl =
      event.target instanceof Element
        ? event.target.closest("[data-cookie-preference-action]")
        : null;
    const action = actionControl?.dataset.cookiePreferenceAction;

    if (action === "accept-all") {
      this.#writeServices(
        createOptionalServices(true),
        "Tous les services optionnels sont autorisés.",
      );
    } else if (action === "reject-all") {
      this.#writeServices(
        createOptionalServices(false),
        "Tous les services optionnels sont refusés.",
      );
    } else if (action === "reset") {
      this.#resetChoice();
    }
  };

  #handleChange = (event) => {
    const serviceControl =
      event.target instanceof Element
        ? event.target.closest("[data-cookie-preference-service]")
        : null;
    const service = serviceControl?.dataset.cookiePreferenceService;
    if (!service || !OPTIONAL_SERVICE_IDS.includes(service)) return;

    const services = {
      ...(this.#services ?? createOptionalServices(false)),
      [service]: Boolean(serviceControl.selected),
    };
    this.#writeServices(services, "Préférences des services optionnels enregistrées.");
  };

  connectedCallback() {
    if (this.dataset.cookiePreferencesReady === "true") return;

    this.dataset.cookiePreferencesReady = "true";
    this.#services = readConsent()?.services ?? null;
    this.#syncView();
    this.addEventListener("click", this.#handleClick);
    this.addEventListener("change", this.#handleChange);
    document.dispatchEvent(new Event("site:cookie-preferences-ready"));
  }

  disconnectedCallback() {
    this.removeEventListener("click", this.#handleClick);
    this.removeEventListener("change", this.#handleChange);
    delete this.dataset.cookiePreferencesReady;
  }

  #writeServices(services, feedback) {
    const consent = writeConsentServices(services);
    if (!consent) return;

    this.#services = consent.services;
    exposeConsentApi();
    this.#syncView(feedback);
    document.dispatchEvent(new Event(SITE_EVENTS.consentChange));
  }

  #resetChoice() {
    resetConsent();
    this.#services = null;
    exposeConsentApi();
    this.#syncView("Choix des services optionnels réinitialisé.");
    document.dispatchEvent(new Event(SITE_EVENTS.consentChange));
  }

  #syncView(feedback = "") {
    const status = this.querySelector("[data-cookie-preferences-status]");
    const feedbackElement = this.querySelector("[data-cookie-preferences-feedback]");
    const panel = this.querySelector(".cookie-preferences-panel");

    if (status) status.textContent = statusLabelForServices(this.#services);
    if (feedbackElement) feedbackElement.textContent = feedback;
    if (panel) panel.dataset.cookiePreferenceState = choiceForServices(this.#services);

    const allServicesEnabled = areAllOptionalServicesEnabled(this.#services);
    const noServicesEnabled =
      this.#services !== null && countEnabledOptionalServices(this.#services) === 0;
    this.querySelector('[data-cookie-preference-action="accept-all"]')?.toggleAttribute(
      "data-selected",
      allServicesEnabled,
    );
    this.querySelector('[data-cookie-preference-action="reject-all"]')?.toggleAttribute(
      "data-selected",
      noServicesEnabled,
    );
    this.querySelector('[data-cookie-preference-action="reset"]')?.toggleAttribute(
      "disabled",
      this.#services === null,
    );

    for (const control of this.querySelectorAll("[data-cookie-preference-service]")) {
      const selected = Boolean(this.#services?.[control.dataset.cookiePreferenceService]);
      control.toggleAttribute("selected", selected);
      control.selected = selected;
    }
  }
}

export function defineCookieConsentControls() {
  void import("@material/web/textfield/outlined-text-field.js").catch(() => undefined);

  if (!customElements.get("site-cookie-consent-banner")) {
    customElements.define("site-cookie-consent-banner", SiteCookieConsentBanner);
  }

  if (!customElements.get("site-cookie-preferences")) {
    customElements.define("site-cookie-preferences", SiteCookiePreferences);
  }
}
