# Security Headers

> Cette référence explique les détails de la politique de sécurité. Pour savoir quelle commande
> lancer et comment corriger un hachage obsolète, consultez
> [Commandes et contrôles](commandes-et-controles.md#securite-et-contenu-produit) et
> [Dépannage](depannage.md#les-hachages-de-securite-sont-obsoletes).

## CSP inline script hashes

The production CSP in `vercel.json` does not allow `script-src 'unsafe-inline'`.
Astro still emits a few deterministic inline scripts, so their SHA-256 hashes are
stored in the `script-src` directive.

After changing rendered HTML, run:

```bash
pnpm build
pnpm sync:headers
pnpm check:headers
```

`pnpm verify` builds first and then checks that the committed hashes match the
current `dist` output.

The `Validate security header hashes` GitHub Action runs with read-only
repository permissions on every pull request. It derives the expected hashes
locally and fails with the exact command above when `vercel.json` is stale. It
never commits to, or pushes, contributor branches.

## Blocking Vercel production promotion on CI

Use [Vercel Deployment Checks](https://vercel.com/docs/deployment-checks) for
the connected GitHub project:

1. Open the Vercel project.
2. Go to `Settings` -> `Deployment Checks`.
3. Remove any obsolete GitHub check named `verify` and any PR-only check.
4. Select the push checks `Check Astro, Material Web, and security headers` and
   `Lighthouse 95+ performance (mobile and desktop, no SEO)`.
5. Keep production automatic aliasing enabled, then redeploy the affected commit:
   Vercel does not retroactively recompute a deployment already waiting on a
   deleted or renamed check.

With this setup, Vercel may still create a production deployment, but it will not
promote it to the production domain until both selected GitHub checks pass. Do not
select the external `Vercel` status itself: making an alias wait on its own status
creates a circular deployment gate.

For the stricter model where Vercel does not start any Git deployment before CI,
disable Vercel's automatic Git deployments and deploy from GitHub Actions after
`pnpm verify` with Vercel CLI. That requires repository secrets for
`VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`.

The Vercel CLI flow is:

```bash
pnpm verify
vercel pull --yes --environment=production --token=$VERCEL_TOKEN
vercel build --prod --token=$VERCEL_TOKEN
vercel deploy --prebuilt --prod --token=$VERCEL_TOKEN
```

See the Vercel docs for [`vercel build`](https://vercel.com/docs/cli/build) and
[`vercel deploy --prebuilt`](https://vercel.com/docs/cli/deploy).
