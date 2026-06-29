import * as pagefind from "/pagefind/pagefind.js";

globalThis.__pagefindModule = pagefind;
globalThis.dispatchEvent(
  new CustomEvent("site:pagefind-loaded", {
    detail: pagefind,
  }),
);
