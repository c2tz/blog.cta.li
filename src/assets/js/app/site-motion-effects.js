import { SITE_EVENTS } from "@/lib/site-contracts";
import { areSiteAnimationsEnabled } from "./site-motion.js";

// Global CSS cannot cross Material's shadow roots. Install the same preference
// before their first render, including controls registered by deferred modules.
const shadowStyles = new Map();
const disabledMotionStyles = `
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
    scroll-behavior: auto !important;
  }
  :host(md-linear-progress[indeterminate]) .primary-bar {
    inset-inline-start: 25% !important;
    transform: scaleX(.5) !important;
  }
  :host(md-linear-progress[indeterminate]) .secondary-bar { display: none !important; }
  :host(md-linear-progress[indeterminate]) .bar-inner { transform: none !important; }
`;

function finishAnimation(animation) {
  if (animation.playState !== "running" && !animation.pending) return;
  // Finishing keeps Material's completion promises and lifecycle events intact.
  // Infinite effects need a finite end time before finish() can settle them.
  animation.effect?.updateTiming({ iterations: 1, duration: 0, delay: 0, endDelay: 0 });
  animation.finish();
}

function syncMotionEffects() {
  const enabled = areSiteAnimationsEnabled();
  const media = enabled ? "not all" : "all";
  const roots = [document];
  for (const [root, style] of shadowStyles) {
    if (!root.host.isConnected) {
      shadowStyles.delete(root);
      continue;
    }
    if (style.media !== media) style.media = media;
    roots.push(root);
  }
  if (!enabled) {
    // Apply every style change before querying animations: each query can flush
    // pending styles. Finish only after all reads, since finish() writes timing.
    const animations = new Set(roots.flatMap((root) => root.getAnimations()));
    animations.forEach(finishAnimation);
  }
}

function trackShadowRoot(root) {
  let style = root.querySelector("style[data-site-motion]");
  if (!style) {
    style = document.createElement("style");
    style.dataset.siteMotion = "";
    style.textContent = disabledMotionStyles;
    root.prepend(style);
  }
  style.media = areSiteAnimationsEnabled() ? "not all" : "all";
  shadowStyles.set(root, style);
  observer.observe(root, { childList: true, subtree: true });
}

function discoverShadowRoots(node) {
  if (!(node instanceof Element)) return;
  if (node.shadowRoot) {
    trackShadowRoot(node.shadowRoot);
    for (const child of node.shadowRoot.children) discoverShadowRoots(child);
  }
  for (const element of node.querySelectorAll("*")) {
    if (element.shadowRoot) {
      trackShadowRoot(element.shadowRoot);
      for (const child of element.shadowRoot.children) discoverShadowRoots(child);
    }
  }
}

const observer = new MutationObserver((records) => {
  for (const record of records) {
    for (const node of record.addedNodes) discoverShadowRoots(node);
  }
});

const attachShadow = Element.prototype.attachShadow;
Element.prototype.attachShadow = function (options) {
  const root = attachShadow.call(this, options);
  trackShadowRoot(root);
  return root;
};

// Material also uses the Web Animations API (ripples, tab indicators, dialogs).
// Zero-duration effects still return real Animation objects to their callers.
const animate = Element.prototype.animate;
Element.prototype.animate = function (keyframes, options) {
  if (!areSiteAnimationsEnabled()) {
    options = {
      ...(typeof options === "object" ? options : {}),
      duration: 0,
      delay: 0,
      endDelay: 0,
      iterations: 1,
    };
  }
  return animate.call(this, keyframes, options);
};

discoverShadowRoots(document.documentElement);
observer.observe(document, { childList: true, subtree: true });
document.addEventListener(SITE_EVENTS.motionChange, syncMotionEffects);
syncMotionEffects();
