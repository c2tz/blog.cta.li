# Architecture

## Roles

- Astro owns page structure, routing, layouts, content collections, and static rendering.
- MD/MDX owns editorial content.
- New interface code stays framework-independent. Existing Angular islands are temporary state and
  lifecycle controllers while their visible controls migrate to `@material/web`; do not introduce
  new Angular Material UI or make new features depend on Angular.
- Browser scripts in `src/assets/js/app` own progressive enhancement shared across pages.
- Shared public names live in `src/lib/site-contracts.ts`.

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
- TypeScript classes, interfaces, and Angular components use PascalCase.
- Legacy storage or cookie names may keep their original shape only inside `SITE_LEGACY_*`.

## Persisted Browser Data

Version suffixes such as `v1`, `v2`, or `v6` belong to browser-persisted data formats.
They are incremented when the stored JSON, cache content, or meaning changes enough that old data should not be trusted as current data.

Examples:

- `ct-cookie-consent-v1`: consent payload version.
- `ct-explicit-content-ack-v1`: explicit image warning acknowledgement.
- `site-ip-geolocation-v2`: IP geolocation cache format.
- `home-konachan-backgrounds-v6`: selected home background manifest cache format.
- `home-konachan-backgrounds-v2`: Cache Storage bucket for fetched Konachan JSON responses.

When renaming a persisted key, keep a legacy key and migrate on read before deleting the old value.

## PhotoSwipe Contract

PhotoSwipe itself is controlled from `src/assets/js/app/photo-swipe`.
The Angular toolbar does not import PhotoSwipe directly. It communicates through document events.

Toolbar to PhotoSwipe:

- `site:photo-swipe-action`
- detail: `{ action }`
- actions: `close`, `download`, `fullscreen`, `next`, `previous`, `share`, `zoom`

PhotoSwipe to toolbar:

- `site:photo-swipe-state`
- detail includes: `open`, `src`, `fileName`, `index`, `total`, `isFullscreen`, `fullscreenAvailable`, `zoomed`, `loading`, `closing`

Share feedback:

- `site:photo-swipe-share-result`
- detail: `{ message }`

Tooltips are hidden globally through:

- `site:tooltip-hide`

## Konachan Contract

Home background refresh is event-driven so the Astro shell, Angular buttons, and browser script stay decoupled.

- `konachan:refresh-request`: emitted by the refresh button.
- `konachan:refresh-state`: emitted by the home background script with `{ busy, status }`.

## Checks

Use `pnpm verify` before pushing. It covers unit tests, generated theme parity, Angular island type
checking, Material Symbol coverage, unused-code checks, formatting, the production build, security
headers, and browser smoke tests.

`astro check` is not part of `verify` because the current Astro checker reports false positives on Analog Angular islands even when the production build succeeds.
