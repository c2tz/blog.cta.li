# Architecture

## Roles

- Astro owns page structure, routing, layouts, content collections, and static rendering.
- MD/MDX owns editorial content.
- Angular owns interactive UI components that need state, Material components, or lifecycle hooks.
- Browser scripts in `src/assets/js/app` own progressive enhancement shared across pages.
- Shared public names live in `src/lib/site-contracts.ts`.

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

Use `pnpm verify` before pushing. It runs:

1. `astro sync`
2. Angular template/type checking with `ngc`
3. `astro build`

`astro check` is not part of `verify` because the current Astro checker reports false positives on Analog Angular islands even when the production build succeeds.
