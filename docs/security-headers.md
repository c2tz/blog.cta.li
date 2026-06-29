# Security Headers

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

The `Update security header hashes` GitHub Action also runs on same-repository
pull requests and commits a refreshed `vercel.json` when the hashes drift.

## Blocking Vercel production promotion on CI

Use [Vercel Deployment Checks](https://vercel.com/docs/deployment-checks) for
the connected GitHub project:

1. Open the Vercel project.
2. Go to `Settings` -> `Deployment Checks`.
3. Add a GitHub check.
4. Select the GitHub Actions check named `verify`.
5. Keep production automatic aliasing enabled.

With this setup, Vercel may still create a production deployment, but it will not
promote it to the production domain until the selected GitHub check passes.

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
