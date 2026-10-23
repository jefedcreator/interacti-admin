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
