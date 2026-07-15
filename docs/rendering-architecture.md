# Rendering architecture and performance contract

This document describes the production rendering path at the `2c73092a` baseline and the
performance migration applied on `develop` in July 2026. It is a regression contract: a new
feature should be placed in the latest possible loading phase that still preserves its first
interaction.

## Stack reality

The current application is Astro SSG with Material Web/Lit custom elements and native modules.
It contains no Angular runtime, Astro `client:*` island, Analog adapter, or PhotoSwipe package.
The image preview is the repository's own Material `md-dialog` implementation. Consequently,
the relevant mismatch risk is a custom element being used before upgrade, rather than an
Angular/Astro hydration mismatch.

The post `/posts/markdown-style-guide/` was deliberately deleted by the baseline commit and
replaced as a rendering fixture by `/posts/mdx-smoke-test/`. The migration preserves that route
state and tests the equivalent image-preview behavior on the replacement fixture.

## Execution map

| Surface                 | Static HTML/CSS                                                                   | Initial post-paint code                                                               | Lazy code/network                                                                                                                                               | Consent boundary                                                   |
| ----------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Astro shell             | Header, footer, navigation, post markup, tags, cookie templates and dialog markup | Small base Material registry, theme, cookie controls, tooltips, loading/focus helpers | Route registries selected by DOM presence                                                                                                                       | Explicit-content notice pre-locks the page before interactive code |
| Material 3              | Real `md-*` hosts and local Material Symbols are emitted by Astro                 | Only controls shared by the current shell are registered                              | Search, tags, content, home and image-preview registries are split                                                                                              | None; the components themselves are local                          |
| Search                  | Closed dialog and trigger are static                                              | A small trigger loader only                                                           | Search controller and search Material controls on focus/hover/first click; Pagefind Worker/WASM and index on opening/query                                      | None                                                               |
| Markdown and shortcodes | Shiki HTML, prose and shortcode source markup                                     | A selector gate inspects the rendered prose                                           | Copy controls only for code blocks; shortcode Material runtime only when complex controls exist                                                                 | None                                                               |
| Image preview           | Two Material dialog hosts and the source images                                   | A small capture-phase loader only                                                     | Full controller, dialogs and buttons on focus/hover/first click; share-file fetch after preview intent                                                          | None                                                               |
| Konachan home           | Hero structure and local manifest URL                                             | Lightweight home table and controls required for the visible shell                    | Background controller, color Worker, manifest and selected images after explicit-content acknowledgement                                                        | Explicit-content acknowledgement                                   |
| Giscus                  | Local consent UI and placeholder                                                  | Local controller on post routes                                                       | `giscus.app/client.js` and iframe only after functionality consent plus the separate comments opt-in                                                            | Functionality consent and comments opt-in                          |
| Optional services       | Static IP placeholder and Vercel metadata                                         | No optional service module before consent                                             | IP geolocation and Speed Insights modules/services only after functionality consent; any inserted third-party script is purged by one consent-revocation reload | Functionality consent                                              |
| CSP/Vercel              | CSP hashes and headers are generated from the built HTML                          | No runtime policy relaxation                                                          | Pagefind Worker/WASM and approved external Giscus/IP origins                                                                                                    | Deployment checks gate alias promotion                             |

## Target invariants

1. Astro owns the first render. Custom elements enhance existing markup and never replace the
   page shell with client-rendered HTML.
2. A route loads only the Material registry it uses. Shared controls stay in `material-web.js`;
   search, home, tags, content and image preview have separate entries.
3. A deferred feature has a tiny loader that catches the first pointer or keyboard activation.
   Image preview passes the original target and focus intent directly to its controller, without
   redispatching an event. Search currently finishes its import and replays the requested open
   with one programmatic `button.click()`; focus and hover normally warm that chunk before a
   click.
4. Initializers may cache module imports, but must run again for every `astro:page-load` and new
   DOM. Failed dynamic imports reset their cache so a later interaction can retry.
5. Optional services are not merely prevented from calling their endpoint: their modules are not
   imported before consent. Revoking consent removes an unexecuted service script immediately or
   reloads once if a Speed Insights or Giscus script was inserted, so neither an executed nor an
   in-flight third-party runtime can survive the opt-out. `pageshow` and consent-storage changes
   resynchronize restored BFCache pages and other open tabs.
6. The image preview owns zoomed-image panning and scroll restoration. Browser `ctrl+wheel`/pinch
   remains native, while two-axis trackpad movement pans the preview image inside its bounds. The
   document stays locked during native two-touch visual-viewport panning, and the toolbar follows
   that visual viewport instead of disappearing into the layout viewport.
7. Keyboard focus is cycled explicitly inside both preview dialogs so Safari does not depend on
   the user's full-keyboard-access preference. A focus move made during Material's opening motion
   wins over the later resolution of `show()` instead of being overwritten by autofocus.
8. Native file sharing is prepared after preview intent. The click selects exactly one native
   payload: the `File` when ready and supported, otherwise its URL. A non-cancellation failure
   falls back directly to the clipboard because Web Share consumes transient activation on its
   first invocation.
9. CSP and Vercel headers are checked from the exact minified production output.

## Implemented migration stages

### 1. Remove unconditional work

- Removed sequential Lit warm-up imports.
- Stopped bootstrapping interactive code on the bare 404 page.
- Moved IP geolocation and Speed Insights behind functionality consent.
- Made functionality-consent revocation remove Speed Insights and reload once whenever its script
  had been inserted, including while its response is still in flight.
- Made functionality-consent revocation stop the current document load, remove the Giscus
  script/iframe, reset its loading state and reload once whenever Giscus reached the document.
  Returning consent reloads comments when their separate opt-in is still stored.
- Moved the Konachan background/color path behind explicit-content acknowledgement.

### 2. Split route and interaction registries

- Extracted search and image-preview Material registries.
- Restored `md-select-option` to the content and tags entries that own it.
- Selected code-block and complex-shortcode enhancement by rendered DOM.
- Deferred the search controller and full image-preview controller until user intent.
- Disabled Vite's JavaScript dependency preloads for deferred entries. Intent warming still starts
  the real native module graph, without duplicate `modulepreload` requests or WebKit warnings for
  already evaluated shared modules.

### 3. Harden the image preview

- Added trackpad X/Y panning while browser zoom is active without intercepting native pinch zoom.
- Made initial and information-dialog focus deterministic, added an explicit Safari-safe Tab
  cycle, and guarded it against the asynchronous completion of Material's opening animation.
- Kept real Material icon/text buttons and local icons; unsupported fullscreen remains genuinely
  hidden on WebKit.
- Prepared a native `File` before the share action and preserved transient user activation.
- Reused the prefetched share `File` for displayed MIME/size metadata, retaining `HEAD` only as a
  fallback.
- Kept history, scroll locking/restoration, gallery reset, reduced motion and the toolbar radius
  motion: 16 px → half-height → 16 px (28 px desktop, 26 px mobile).

### 4. Align delivery gates

- Added desktop and iPhone-profile WebKit coverage for the image preview, search, consent,
  Giscus/content and code-block surfaces to the normal Playwright gate.
- Made `develop` pushes run the same build/header and Lighthouse jobs required by its ruleset.
- Synchronized the versioned `main` and `develop` rulesets with the live GitHub rules.
- Documented the obsolete/circular Vercel deployment-check configuration that leaves aliases
  waiting even after GitHub Actions succeeds.

## Measurements

Cold-route request counts come from isolated Chromium contexts against one `astro preview` of
the final production `dist`, without rebuilding between scenarios. Each scenario uses a fresh
browser context with its normal cold cache. Raw, gzip and Brotli sizes are calculated file by
file for local JavaScript responses with Node's default zlib settings; they do not represent a
CDN's transfer encoding. Request counts are browser request events, including cache-backed
requests. The accepted-consent scenario deterministically fulfills the single `ipapi.is` request
with the same fixture as Playwright; no external response time or byte count is included in the
local JavaScript totals.

### Initial-route comparison

| Route/state                         | Baseline requests / JS / JS gzip | Migrated requests / JS / JS gzip |                               Change |
| ----------------------------------- | -------------------------------: | -------------------------------: | -----------------------------------: |
| Home, fresh explicit-content notice |              43 / 38 / 127,860 B |               35 / 30 / 72,646 B |      −8 requests, −8 JS, −43.2% gzip |
| Cookies, functionality refused      |               41 / 35 / 92,346 B |               33 / 27 / 64,163 B |      −8 requests, −8 JS, −30.5% gzip |
| Technical MDX post, Giscus refused  |              46 / 40 / 119,025 B |               36 / 30 / 68,960 B |    −10 requests, −10 JS, −42.1% gzip |
| Bare 404                            |               35 / 31 / 85,046 B |                      4 / 0 / 0 B | −31 requests, no external JavaScript |

The baseline tags route was 40 requests, 35 scripts and 96,938 B gzip. It was not captured in
the final isolated snapshot, so this document does not claim an unmeasured route-specific gain.
The four remaining 404 requests transfer the document and static assets; its roughly 1.36 MB
total transfer is dominated by the 404 image, not runtime code. The `0 B` figure counts external
JavaScript responses consistently with the other route measurements; two executable inline
snippets still travel inside `404.html`.

The fresh-home reduction is the primary initial-load result:

| Fresh home      | JavaScript modules |            Raw |          Gzip |        Brotli |
| --------------- | -----------------: | -------------: | ------------: | ------------: |
| Baseline        |                 38 |      499,695 B |     127,860 B |     110,311 B |
| Migrated        |                 30 |      258,797 B |      72,646 B |      63,740 B |
| Absolute change |             **−8** | **−240,898 B** | **−55,214 B** | **−46,571 B** |
| Relative change |         **−21.1%** |     **−48.2%** |    **−43.2%** |    **−42.2%** |

### Final route and consent states

| Scenario                                                 | Requests |  JS |    Raw JS |   Gzip JS | Brotli JS |
| -------------------------------------------------------- | -------: | --: | --------: | --------: | --------: |
| Home, fresh explicit-content notice                      |       35 |  30 | 258,797 B |  72,646 B |  63,740 B |
| Home, explicit content acknowledged and cookies refused  |       42 |  33 | 484,289 B | 123,875 B | 106,743 B |
| Home, explicit content acknowledged and cookies accepted |       44 |  34 | 487,275 B | 125,248 B | 107,938 B |
| `/cookies/`, functionality refused                       |       33 |  27 | 219,673 B |  64,163 B |  56,451 B |
| MDX article, functionality refused                       |       36 |  30 | 232,408 B |  68,960 B |  60,557 B |
| Shortcode article, functionality refused                 |       42 |  36 | 362,309 B |  94,333 B |  82,813 B |
| `404.html`                                               |        4 |   0 |       0 B |       0 B |       0 B |

Moving from the fresh home notice to acknowledged explicit content adds exactly the three
Konachan bundles (background controller, controls and Material Color Utilities worker): 225,492
B raw, 51,229 B gzip and 43,003 B Brotli. The manifest and three image request events (two unique
image URLs) account for the other four requests. This proves that the pre-acknowledgement boundary
blocks both code and image network work, rather than merely hiding the result.

Accepting functionality adds only the local `ip-geolocation` module (2,986 B raw, 1,373 B gzip,
1,195 B Brotli) and one successful `https://api.ipapi.is/` request in this preview. Speed
Insights remains absent because a local build does not have Vercel's production marker.

### Pagefind first-use path

Measured from `/cookies/` with functionality refused:

| Phase                                                            | Added requests |           Raw |          Gzip |        Brotli |
| ---------------------------------------------------------------- | -------------: | ------------: | ------------: | ------------: |
| Focus search trigger: controller only                            |              1 |      18,130 B |       5,546 B |       4,985 B |
| Open search: Material controls, Pagefind worker/runtime and WASM |             13 |     290,420 B |     123,177 B |     117,487 B |
| First query: one index and one result fragment                   |              2 |         249 B |         292 B |         257 B |
| **Initial route to first query**                                 |         **16** | **308,799 B** | **129,015 B** | **122,729 B** |

The opening phase consists of 130,373 B raw / 24,964 B gzip / 21,843 B Brotli of Material
Search, 87,003 B / 25,125 B / 22,632 B of Pagefind JavaScript, and 73,044 B / 73,088 B / 73,012
B of entry metadata and WASM. The 72,782 B French WASM is effectively incompressible.

The first query uses Pagefind's internal placeholder term to exercise both generated index files;
the two unlisted posts are intentionally absent from the public index. The baseline opening path
added 7 requests, 176,044 B raw and 101,392 B gzip. The migrated initial-to-first-query path adds
9 more requests, 132,755 B raw and 27,623 B gzip, but it includes focus warm-up, the lazily split
Material registry and an actual query, so it is not a strict like-for-like regression. The
measurable trade-off is deliberate: none of that cost remains on the closed initial route, at the
expense of a more fragmented first use.

### Image-preview first-use path

The MDX article initially loads the capture-phase loader, not the complete controller. A cold
first click adds three JavaScript requests:

| Chunk              |          Raw |         Gzip |
| ------------------ | -----------: | -----------: |
| `image-preview`    |     39,120 B |      9,889 B |
| Material dialog    |     13,292 B |      3,853 B |
| Clipboard fallback |        962 B |        538 B |
| **Total**          | **53,374 B** | **14,280 B** |

The three chunks total 12,528 B Brotli. Initial article JavaScript plus a first opening is
285,782 B raw and 83,240 B gzip, still 201,673 B raw (−41.4%) and 35,785 B gzip (−30.1%) below
the baseline post's initial JavaScript.

A cold open trace contained six network events: the three chunks, the same WebP in two image
request events, and one fetch through `prepareShareFile()`. Request events include cache-backed
loads, so this count does not prove three independent wire transfers. The prepared file's MIME
and size are reused by the information dialog, avoiding the otherwise redundant `HEAD`; that
request remains only as a fallback when file preparation fails. Preparing the share `File` at
preview intent preserves Safari's transient user activation later, but it also pulls the full
image before the information panel or share action is used. Deferring that work without losing
native file sharing remains explicit debt.

### Total generated JavaScript

| Production `_astro` output | Artifacts |       Raw |      Gzip |    Brotli |
| -------------------------- | --------: | --------: | --------: | --------: |
| Baseline                   |        50 | 770,578 B | 182,794 B | 157,512 B |
| Migrated                   |        54 | 774,555 B | 185,381 B | 160,591 B |
| Change                     |        +4 |  +3,977 B |  +2,587 B |  +3,079 B |

Code splitting therefore slightly increases total deployable JavaScript while removing it from
unrelated initial routes. The fresh home requests 30 artifacts representing 33.4% of total raw
weight and 39.2% of total gzip weight.

### Lighthouse mobile snapshot

Migrated ranges below come from the three final simulated-mobile JSON reports emitted by the
release gate, rather than selecting one favorable run.

| Metric             |       Baseline | Final migrated range |             Change |
| ------------------ | -------------: | -------------------: | -----------------: |
| Performance        |            100 |                  100 |          No change |
| Requests           |             44 |                   36 |                 −8 |
| Total transferred  |      224,668 B |            166,480 B | −58,188 B (−25.9%) |
| JS requests        |             38 |                   30 |                 −8 |
| JS transferred     |      144,587 B |             86,333 B | −58,254 B (−40.3%) |
| FCP                | 1,352–1,353 ms |       1,427–1,429 ms |          +74–77 ms |
| LCP                | 1,427–1,428 ms |       1,502–1,504 ms |          +74–77 ms |
| TBT                |       11–14 ms |               0–3 ms |      8–14 ms lower |
| CLS                |         0.0083 |               0.0083 |          No change |
| JavaScript boot-up |   Not recorded |             18–70 ms |                  — |

The final gate completed three mobile and three desktop runs; all six scored 100 for performance,
accessibility and best practices. The byte reduction is stable across the three mobile reports,
but their LCP remains roughly 74–77 ms slower than the baseline range and is reported explicitly.
The final desktop range was FCP 343–344 ms, LCP 363–364 ms and TBT 0 ms, compared with baseline
FCP 322–324 ms, LCP 362–364 ms and TBT 0 ms. Lighthouse does not exercise acknowledged Konachan,
Pagefind, Giscus or image-preview interactions, so those paths remain Playwright/browser checks.

## Verification contract

- `pnpm verify:project`: unit/theme/type/lint/audit/symbol/Knip/format, production build,
  CSP/headers, all Playwright projects, then three mobile and three desktop Lighthouse runs.
- `pnpm build:vercel`: full Git history, Astro SSG, Pagefind, minification and final CSP/header
  validation.
- Image preview: Chromium light/dark desktop/mobile plus targeted light WebKit desktop/mobile;
  first activation, toolbar visible/hidden/visible, mouse/touch/trackpad gestures, history,
  scroll, post-animation focus, 16 px/pill/16 px radius motion, native file share,
  URL/clipboard fallback, transient fullscreen/share activation and console cleanliness. WebKit
  additionally simulates DPR changes and `gesturestart`/`gestureend`, verifies native two-touch
  handoff, and checks that pan is bounded then reset.
- In-app browser inspection: desktop 1280 px rendering, physical keyboard flow and first-click
  lazy loading. Mobile rendering and interactions use the Chromium/WebKit device profiles above.

## Known trade-offs and debt

- Playwright WebKit is a Safari-engine approximation, not a physical iPhone or the installed
  macOS Safari application. Native pinch and the system share sheet still need a physical-device
  release smoke test.
- Automated visual checks assert layout, visibility, state and focus rather than stored pixel
  snapshots. They protect the rendered contract across desktop/mobile profiles, but exact
  device-pixel parity on macOS and iPhone Safari still belongs in that physical release smoke.
- Browser-zoom automation uses Chromium CDP. WebKit simulates the DPR/gesture signal and verifies
  the native touch handoff and resulting pan/reset contract, but Playwright cannot drive Safari's
  actual zoom UI, physical pinch gesture or system share sheet.
- The cold preview trace records two WebP image request events and a separate share-file fetch.
  Some image events can be cache-backed, but the share prefetch can still transfer the full file.
  It is the current cost of keeping Safari's native file share inside transient user activation
  and should be reduced only with a physical-Safari proof.
- Revoking consent after a Speed Insights or Giscus script was inserted reloads the page once,
  because removing an in-flight dynamic script does not reliably prevent Chromium from executing
  it and removing a loaded script cannot undo third-party code. This can discard transient UI
  state, and an IP request that already completed cannot be retroactively cancelled.
- Deferred search/image-preview chunks can add latency to a first interaction; focus and hover
  prewarming mitigate it. Preview uses a tested direct controller handoff; search currently
  replays a cold open with one programmatic `button.click()`, whose trusted-event semantics
  remain a difference to keep covered. Dependency preloading is intentionally disabled, so a cold
  activation follows the native import graph instead of issuing speculative shared-module
  requests.
- Disabling module preloads relies on a Vite `generateBundle` hook mutating
  `this.environment.config.build.modulePreload`. It is verified with Astro 7 and Vite 8, but that
  environment configuration API must be revalidated when either tool is upgraded.
- Search first use is more fragmented than the baseline path: the measured initial-to-query path
  adds 9 requests and 27,623 B gzip over the older opening-only trace. The benefit is the complete
  removal of this work from routes where search stays closed.
- Splitting raises the deployable JavaScript total by four artifacts and 2,587 B gzip even though
  the fresh-home initial gzip falls by 43.2%.
- All three final mobile Lighthouse runs scored 100, but their LCP remained 74–77 ms slower than
  the baseline range. A perfect aggregate score therefore does not erase the timing regression.
- `inlineStylesheets: "always"` avoids a render-blocking stylesheet request but repeats about
  600 KiB of raw CSS (614,322 B, or 599.9 KiB) across the six generated HTML documents. Moving
  shared CSS to cached files is a separate visual/FOUC experiment, not hidden inside this
  migration.
- The current build contains only two unlisted technical posts, so the Pagefind index is nearly
  empty and its search measurements are not representative of a production corpus.
- The same small corpus does not exercise list-view tag pagination above ten posts in a rendered
  browser route. Its Material import is tied to the shared `hasPagination` condition, but a larger
  production-like fixture would give stronger regression coverage.
- The Konachan set dominates `dist` (300 WebP files, 23,727,528 B, or 22.6 MiB), but the manifest,
  Worker and chosen images are outside the fresh initial path.
- Dependabot applies a one-day version cooldown to match pnpm 11's 1,440-minute minimum release
  age. Without it, a fresh automated version PR can be impossible for CI and Vercel to install
  until the package matures; Dependabot security updates remain outside the cooldown.
- Dependabot temporarily ignores only semver-major TypeScript updates: `@astrojs/check@0.9.9`
  supports TypeScript 5 and 6, while its current language server crashes during `astro check` on
  TypeScript 7. Patch/minor 6.x and security updates remain enabled; remove the exception once
  Astro's declared peer range and check runtime support TypeScript 7.
- The Vercel GitHub status already stuck on `Waiting for checks to complete` cannot be repaired by
  repository code alone. The obsolete check must be removed in the authenticated Vercel project,
  then the deployment must be recreated.
- The versioned rulesets mirror the live GitHub rules, including an `always` bypass for the `c2tz`
  administrator. This permits the requested direct integration push but means branch protections
  are not absolute against that account; removing it requires a deliberate live ruleset policy
  change, not a repository-only edit.
