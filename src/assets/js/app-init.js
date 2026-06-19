import PhotoSwipeLightbox from "photoswipe/lightbox";
import PhotoSwipe from "photoswipe";
import "photoswipe/style.css";
import { initMuiTooltips } from "./mui-tooltips.js";

const CODE_COPY_ICON_PATH =
  "M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z";
const CODE_CHECK_ICON_PATH = "M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z";
const CODE_ERROR_ICON_PATH =
  "M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm-40-160h80v-240h-80v240Zm40 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z";

function createIcon(className, path) {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 -960 960 960");
  icon.setAttribute("width", "20");
  icon.setAttribute("height", "20");
  icon.setAttribute("fill", "currentColor");
  icon.classList.add("code-icon", className);
  icon.setAttribute("matButtonIcon", "");
  icon.innerHTML = `<path d="${path}"/>`;
  return icon;
}

function createMaterialButtonChrome(rippleClass = "mdc-button__ripple") {
  const ripple = document.createElement("span");
  ripple.className = `mat-mdc-button-persistent-ripple ${rippleClass}`;
  ripple.setAttribute("aria-hidden", "true");

  const focus = document.createElement("span");
  focus.className = "mat-focus-indicator";
  focus.setAttribute("aria-hidden", "true");

  const touchTarget = document.createElement("span");
  touchTarget.className = "mat-mdc-button-touch-target";
  touchTarget.setAttribute("aria-hidden", "true");

  return { focus, ripple, touchTarget };
}

function initManualMaterialRipples() {
  if (document.documentElement.dataset.manualMaterialRipples === "true") return;

  document.documentElement.dataset.manualMaterialRipples = "true";
  document.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;

    const button = event.target?.closest?.(".site-material-ripple");
    if (!button || button.matches(":disabled, [aria-disabled='true']")) return;

    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2.2;
    const ripple = document.createElement("span");

    ripple.className = "site-material-ripple__wave";
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${event.clientX - rect.left}px`;
    ripple.style.top = `${event.clientY - rect.top}px`;

    button.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove(), { once: true });
  });
}

const FULLSCREEN_ICON_PATH =
  "M120-120v-200h80v120h120v80H120Zm520 0v-80h120v-120h80v200H640ZM120-640v-200h200v80H200v120h-80Zm640 0v-120H640v-80h200v200h-80Z";
const CLOSE_FULLSCREEN_ICON_PATH =
  "m136-80-56-56 264-264H160v-80h320v320h-80v-184L136-80Zm344-400v-320h80v184l264-264 56 56-264 264h184v80H480Z";
const OPEN_IMAGE_ICON_PATH =
  "M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm0-72q-45 0-76.5-31.5T372-500q0-45 31.5-76.5T480-608q45 0 76.5 31.5T588-500q0 45-31.5 76.5T480-392Zm0 192q-146 0-266-81.5T40-500q54-137 174-218.5T480-800q146 0 266 81.5T920-500q-54 137-174 218.5T480-200Zm0-300Zm0 220q113 0 207.5-59.5T832-500q-50-101-144.5-160.5T480-720q-113 0-207.5 59.5T128-500q50 101 144.5 160.5T480-280Z";
const SHARE_IMAGE_ICON_PATH =
  "M720-80q-50 0-85-35t-35-85q0-7 1-14.5t3-13.5L322-392q-17 15-38 23.5t-44 8.5q-50 0-85-35t-35-85q0-50 35-85t85-35q23 0 44 8.5t38 23.5l282-164q-2-6-3-13.5t-1-14.5q0-50 35-85t85-35q50 0 85 35t35 85q0 50-35 85t-85 35q-23 0-44-8.5T638-672L356-508q2 6 3 13.5t1 14.5q0 7-1 14.5t-3 13.5l282 164q17-15 38-23.5t44-8.5q50 0 85 35t35 85q0 50-35 85t-85 35Zm0-80q17 0 28.5-11.5T760-200q0-17-11.5-28.5T720-240q-17 0-28.5 11.5T680-200q0 17 11.5 28.5T720-160ZM240-440q17 0 28.5-11.5T280-480q0-17-11.5-28.5T240-520q-17 0-28.5 11.5T200-480q0 17 11.5 28.5T240-440Zm480-280q17 0 28.5-11.5T760-760q0-17-11.5-28.5T720-800q-17 0-28.5 11.5T680-760q0 17 11.5 28.5T720-720Z";
const SCROLL_TOP_ICON_PATH =
  "M440-727 256-544l-56-56 280-280 280 280-56 57-184-184v287h-80v-287Zm0 487v-120h80v120h-80Zm0 160v-80h80v80h-80Z";
const DYNAMIC_ANCHOR_OFFSET = 96;

let isDynamicAnchorInitialized = false;
let dynamicAnchorFrame = 0;
let activeHeadingLink = null;
let activeHeadingHash = "";
let dynamicAnchorHashPausedUntil = 0;

function hideSiteTooltip() {
  document.dispatchEvent(new CustomEvent("site:tooltip-hide"));
}

function padDatePart(value, length = 2) {
  return String(value).padStart(length, "0");
}

function formatCompactLocalDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";

  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absOffset = Math.abs(offsetMinutes);
  const timezone = `${sign}${padDatePart(Math.floor(absOffset / 60))}${padDatePart(
    absOffset % 60,
  )}`;

  return `${padDatePart(date.getFullYear(), 4)}${padDatePart(
    date.getMonth() + 1,
  )}${padDatePart(date.getDate())}T${padDatePart(date.getHours())}${padDatePart(
    date.getMinutes(),
  )}${padDatePart(date.getSeconds())}${timezone}`;
}

function initLocalDateTimes() {
  document.querySelectorAll("time[data-local-date-time]").forEach((time) => {
    const formatted = formatCompactLocalDateTime(time.dataset.localDateTime);
    if (!formatted) return;

    time.textContent = formatted;
    time.setAttribute("aria-label", formatted);
  });
}

function getScrollProgress() {
  const doc = document.documentElement;
  const scrollTop = window.scrollY || doc.scrollTop || document.body.scrollTop || 0;
  const scrollable = Math.max(doc.scrollHeight - window.innerHeight, 1);

  return Math.min(100, Math.max(0, Math.round((scrollTop / scrollable) * 100)));
}

let scrollUiFrame = 0;

function requestScrollUiSync() {
  if (scrollUiFrame) return;

  scrollUiFrame = requestAnimationFrame(() => {
    scrollUiFrame = 0;
    syncScrollUi();
  });
}

function syncScrollUi() {
  const progress = getScrollProgress();

  document
    .querySelectorAll(".site-scroll-top")
    .forEach((button) => syncBackToTopButton(button, progress));
  document
    .querySelectorAll(".site-scroll-progress")
    .forEach((bar) => syncScrollProgressBar(bar, progress));
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    const selection = document.getSelection();
    const selectedRange =
      selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.inset = "0 auto auto 0";
    textarea.style.opacity = "0";

    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    let copied = false;
    try {
      copied = document.execCommand("copy");
    } finally {
      textarea.remove();
      if (selectedRange && selection) {
        selection.removeAllRanges();
        selection.addRange(selectedRange);
      }
    }

    return copied;
  }
}

function initCodeBlocks() {
  document.querySelectorAll("pre > code").forEach((codeBlock) => {
    const pre = codeBlock.parentElement;
    if (!pre || pre.dataset.styled === "1") return;
    pre.dataset.styled = "1";
    pre.removeAttribute("tabindex");

    const langClass = Array.from(codeBlock.classList).find((className) =>
      className.startsWith("language-"),
    );
    const preLangClass = Array.from(pre.classList).find((className) =>
      className.startsWith("language-"),
    );
    const dataLang =
      codeBlock.getAttribute("data-language") ||
      codeBlock.getAttribute("data-lang") ||
      pre.getAttribute("data-language") ||
      pre.getAttribute("data-lang");

    const lang =
      langClass?.replace("language-", "") ||
      preLangClass?.replace("language-", "") ||
      dataLang?.toLowerCase() ||
      "code";

    const shell = document.createElement("div");
    shell.className = "code-shell";
    pre.parentNode?.insertBefore(shell, pre);
    shell.appendChild(pre);

    const header = document.createElement("div");
    header.className = "code-header";

    const langEl = document.createElement("div");
    langEl.className = "code-lang";
    langEl.textContent = lang;

    const actions = document.createElement("div");
    actions.className = "code-actions";

    const button = document.createElement("button");
    button.type = "button";
    button.className =
      "code-copy-btn site-icon-button site-tooltip mat-mdc-icon-button mat-mdc-button-base";
    button.tabIndex = 0;
    button.setAttribute("aria-label", "Copier le code");
    button.setAttribute("data-tooltip", "Copier le code");
    button.setAttribute("aria-keyshortcuts", "Enter Space");

    const status = document.createElement("span");
    status.className = "sr-only code-copy-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");

    const materialChrome = createMaterialButtonChrome("mdc-icon-button__ripple");
    const copyIcon = createIcon("code-copy-icon", CODE_COPY_ICON_PATH);
    const copyIconPath = copyIcon.querySelector("path");
    button.append(
      materialChrome.ripple,
      copyIcon,
      materialChrome.focus,
      materialChrome.touchTarget,
    );

    button.addEventListener("click", async () => {
      const mark = (className, text, iconPath) => {
        button.classList.remove("is-copied", "is-error");
        button.classList.add(className);
        button.setAttribute("aria-label", text);
        button.setAttribute("data-tooltip", text);
        copyIconPath?.setAttribute("d", iconPath);
        status.textContent = text;
        setTimeout(() => {
          button.classList.remove(className);
          button.setAttribute("aria-label", "Copier le code");
          button.setAttribute("data-tooltip", "Copier le code");
          copyIconPath?.setAttribute("d", CODE_COPY_ICON_PATH);
        }, 1000);
      };

      const copied = await copyToClipboard(codeBlock.innerText);
      mark(
        copied ? "is-copied" : "is-error",
        copied ? "Copié" : "Erreur",
        copied ? CODE_CHECK_ICON_PATH : CODE_ERROR_ICON_PATH,
      );
    });

    actions.appendChild(button);
    actions.appendChild(status);
    header.append(langEl, actions);
    shell.insertBefore(header, pre);
  });
}

function initSiteTooltips() {
  document.querySelectorAll("[title]").forEach((element) => {
    const title = element.getAttribute("title");
    if (!title) return;

    element.setAttribute("data-tooltip", title);
    element.removeAttribute("title");
    element.classList.add("site-tooltip");

    if (!element.hasAttribute("aria-label")) {
      element.setAttribute("aria-label", title);
    }

    if (
      !element.matches("a, button, input, select, textarea, summary") &&
      !element.hasAttribute("tabindex")
    ) {
      element.setAttribute("tabindex", "0");
    }
  });

  document.querySelectorAll("[data-footnote-backref]").forEach((backref) => {
    backref.setAttribute("aria-label", "Retour au contenu");
    backref.setAttribute("data-tooltip", "Retour au contenu");
    backref.classList.add("site-tooltip");

    if (!backref.dataset.footnoteEnhanced) {
      backref.dataset.footnoteEnhanced = "true";
      backref.addEventListener("click", () => {
        hideSiteTooltip();
        backref.blur?.();

        const hash = backref.getAttribute("href");
        if (!hash?.startsWith("#")) return;

        requestAnimationFrame(() => {
          const target = document.getElementById(decodeURIComponent(hash.slice(1)));
          if (target && !target.hasAttribute("tabindex")) {
            target.setAttribute("tabindex", "-1");
          }
          target?.scrollIntoView({ behavior: "smooth", block: "center" });
          target?.focus?.({ preventScroll: true });
        });
      });
    }
  });

  document.querySelectorAll(".site-prose a[href^='#user-content-fn-']").forEach((ref) => {
    if (ref.hasAttribute("data-footnote-backref")) return;

    ref.setAttribute("aria-label", "Voir l'explication");
    ref.setAttribute("data-tooltip", "Voir l'explication");
    ref.classList.add("site-tooltip", "footnote-ref-tooltip");
  });
}

function initBackToTopButton() {
  if (document.body?.dataset.scrollTopUi === "off") return;

  const existingButton = document.querySelector(".site-scroll-top");
  if (existingButton) {
    syncBackToTopButton(existingButton);
    return;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className =
    "site-scroll-top mdc-button mat-mdc-button-base mat-mdc-outlined-button site-material-ripple";
  button.setAttribute("aria-label", "Retour en haut");
  button.innerHTML = `
    <span class="mat-mdc-button-persistent-ripple mdc-button__ripple" aria-hidden="true"></span>
    <span class="mdc-button__label">
      <svg matButtonIcon aria-hidden="true" viewBox="0 -960 960 960" focusable="false">
        <path d="${SCROLL_TOP_ICON_PATH}"></path>
      </svg>
      <span>Haut</span>
      <span class="site-scroll-top__count" data-scroll-progress-count aria-hidden="true">0%</span>
    </span>
    <span class="mat-focus-indicator" aria-hidden="true"></span>
    <span class="mat-mdc-button-touch-target" aria-hidden="true"></span>
  `;

  button.addEventListener("click", () => {
    hideSiteTooltip();
    button.blur();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  window.addEventListener("scroll", requestScrollUiSync, { passive: true });
  window.addEventListener("resize", requestScrollUiSync, { passive: true });
  document.body.appendChild(button);
  syncScrollUi();
}

function syncBackToTopButton(button, progress = getScrollProgress()) {
  const isVisible = window.scrollY > 100;
  const count = button.querySelector("[data-scroll-progress-count]");

  button.classList.toggle("is-visible", isVisible);
  button.tabIndex = isVisible ? 0 : -1;
  button.setAttribute("aria-label", `Retour en haut, progression ${progress} %`);
  if (count) count.textContent = `${progress}%`;
}

function initScrollProgressBar() {
  if (document.body?.dataset.scrollProgressUi === "off") return;

  const existingBar = document.querySelector(".site-scroll-progress");
  if (existingBar) {
    syncScrollProgressBar(existingBar);
    return;
  }

  const bar = document.createElement("div");
  bar.className = "site-scroll-progress";
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-label", "Progression de lecture");
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", "100");
  bar.innerHTML = '<span class="site-scroll-progress__bar"></span>';

  window.addEventListener("scroll", requestScrollUiSync, { passive: true });
  window.addEventListener("resize", requestScrollUiSync, { passive: true });
  document.body.appendChild(bar);
  syncScrollUi();
}

function syncScrollProgressBar(bar, progress = getScrollProgress()) {
  const fill = bar.querySelector(".site-scroll-progress__bar");

  bar.setAttribute("aria-valuenow", String(progress));
  fill?.style.setProperty("transform", `translate3d(0, 0, 0) scaleX(${progress / 100})`);
}

function removeScrollUi() {
  document.querySelectorAll(".site-scroll-progress").forEach((element) => {
    element.remove();
  });
}

function getHeadingHashFromLink(link) {
  const hash = link.getAttribute("href");
  if (!hash?.startsWith("#") || hash === "#") return "";
  return hash;
}

function getDynamicAnchorEntries() {
  const postHeader = document.querySelector(".post-header");
  const prose = document.querySelector(".site-prose");
  if (!postHeader || !prose) return [];

  const entries = [];
  const resetHeading = postHeader.querySelector("[data-anchor-reset]");
  if (resetHeading) {
    entries.push({
      hash: "",
      heading: resetHeading,
      link: null,
      reset: true,
    });
  }

  prose
    .querySelectorAll(":is(h1, h2, h3, h4, h5, h6) > a.heading-link[href^='#']")
    .forEach((link) => {
      const hash = getHeadingHashFromLink(link);
      const heading = link.closest("h1, h2, h3, h4, h5, h6");
      if (!hash || !heading) return;

      entries.push({
        hash,
        heading,
        link,
        reset: false,
      });
    });

  return entries.sort((a, b) => {
    const aTop = a.heading.getBoundingClientRect().top + window.scrollY;
    const bTop = b.heading.getBoundingClientRect().top + window.scrollY;
    return aTop - bTop;
  });
}

function clearActiveHeading(managedHashes = new Set()) {
  activeHeadingLink?.classList.remove("is-anchor-active");
  activeHeadingLink?.removeAttribute("aria-current");
  activeHeadingLink = null;

  if (location.hash && (managedHashes.has(location.hash) || location.hash === activeHeadingHash)) {
    history.replaceState(null, "", `${location.pathname}${location.search}`);
  }

  activeHeadingHash = "";
}

function setActiveHeading(entry, { updateLocation = true } = {}) {
  if (activeHeadingLink && activeHeadingLink !== entry.link) {
    activeHeadingLink.classList.remove("is-anchor-active");
    activeHeadingLink.removeAttribute("aria-current");
  }

  activeHeadingLink = entry.link;
  activeHeadingHash = entry.hash;
  activeHeadingLink?.classList.add("is-anchor-active");
  activeHeadingLink?.setAttribute("aria-current", "location");

  if (updateLocation && location.hash !== entry.hash) {
    history.replaceState(null, "", entry.hash);
  }
}

function syncDynamicAnchors() {
  dynamicAnchorFrame = 0;

  const entries = getDynamicAnchorEntries();
  if (entries.length === 0) {
    clearActiveHeading();
    return;
  }

  const managedHashes = new Set(
    entries.filter((entry) => !entry.reset).map((entry) => entry.hash),
  );

  if (window.scrollY < 24) {
    clearActiveHeading(managedHashes);
    return;
  }

  let currentEntry = null;
  const viewportOffset = window.visualViewport?.offsetTop || 0;
  const activationLine = viewportOffset + DYNAMIC_ANCHOR_OFFSET;

  for (const entry of entries) {
    if (entry.heading.getBoundingClientRect().top <= activationLine) {
      currentEntry = entry;
    } else {
      break;
    }
  }

  if (!currentEntry || currentEntry.reset || !currentEntry.link) {
    clearActiveHeading(managedHashes);
    return;
  }

  const isPausedOnUnmanagedHash =
    Date.now() < dynamicAnchorHashPausedUntil &&
    location.hash &&
    !managedHashes.has(location.hash);

  setActiveHeading(currentEntry, { updateLocation: !isPausedOnUnmanagedHash });
}

function requestDynamicAnchorSync() {
  if (dynamicAnchorFrame) return;
  dynamicAnchorFrame = requestAnimationFrame(syncDynamicAnchors);
}

function initDynamicAnchors() {
  requestDynamicAnchorSync();
  if (isDynamicAnchorInitialized) return;

  isDynamicAnchorInitialized = true;

  document.addEventListener(
    "click",
    (event) => {
      const link = event.target?.closest?.("a[href^='#']");
      if (!link) return;

      hideSiteTooltip();
      const isHeadingLink =
        link.matches(".heading-link") &&
        Boolean(link.closest(".site-prose :is(h1, h2, h3, h4, h5, h6)"));

      dynamicAnchorHashPausedUntil = isHeadingLink ? 0 : Date.now() + 1600;

      if (event.detail > 0) {
        requestAnimationFrame(() => link.blur?.());
      }

      requestAnimationFrame(requestDynamicAnchorSync);
      window.setTimeout(requestDynamicAnchorSync, 420);
    },
    true,
  );

  window.addEventListener("scroll", requestDynamicAnchorSync, { passive: true });
  window.addEventListener("resize", requestDynamicAnchorSync, { passive: true });
  window.visualViewport?.addEventListener("resize", requestDynamicAnchorSync, {
    passive: true,
  });
  window.visualViewport?.addEventListener("scroll", requestDynamicAnchorSync, {
    passive: true,
  });
  window.addEventListener("hashchange", requestDynamicAnchorSync);
}

function wrapMarkdownImages() {
  document.querySelectorAll(".site-prose").forEach((container) => {
    let imageIndex = 0;

    container
      .querySelectorAll("img:not([data-no-lightbox])")
      .forEach((img) => {
        if (img.closest("header, footer, nav, [data-no-lightbox], a")) return;
        if (!img.src) return;
        const isPriorityImage =
          imageIndex === 0 ||
          img.loading === "eager" ||
          img.getAttribute("fetchpriority") === "high";
        imageIndex += 1;

        const link = document.createElement("a");
        link.href = img.src;
        link.tabIndex = 0;
        link.setAttribute("data-pswp-item", "");
        link.setAttribute(
          "aria-label",
          img.alt ? `Agrandir l'image : ${img.alt}` : `Agrandir l'image ${fileNameFromURL(img.src)}`,
        );

        link.addEventListener("keydown", (event) => {
          if (event.key !== " ") return;
          event.preventDefault();
          link.click();
        });
        link.addEventListener("click", hideSiteTooltip);

        const setSize = () => {
          const width =
            img.naturalWidth || parseInt(img.getAttribute("width") || "0") || 1400;
          const height =
            img.naturalHeight || parseInt(img.getAttribute("height") || "0") || 933;
          link.setAttribute("data-pswp-width", String(width));
          link.setAttribute("data-pswp-height", String(height));
        };

        if (img.complete) {
          setSize();
        } else {
          img.addEventListener("load", setSize, { once: true });
        }

        img.parentNode?.insertBefore(link, img);
        link.appendChild(img);
        img.decoding = "async";
        img.loading = isPriorityImage ? "eager" : "lazy";
        if (isPriorityImage) {
          img.fetchPriority = "high";
          img.setAttribute("fetchpriority", "high");
        }
      });
  });
}

function initKeyboardAccessibleTargets() {
  document.querySelectorAll("a[href]").forEach((link) => {
    if (!link.hasAttribute("tabindex")) link.setAttribute("tabindex", "0");
  });

  document.querySelectorAll("main :is(h1, h2, h3, h4, h5, h6)").forEach((heading) => {
    if (heading.closest("nav") || heading.querySelector("a[href]")) return;
    if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "0");
  });
}

function fileNameFromURL(url) {
  try {
    const parsed = new URL(url, location.href);
    return decodeURIComponent(parsed.pathname.split("/").pop() || "image");
  } catch {
    return "image";
  }
}

function enhancePhotoSwipeButton(button, label) {
  const topBar = button.closest(".pswp__top-bar");
  const contrastScope = topBar ? "bar" : "button";

  topBar?.classList.add("pswp__top-bar--contrast");
  button.setAttribute("aria-label", label);
  button.removeAttribute("title");
  button.dataset.tooltip = label;
  button.dataset.contrast = "true";
  button.dataset.contrastScope = contrastScope;
  button.setAttribute("type", "button");
  button.classList.add("pswp__button--contrast", "mat-mdc-button-base", "mat-mdc-icon-button");
  button.style.setProperty("color", "#fff", "important");
  button.style.setProperty(
    "mix-blend-mode",
    contrastScope === "bar" ? "normal" : "difference",
    "important",
  );
  button.style.setProperty("overflow", "visible", "important");
  button.style.setProperty("filter", "none", "important");
  button.tabIndex = button.hasAttribute("disabled") ? -1 : 0;

  button.querySelectorAll(".pswp__icn, svg, path").forEach((icon) => {
    icon.style.setProperty("color", "#fff", "important");
    icon.style.setProperty("fill", "currentColor", "important");
    icon.style.setProperty(
      "mix-blend-mode",
      contrastScope === "bar" ? "normal" : "difference",
      "important",
    );
    icon.style.setProperty("filter", "none", "important");
    if (icon.hasAttribute("stroke")) {
      icon.style.setProperty("stroke", "currentColor", "important");
    }
  });

  if (!button.dataset.keyboardEnhanced) {
    button.dataset.keyboardEnhanced = "true";
    button.addEventListener("click", hideSiteTooltip);
    button.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      button.click();
    });
  }
}

async function downloadViaFetch(url, filename) {
  const res = await fetch(url, { mode: "cors" });
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}

function setTemporaryPhotoSwipeButtonLabel(button, label, fallbackLabel) {
  enhancePhotoSwipeButton(button, label);
  window.setTimeout(() => enhancePhotoSwipeButton(button, fallbackLabel), 1400);
}

async function sharePhotoSwipeImage(src, button) {
  const url = new URL(src, location.href).href;
  const shareData = {
    title: document.title,
    url,
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    setTemporaryPhotoSwipeButtonLabel(button, "Lien copié", "Partager");
  } catch {
    window.open(url, "_blank", "noopener");
  }
}

function getSlideThumb(slide) {
  const source = slide?.data?.element;
  if (!source) return null;
  return source.matches?.("img") ? source : source.querySelector?.("img");
}

function syncThumbRadiusTransition(img, pswp) {
  if (!img) return;
  const duration = pswp.element
    ? getComputedStyle(pswp.element).getPropertyValue("--pswp-transition-duration").trim()
    : "";
  img.style.transitionDuration = duration || "";
  img.style.transitionTimingFunction = "cubic-bezier(0.4, 0, 0.22, 1)";
}

function cleanupThumbRadiusTransition(img) {
  if (!img) return;
  img.style.removeProperty("transition-duration");
  img.style.removeProperty("transition-timing-function");
}

function transitionThumbRadiusFlat(img, pswp) {
  if (!img) return;
  syncThumbRadiusTransition(img, pswp);
  img.getBoundingClientRect();
  img.classList.add("is-lightbox-radius-flat");
}

function hideThumbBehindLightbox(img, pswp) {
  if (!img) return;
  syncThumbRadiusTransition(img, pswp);
  img.getBoundingClientRect();
  img.classList.add("is-lightbox-thumb-hidden");
}

function revealThumbAfterClose(img, onDone) {
  if (!img) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      img.getBoundingClientRect();
      img.classList.remove("is-lightbox-thumb-hidden", "is-lightbox-thumb-fade");
      onDone?.();
    });
  });
}

function restoreThumbRadiusInstant(img) {
  if (!img) return;
  img.classList.add("is-lightbox-radius-instant");
  img.classList.remove("is-lightbox-radius-flat");
  cleanupThumbRadiusTransition(img);
  requestAnimationFrame(() => img.classList.remove("is-lightbox-radius-instant"));
}

function transitionPhotoSwipeImageRadius(pswp, radius) {
  pswp.element?.querySelectorAll(".pswp__img").forEach((img) => {
    img.classList.add("pswp__img--radius-transition");
    img.style.borderRadius = radius;
  });
}

function initLightboxRadiusTransition(pswp) {
  let thumb = null;
  const flatThumbs = new Set();
  const hiddenThumbs = new Set();

  const keepThumbFlat = (img) => {
    if (!img) return;
    flatThumbs.add(img);
    transitionThumbRadiusFlat(img, pswp);
  };

  const hideThumb = (img) => {
    if (!img) return;
    hiddenThumbs.add(img);
    hideThumbBehindLightbox(img, pswp);
  };

  const revealThumb = (img) => {
    if (!img) return;
    img.classList.remove("is-lightbox-thumb-hidden", "is-lightbox-thumb-fade");
    hiddenThumbs.delete(img);
  };

  const resetInactiveThumbs = (activeThumb) => {
    flatThumbs.forEach((img) => {
      if (img === activeThumb) return;
      restoreThumbRadiusInstant(img);
      revealThumb(img);
      flatThumbs.delete(img);
    });
  };

  pswp.on("contentAppendImage", ({ content }) => {
    const img = content?.element;
    if (!(img instanceof HTMLImageElement)) return;
    img.classList.add("pswp__img--radius-transition");
    img.style.borderRadius = "16px";
    requestAnimationFrame(() => {
      img.style.borderRadius = "0px";
    });
  });

  pswp.on("openingAnimationStart", () => {
    hideSiteTooltip();
    thumb = getSlideThumb(pswp.currSlide);
    hideThumb(thumb);
    keepThumbFlat(thumb);
    requestAnimationFrame(() => transitionPhotoSwipeImageRadius(pswp, "0px"));
  });

  pswp.on("closingAnimationStart", () => {
    hideSiteTooltip();
    thumb = getSlideThumb(pswp.currSlide) || thumb;
    resetInactiveThumbs(thumb);
    transitionPhotoSwipeImageRadius(pswp, "0px");
  });

  pswp.on("closingAnimationEnd", () => {
    cleanupThumbRadiusTransition(thumb);
    restoreThumbRadiusInstant(thumb);
    revealThumbAfterClose(thumb, () => hiddenThumbs.delete(thumb));
    flatThumbs.delete(thumb);
  });

  pswp.on("destroy", () => {
    hideSiteTooltip();
    flatThumbs.forEach((img) => {
      restoreThumbRadiusInstant(img);
    });
    flatThumbs.clear();
    hiddenThumbs.forEach((img) => revealThumb(img));
    hiddenThumbs.clear();
    cleanupThumbRadiusTransition(thumb);
    thumb?.classList.remove(
      "is-lightbox-radius-flat",
      "is-lightbox-radius-instant",
      "is-lightbox-thumb-hidden",
      "is-lightbox-thumb-fade",
    );
    thumb = null;
  });
}

function syncFullscreenButton(button) {
  const isFullscreen = Boolean(document.fullscreenElement);
  const label = isFullscreen ? "Quitter le plein écran" : "Plein écran";
  const path = button.querySelector("path");

  path?.setAttribute("d", isFullscreen ? CLOSE_FULLSCREEN_ICON_PATH : FULLSCREEN_ICON_PATH);
  enhancePhotoSwipeButton(button, label);
}

function initLightboxZoomLock(pswp) {
  const root = pswp.element;
  if (!root) return;

  const preventGesture = (event) => {
    event.preventDefault();
  };
  const preventZoomWheel = (event) => {
    if (event.ctrlKey || event.metaKey) event.preventDefault();
  };

  root.addEventListener("wheel", preventZoomWheel, { passive: false });
  root.addEventListener("gesturestart", preventGesture, { passive: false });
  root.addEventListener("gesturechange", preventGesture, { passive: false });
  root.addEventListener("gestureend", preventGesture, { passive: false });
  pswp.on("destroy", () => {
    root.removeEventListener("wheel", preventZoomWheel);
    root.removeEventListener("gesturestart", preventGesture);
    root.removeEventListener("gesturechange", preventGesture);
    root.removeEventListener("gestureend", preventGesture);
  });
}

function initLightboxDesktopImageClickClose(pswp) {
  let cleanup = null;
  let imagePointer = null;
  const isMousePointer = (event) =>
    event.pointerType === "mouse" || event.type === "mousedown" || event.type === "mouseup";
  const isLightboxImage = (target) =>
    target instanceof Element && target.classList.contains("pswp__img");

  const onPointerDown = (event) => {
    if (event.button !== 0 || !isMousePointer(event) || !isLightboxImage(event.target)) {
      imagePointer = null;
      return;
    }

    imagePointer = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  };

  const onPointerUp = (event) => {
    if (!imagePointer || !isMousePointer(event) || !isLightboxImage(event.target)) {
      imagePointer = null;
      return;
    }

    const samePointer =
      event.pointerId === imagePointer.id || event.type === "mouseup";
    const moved =
      Math.abs(event.clientX - imagePointer.x) > 8 ||
      Math.abs(event.clientY - imagePointer.y) > 8;

    imagePointer = null;

    if (!samePointer || moved) return;

    event.preventDefault();
    event.stopPropagation();
    pswp.close();
  };

  const bind = () => {
    const root = pswp.element;
    if (!root || cleanup) return;

    root.addEventListener("mousedown", onPointerDown, true);
    root.addEventListener("pointerdown", onPointerDown, true);
    root.addEventListener("pointerup", onPointerUp, true);
    root.addEventListener("mouseup", onPointerUp, true);

    cleanup = () => {
      root.removeEventListener("mousedown", onPointerDown, true);
      root.removeEventListener("pointerdown", onPointerDown, true);
      root.removeEventListener("pointerup", onPointerUp, true);
      root.removeEventListener("mouseup", onPointerUp, true);
      imagePointer = null;
    };
  };

  bind();
  pswp.on("afterInit", bind);
  pswp.on("bindEvents", bind);
  pswp.on("destroy", () => {
    cleanup?.();
    cleanup = null;
  });
}

function removePhotoSwipeZoomUi(pswp) {
  const root = pswp.element;
  if (!root) return;

  root.classList.remove("pswp--zoom-allowed", "pswp--click-to-zoom", "pswp--zoomed-in");
  root
    .querySelectorAll(
      [
        ".pswp__button--zoom",
        ".pswp__button--zoom-in",
        ".pswp__button--zoom-out",
        "[aria-label='Zoom']",
        "[title='Zoom']",
      ].join(","),
    )
    .forEach((element) => element.remove());
}

const lightbox = new PhotoSwipeLightbox({
  gallery: ".site-prose",
  children: "a[data-pswp-item]",
  pswpModule: PhotoSwipe,
  mainClass: "pswp--system-zoom",
  initialZoomLevel: "fit",
  secondaryZoomLevel: "fit",
  maxZoomLevel: "fit",
  wheelToZoom: false,
  zoom: false,
  allowPanToNext: true,
  pinchToClose: false,
  closeOnVerticalDrag: true,
  imageClickAction: "close",
  doubleTapAction: false,
  arrowPrevTitle: "Image précédente",
  arrowNextTitle: "Image suivante",
  closeTitle: "Fermer",
});

lightbox.on("uiRegister", () => {
  const pswp = lightbox.pswp;
  const ui = pswp?.ui;
  if (!pswp || !ui) return;

  initLightboxRadiusTransition(pswp);
  initLightboxZoomLock(pswp);
  initLightboxDesktopImageClickClose(pswp);

  ui.uiElementsData = ui.uiElementsData.filter((element) => {
    const name = String(element.name || element.className || "");
    return !name.toLowerCase().includes("zoom");
  });

  const fullscreenButtons = new Set();
  const syncFullscreenButtons = () => {
    fullscreenButtons.forEach((button) => {
      if (!button.isConnected) {
        fullscreenButtons.delete(button);
        return;
      }

      syncFullscreenButton(button);
    });
  };

  document.addEventListener("fullscreenchange", syncFullscreenButtons);
  pswp.on("destroy", () => {
    document.removeEventListener("fullscreenchange", syncFullscreenButtons);
    fullscreenButtons.clear();
  });

  const localizeButtons = () => {
    const labels = {
      ".pswp__button--arrow--prev": "Image précédente",
      ".pswp__button--arrow--next": "Image suivante",
      ".pswp__button--close": "Fermer",
      ".pswp__button--fullscreen": "Plein écran",
      ".pswp__button--open-new": "Visualiser",
      ".pswp__button--download": "Télécharger",
      ".pswp__button--share": "Partager",
    };

    for (const [selector, label] of Object.entries(labels)) {
      pswp.element?.querySelectorAll(selector).forEach((button) => {
        if (selector === ".pswp__button--fullscreen") {
          fullscreenButtons.add(button);
          syncFullscreenButton(button);
        } else {
          enhancePhotoSwipeButton(button, label);
        }
      });
    }
  };

  const enhanceButtons = () => {
    requestAnimationFrame(() => {
      removePhotoSwipeZoomUi(pswp);
      localizeButtons();
    });
  };

  pswp.on("uiElementCreate", ({ data }) => {
    const name = String(data.name || data.className || "");
    if (name.toLowerCase().includes("zoom")) data.html = "";
  });
  pswp.on("afterInit", enhanceButtons);
  pswp.on("bindEvents", enhanceButtons);
  pswp.on("change", enhanceButtons);
  pswp.on("zoomPanUpdate", () => removePhotoSwipeZoomUi(pswp));

  if (!window.matchMedia("(pointer: coarse)").matches && window.innerWidth >= 768) {
    ui.registerElement({
      name: "custom-fullscreen",
      order: 1,
      appendTo: "bar",
      isButton: true,
      tagName: "button",
      className:
        "pswp__button custom pswp__button--fullscreen mat-mdc-button-base mat-mdc-icon-button",
      ariaLabel: "Plein écran",
      html: `<svg aria-hidden="true" class="pswp__icn" width="32" height="32" viewBox="0 -960 960 960"><path fill="currentColor" d="${FULLSCREEN_ICON_PATH}"/></svg>`,
      onInit: (el) => {
        fullscreenButtons.add(el);
        syncFullscreenButton(el);
      },
      onClick: (_event, el, instance) => {
        const root = instance.element || document.documentElement;
        if (!document.fullscreenElement) {
          root.requestFullscreen?.()?.catch?.(() => {});
        } else {
          document.exitFullscreen?.()?.catch?.(() => {});
        }
        requestAnimationFrame(() => syncFullscreenButton(el));
      },
    });
  }

  ui.registerElement({
    name: "open-new-tab",
    order: 112,
    appendTo: "bar",
    isButton: true,
    tagName: "a",
    className:
      "pswp__button custom pswp__button--open-new mat-mdc-button-base mat-mdc-icon-button",
    ariaLabel: "Visualiser",
    html: `<svg aria-hidden="true" class="pswp__icn" width="32" height="32" viewBox="0 -960 960 960"><path fill="currentColor" d="${OPEN_IMAGE_ICON_PATH}"/></svg>`,
    onInit: (el, instance) => {
      const link = el;
      const syncHref = () => {
        const src = instance.currSlide?.data?.src;
        if (src) {
          link.setAttribute("href", src);
          link.setAttribute("target", "_blank");
          link.setAttribute("rel", "noopener");
        } else {
          link.removeAttribute("href");
        }
      };

      enhancePhotoSwipeButton(link, "Visualiser");
      syncHref();
      instance.on("change", syncHref);
    },
  });

  ui.registerElement({
    name: "download",
    order: 110,
    appendTo: "bar",
    isButton: true,
    tagName: "button",
    className:
      "pswp__button pswp__button--download custom mat-mdc-button-base mat-mdc-icon-button",
    ariaLabel: "Télécharger",
    html: '<svg aria-hidden="true" class="pswp__icn" viewBox="0 -960 960 960" width="32" height="32"><path d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z" fill="currentColor"/></svg>',
    onInit: (el) => enhancePhotoSwipeButton(el, "Télécharger"),
    onClick: async (_event, _el, instance) => {
      const src = instance.currSlide?.data?.src;
      if (!src) return;

      try {
        await downloadViaFetch(src, fileNameFromURL(src));
      } catch {
        window.open(src, "_blank", "noopener");
      }
    },
  });

  ui.registerElement({
    name: "share-image",
    order: 111,
    appendTo: "bar",
    isButton: true,
    tagName: "button",
    className:
      "pswp__button custom pswp__button--share mat-mdc-button-base mat-mdc-icon-button",
    ariaLabel: "Partager",
    html: `<svg aria-hidden="true" class="pswp__icn" viewBox="0 -960 960 960" width="32" height="32"><path d="${SHARE_IMAGE_ICON_PATH}" fill="currentColor"/></svg>`,
    onInit: (el) => enhancePhotoSwipeButton(el, "Partager"),
    onClick: async (_event, el, instance) => {
      const src = instance.currSlide?.data?.src;
      if (!src) return;

      await sharePhotoSwipeImage(src, el);
    },
  });

  ui.registerElement({
    name: "custom-close",
    order: 120,
    appendTo: "bar",
    isButton: true,
    tagName: "button",
    className:
      "pswp__button custom pswp__button--close mat-mdc-button-base mat-mdc-icon-button",
    ariaLabel: "Fermer",
    html: '<svg aria-hidden="true" class="pswp__icn" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" width="32" height="32"><path fill="currentColor" d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>',
    onInit: (el) => enhancePhotoSwipeButton(el, "Fermer"),
    onClick: (_event, _el, instance) => instance.close(),
  });
});

let isLightboxInitialized = false;

function initLightbox() {
  wrapMarkdownImages();

  if (isLightboxInitialized) {
    try {
      lightbox.refresh();
    } catch {}
    return;
  }

  lightbox.init();
  isLightboxInitialized = true;
}

function initApp() {
  initLocalDateTimes();
  initManualMaterialRipples();
  initSiteTooltips();
  initMuiTooltips();
  initCodeBlocks();
  initLightbox();
  initKeyboardAccessibleTargets();
  initDynamicAnchors();
  if (document.body?.dataset.scrollUi === "off") {
    removeScrollUi();
    initBackToTopButton();
  } else {
    initScrollProgressBar();
    initBackToTopButton();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp, { once: true });
} else {
  initApp();
}

addEventListener("astro:page-load", initApp);
