// Keep the all-route registry small; route-specific controls live in material-web/.
import "@material/web/button/filled-button.js";
import "@material/web/button/filled-tonal-button.js";
import "@material/web/button/text-button.js";
import "@material/web/chips/chip-set.js";
import "@material/web/divider/divider.js";
import "@material/web/dialog/dialog.js";
import "@material/web/icon/icon.js";
import "@material/web/iconbutton/icon-button.js";
import "@material/web/menu/menu-item.js";
import "@material/web/menu/menu.js";
import "@material/web/progress/circular-progress.js";
import "@material/web/progress/linear-progress.js";
import "@material/web/select/filled-select.js";
import "@material/web/select/select-option.js";
import "@material/web/switch/switch.js";
import "@material/web/textfield/filled-text-field.js";

import { initFocusModality } from "@/assets/js/app/focus-modality";
import { initMaterialMenuFocusIndicators } from "@/assets/js/app/material-menu";

initFocusModality();
initMaterialMenuFocusIndicators();
document.addEventListener("astro:page-load", () => initMaterialMenuFocusIndicators());
