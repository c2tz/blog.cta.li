import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { relative, resolve, sep } from "node:path";
import { gunzipSync } from "node:zlib";

import { parse } from "parse5";

const DEFAULT_DIST_DIRECTORY = resolve("dist");
const DEFAULT_SITE_ORIGIN = "https://ct-blog.cta.li";
const PAGEFIND_PLACEHOLDER_PATH = "/posts/pagefind-index-placeholder/";
const PAGEFIND_PLACEHOLDER_TOKEN = "pagefind-internal-placeholder-4d6af32b";
const URL_ATTRIBUTES = new Set(["action", "data", "href", "poster", "src"]);
const IGNORED_PROTOCOLS = new Set(["blob:", "mailto:", "tel:"]);

async function listFiles(directory, root = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(absolutePath, root)));
    } else if (entry.isFile()) {
      files.push(relative(root, absolutePath).split(sep).join("/"));
    }
  }

  return files;
}

function walkElements(node, elements = []) {
  if (node && typeof node === "object" && "tagName" in node) elements.push(node);
  for (const child of node?.childNodes ?? []) walkElements(child, elements);
  if (node?.content) walkElements(node.content, elements);
  return elements;
}

function getAttribute(element, name) {
  return element.attrs?.find((attribute) => attribute.name === name)?.value;
}

function hasAttribute(element, name) {
  return element.attrs?.some((attribute) => attribute.name === name) ?? false;
}

function hasClass(element, className) {
  return (getAttribute(element, "class") ?? "").split(/\s+/).includes(className);
}

function outputPathToRoute(outputPath) {
  if (outputPath === "index.html") return "/";
  if (outputPath === "404.html") return "/404/";
  if (outputPath.endsWith("/index.html")) {
    return `/${outputPath.slice(0, -"index.html".length)}`;
  }
  return `/${outputPath}`;
}

function pathVariants(pathname) {
  const variants = new Set([pathname]);
  try {
    variants.add(decodeURIComponent(pathname));
  } catch {
    // The URL constructor already rejected malformed URLs; keep the encoded path as a fallback.
  }
  return variants;
}

function outputCandidates(pathname) {
  const candidates = new Set();
  if (pathname === "/404/") candidates.add("404.html");
  for (const variant of pathVariants(pathname)) {
    const relativePath = variant.replace(/^\/+/, "");
    if (!relativePath || variant.endsWith("/")) {
      candidates.add(`${relativePath}index.html`);
    } else {
      candidates.add(relativePath);
      candidates.add(`${relativePath}/index.html`);
    }
  }
  return [...candidates];
}

function srcsetUrls(value) {
  if (value.trim().startsWith("data:")) return [value.trim()];
  return value
    .split(",")
    .map((candidate) => candidate.trim().split(/\s+/, 1)[0])
    .filter(Boolean);
}

function referenceValues(element) {
  const references = [];
  for (const attribute of element.attrs ?? []) {
    if (URL_ATTRIBUTES.has(attribute.name)) references.push(attribute.value);
    if (attribute.name === "srcset") references.push(...srcsetUrls(attribute.value));
  }
  return references;
}

function addIssue(issues, message) {
  issues.add(message);
}

function decodeXmlText(value) {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function xmlRoutes(source, elementName, siteOrigin) {
  const routes = new Set();
  const elementPattern = new RegExp(
    `<${elementName}(?:\\s[^>]*)?>([\\s\\S]*?)</${elementName}>`,
    "gi",
  );

  for (const match of source.matchAll(elementPattern)) {
    try {
      const url = new URL(decodeXmlText(match[1]?.trim() ?? ""), siteOrigin);
      if (url.origin === siteOrigin) routes.add(url.pathname);
    } catch {
      // Malformed feed URLs are already outside the generated publishing contract.
    }
  }

  return routes;
}

async function readPage(distDirectory, outputPath) {
  const source = await readFile(resolve(distDirectory, outputPath), "utf8");
  const document = parse(source);
  const elements = walkElements(document);
  const ids = new Set(
    elements
      .flatMap((element) => [getAttribute(element, "id"), getAttribute(element, "name")])
      .filter(Boolean),
  );

  return {
    document,
    elements,
    ids,
    outputPath,
    route: outputPathToRoute(outputPath),
    source,
  };
}

async function readPagefindFragments(distDirectory, files, issues) {
  const fragments = [];
  const fragmentPaths = files.filter(
    (file) => file.startsWith("pagefind/fragment/") && file.endsWith(".pf_fragment"),
  );

  for (const fragmentPath of fragmentPaths) {
    try {
      const compressed = await readFile(resolve(distDirectory, fragmentPath));
      const inflated = gunzipSync(compressed).toString("utf8");
      const jsonStart = inflated.indexOf("{");
      if (jsonStart === -1) throw new Error("missing JSON payload");
      fragments.push(JSON.parse(inflated.slice(jsonStart)));
    } catch (error) {
      addIssue(
        issues,
        `${fragmentPath}: impossible de vérifier le fragment Pagefind (${error instanceof Error ? error.message : error})`,
      );
    }
  }

  return fragments;
}

export async function collectBuiltContentIssues({
  distDirectory = DEFAULT_DIST_DIRECTORY,
  siteOrigin = DEFAULT_SITE_ORIGIN,
} = {}) {
  const normalizedSiteOrigin = new URL(siteOrigin).origin;
  const files = await listFiles(distDirectory);
  const fileSet = new Set(files);
  const htmlPaths = files.filter((file) => file.endsWith(".html")).sort();
  const pages = await Promise.all(htmlPaths.map((file) => readPage(distDirectory, file)));
  const pageByOutputPath = new Map(pages.map((page) => [page.outputPath, page]));
  const issues = new Set();
  let checkedReferences = 0;

  if (!fileSet.has("rss.xml")) addIssue(issues, "Publication: flux RSS absent");
  if (!fileSet.has("sitemap.xml")) addIssue(issues, "Publication: sitemap absent");

  if (fileSet.has("posts/pagefind-index-placeholder/index.html")) {
    addIssue(issues, `${PAGEFIND_PLACEHOLDER_PATH}: la route Pagefind temporaire existe encore`);
  }

  for (const page of pages) {
    const h1Elements = page.elements.filter((element) => element.tagName === "h1");
    if (h1Elements.length !== 1) {
      addIssue(issues, `${page.route}: ${h1Elements.length} H1 trouvé(s), 1 attendu`);
    }

    const inlineStyles = page.elements.filter((element) => element.tagName === "style");
    if (inlineStyles.length > 0) {
      addIssue(
        issues,
        `${page.route}: ${inlineStyles.length} bloc(s) style inline trouvé(s), CSS externe attendu`,
      );
    }

    const stylesheetLinks = page.elements.filter(
      (element) =>
        element.tagName === "link" &&
        (getAttribute(element, "rel") ?? "")
          .split(/\s+/)
          .some((token) => token.toLowerCase() === "stylesheet"),
    );
    if (stylesheetLinks.length === 0) {
      addIssue(issues, `${page.route}: aucune feuille CSS externe trouvée`);
    }
    for (const stylesheet of stylesheetLinks) {
      const href = getAttribute(stylesheet, "href") ?? "";
      let stylesheetUrl;
      try {
        stylesheetUrl = new URL(href, normalizedSiteOrigin);
      } catch {
        addIssue(issues, `${page.route}: feuille CSS invalide ${JSON.stringify(href)}`);
        continue;
      }
      if (
        stylesheetUrl.origin !== normalizedSiteOrigin ||
        !/^\/_astro\/[^/]+\.css$/.test(stylesheetUrl.pathname)
      ) {
        addIssue(
          issues,
          `${page.route}: feuille CSS non versionnée hors /_astro ${JSON.stringify(href)}`,
        );
      }
    }

    const canonicalLinks = page.elements.filter(
      (element) =>
        element.tagName === "link" &&
        (getAttribute(element, "rel") ?? "")
          .split(/\s+/)
          .some((token) => token.toLowerCase() === "canonical"),
    );
    if (canonicalLinks.length !== 1) {
      addIssue(
        issues,
        `${page.route}: ${canonicalLinks.length} lien(s) canonical trouvé(s), 1 attendu`,
      );
    } else {
      const canonicalHref = getAttribute(canonicalLinks[0], "href");
      const expectedCanonical = new URL(page.route, normalizedSiteOrigin).toString();
      if (canonicalHref !== expectedCanonical) {
        addIssue(
          issues,
          `${page.route}: canonical ${JSON.stringify(canonicalHref)} au lieu de ${expectedCanonical}`,
        );
      }
    }

    if (page.source.includes(PAGEFIND_PLACEHOLDER_TOKEN)) {
      addIssue(
        issues,
        `${page.route}: le marqueur Pagefind temporaire est rendu dans une vraie page`,
      );
    }

    for (const element of page.elements) {
      for (const value of referenceValues(element)) {
        if (!value || value === "#") continue;
        let target;
        try {
          target = new URL(value, new URL(page.route, normalizedSiteOrigin));
        } catch {
          addIssue(issues, `${page.route}: URL invalide ${JSON.stringify(value)}`);
          continue;
        }

        if (
          target.protocol === "javascript:" ||
          target.protocol === "vbscript:" ||
          target.protocol === "data:"
        ) {
          addIssue(
            issues,
            `${page.route}: protocole URL interdit ${target.protocol} ${JSON.stringify(value)}`,
          );
          continue;
        }
        if (IGNORED_PROTOCOLS.has(target.protocol) || target.origin !== normalizedSiteOrigin) {
          continue;
        }

        checkedReferences += 1;
        const candidates = outputCandidates(target.pathname);
        const targetOutputPath = candidates.find((candidate) => fileSet.has(candidate));
        if (!targetOutputPath) {
          addIssue(issues, `${page.route}: cible interne absente ${target.pathname}`);
          continue;
        }

        if (target.hash && targetOutputPath.endsWith(".html")) {
          const targetPage = pageByOutputPath.get(targetOutputPath);
          let anchor;
          try {
            anchor = decodeURIComponent(target.hash.slice(1));
          } catch {
            anchor = target.hash.slice(1);
          }
          if (anchor && targetPage && !targetPage.ids.has(anchor)) {
            addIssue(issues, `${page.route}: ancre absente ${target.pathname}${target.hash}`);
          }
        }
      }
    }
  }

  const pagefindFragments = await readPagefindFragments(distDirectory, files, issues);
  const fragmentUrls = new Set(pagefindFragments.map((fragment) => fragment.url));
  const placeholderFragments = pagefindFragments.filter(
    (fragment) => fragment.url === PAGEFIND_PLACEHOLDER_PATH,
  );
  if (fileSet.has("pagefind/pagefind-entry.json") && placeholderFragments.length !== 1) {
    addIssue(
      issues,
      `Pagefind: ${placeholderFragments.length} document(s) temporaire(s) trouvé(s), 1 attendu`,
    );
  }
  for (const fragment of placeholderFragments) {
    if (!fragment.filters?.internal?.includes("placeholder")) {
      addIssue(issues, "Pagefind: le document temporaire n'a pas son filtre internal:placeholder");
    }
  }
  for (const fragment of pagefindFragments) {
    if (
      fragment.url !== PAGEFIND_PLACEHOLDER_PATH &&
      String(fragment.content ?? "").includes(PAGEFIND_PLACEHOLDER_TOKEN)
    ) {
      addIssue(issues, `Pagefind: le marqueur temporaire fuit dans ${fragment.url}`);
    }
  }

  const postPages = pages.filter((page) => page.route.startsWith("/posts/"));
  const listedPostRoutes = [];
  const hiddenPostRoutes = [];
  for (const page of postPages) {
    const article = page.elements.find(
      (element) => element.tagName === "article" && hasClass(element, "post"),
    );
    if (!article) continue;
    const isListed = hasAttribute(article, "data-pagefind-body");
    (isListed ? listedPostRoutes : hiddenPostRoutes).push(page.route);
  }

  for (const route of listedPostRoutes) {
    if (!fragmentUrls.has(route)) {
      addIssue(issues, `${route}: article listé absent de Pagefind`);
    }
  }
  for (const route of hiddenPostRoutes) {
    if (fragmentUrls.has(route)) {
      addIssue(issues, `${route}: article non listé présent dans Pagefind`);
    }
  }

  const rss = fileSet.has("rss.xml")
    ? await readFile(resolve(distDirectory, "rss.xml"), "utf8")
    : "";
  const sitemap = fileSet.has("sitemap.xml")
    ? await readFile(resolve(distDirectory, "sitemap.xml"), "utf8")
    : "";
  const rssRoutes = xmlRoutes(rss, "link", normalizedSiteOrigin);
  const sitemapRoutes = xmlRoutes(sitemap, "loc", normalizedSiteOrigin);
  for (const route of listedPostRoutes) {
    if (!rssRoutes.has(route)) {
      addIssue(issues, `${route}: article listé absent du flux RSS`);
    }
    if (!sitemapRoutes.has(route)) {
      addIssue(issues, `${route}: article listé absent du sitemap`);
    }
  }
  for (const route of hiddenPostRoutes) {
    if (rssRoutes.has(route)) {
      addIssue(issues, `${route}: article non listé présent dans le flux RSS`);
    }
    if (sitemapRoutes.has(route)) {
      addIssue(issues, `${route}: article non listé présent dans le sitemap`);
    }
  }

  return {
    issues: [...issues].sort(),
    summary: {
      checkedReferences,
      hiddenPosts: hiddenPostRoutes.length,
      listedPosts: listedPostRoutes.length,
      pagefindFragments: pagefindFragments.length,
      pages: pages.length,
    },
  };
}

export async function checkBuiltContent(options) {
  const result = await collectBuiltContentIssues(options);
  if (result.issues.length > 0) {
    throw new Error(`Vérification du contenu échouée :\n- ${result.issues.join("\n- ")}`);
  }
  return result.summary;
}

async function main() {
  const summary = await checkBuiltContent();
  console.log(
    `Contenu vérifié : ${summary.pages} pages, ${summary.checkedReferences} références internes, ` +
      `${summary.listedPosts} article(s) listé(s), ${summary.hiddenPosts} non listé(s).`,
  );
}

const invokedPath = process.argv[1] && resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
