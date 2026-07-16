# Physical device QA

Run this short pass on a public Vercel preview after automated checks. Record the device, OS/browser
version, preview URL, commit, and pass/fail result. Start in a private window so consent and cached
assets cannot hide a regression.

The `Smoke Vercel preview deployment` workflow can also be run manually with a public
`https://<deployment>.vercel.app/` origin. Automatic `deployment_status` runs are enabled only when
the repository variable `VERCEL_PREVIEW_SMOKE_ENABLED` is exactly `true`. Keep that variable unset
while Vercel Deployment Protection redirects anonymous requests to SSO: a protected preview cannot
be truthfully validated without a bypass credential, and the workflow deliberately uses no secret.
The smoke verifies the live document/security headers and real 404, then fetches one emitted Astro
stylesheet, the compact 150-image Konachan manifest and one WebP variant to prove their MIME,
cache policy, size and payload contracts on the deployed origin.

## Common checks

- Confirm the image warning blocks the page, then continue and choose `REFUSER`; reload and verify
  that optional services remain disabled.
- Open search, change its sort order, close it with the visible close action, and verify keyboard or
  touch focus returns to the trigger.
- Open a post image. At browser zoom 100%, swipe between images; when zoomed, pan natively in both
  axes while the toolbar keeps its top safe-area anchor instead of following the pan. Return to
  100% and verify gallery swipe still works.
- Visit a deliberately unknown URL and confirm the branded 404 page is shown with an HTTP 404 in
  remote Web Inspector or DevTools.

## Safari on macOS

- Test keyboard `Tab` with Safari's web-page tabbing setting enabled, trackpad pinch/page zoom,
  two-finger pan, lightbox double-click smart zoom/reset, Escape, and browser back/forward.

## Safari on iPhone and iPad

- Test portrait and landscape, safe-area toolbar placement, page and lightbox pinch/pan,
  double-tap smart zoom/reset, one-finger gallery swipe at 100%, and rotation while the lightbox is
  open.
- On iPad, repeat once with a trackpad or pointer if available.

## Chrome on Android

- Test page and lightbox pinch/pan, double-tap browser zoom/reset, gallery swipe at 100%, system
  back, rotation, and toolbar placement around the cutout/status bar.
