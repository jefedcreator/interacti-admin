# CLAUDE.md

interacti's admin dashboard. React, TypeScript and Tailwind on Vite. It reads and
writes each product through the identical `/api/admin` surface. Read
`docs/superpowers/specs/2026-10-22-interacti-admin-design.md` for the design and
`docs/superpowers/plans/2026-10-22-interacti-admin-dashboard.md` for the build order.

## Rules that override convenience

- **Colour:** black `#000` and white `#fff` only, with opacity steps at 80/50/30/20/10.
  The app is black with white text; modals are white with black text. Danger is never red.
- **Type:** Switzer only, weights 400 and 500, self-hosted as Fontshare's unmodified
  WOFF2 files in `public/fonts/`. The ITF Free Font License forbids subsetting or
  converting them.
- **The logo:** use the committed kit file `public/brand/interacti/logo-white.svg`, copied
  unmodified from `landing/brand/interacti/`, in an `<img>`. Never retype, redraw, stretch
  or recolour it. Nothing animates it here, so it stays in its `arch-back` pose.
- **Coming soon:** Sara, Fluid and Harv3st are labelled "Coming soon" wherever a product
  list shows them and are never linked as if usable. A product with no configured origin
  is shown as not switched on.
- **Commits:** plain messages. No `Co-Authored-By`, "Generated with" or other AI
  attribution trailers. This is the owner's standing rule.
- **Tooling:** yarn 1.22, Node 24.

## Admin rules

- **Credentials:** never handle or show a credential. The token lives only in
  `sessionStorage` under `ix-admin-token`; it is never logged, rendered, put in a URL or
  echoed in an error.
- **HTTPS only:** never send the token over http. `localhost` and `127.0.0.1` are the only
  exceptions, for development. A product with an http origin shows "Needs HTTPS".
- **No product rules:** keep the dashboard free of product rules. Columns, fields, enums
  and validation come from each product's manifest, never from hard-coded knowledge of a
  product.
- **Create and edit** use Sara's modal (`Modal`, `ConfirmModal`, `Field`), one modal owned
  by its page. Never a page.
