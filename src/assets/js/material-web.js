import "@/assets/js/app/site-motion-effects.js";
// Keep the all-route registry small; route-specific controls live in material-web/.
import "@material/web/button/filled-button.js";
import "@material/web/button/filled-tonal-button.js";
import "@material/web/button/text-button.js";
import "@material/web/divider/divider.js";
import "@material/web/icon/icon.js";
import "@material/web/iconbutton/icon-button.js";
import "@material/web/menu/menu-item.js";
import "@material/web/menu/menu.js";
import "@material/web/progress/circular-progress.js";
import "@material/web/progress/linear-progress.js";
import "@material/web/switch/switch.js";

import { initFocusModality } from "@/assets/js/app/focus-modality";
import { initMaterialMenuEnhancements } from "@/assets/js/app/material-menu";

initFocusModality();
initMaterialMenuEnhancements();
document.addEventListener("astro:page-load", () => initMaterialMenuEnhancements());
