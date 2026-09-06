import { SITE_EVENTS } from "@/lib/site-contracts";
import { areSiteAnimationsEnabled } from "./site-motion.js";

const QUICK_CONTROLS = "md-menu, md-filled-select, md-outlined-select, md-dialog";
let initialized = false;
const motionOwners = new WeakSet();
const activeControls = new WeakSet();

function syncControlMotion(control) {
  // Material consults quick again when emitting its closed event. Keep the
  // current value through that lifecycle, then apply the latest preference.
  if (activeControls.has(control) || control.open) return;
  const quick = !areSiteAnimationsEnabled();
  control.toggleAttribute("quick", quick);
  if (customElements.get(control.localName)) control.quick = quick;
}

function syncMaterialMotion(root = document) {
  root.querySelectorAll(QUICK_CONTROLS).forEach((control) => {
    if (!motionOwners.has(control)) {
      motionOwners.add(control);
      control.addEventListener("opening", () => activeControls.add(control));
      control.addEventListener("closed", () => {
        activeControls.delete(control);
        syncControlMotion(control);
      });
    }
    // Attributes also apply to deferred controls before their custom element loads.
    syncControlMotion(control);
  });
}

export function initMaterialMotion(root = document) {
  if (!initialized) {
    initialized = true;
    document.addEventListener(SITE_EVENTS.motionChange, () => syncMaterialMotion());
  }
  syncMaterialMotion(root);
}
