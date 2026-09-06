# Physical device QA

> Cette vérification complète les tests automatiques après une modification visible importante. Le
> parcours GitHub Actions et déploiement est expliqué dans
> [GitHub Actions et déploiement](github-actions-et-deploiement.md).

Run this short pass on a public Vercel preview after automated checks. Record the device, OS/browser
version, preview URL, commit, and pass/fail result. Start in a private window so consent and cached
assets cannot hide a regression.

## À renseigner dans la pull request

Pour toute modification visuelle, complétez la section **QA sur appareil physique** du modèle de
pull request avant de demander la fusion : appareil, version d'OS et de navigateur, URL de preview,
commit vérifié et résultat. Si cette passe ne s'applique pas ou est bloquée, indiquez-le explicitement
avec la raison ; ne laissez pas la case non renseignée. Les tests WebKit automatisés complètent cette
preuve, mais ne remplacent pas Safari sur un appareil réel.

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
- Open a post image, including once after first zooming the page. Check that opening does not jump
  toward the close button. At normal zoom, swipe between images; when magnified, pan natively in
  both axes and repeat with mouse dragging. Controls retain their original layout anchor and
  screen size even at 4x pinch magnification; they must not chase the visible viewport.
  Return close to 100% and verify gallery swipe and vertical dismissal work without an exact reset.
- Drag from the top and bottom of the image in both directions. Equal displacement should give
  equal scrim opacity, and dragging the image fully out should make the scrim transparent. Cancel
  a drag and repeat with site motion enabled and disabled; there should be no dark/light flash.
  With motion enabled, open/close twice and close once before the opening fade ends: the toolbar
  must keep its viewport anchor without jumping at an animation boundary.
  Release a dismissal drag with motion enabled: the image must not recenter and the scrim must
  continue fading instead of returning to its initial opacity.
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
