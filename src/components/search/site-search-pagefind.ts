interface PagefindResultData {
  excerpt?: string;
  meta?: {
    created?: string;
    modified?: string;
    priority?: string;
    tags?: string;
    title?: string;
  };
  title?: string;
  url: string;
}

interface PagefindResultRef {
  data: () => Promise<PagefindResultData>;
  raw_url?: string;
  score: number;
}

type PagefindFilterCounts = Record<string, Record<string, number>>;
type PagefindSortDirection = "asc" | "desc";
type PagefindFilterValue = string | string[] | Record<string, string | string[]>;

interface PagefindSearchOptions {
  filters?: Record<string, PagefindFilterValue>;
  sort?: Record<string, PagefindSortDirection>;
}

interface PagefindResponse {
  filters?: PagefindFilterCounts;
  results: PagefindResultRef[];
  totalFilters?: PagefindFilterCounts;
  unfilteredResultCount?: number;
}

interface PagefindModule {
  filters: () => Promise<PagefindFilterCounts>;
  search: (query: string | null, options?: PagefindSearchOptions) => Promise<PagefindResponse>;
}

declare global {
  interface Window {
    __pagefindModule?: PagefindModule;
  }
}

const PAGEFIND_LOADER_PATH = "/pagefind-loader.js";
const PAGEFIND_LOADED_EVENT = "site:pagefind-loaded";
const PAGEFIND_ERROR_EVENT = "site:pagefind-error";
const LOADER_TIMEOUT_MS = 10_000;
let pendingLoad: Promise<void> | undefined;
let loadAttempt = 0;

function loadPagefindScript() {
  if (window.__pagefindModule) return Promise.resolve();
  if (pendingLoad) return pendingLoad;

  pendingLoad = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    const attempt = loadAttempt++;
    // Failed module fetches are cached by browsers, so retries need a fresh URL.
    script.src = attempt ? `${PAGEFIND_LOADER_PATH}?retry=${attempt}` : PAGEFIND_LOADER_PATH;
    script.type = "module";
    script.async = true;
    const handleLoaded = () => {
      if (!window.__pagefindModule) return;
      cleanup();
      resolve();
    };
    const handleError = (event?: Event) => {
      if (event instanceof CustomEvent && event.detail?.url !== script.src) return;
      cleanup();
      script.remove();
      reject(new Error("pagefind_loader_failed"));
    };
    const timeout = window.setTimeout(handleError, LOADER_TIMEOUT_MS);
    const cleanup = () => {
      window.clearTimeout(timeout);
      window.removeEventListener(PAGEFIND_LOADED_EVENT, handleLoaded);
      window.removeEventListener(PAGEFIND_ERROR_EVENT, handleError);
      script.removeEventListener("error", handleError);
    };

    window.addEventListener(PAGEFIND_LOADED_EVENT, handleLoaded);
    window.addEventListener(PAGEFIND_ERROR_EVENT, handleError);
    script.addEventListener("error", handleError, { once: true });
    document.head.append(script);
  }).finally(() => {
    pendingLoad = undefined;
  });
  return pendingLoad;
}

export async function loadPagefindModule() {
  if (window.__pagefindModule) return window.__pagefindModule;

  await loadPagefindScript();
  if (!window.__pagefindModule) throw new Error("pagefind_module_unavailable");

  return window.__pagefindModule;
}
