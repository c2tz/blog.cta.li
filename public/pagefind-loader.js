const moduleUrl = new URL("/pagefind/pagefind.js", import.meta.url);
const retry = new URL(import.meta.url).searchParams.get("retry");
if (retry) moduleUrl.searchParams.set("retry", retry);

try {
  const pagefind = await import(moduleUrl.href);
  globalThis.__pagefindModule = pagefind;
  globalThis.dispatchEvent(new CustomEvent("site:pagefind-loaded", { detail: pagefind }));
} catch {
  globalThis.dispatchEvent(
    new CustomEvent("site:pagefind-error", { detail: { url: import.meta.url } }),
  );
}
