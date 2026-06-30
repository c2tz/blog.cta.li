export interface PagefindResultData {
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

export interface PagefindResultRef {
  data: () => Promise<PagefindResultData>;
  score: number;
}

export type PagefindFilterCounts = Record<string, Record<string, number>>;
export type PagefindSortDirection = "asc" | "desc";

export interface PagefindSearchOptions {
  filters?: Record<string, string | string[] | { all: string[] } | { any: string[] }>;
  sort?: Record<string, PagefindSortDirection>;
}

export interface PagefindResponse {
  filters?: PagefindFilterCounts;
  results: PagefindResultRef[];
  totalFilters?: PagefindFilterCounts;
  unfilteredResultCount?: number;
}

export interface PagefindModule {
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

function loadPagefindScript() {
  return new Promise<void>((resolve, reject) => {
    if (window.__pagefindModule) {
      resolve();
      return;
    }

    let script = document.querySelector<HTMLScriptElement>(`script[src="${PAGEFIND_LOADER_PATH}"]`);

    const handleLoaded = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("pagefind_loader_failed"));
    };
    const cleanup = () => {
      window.removeEventListener(PAGEFIND_LOADED_EVENT, handleLoaded);
      script?.removeEventListener("error", handleError);
    };

    window.addEventListener(PAGEFIND_LOADED_EVENT, handleLoaded, { once: true });

    if (script) {
      script.addEventListener("error", handleError, { once: true });
      return;
    }

    script = document.createElement("script");
    script.type = "module";
    script.async = true;
    script.src = PAGEFIND_LOADER_PATH;
    script.addEventListener("error", handleError, { once: true });
    document.head.append(script);
  });
}

export async function loadPagefindModule() {
  if (window.__pagefindModule) return window.__pagefindModule;

  await loadPagefindScript();
  if (!window.__pagefindModule) throw new Error("pagefind_module_unavailable");

  return window.__pagefindModule;
}
