# Architecture

> Ce document est une référence technique. Pour découvrir le projet ou publier un article, commencez
> par le [guide du débutant](guide-du-debutant.md) et le guide
> [Publier un article](publier-un-article.md). Le rôle des contrôles est expliqué sans jargon dans
> [Commandes et contrôles](commandes-et-controles.md).

## Roles

- Astro owns page structure, routing, layouts, content collections, and static rendering.
- MD/MDX owns editorial content.
- Interactive interface code stays framework-independent: Astro renders the structure, Material Web
  supplies the supported controls, and native browser modules own lifecycle and state.
- Browser scripts in `src/assets/js/app` own progressive enhancement shared across pages.
- Shared public names live in `src/lib/site-contracts.ts`.

## MD/MDX publishing contract

Articles live exclusively in `src/content/blog` as `.md` or `.mdx` files. Astro owns the article
route and renders its H1, dates, metadata, comments, and discovery attributes. An article body must
therefore start below H1 (normally at `##`) and must not repeat the title as a Markdown H1. Creation
and modification dates come from Git; they are not frontmatter fields.

The frontmatter contract is validated by `src/content.config.ts`:

- `title` is required, trimmed, and contains between 1 and 160 characters.
- `description` is a trimmed string between 1 and 320 characters. It may be omitted while
  `listed: false`, but is required before publication.
- `listed` is a boolean. The schema keeps `true` as its compatibility default, so new files should
  always write it explicitly; the generator safely writes `false` unless `--publish` is passed.
- `tags` defaults to `[]` and accepts at most 12 unique tags. Each tag contains 1 to 48 URL-safe
  characters, starts with a letter or number, then uses only letters, numbers, dots, underscores,
  plus signs, or hyphens. `all` is reserved and added by the site.
- `priority` is optional and, when present, is an integer from 0 to 100 used as search metadata.

Create a private draft with:

```sh
pnpm new:post "Titre de l’article"
```

The command refuses filename collisions and creates a non-listed `.md` file without a duplicate
H1 or an empty description. A draft remains reachable at `/posts/<slug>/` for direct review, but is
absent from the home page, tag routes, latest-posts JSON, RSS, sitemap, and Pagefind. Its displayed
tags are labels rather than links to routes that do not exist.

To publish directly, provide the summary explicitly:

```sh
pnpm new:post "Titre de l’article" --description "Résumé utile et autonome." --publish
```

For an existing draft, finish the body and description, then change `listed` to `true`. The next
build exposes it through every discovery surface. No Astro page or component edit is required.

`pnpm check:content` inspects the generated site after Pagefind indexing and before HTML
minification. It fails on missing internal routes or assets, missing anchors, unsafe JavaScript
URLs, a missing or duplicate H1/canonical, a canonical that does not match its route, a mismatch
between `listed` and RSS/sitemap/Pagefind, a leaked/misconfigured Pagefind placeholder, inline
`<style>` blocks, or a stylesheet that is not emitted as a versioned `/_astro/*.css` asset. Both
`pnpm build` and `pnpm build:debug` run this check automatically.

## Material Web boundary

- `src/assets/js/material-web.js` is the explicit registry of imported Material Web components.
- `scripts/generate-material-theme.ts` generates the Material 3 color roles from `#1565C0` with
  Material Color Utilities. Dark mode only overrides the page background role to pure black;
  component surfaces keep their generated Material roles.
- Markdown shortcodes are parsed at build time by
  `src/lib/remark-hugo-material-shortcodes.mjs`. Buttons, icons, progress and tabs emit genuine
  `md-*` elements.
- Material Web does not ship every Material 3 pattern. Cards, data tables, disclosures, tooltips and
  snackbars therefore remain semantic HTML or existing infrastructure; the site must not invent
  unsupported `md-*` element names.
- Progress follows the Material 3 timing and placement rules: no indicator below 200 ms; one
  indeterminate loading indicator for an unknown short wait; a determinate indicator only when a
  real value is available; one indicator per group. Linear indicators sit on a container edge and
  circular indicators are centered in the element being loaded.
- Button variants express hierarchy rather than decoration: use a single filled primary action,
  elevated buttons only when separation from a prominent background is needed, and sentence-case
  labels of one to three words when possible.

## Naming

- Files and folders use kebab-case.
- CSS classes, custom events, storage keys, cookies, and cache names use kebab-case.
- TypeScript variables and functions use camelCase.
- TypeScript classes and interfaces use PascalCase.
- Legacy storage or cookie names may keep their original shape only inside `SITE_LEGACY_*`.

## Persisted Browser Data

Version suffixes such as `v1`, `v3`, or `v8` belong to browser-persisted data formats.
They are incremented when the stored JSON, cache content, or meaning changes enough that old data should not be trusted as current data.

Examples:

- `ct-cookie-consent-v2`: individual optional-services consent payload.
- `ct-explicit-content-ack-v1`: explicit image warning acknowledgement.
- `site-ip-geolocation-v3`: IP geolocation cache format.
- `home-konachan-backgrounds-v8`: selected home background manifest cache format.
- `home-konachan-backgrounds-v4`: Cache Storage bucket for fetched Konachan JSON responses.

When renaming a persisted key, keep a legacy key and migrate on read before deleting the old value.

## Image preview

`src/components/image-preview/image-preview.astro` renders the genuine Material Web dialogs, menu,
icon buttons, and progress element. `src/assets/js/app/image-preview.js` owns image discovery,
history, zoom, fullscreen, sharing, downloads, and focus/scroll restoration. Native `title`
attributes provide tooltips because Material Web does not ship a stable tooltip component.

## Konachan Contract

Home background refresh is event-driven so the Astro shell, Material Web icon buttons, and browser
script stay decoupled.

- `konachan:refresh-request`: emitted by the refresh button.
- `konachan:refresh-state`: emitted by the home background script with `{ busy, status }`.

The authoring manifest, downloader, and generated images live in the private
`c2tz/ct-blog-landing-img` repository. Trusted Vercel builds clone it through a read-only deploy
key, validate every declared WebP, and stage only the compact runtime manifest plus browser assets.
Pull requests and local development use abstract fixtures, so no private asset or credential is
present in this public repository. Every build fails if the runtime contract, dimensions, file
set, or 40 KiB manifest budget is invalid.

## Checks

Use `pnpm verify` before pushing. It covers unit tests, generated theme parity, Astro type checking,
Material Symbol coverage, unused-code checks, formatting, the production build, security headers,
and browser smoke tests.
