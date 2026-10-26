# interacti admin

The owner's dashboard for interacti's products. One sign-in token covers every product
that has switched its admin API on.

## Commands

```sh
yarn dev         # dev server on http://localhost:5174
yarn build       # production build (use --mode test for the e2e build)
yarn preview     # serve the build on :4173
yarn typecheck   # tsc --noEmit
yarn test        # vitest (happy-dom, Testing Library, MSW)
yarn e2e         # playwright: desktop, mobile (375px) and reduced-motion projects
```

Node 24 and yarn 1.22.

## Environment

Each product's origin is a build-time variable, without a trailing slash. An empty value
means the product is not switched on in this build.

| Variable | Product |
| --- | --- |
| `VITE_API_0NBOX` | 0nbox |
| `VITE_API_STRIVE` | Strive |
| `VITE_API_PARCOURS` | Parcours |
| `VITE_API_SARA` | Sara |
| `VITE_API_FLUID` | Fluid |

`.env.production` is committed with the live origins (Fluid empty); they are not secrets.
`.env.development` points at local dev servers: Strive `:3000`, Parcours `:3001`,
0nbox `:3002`, Sara `:3003`, Fluid `:3004`. `.env.test` holds the fake origins the e2e
build uses. Override on your machine in `.env.local`. See `.env.example`.

## Switching on a product's admin

A product answers every `/api/admin` request with 404 until it is switched on. In that
product's server environment:

1. Set `ADMIN_API_TOKEN` to a random secret of at least 32 characters
   (`openssl rand -base64 32`). Use the same value in every product, so one sign-in
   covers all of them. Rotating it means changing the environment and restarting.
2. Set `ADMIN_ORIGIN` to this dashboard's origin, for example
   `https://admin.interacti.84-12-92-46.sslip.io`. It must match exactly.
3. Restart the product, then sign in here with the token. The dashboard only signs in over
   https (or `localhost` for development).

If a product rejects the token it shows "Token rejected" and the others keep working.

### Analytics

Each product's page opens with its Google Analytics figures for the last 7, 30 or 90 days:
visitors, page views and, where the product tracks them, enquiries. The product's server
reads Google Analytics and serves the numbers from `GET /api/admin/analytics` (spec §6.7),
so the dashboard never holds a Google credential. A product that hasn't built the route
says "Analytics isn't available from <product> yet", and one with no Google Analytics set
up shows its own note about what to set.

Each product's server reads three optional variables: `GA_PROPERTY_ID` (the numeric GA4
property id, not the `G-…` measurement id), `GA_SERVICE_ACCOUNT_B64` (the base64-encoded
service-account JSON key, made with `base64 -i key.json | tr -d '\n'`) and, only where
enquiries are tracked, `GA_ENQUIRY_EVENT` (the GA event name). The endpoint answers
`configured: false` with a note naming what to set until they are. The owner checklist in
[the implementation plan](docs/superpowers/plans/2026-10-26-product-analytics-backends.md)
lists the Google Cloud, GA4 access and repository-secret steps.

## Deploy

A push to `main` runs `.github/workflows/deploy.yml` ("Deploy interacti admin"): it
installs, runs `yarn test` and `yarn build`, uploads `dist/` to
`/srv/interacti-admin/releases/<sha>` on the host and runs `deploy/release.sh`, which
points `/srv/interacti-admin/current` at it. nginx serves that symlink as static files.

The workflow needs these repository secrets (Settings, Secrets and variables, Actions).
It reads nothing else, and it uses no repository variables:

| Secret | What it is |
| --- | --- |
| `SSH_HOST` | The host's address, `84.12.92.46` |
| `SSH_USER` | The ssh user on that host, `opc` |
| `SSH_KEY` | The deploy private key, the whole file including header and footer |

They are the same values the landing uses. Never commit a key. Details, the certificate
step, rollback and the nginx kit are in [`deploy/README.md`](deploy/README.md).

### First use

1. Create the GitHub repo and add the `SSH_HOST`, `SSH_USER` and `SSH_KEY` secrets.
2. On the host, run `bash deploy/setup-host.sh`, then certbot for
   `admin.interacti.84-12-92-46.sslip.io` (the dashboard refuses http, so the certificate
   is required before first sign-in).
3. Set `ADMIN_API_TOKEN` and `ADMIN_ORIGIN` on each product and restart it, once the
   admin API has shipped to that product.
4. Push to `main`, then sign in.

# interacti-admin
