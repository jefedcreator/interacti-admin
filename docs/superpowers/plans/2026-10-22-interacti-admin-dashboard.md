# interacti Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the static admin app in `interacti/admin`. It signs in with the admin token and reads each product's manifest. Every registered resource gets a Dandys-style table, a record view, Sara-style create and edit modals, and a guarded delete, all in the landing's black-and-white Switzer design.

**Architecture:**
- **A React app on Vite, with no server.** `src/config/products.ts` turns build-time env into six product configs.
- **Data:** each ready product gets an axios client (`src/utils/axios.ts`, `api.ts`) and TanStack Query hooks keyed by `adminKeys`.
- **The screen is generic.** Tables, the record view and the forms render from the manifest's field metadata, so the dashboard holds no product's rules.
- **One modal for every dialog:** `Modal` is Sara's primitive, restyled. Create and edit share one `RecordFormModal`, owned by the resource list page just as Sara's services page owns its `ServiceModal`.
- **One fake for both test layers:** an in-memory fake of the spec §6 contract (`tests/fake-api/`) serves Vitest through MSW and Playwright through `page.route`.

**Tech Stack:**
- React 19, React Router 7, TanStack Query 5, TanStack Table 8;
- react-hook-form 7, `@hookform/resolvers` 5, Zod 4;
- axios 1 with the fetch adapter;
- `radix-ui` (the unified package);
- sonner 2, `clsx` with `tailwind-merge`;
- Vite with `@vitejs/plugin-react` and `@tailwindcss/vite`, TypeScript and Tailwind v4;
- Vitest with happy-dom, Testing Library and MSW 2;
- Playwright with `@axe-core/playwright`;
- yarn 1.22 on Node 24.

**Spec:** `docs/superpowers/specs/2026-10-22-interacti-admin-design.md`. Section numbers (§8.4.2 and so on) refer to it. The endpoints come from `docs/superpowers/plans/2026-10-22-interacti-admin-api.md`. This app is built and tested against the fake, so it doesn't wait for them.

**Reference code to read before Tasks 4, 7, 8 and 9:**
- `../sara/src/primitives/Modal.tsx`, `ConfirmModal.tsx` and `Field.tsx`;
- `../sara/src/components/services/service-modal.tsx` and `services-page-client.tsx`;
- the keyframes in `../sara/src/styles/globals.css`;
- `../../Dandys/Dandys_AdminDashboardrd/src/primitives/DataTable.tsx`, `src/components/Pagination.tsx`, `src/hooks/usePagination.tsx`, `src/hooks/useDebounce.tsx` and `src/app/app/users/clients/page.tsx`.

## Global Constraints

- **Colour:** `#000` and `#fff` only, with opacity steps 80/50/30/20/10. Tailwind's palette is removed (`--color-*: initial`).
  - Primitives draw with two surface aliases, `ink` and `ground`: white on black by default, swapped on `.surface-light` (white modals).
  - Secondary text is `ink/50` on black but `ink/80` on `.surface-light`.
  - Product colour appears only inside product tiles. Danger, success and status are never coloured.
- **Type:** Switzer 400 and 500 only, copied unmodified from `../landing/public/fonts/` (the ITF Free Font License forbids subsetting or converting them). Sizes come from the tokens `--text-micro` (14px), `--text-body` (16px), `--text-statement` (24px) and `--text-large` (48px, at 500 with tracking −0.02em).
- **Logo:** `../landing/brand/interacti/logo-white.svg`, copied unmodified, in an `<img alt="interacti">` at least 72px wide. The favicon is the kit's `favicon.svg`. Glyphs, not an icon set: ↗ ↓ → ← ↑ × ⋯.
- **Modals (Decided 2026-10-22):**
  - Every dialog is `Modal`, with Sara's compound API and behaviour (spec §8.4.1).
  - Create and edit are one `RecordFormModal`, never a page or a route. The list page owns it and both mutations, with Sara's `{ key, record? }` plus a separate `open` (spec §8.4.2).
  - Only one modal is ever open.
- **Coming soon:** Sara, Fluid and Harv3st show "Coming soon" wherever they appear, and Harv3st is never a link. Product imagery is only the tiles copied from `../landing/public/brand/<slug>/tile.svg`; Fluid and Harv3st are typeset.
- **The token:**
  - It's kept in `sessionStorage` under `ix-admin-token`, never `localStorage`, a URL, a log or a query key.
  - It's sent only to origins where `canSendToken` holds (https, or http on `localhost` or `127.0.0.1`).
  - Sign-in is refused on a page where `canSendToken(location)` fails.
  - No third-party scripts are loaded.
- **Contract:** spec §6. Keys are opaque (`_key`), encoded with `encodeURIComponent` and never built. Payloads carry only writable, changed fields. The only client checks are on shape (spec §8.4.2); every message the product sends is shown as sent.
- **Frontend patterns** (spec §10):
  - query keys from `adminKeys` only;
  - query hooks in `src/hooks/queries/` and mutation hooks in `src/hooks/mutations/`;
  - on success, invalidate the list, the detail and the manifest; no optimistic updates, `setQueryData` or `placeholderData`;
  - `primitives/` hold no queries and no feature types;
  - forms are `noValidate` and `autoComplete="off"`, except the sign-in token field (`autoComplete="current-password"`);
  - imports through barrels and the `@/*` alias.
- **Copy:** sentence case, short declaratives, no exclamation marks. The exact strings are in spec §8.
- **Layout:** no sideways page scroll at 375px; tables scroll inside their own frame. Pinch-zoom stays on: no `maximum-scale` and no `user-scalable=no`.
- **Accessibility:** WCAG 2.2 AA:
  - the landing's focus ring, black on `.surface-light`;
  - tables with `<th scope="col">` and `aria-sort`;
  - every control labelled through `Field`;
  - modals trap and return focus.
- **Motion:** modals use Sara's keyframes and durations (spec §9), with ins on `--ease-reveal`. Other UI fades take 0.3s. Sara's global reduced-motion rule applies. Nothing animates the logo.
- **Repo:** yarn 1.22 and Node 24. Commit messages are plain, with no `Co-Authored-By`, "Generated with" or other AI trailer (the owner's standing rule; it overrides any tool default).

## Review Focus

These are failure modes the spec implies but the journeys don't exercise. Each one has a test in the task named.

1. **A product is down, slow, or answers with an HTML error page** (nginx 502). Expected: that product reads "Couldn't reach it", the others keep working, and nothing throws. Tested in Tasks 3 and 6.
2. **One product rejects the token** after a rotation. Expected: only that product reads "Token rejected", with no forced sign-out. Sign-in fails only when every reachable product rejects. Tested in Tasks 5 and 6.
3. **A stale or hand-edited table URL** (`?page=-3&size=500&sortBy=gone&isPublic=maybe&nope=1`), or a manifest newer than the server's rules. Expected: the client drops what it can't use, and a server 422 offers "Reset the table". Tested in Task 9.
4. **A record deleted elsewhere while its view or edit modal is open.** Expected: "This record doesn't exist any more." with no crash. Tested in Tasks 8 and 10.
5. **Huge or structured values:** 5,000-character text, deep JSON, long lists. Expected: cells cut to one line, the view shows them wrapped in full, a tall form scrolls inside the modal's overlay, and the page never scrolls sideways at 375px. Tested in Tasks 9, 10 and 11.

---

## File map

```
admin/
├─ index.html · package.json · tsconfig.json · vite.config.ts · vitest.config.ts · playwright.config.ts
├─ CLAUDE.md · README.md · .gitignore · .env.example · .env.development · .env.production · .env.test
├─ public/  fonts/switzer-{400,500}.woff2 · brand/interacti/logo-white.svg · brand/{0nbox,strive,parcours,sara}/tile.svg · favicon.svg · robots.txt
├─ src/main.tsx
├─ src/app/       router.tsx (exports `routes`) · require-auth.tsx
├─ src/app/routes/ sign-in.tsx · overview.tsx · product.tsx · resource-list.tsx · record-view.tsx · not-found.tsx
├─ src/styles/app.css
├─ src/types/admin.ts
├─ src/config/products.ts
├─ src/utils/     index.ts · cn.ts · axios.ts · api.ts · verify-token.ts · search-params.ts · format.ts
├─ src/provider/  index.tsx · auth-provider.tsx · query-client.ts
├─ src/hooks/     use-debounce.ts · use-pagination.ts · use-list-params.ts · use-product-api.ts
├─ src/hooks/queries/   keys.ts · use-manifest.ts · use-records.ts · use-record.ts
├─ src/hooks/mutations/ use-record-mutations.ts
├─ src/forms/fields.ts
├─ src/primitives/ index.ts · Modal.tsx · Field.tsx · Notice.tsx · Button.tsx · Input.tsx · Textarea.tsx · Select.tsx · Checkbox.tsx · table.tsx · Menu.tsx · Popover.tsx · Pill.tsx · Dot.tsx · Skeleton.tsx · Logo.tsx · ProductMark.tsx · Toaster.tsx
├─ src/components/ app-shell.tsx · product-nav.tsx · product-card.tsx · state-message.tsx · data-table.tsx · columns.tsx · field-value.tsx · table-toolbar.tsx · filter-menu.tsx · pagination.tsx · delete-modal.tsx · record-form-modal.tsx · field-input.tsx · relation-picker.tsx
├─ tests/setup.ts · tests/unit/render.tsx · tests/unit/*.test.ts(x)
├─ tests/fake-api/ fixture.ts · fake-admin-api.ts · msw.ts · playwright.ts
├─ tests/e2e/      helpers.ts · smoke.spec.ts · journey.spec.ts · a11y.spec.ts · phone.spec.ts
├─ deploy/        nginx/admin.conf.template · setup-host.sh · release.sh · README.md
└─ .github/workflows/deploy.yml
```

---

### Task 1: Scaffold, tokens, fonts and brand

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `index.html`, `src/main.tsx`, `src/styles/app.css`, `.gitignore`, `CLAUDE.md`, `README.md`, `.env.example`, `.env.development`, `.env.production`, `.env.test`, `public/robots.txt`, `tests/setup.ts`, `tests/e2e/helpers.ts`
- Copy (unmodified): `public/fonts/switzer-400.woff2`, `public/fonts/switzer-500.woff2`, `public/favicon.svg`, `public/brand/interacti/logo-white.svg`, `public/brand/{0nbox,strive,parcours,sara}/tile.svg`
- Test: `tests/e2e/smoke.spec.ts`

**Interfaces:**
- Produces:
  - **yarn scripts:** `dev` (`vite`), `build` (`vite build`), `preview` (`vite preview`), `typecheck` (`tsc --noEmit`), `test` (`vitest run`) and `e2e` (`playwright test`).
  - **Playwright projects:** `desktop` (1440×900), `mobile` (375×812, `isMobile`, `hasTouch`) and `reduced` (1440×900, `reducedMotion: 'reduce'`). The `webServer` command is `yarn build --mode test && yarn preview --port 4173`, and `baseURL` is `http://localhost:4173`.
  - **`tests/e2e/helpers.ts`:** `only(info: TestInfo, ...projects: string[]): void`, which skips other projects. `signIn` is added in Task 11.
  - **CSS tokens:**
    - the landing's `@theme` block verbatim (`--color-*: initial`, black and white, `--font-sans`, the four text sizes, `--radius-sheet`, `--radius-sheet-sm`);
    - plus `--radius-control: 0.75rem`;
    - plus `@theme inline { --color-ink: var(--ink); --color-ground: var(--ground); }`;
    - on `:root`: the landing's `--gutter`, `--ease-reveal` and `--ease-flip`;
    - `:root, .surface-dark { --ink: #fff; --ground: #000 }` and `.surface-light { --ink: #000; --ground: #fff }`.
  - **Motion tokens:** Sara's keyframes and `--animate-*` tokens with Sara's durations:
    - `fade-in` 0.24s and `fade-out` 0.15s;
    - `sheet-in` 0.42s and `sheet-out` 0.2s (`translateY(100%)`);
    - `pop-in` 0.32s (from `opacity: 0`, `translateY(8px)`, `scale(0.97)`) and `pop-out` 0.16s.

    Ins use `var(--ease-reveal)` and outs `ease-out`. Sara's global `prefers-reduced-motion: reduce` rule sets animation and transition durations to 0.01ms.
  - **Env files:**
    - `.env.production`: `VITE_API_0NBOX=https://onbox.live`, `VITE_API_STRIVE=https://www.usestrive.run`, `VITE_API_PARCOURS=https://parcours.live`, `VITE_API_SARA=https://sara.84-12-92-46.sslip.io`, and `VITE_API_FLUID=` empty;
    - `.env.development`: the localhost ports in spec §10;
    - `.env.test`: `VITE_API_STRIVE=https://strive.test` and `VITE_API_SARA=https://sara.test`, the rest empty.

- [ ] **Step 1: Initialise the repo.**
  - In `interacti/admin`, run `git init`. The existing `docs/` is committed with the scaffold, and the empty `home/` folder is left alone.
  - `.gitignore` covers `node_modules/`, `dist/`, `test-results/`, `playwright-report/`, `.env.local`, `.env.*.local` and `*.log`.
- [ ] **Step 2: Install dependencies.**
  - Run `yarn init -y`, then set `"private": true`, `"type": "module"` and `"engines": { "node": ">=24" }`.
  - **Runtime dependencies:** run `yarn add react react-dom react-router @tanstack/react-query @tanstack/react-table react-hook-form @hookform/resolvers zod axios radix-ui sonner clsx tailwind-merge`.
  - **Shared dev tools:** add `vite`, `typescript`, `tailwindcss`, `@tailwindcss/vite`, `vitest`, `happy-dom`, `@playwright/test` and `@axe-core/playwright` with `yarn add -D`, at the exact versions in `../landing/package.json`.
  - **Other dev dependencies:** run `yarn add -D @vitejs/plugin-react @types/react @types/react-dom @types/node @testing-library/react @testing-library/user-event @testing-library/jest-dom msw`.
- [ ] **Step 3: Copy the fonts and brand files, then check they're unmodified.**
  - Copy each file listed under "Copy" from `../landing/` with `cp`.
  - Run `for f in public/fonts/switzer-400.woff2 public/fonts/switzer-500.woff2; do cmp "$f" "../landing/$f"; done && cmp public/brand/interacti/logo-white.svg ../landing/brand/interacti/logo-white.svg && cmp public/favicon.svg ../landing/brand/interacti/favicon.svg`.
  - Expected: no output.
- [ ] **Step 4: Write the failing test** `tests/e2e/smoke.spec.ts`.

```ts
import { test, expect } from '@playwright/test';

test('the app loads on black, in Switzer, unindexed', async ({ page }) => {
  await page.goto('/sign-in');
  await expect(page).toHaveTitle('interacti admin');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(0, 0, 0)');
  for (const weight of [400, 500]) {
    expect(await page.evaluate(async w => (await document.fonts.load(`${w} 16px Switzer`)).length, weight)).toBe(1);
  }
  await expect(page.getByRole('img', { name: 'interacti' })).toBeVisible();
});
```

- [ ] **Step 5: Run it to see it fail.** Run `yarn playwright install chromium && yarn e2e tests/e2e/smoke.spec.ts --project=desktop`. Expected: FAIL, because there is no build yet.
- [ ] **Step 6: Write the scaffold.**
  - **`vite.config.ts`:** the react and tailwind plugins, `resolve.alias['@'] = /src`, `server.port: 5174` and `preview.port: 4173`.
  - **`tsconfig.json`:** `strict`, `noUncheckedIndexedAccess`, `jsx: "react-jsx"` and `paths: { "@/*": ["./src/*"] }`.
  - **`vitest.config.ts`:** extends the Vite config with `environment: 'happy-dom'`, `setupFiles: ['tests/setup.ts']` and `include: ['tests/unit/**/*.test.{ts,tsx}']`.
  - **`index.html`:** `lang="en"`, `<title>interacti admin</title>`, the robots meta, `<link rel="icon" href="/favicon.svg">` and `<div id="root">`.
  - **`src/main.tsx`:** for now it renders `<main>` with the logo `<img>`. Task 5 replaces it.
  - **`app.css`:** the landing's `@font-face`, base, `:focus-visible`, `.sr-only` and `.dot` rules, the tokens above, and `.surface-light :focus-visible { outline-color: #000; box-shadow: 0 0 0 1px #fff }`.
  - **`public/robots.txt`:** `User-agent: *` and `Disallow: /`.
  - **`CLAUDE.md`:** carries the landing `CLAUDE.md`'s colour, type, logo, coming-soon, commit and tooling rules, plus three admin rules: never handle or show a credential, never send the token over http, and keep the dashboard free of product rules. It also records that create and edit use Sara's modal and never a page.
  - **`README.md`:** the commands, the env variables, and how to switch on a product's admin (spec §5).
- [ ] **Step 7: Run the test.** Run `yarn e2e tests/e2e/smoke.spec.ts --project=desktop`. Expected: PASS.
- [ ] **Step 8: Commit.**

```bash
git add -A
git commit -m "chore: scaffold the admin app with the landing's tokens, fonts and logo"
```

---

### Task 2: Contract types and the product list

**Files:**
- Create: `src/types/admin.ts`, `src/config/products.ts`
- Test: `tests/unit/products.test.ts`

**Interfaces:**
- Produces:
  - **`types/admin.ts`:**
    - spec §6.2–6.3 verbatim: `AdminManifest`, `AdminResourceMeta`, `AdminFieldMeta`, `AdminRecord`;
    - `AdminRef = { key: string; title: string }`;
    - `ApiResponse<T> = { status: number; message: string; data: T; success?: boolean }`;
    - `PaginatedApiResponse<T> = ApiResponse<T> & { total: number; page: number; size: number; totalPages: number }`;
    - `ListParams = { page: number; size: number; query?: string; sortBy?: string; sortOrder?: 'asc' | 'desc'; filters: Record<string, string> }`.
  - **`config/products.ts`:**
    - `ProductSlug = '0nbox' | 'strive' | 'parcours' | 'sara' | 'fluid' | 'harv3st'`;
    - `Connection = { state: 'ready'; apiBase: string } | { state: 'needs-https'; apiBase: string } | { state: 'not-configured'; envVar: string } | { state: 'no-backend' }`;
    - `ProductConfig = { slug: ProductSlug; name: string; field: 'SaaS' | 'Edtech' | 'AI' | 'Crypto'; status: 'live' | 'coming-soon'; tile: string | null; connection: Connection }`;
    - `canSendToken(url: URL): boolean`;
    - `resolveConnection(raw: string | undefined, envVar: string, hasBackend: boolean): Connection`;
    - `buildProducts(env: Record<string, string | undefined>): ProductConfig[]`;
    - `products = buildProducts(import.meta.env)`;
    - `productBySlug(slug: string): ProductConfig | undefined`.

- [ ] **Step 1: Write the failing test** `tests/unit/products.test.ts`.
  - **`resolveConnection(…, 'VITE_API_X', true)`:**

    | Input | Result |
    |---|---|
    | `undefined` or `''` | `{ state: 'not-configured', envVar: 'VITE_API_X' }` |
    | `'https://parcours.live/'` | `{ state: 'ready', apiBase: 'https://parcours.live' }` |
    | `'http://localhost:3001'` or `'http://127.0.0.1:3000'` | `ready` |
    | `'http://sara.84-12-92-46.sslip.io'` | `needs-https` |
    | `'parcours.live'` (not a URL) | `not-configured` |

    With `hasBackend` false, the result is `{ state: 'no-backend' }` whatever the input.
  - **`canSendToken`:** true for `https://admin.x`, `http://localhost:5174` and `http://127.0.0.1:4173`; false for `http://admin.interacti.84-12-92-46.sslip.io`.
  - **`buildProducts({ VITE_API_STRIVE: 'https://strive.test' })`:**
    - the slugs in order are `['0nbox', 'strive', 'parcours', 'sara', 'fluid', 'harv3st']`;
    - `strive` is `ready`; `fluid` is `not-configured` with `envVar: 'VITE_API_FLUID'`; `harv3st` is `no-backend`;
    - `sara`, `fluid` and `harv3st` are `coming-soon`, the rest `live`;
    - the fields are SaaS, SaaS, Edtech, AI, Crypto, Crypto;
    - `tile` is `/brand/<slug>/tile.svg` for the first four and `null` for Fluid and Harv3st.
- [ ] **Step 2: Run it to see it fail.** Run `yarn test tests/unit/products.test.ts`. Expected: FAIL, because the module doesn't exist.
- [ ] **Step 3: Implement both files.** Names, fields and statuses follow the landing's `src/content/products.ts` and spec §2.
- [ ] **Step 4: Run the test.** Run `yarn test tests/unit/products.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit.** Run `git commit -m "feat: admin contract types and the six products"` after adding the files.

---

### Task 3: API client, errors and the fake admin API

**Files:**
- Create: `src/utils/axios.ts`, `src/utils/api.ts`, `src/utils/index.ts`, `tests/fake-api/fixture.ts`, `tests/fake-api/fake-admin-api.ts`, `tests/fake-api/msw.ts`
- Modify: `tests/setup.ts` (MSW server lifecycle, jest-dom, `sessionStorage.clear()`)
- Test: `tests/unit/api.test.ts`, `tests/unit/fake-api.test.ts`

**Interfaces:**
- Consumes: Task 2's types.
- Produces:
  - **`createAdminClient(apiBase: string, token: string): AxiosInstance`:** `adapter: 'fetch'`, `baseURL: apiBase + '/api/admin'`, `timeout: 15000`, `Authorization: Bearer <token>` and `Accept: application/json`.
  - **`AdminApiError extends Error`,** with `readonly kind: 'unreachable' | 'unauthorized' | 'off' | 'not-found' | 'forbidden' | 'conflict' | 'invalid' | 'server'`, `readonly status: number | null` and `readonly field: string | null`.
  - **`toAdminApiError(error: unknown): AdminApiError`** and **`isAdminApiError(error: unknown): error is AdminApiError`.**
  - **`adminApi(client: AxiosInstance)`** returns:
    - `manifest(): Promise<AdminManifest>`;
    - `list(resource: string, params: ListParams): Promise<PaginatedApiResponse<AdminRecord[]>>`;
    - `get(resource: string, key: string): Promise<AdminRecord>`;
    - `create(resource: string, body: Record<string, unknown>): Promise<AdminRecord>`;
    - `update(resource: string, key: string, body: Record<string, unknown>): Promise<AdminRecord>`;
    - `remove(resource: string, key: string): Promise<void>`.

    Every method throws `AdminApiError`, and `manifest()` turns `not-found` into `off`.
  - **`toSearchParams(params: ListParams): URLSearchParams`:** `page`, `size`, `query`, `sortBy`, `sortOrder`, then the filters in key order. It skips `undefined`, `null` and `''`, as Strive's `toSearchParams` does.
  - **Fake API:** `FAKE_TOKEN` (40 characters), `fakeManifest(product): AdminManifest`, `fakeRecords(): Record<string, AdminRecord[]>`, `createFakeAdminApi(options: { token: string; product: string; referenced?: Set<string>; rejectSortBy?: string[] }): { handle(req: FakeRequest): FakeResponse; requests: FakeRequest[]; records: Record<string, AdminRecord[]> }` and `adminHandlers(origin: string, api): HttpHandler[]`.

- [ ] **Step 1: Write the fixture and the fake.**
  - **The fixture's three resources:**
    - **`users`** (title `email`, all abilities, group People): `id` (read-only id), `email` (required), `name` (nullable), `role` (enum ADMIN/MEMBER) and `createdAt` (read-only). `related` is `[{ resource: 'clubs', field: 'ownerId' }, { resource: 'sessions', field: 'userId' }]`.
    - **`clubs`** (title `name`, group Clubs): `id`, `name` (required), `description` (text, nullable), `ownerId` (required, relation `users`), `isPublic` (boolean), `memberCount` (int, read-only), `settings` (json, nullable), `tags` (string list), `startsAt` (datetime, nullable) and `createdAt`. Its `filterable` is `['ownerId', 'isPublic']`.
    - **`sessions`** (title `userId`, group Sign-in, `can` `{ create: false, update: false, delete: true }`): `id`, `userId` (relation `users`), `userAgent` (nullable) and `createdAt`.
  - **Seeded records:**
    - 3 users: `ada@x.co`, `bola@x.co`, `chi@x.co`;
    - 45 clubs: `Lagos Runners` owned by Ada with `memberCount` 3, `Abuja Pacers`, then `Club 03` to `Club 45`;
    - 2 sessions.
  - **What the fake implements of spec §6:**
    - a token check (401);
    - the manifest, with live counts;
    - lists with paging, case-insensitive `contains` on `searchable`, sort and filters, answering 422 `Invalid query parameter: …` for unknown keys, a `sortBy` outside `sortable`, or one in `rejectSortBy`;
    - reads, with 404 for an unknown key;
    - creates and updates, answering:
      - 403 when `can` forbids;
      - 422 `<field>: Required`;
      - 422 `<key>: Unrecognized key` for read-only or unknown keys;
      - 422 `<field>: no such user`;
      - 201 for a create, with `_key` `fake-<n>`, `_title` and `_refs`;
    - deletes: 409 `Other records still point at this one` for a key in `referenced`, otherwise 200.
  - **Bookkeeping:** every request is recorded in `requests`.
  - **MSW:** `adminHandlers` wraps the fake with `http.all(origin + '/api/admin/*')`.
- [ ] **Step 2: Write the failing tests.**
  - **`fake-api.test.ts`:** a manifest without a token gets 401, and with `FAKE_TOKEN` 200 and 50 records in total. A list at `?page=3` returns 5 clubs.
  - **`api.test.ts`:** the MSW server mounts the fake at `https://strive.test`, plus per-test overrides.
    - **The request URL:** `list('clubs', { page: 2, size: 20, query: 'lag', sortBy: 'name', sortOrder: 'asc', filters: { isPublic: 'true' } })` sends exactly `/api/admin/clubs?page=2&size=20&query=lag&sortBy=name&sortOrder=asc&isPublic=true`.
    - **Keys are encoded:** `get('clubs', 'a/b')` requests `/api/admin/clubs/a%2Fb`.
    - **Error mapping:**

      | Response | `AdminApiError` |
      |---|---|
      | A wrong token | `unauthorized`, status 401 |
      | A 404 on the manifest | `off` |
      | A 404 on a record | `not-found` |
      | `HttpResponse.error()` | `unreachable`, status `null` |
      | A 502 with an HTML body | `unreachable` |
      | A 500 with `{ message: 'boom' }` | `server`, message `boom` |
      | A 422 `{ message: 'name: Required' }` | `invalid`, `field` `'name'`, message `'name: Required'` |
      | A 409 `{ message: 'email: already in use' }` | `conflict`, `field` `'email'` |
      | A 409 `{ message: 'Other records still point at this one' }` | `conflict`, `field` `null` |
      | A 403 | `forbidden` |

- [ ] **Step 3: Run them to see them fail.** Run `yarn test tests/unit/api.test.ts tests/unit/fake-api.test.ts`. Expected: FAIL.
- [ ] **Step 4: Implement `axios.ts` and `api.ts`.** The mapping is in the table above.
  - **`field`** is the text before the first `': '`, when it matches `/^[A-Za-z_][\w.]*$/`. It's read for 409s and 422s only.
  - **When a body has no string `message`,** the error message is a fallback per kind: "Couldn't reach it.", "Unexpected response."
- [ ] **Step 5: Run the tests.** Run `yarn test tests/unit/api.test.ts tests/unit/fake-api.test.ts`. Expected: PASS.
- [ ] **Step 6: Commit.** Run `git commit -m "feat: typed admin API client and an in-memory fake of the contract"`.

---

### Task 4: Primitives, with Sara's modal and field

**Files:**
- Create: `src/utils/cn.ts`, and in `src/primitives/`: `index.ts`, `Modal.tsx`, `Field.tsx`, `Notice.tsx`, `Button.tsx`, `Input.tsx`, `Textarea.tsx`, `Select.tsx`, `Checkbox.tsx`, `table.tsx`, `Menu.tsx`, `Popover.tsx`, `Pill.tsx`, `Dot.tsx`, `Skeleton.tsx`, `Logo.tsx`, `ProductMark.tsx`, `Toaster.tsx`
- Test: `tests/unit/primitives.test.tsx`

**Interfaces:**
- Produces, all exported from `@/primitives`:
  - **`cn(...inputs: ClassValue[]): string`**, with `clsx` and `tailwind-merge`.
  - **`Modal`:** Sara's `src/primitives/Modal.tsx` API exactly.
    - **The parts:** `Modal({ open?, onOpenChange?, defaultOpen?, children })`, `Modal.Button` (`Dialog.Trigger`), `Modal.Portal({ children, className?, container? })`, `Modal.Content` (forwardRef over `Dialog.Content`), `Modal.Title`, `Modal.Description`, `Modal.Close` (`Dialog.Close`), `Modal.Dismiss({ label = 'Close' })` and `Modal.Handle()`.
    - **Kept from Sara:**
      - the overlay wraps the content (`fixed inset-0 z-50 grid grid-cols-1 items-end overflow-y-auto overscroll-contain backdrop-blur-[2px] sm:place-items-center sm:p-6`, fading on `data-state`);
      - below 640px the content is a bottom sheet (`animate-sheet-in/out`), with `pb-[max(1.5rem,env(safe-area-inset-bottom))]`;
      - from 640px it's a panel (`sm:max-w-[480px]`, `animate-pop-in/out`);
      - the Dismiss button is round, pinned top right (`top-4 right-4`, `sm:top-5 sm:right-5`), and labelled "Close";
      - the handle is `aria-hidden`, `sm:hidden`.
    - **Restyled to interacti:**
      - the overlay is `bg-black/50`;
      - the content is `surface-light bg-ground text-ink` with no shadow, `rounded-t-[var(--radius-sheet)] sm:rounded-[var(--radius-sheet)]`;
      - the title is `--text-statement` at 500 with tracking −0.02em and `pr-10`;
      - the description is `text-ink/80`;
      - the Dismiss button is an `ink/10` circle holding the `×` glyph;
      - the handle is `ink/20`.
  - **`Field({ id: string; label: ReactNode; optional?: boolean; hint?: ReactNode; error?: string; className?: string; children: ReactNode })`:** Sara's `Field.tsx` exactly, plus `optional`.
    - It provides a context, `{ id; describedBy; invalid }`, read through `useFieldContext()`.
    - The label sits above its control, followed by " (optional)" when `optional`.
    - The error replaces the hint, with ids `${id}-error` and `${id}-hint`.
    - On `.surface-light` the label is `text-ink/80` and the hint `text-ink/80`, both at micro size; the error text is `text-ink` at 500.
  - **Controls:** `Input`, `Textarea` (`field-sizing: content`, min 3 rows), `Select` (native) and `Checkbox` (native) read `useFieldContext()` for `id`, `aria-describedby` and `aria-invalid`, as Sara's do. They're styled `rounded-[var(--radius-control)]` with a 1px `ink/30` border, a 44px minimum height and the body size.
  - **`Notice({ children; role?: 'alert' | 'status' })`:** a 1px `ink/30` bordered block of body text. It replaces Sara's `Notice tone="danger"`; there's no colour.
  - **`Button`** takes `variant?: 'primary' | 'secondary' | 'ghost'` (default `primary`), `size?: 'md' | 'sm'` and `asChild?: boolean` (radix `Slot`), plus button props.
    - Primary is `bg-ink text-ground rounded-full`.
    - Secondary is `border border-ink/30 rounded-full`.
    - Ghost is text only.
    - Disabled is `opacity-50`, with no pointer.
  - **`table.tsx`:**
    - `Table` is a `div.overflow-x-auto` frame around a `<table class="w-full text-body tabular-nums">`;
    - `TableHeader` and `TableBody`;
    - `TableRow` has `border-b border-ink/10` and `hover:bg-ink/10`;
    - `TableHead` is a `th` with `scope="col"` by default, `whitespace-nowrap`, micro size and `text-ink/50`;
    - `TableCell` has `max-w-[24rem] truncate`.
  - **Menus:** `Menu`, `MenuTrigger`, `MenuContent` and `MenuItem` (radix DropdownMenu), and `Popover`, `PopoverTrigger` and `PopoverContent` (radix Popover).
  - **Small parts:**
    - **`Pill`** is a 1px `ink/30` rounded pill, micro size.
    - **`Dot`** takes `{ live: boolean }` and renders the landing's `.dot` or `.dot--soon` with `aria-hidden`.
    - **`Skeleton`** is an `ink/10` block, pulsing only under `motion-safe`.
    - **`Logo`** is `<img src="/brand/interacti/logo-white.svg" alt="interacti">`, at least 72px wide.
    - **`ProductMark`** takes `{ product: ProductConfig; size?: 20 | 40 }`. It shows the tile with a 1px `ink/10` hairline, or, with no tile, a square with a 1px `ink/30` border holding the name's first letter at 500.
  - **`Toaster`** is sonner's `<Toaster>`, unstyled, with token classes: a white pill with black text for every type. An action button is underlined text.

- [ ] **Step 1: Write the failing test** `tests/unit/primitives.test.tsx`.
  - **`Field` wiring:** `render(<Field id="name" label="Name" error="Required"><Input /></Field>)`.
    - `getByLabelText('Name')` is the input, with `id="name"` and `aria-invalid="true"`.
    - Its `aria-describedby` is `name-error`, an element whose text is `Required`.
    - `<Field id="bio" label="Bio" optional hint="Shown on the profile."><Textarea /></Field>` labels the textarea `Bio (optional)` and describes it by `bio-hint`.
  - **A `Modal`** `open` with `Modal.Portal` → `Modal.Content` → `Modal.Handle`, `Modal.Dismiss`, `<Modal.Title>New club</Modal.Title>` and `<Modal.Description>Empty fields…</Modal.Description>`:
    - `getByRole('dialog', { name: 'New club' })` is described by `Empty fields…`;
    - `getByRole('button', { name: 'Close' })` closes it through `onOpenChange(false)`, and so does pressing Escape;
    - the content's class list includes `surface-light`;
    - the handle is `aria-hidden`.
  - **Other parts:**
    - `render(<Button asChild><a href="/x">Go</a></Button>)` renders a link named "Go".
    - `TableHead` renders `scope="col"`.
    - `ProductMark` for Fluid (no tile) renders the text `F`, and for Strive an `<img>` with `src="/brand/strive/tile.svg"` and `alt=""`.
- [ ] **Step 2: Run it to see it fail.** Run `yarn test tests/unit/primitives.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement the primitives.**
  - **Port, don't reinvent:** port `Modal.tsx` and `Field.tsx` from Sara line by line, changing only the classes listed above and swapping the Phosphor `X` for the `×` glyph.
  - **Test polyfills:** add jsdom-style polyfills to `tests/setup.ts` only if radix needs them under happy-dom (`ResizeObserver`, `hasPointerCapture`).
- [ ] **Step 4: Run the test.** Run `yarn test tests/unit/primitives.test.tsx`. Expected: PASS.
- [ ] **Step 5: Commit.** Run `git commit -m "feat: monochrome primitives, with sara's modal and field"`.

---

### Task 5: Auth, providers, routes and sign-in

**Files:**
- Create: `src/provider/auth-provider.tsx`, `src/provider/query-client.ts`, `src/provider/index.tsx`, `src/hooks/use-product-api.ts`, `src/utils/verify-token.ts`, `src/app/router.tsx`, `src/app/require-auth.tsx`, `src/app/routes/sign-in.tsx`, `src/app/routes/not-found.tsx`, `tests/unit/render.tsx`
- Modify: `src/main.tsx` (mount `Provider` and `RouterProvider`)
- Test: `tests/unit/auth.test.tsx`, `tests/unit/sign-in.test.tsx`

**Interfaces:**
- Consumes: `products`, `canSendToken`, `createAdminClient`, `adminApi`, `isAdminApiError`, and the primitives.
- Produces:
  - **`TOKEN_STORAGE_KEY = 'ix-admin-token'`.**
  - **`AuthProvider`** takes `{ children; storage?: Storage; onSignOut?: () => void }`, and `useAuth()` returns `{ token: string | null; signIn(token: string): void; signOut(): void }`.
  - **`createQueryClient(): QueryClient`,** with Strive's defaults (`staleTime: 5 * 60_000`, `refetchOnMount: 'always'`, `refetchOnWindowFocus: 'always'`) and `retry: (count, error) => count < 3 && isAdminApiError(error) && (error.kind === 'unreachable' || error.kind === 'server')`. This is a Call: a 4xx won't change on retry. It's set once here, never per query.
  - **`Provider({ children })`:** `QueryClientProvider` → `AuthProvider` (whose `onSignOut` clears the query cache) → `Toaster`.
  - **`useProductApi(slug: ProductSlug): ReturnType<typeof adminApi> | null`:** `null` unless the product is `ready` and a token exists. It's memoised on `apiBase` and `token`.
  - **`verifyToken(token: string, list = products): Promise<{ accepted: ProductSlug[]; rejected: ProductSlug[]; failed: ProductSlug[] }>`:** it calls `manifest()` on every ready product in parallel. A 401 is `rejected`; any other error is `failed`.
  - **`routes: RouteObject[]`:** `/sign-in`, then a `RequireAuth` + `AppShell` layout. Its children are added in Tasks 6, 9 and 10, and `*` is `NotFoundPage`. There is no create or edit route.
  - **`renderApp(path: string, options?: { token?: string | null }): RenderResult & { router }`:** used by every later page test. It mounts `routes` in `createMemoryRouter` inside a fresh `Provider`, with the token preset in `sessionStorage`.

- [ ] **Step 1: Write the failing tests.**
  - **`auth.test.tsx`:**
    - `signIn('t')` stores `t` under `ix-admin-token`;
    - `signOut()` removes it and calls `onSignOut` once;
    - the provider starts from a stored token;
    - `renderApp('/strive', { token: null })` lands on `/sign-in?next=%2Fstrive`.
  - **`sign-in.test.tsx`:** MSW mounts the fake at `https://strive.test` with `FAKE_TOKEN`, and at `https://sara.test` with a different token.
    - Typing a wrong token and submitting shows `That token wasn't accepted.`, and the URL stays `/sign-in`.
    - `FAKE_TOKEN` navigates to `next`: from `/sign-in?next=%2Fstrive%2Fclubs` it lands on `/strive/clubs`, even though Sara rejected the token.
    - `next=%2F%2Fevil.example` lands on `/`.
    - With every origin answering `HttpResponse.error()`, it shows `Couldn't reach any product. Check that their admin is switched on.`
    - The button reads `Checking…` and is disabled while pending.
    - On `http://admin.example/sign-in` (set the page URL through happy-dom), it shows `Sign-in needs HTTPS.` and the button is disabled.
- [ ] **Step 2: Run them to see them fail.** Run `yarn test tests/unit/auth.test.tsx tests/unit/sign-in.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **The sign-in screen** (spec §8.1) is centred on black: the `Logo`, the eyebrow "Admin", a `Field` "Admin token" with an `Input type="password"` and `autoComplete="current-password"`, and the primary button "Sign in".
  - **`next`** is honoured only when it starts with `/` and not `//`.
- [ ] **Step 4: Run the tests.** Run `yarn test tests/unit/auth.test.tsx tests/unit/sign-in.test.tsx`. Expected: PASS.
- [ ] **Step 5: Commit.** Run `git commit -m "feat: token sign-in that checks every product and refuses http"`.

---

### Task 6: Query hooks, app shell, overview and product page

**Files:**
- Create: `src/hooks/queries/keys.ts`, `use-manifest.ts`, `use-records.ts`, `use-record.ts`, `src/utils/format.ts`, `src/components/app-shell.tsx`, `product-nav.tsx`, `product-card.tsx`, `state-message.tsx`, `src/app/routes/overview.tsx`, `src/app/routes/product.tsx`
- Modify: `src/app/router.tsx` (the index and `:product` children)
- Test: `tests/unit/format.test.ts`, `tests/unit/overview.test.tsx`

**Interfaces:**
- Consumes: `useProductApi`, `toSearchParams`, the primitives, and `renderApp`.
- Produces:
  - **`adminKeys`:**
    - `all: ['admin']`;
    - `manifest: (p) => ['admin', p, 'manifest']`;
    - `lists: (p, r) => ['admin', p, r, 'list']`;
    - `list: (p, r, params: ListParams) => ['admin', p, r, 'list', toSearchParams(params).toString()]`;
    - `detail: (p, r, key) => ['admin', p, r, 'detail', key]`.

    Every key is a flat array of strings.
  - **Query hooks:**
    - `useManifestQuery(slug: ProductSlug): UseQueryResult<AdminManifest, AdminApiError>`;
    - `useRecordsQuery(slug, resource: string, params: ListParams): UseQueryResult<PaginatedApiResponse<AdminRecord[]>, AdminApiError>`;
    - `useRecordQuery(slug, resource: string, key: string): UseQueryResult<AdminRecord, AdminApiError>`.

    Each is `enabled` only when `useProductApi(slug)` isn't null.
  - **`describeConnection(product: ProductConfig, manifest: { data?: AdminManifest; error: AdminApiError | null; isLoading: boolean }): string`:**

    | When | Text |
    |---|---|
    | `no-backend` | `No backend yet` |
    | `not-configured` | `Not connected` |
    | `needs-https` | `Needs HTTPS` |
    | loading | `Checking…` |
    | `unauthorized` | `Token rejected` |
    | `off` | `Admin is off` |
    | `unreachable` or `server` | `Couldn't reach it` |
    | the manifest is loaded | `{n} resource(s) · {total} record(s)`, with thousands separators |

  - **Formatting:** `formatCount(n: number): string` (`en-GB` grouping) and `fixFor(product: ProductConfig): string | null`. `fixFor` gives `Set VITE_API_FLUID and rebuild.`, `Use an https address for VITE_API_SARA.`, `Set ADMIN_API_TOKEN on the server and restart it.` for `off`, or `null`.
  - **`AppShell`** has the rail at 1024px and up, and the top bar with "Menu" below that. The menu is a full-screen black radix Dialog, the landing's phone menu, so not `Modal`. Both render `ProductNav` and "Sign out". `<main id="main">` holds the `Outlet`.
  - **`ProductNav({ activeSlug?: ProductSlug })`:** every product, with `ProductMark`, its name, and "Coming soon" at 50% when that applies. Harv3st isn't a link. The active product's resources are listed under their group headings, each linked, with its count at 50%.
  - **`StateMessage({ title: string; detail?: string; action?: ReactNode })`.**

- [ ] **Step 1: Write the failing tests.**
  - **`format.test.ts`:** `describeConnection` for every row of the table above. The manifest case gives `3 resources · 50 records`, and a single resource with a single record gives `1 resource · 1 record`. `formatCount(2340)` is `'2,340'`.
  - **`overview.test.tsx`:** `renderApp('/', { token: FAKE_TOKEN })` with the Strive fake accepting the token and the Sara fake rejecting it.
    - The Strive card reads `Strive`, `Live · SaaS` and `3 resources · 50 records`, and links to `/strive`.
    - The Sara card reads `Coming soon · AI` and `Token rejected`.
    - 0nbox reads `Not connected`.
    - Harv3st reads `No backend yet` and contains no link.
    - The Strive card still renders when Sara's fake answers with an HTML 502: Sara then reads `Couldn't reach it`.
    - `renderApp('/strive')` shows the groups `People`, `Clubs` and `Sign-in` as headings, with links `Users 3`, `Clubs 45` and `Sessions 2`.
    - `renderApp('/fluid')` shows `Not connected` and `Set VITE_API_FLUID and rebuild.`
    - `renderApp('/nope')` shows the not-found page.
- [ ] **Step 2: Run them to see them fail.** Run `yarn test tests/unit/format.test.ts tests/unit/overview.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **The overview** shows the page title "Products" at `--text-large`, then a grid of `ProductCard`s. The status line is "● Live · SaaS" or "○ Coming soon · AI": `Dot` plus text.
  - **The product page** shows the eyebrow "{field} · {Live|Coming soon}" and the product name as `h1`. Below that come its connection state through `StateMessage` with `fixFor`, or the grouped resource list, with skeletons while loading.
- [ ] **Step 4: Run the tests.** Run `yarn test tests/unit/format.test.ts tests/unit/overview.test.tsx`. Expected: PASS.
- [ ] **Step 5: Commit.** Run `git commit -m "feat: product overview, resource index and the app shell"`.

---

### Task 7: Delete modal

**Files:**
- Create: `src/hooks/mutations/use-record-mutations.ts`, `src/components/delete-modal.tsx`
- Test: `tests/unit/delete-modal.test.tsx`

**Interfaces:**
- Consumes: `adminKeys`, `useProductApi`, `Modal`, `Field`, `Input` and `Button`.
- Produces:
  - **`useDeleteRecordMutation(slug: ProductSlug, resource: string): UseMutationResult<void, AdminApiError, { key: string; title: string }>`.** On success it invalidates `adminKeys.lists(slug, resource)` and `adminKeys.manifest(slug)`, and removes `adminKeys.detail(slug, resource, key)`.
  - **`DeleteModal`** takes `{ resource: AdminResourceMeta; record: AdminRecord | null; open: boolean; onOpenChange(open: boolean): void; onConfirm(): void; isPending: boolean; error: AdminApiError | null }`.
    - It's presentational, like Sara's `ConfirmModal`; the list page owns the mutation (Task 9).
    - It's laid out as `ConfirmModal`: `Modal.Handle`, `Modal.Title`, `Modal.Description`, the confirm field, then the actions `grid gap-2.5 sm:flex sm:flex-row-reverse`, with the primary `Delete {singular, lowercased}` and `Modal.Close` → secondary `Cancel`.

- [ ] **Step 1: Write the failing test** `tests/unit/delete-modal.test.tsx`.
  - **The dialog:** `render(<DeleteModal open resource={clubs} record={lagos} … />)` is named `Delete Lagos Runners?` and described by `This can't be undone. Records that belong to it may be deleted with it.`
  - **The confirm button** `Delete club` is disabled until the field `Type delete to confirm` reads `delete`. Case and surrounding spaces don't matter: `' DELETE '` counts.
  - **Confirming** calls `onConfirm` once. With `isPending`, the button reads `Deleting…`, is disabled, and a second click doesn't call `onConfirm`.
  - **An error:** with `error` a `conflict` `AdminApiError` reading `Other records still point at this one`, the description is that message, as in Sara's `ConfirmModal`, and the modal stays open.
  - **The mutation hook,** rendered with the Strive fake: `mutateAsync({ key, title })` sends `DELETE /api/admin/clubs/<key>`, the fake loses the record, and the list query is invalidated.
- [ ] **Step 2: Run it to see it fail.** Run `yarn test tests/unit/delete-modal.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.** The field resets whenever the modal opens for a new record. The parent remounts it by `key` (Task 9).
- [ ] **Step 4: Run the test.** Run `yarn test tests/unit/delete-modal.test.tsx`. Expected: PASS.
- [ ] **Step 5: Commit.** Run `git commit -m "feat: type-to-confirm delete modal in sara's confirm layout"`.

---

### Task 8: The create and edit modal

**Files:**
- Create: `src/forms/fields.ts`, `src/hooks/use-debounce.ts`, `src/components/record-form-modal.tsx`, `field-input.tsx`, `relation-picker.tsx`
- Modify: `src/hooks/mutations/use-record-mutations.ts` (create and update)
- Test: `tests/unit/form-fields.test.ts`, `tests/unit/record-form-modal.test.tsx`

**Interfaces:**
- Consumes: the manifest types, `useRecordsQuery`, `Modal`, `Field`, the controls, `Notice` and `Popover`.
- Produces:
  - **`useDebounce(callback: (value: string) => void, delay = 500): (value: string) => void`.** This is Dandys' `src/hooks/useDebounce.tsx`. The picker uses it here, and Task 9's search after it.
  - **`FormValue = string | boolean`.**
  - **`formFields(resource: AdminResourceMeta, mode: 'create' | 'update'): AdminFieldMeta[]`:** the fields that aren't `readOnly`, and on update aren't `isId` either, in manifest order.
  - **`isOptional(field: AdminFieldMeta, mode: 'create' | 'update'): boolean`:** `!field.required` on create and `field.nullable` on update.
  - **`buildFormSchema(fields: AdminFieldMeta[], mode): z.ZodObject`.** Zod 4, over string and boolean values. A non-optional field must not be empty. The messages:
    - `Required`;
    - `Enter a whole number` (`int`);
    - `Enter a number` (`float`, `decimal`: `/^-?\d+(\.\d+)?$/`);
    - `Enter a date`;
    - `Enter valid JSON`;
    - `Choose one of the options`;
    - list lines are checked per item type.
  - **`toFormValues(fields: AdminFieldMeta[], record?: AdminRecord): Record<string, FormValue>`:**
    - `datetime` becomes local `YYYY-MM-DDTHH:mm`;
    - `json` becomes `JSON.stringify(v, null, 2)`;
    - a list is joined with `'\n'`;
    - `null` becomes `''`;
    - a boolean stays a boolean (default `false`).
  - **`toPayload(fields, values, mode, dirty: Partial<Record<string, boolean>>): Record<string, unknown>`.** It covers dirty fields only.
    - **Empty values:** `''` is left out on create, and is `null` on update.
    - **Numbers:** `int` goes through `parseInt`, `float` through `Number`, and `decimal` stays a string.
    - **Dates:** `datetime` becomes `new Date(v).toISOString()`.
    - **JSON and lists:** `json` goes through `JSON.parse`. A list becomes its trimmed, non-empty lines, with `int` lists as numbers.
  - **`fieldErrorFrom(error: AdminApiError, names: string[]): { field: string | null; message: string }`.**
    - When `error.field` is in `names`, it returns that field and the message after `': '`.
    - A `not-found` gives `{ field: null, message: "This record doesn't exist any more." }`.
    - Anything else gives `{ field: null, message: error.message }`.
  - **Mutations:** `useCreateRecordMutation(slug, resource): UseMutationResult<AdminRecord, AdminApiError, Record<string, unknown>>` and `useUpdateRecordMutation(slug, resource): UseMutationResult<AdminRecord, AdminApiError, { key: string; body: Record<string, unknown> }>`. On success both invalidate the list, the detail and the manifest.
  - **`RecordFormModal`:** Sara's `ServiceModal` contract. It takes `{ open: boolean; onOpenChange(open: boolean): void; product: ProductConfig; resource: AdminResourceMeta; record?: AdminRecord; onSubmit(payload: Record<string, unknown>): void; isPending: boolean; error: AdminApiError | null; onCloseAutoFocus?: (event: Event) => void }`.
    - **Its own state** is only the form, through react-hook-form with `zodResolver(buildFormSchema(...))` and `defaultValues: toFormValues(...)`. It never calls the API itself.
    - **Inside** `Modal.Content className="sm:max-w-[560px]"`, in order:
      1. `Modal.Handle`, then `Modal.Dismiss`;
      2. `Modal.Title`: `New {singular, lowercased}` or `Edit {singular, lowercased}`;
      3. `Modal.Description`: the `note`, otherwise `Empty fields take {product.name}'s default.` or `Only the fields you change are sent.`;
      4. `<form noValidate autoComplete="off" className="mt-6 grid gap-4">`, holding one `Field` + `FieldInput` per `formFields` entry, a `Notice` for form-level errors, and the actions `mt-2 grid gap-2.5 sm:flex sm:flex-row-reverse`. The actions are the primary submit (`Create {singular, lowercased}` or `Save changes`, `Saving…` and disabled while pending) and `Modal.Close asChild` → secondary `Cancel`.
    - **On submit** in edit mode with no dirty field, it shows the `Notice` `Nothing to save.` and doesn't call `onSubmit`.
    - **A field-level `error`** goes to `setError` on that field; other errors go to the `Notice`.
  - **`FieldInput({ field: AdminFieldMeta; product: ProductConfig; record?: AdminRecord })`** renders one control per spec §8.4.2's table, registered through `useFormContext`.
  - **`RelationPicker`** takes `{ product: ProductSlug; target: string; value: string; initialTitle?: string; onChange(key: string): void }`, with its `id` and invalid state from `useFieldContext()`.
    - It's an input with `role="combobox"`, `aria-expanded` and `aria-controls`, plus a `Popover` holding a `role="listbox"`. The popover is portalled into the modal content (`container`), so it stays inside the focus trap.
    - It searches with `useRecordsQuery(product, target, { page: 1, size: 10, query, filters: {} })`, debounced 300ms.
    - Each option shows `_title`, with `_key` at 80%.
    - Enter or a click selects. A pasted key is kept as typed when it's blurred.

- [ ] **Step 1: Write the failing tests.**
  - **`form-fields.test.ts`:**
    - **Which fields:** `formFields(clubs, 'create')` names `name, description, ownerId, isPublic, settings, tags, startsAt` (no `id`, `memberCount` or `createdAt`). On update, `users` has no `id`.
    - **Optional fields:** `isOptional(description, 'create')` is true and `isOptional(name, 'create')` false. On update, a non-nullable `name` isn't optional.
    - **Validation:**
      - `buildFormSchema` on create with `name: ''` fails at `name` with `Required`;
      - `int` `'1.5'` gives `Enter a whole number`;
      - `decimal` `'12.50'` passes and `'abc'` gives `Enter a number`;
      - `json` `'{'` gives `Enter valid JSON`;
      - `datetime` `'x'` gives `Enter a date`.
    - **Create payloads:** `toPayload(…, 'create', { name: true, ownerId: true, isPublic: true })` with those three values filled is `{ name: 'Night Owls', ownerId: '<ada key>', isPublic: true }`, and an empty dirty `description` is left out.
    - **Update payloads:**
      - a cleared `description` gives `{ description: null }`;
      - `settings` `'{"a":1}'` gives `{ settings: { a: 1 } }`;
      - `tags` `'a\n\n b '` gives `['a', 'b']`;
      - `startsAt` `'2026-10-22T14:32'` gives `new Date('2026-10-22T14:32').toISOString()`.
    - **Errors:** `fieldErrorFrom` with a `not-found` error gives the "doesn't exist any more" message.
  - **`record-form-modal.test.tsx`:** the MSW fake serves the relation search, and `onSubmit` is a spy.
    - **Create** (`record` undefined):
      - the dialog is named `New club` and described by `Empty fields take Strive's default.`;
      - `Description (optional)` is a textbox and `Name` has no "(optional)";
      - there are no inputs for `Member count`, `Id` or `Created at`.
      - Fill `Name` with `Night Owls`, type `ada` in `Owner` and choose the option `ada@x.co`, check `Is public`, then press `Create club`. `onSubmit` is called once with `{ name: 'Night Owls', ownerId: '<ada key>', isPublic: true }`.
    - **Edit** (`record` = Lagos Runners):
      - the dialog is named `Edit club`, with `Name` prefilled;
      - changing only `Name` calls `onSubmit` with `{ name: 'Lagos Night Runners' }`;
      - submitting unchanged shows `Nothing to save.` and doesn't call `onSubmit`.
    - **Pending:** with `isPending`, the submit reads `Saving…` and is disabled.
    - **Errors in the modal:**
      - a 422 error with `field` `name` and message `name: Too short` shows `Too short` under `Name`;
      - a 409 `name: already in use` shows `already in use` under `Name`;
      - a 422 naming no field shows in the `Notice`;
      - a `not-found` error shows `This record doesn't exist any more.` in the `Notice`.
    - **Closing:** `Cancel` and the `Close` button both call `onOpenChange(false)`.
    - **A tall form:** with 20 fields in a 375px-tall viewport, the overlay (`Modal.Portal`'s wrapper) has `overflow-y: auto`, and the submit is reachable by scrolling it.
- [ ] **Step 2: Run them to see them fail.** Run `yarn test tests/unit/form-fields.test.ts tests/unit/record-form-modal.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.** Mirror `service-modal.tsx`'s structure, but generate the fields from `formFields`. The fetch for the picker's options is the only network call.
- [ ] **Step 4: Run the tests.** Run `yarn test tests/unit/form-fields.test.ts tests/unit/record-form-modal.test.tsx`. Expected: PASS.
- [ ] **Step 5: Commit.** Run `git commit -m "feat: one sara-style modal for creating and editing any resource"`.

---

### Task 9: The resource table and its modals

**Files:**
- Create: `src/hooks/use-pagination.ts`, `src/hooks/use-list-params.ts`, `src/utils/search-params.ts`, `src/components/data-table.tsx`, `columns.tsx`, `field-value.tsx`, `table-toolbar.tsx`, `filter-menu.tsx`, `pagination.tsx`, `src/app/routes/resource-list.tsx`
- Modify: `src/utils/format.ts` (value formatting), `src/app/router.tsx` (`:product/:resource`)
- Test: `tests/unit/use-pagination.test.ts`, `tests/unit/search-params.test.ts`, `tests/unit/resource-list.test.tsx`

**Interfaces:**
- Consumes: `useManifestQuery`, `useRecordsQuery`, the three mutations, `useDebounce`, `DeleteModal`, `RecordFormModal` and the primitives.
- Produces:
  - **`DOTS = '…'` and `usePagination({ totalCount, pageSize = 20, siblingCount = 1, currentPage }): Array<number | typeof DOTS>`.** This is Dandys' algorithm, returning `[]` when there's nothing to page.
  - **URL helpers:**
    - `createUrl(pathname: string, params: URLSearchParams): string`, which is Dandys', `%2C` → `,` included;
    - `readListParams(search: URLSearchParams, resource: AdminResourceMeta): ListParams`;
    - `withParam(search: URLSearchParams, key: string, value: string | null): URLSearchParams`, which returns a copy, deletes the key when the value is empty, and deletes `page` when `key !== 'page'`.
  - **`useListParams(resource: AdminResourceMeta): { params: ListParams; setParam(key: string, value: string | null): void; reset(): void }`.** It writes with `navigate(createUrl(...), { replace: true, preventScrollReset: true })`.
  - **`formatValue(field: AdminFieldMeta, value: unknown): string`:**
    - `datetime` through `Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })`;
    - `boolean` as `Yes` or `No`;
    - `json` as compact `JSON.stringify`;
    - a list joined with `', '`;
    - `null` as `—`;
    - everything else as `String`.
  - **`FieldValue`** takes `{ product: ProductSlug; field: AdminFieldMeta; value: unknown; ref?: AdminRef | null; full?: boolean }`.
    - A foreign key renders a link to `/${product}/${field.relation.resource}/${encodeURIComponent(ref.key)}`, labelled `ref.title`.
    - An `enum` renders a `Pill`, and `No` and `—` render at the surface's secondary opacity.
    - With `full`, JSON is pretty-printed in `<pre class="whitespace-pre-wrap break-words">`, and text wraps.
  - **`buildColumns(ctx: { product: ProductSlug; resource: AdminResourceMeta; onEdit(record: AdminRecord): void; onDelete(record: AdminRecord): void }): ColumnDef<AdminRecord>[]`.**
    - **First** comes the title column: a `Link` to the record's view with `data-record-link={_key}` and `state: { fromList: location.search }`.
    - **Then** come `resource.columns` minus the title field.
    - **Last** comes `{ id: 'actions' }`: a `Menu` with View (a link), Edit (if `can.update`, calling `onEdit`) and Delete (if `can.delete`, calling `onDelete`), triggered by a `⋯` button with sr-only `Open menu`.
  - **`DataTable<T>`** takes `{ columns: ColumnDef<T>[]; data: T[]; sort: { by?: string; order?: 'asc' | 'desc' }; sortable: string[]; onSort(field: string): void; isLoading: boolean; empty: ReactNode; caption: string }`.
    - It uses `manualSorting` and `manualPagination`.
    - Sortable headers are buttons showing `↑` or `↓`, with `aria-sort` on the `th`.
    - While loading it shows 8 skeleton rows; when empty, one row spans every column.
  - **`TableToolbar`** takes `{ resource; params; onSearch(value: string): void; onFilter(field: string, value: string | null): void; onClear(): void; onCreate: (() => void) | null }`.
  - **`FilterMenu`** is a `Popover` listing `filterable`:
    - an `enum` offers its values;
    - a `boolean` offers Yes and No;
    - an active foreign key filter shows as a removable chip, "Owner: <key> ×".
  - **`Pagination({ totalCount, pageSize, currentPage, onPageChange })`.** Previous and next carry `aria-label`s and are disabled at the ends; the current page has `aria-current="page"`.
  - **`ListOutletContext = { openEditor(record?: AdminRecord): void; confirmDelete(record: AdminRecord): void }`.** `ResourceListPage` passes it to its `<Outlet context>` for the record view (Task 10).
  - **`ResourceListPage`** owns the modals the way Sara's `ServicesPageClient` does:
    - `editing: { key: number; record?: AdminRecord }` and `formOpen`;
    - `removing: { key: number; record: AdminRecord | null }` and `deleteOpen`;
    - the create, update and delete mutations;
    - `openEditor(record?)`, which runs `create.reset(); update.reset()`, bumps `editing.key` and opens;
    - `confirmDelete(record)`, which runs `remove.reset()`, bumps `removing.key` and opens.

    It renders `<RecordFormModal key={editing.key} …>` and `<DeleteModal key={removing.key} …>`.
  - **On a successful save,** following Sara (`onSuccess: () => setFormOpen(false)`):
    - a create toasts `Club created.` with the action `View`, which navigates to the new record's view;
    - an update toasts `Saved.`.

    On a successful delete, it closes and toasts `Deleted {title}.`. On close, `onCloseAutoFocus` focuses the edited row's `[data-record-link]`, or for a create the `New {singular}` button.

- [ ] **Step 1: Write the failing tests.**
  - **`use-pagination.test.ts`:**

    | `totalCount`, `pageSize`, `currentPage` | Result |
    |---|---|
    | 50, 10, 1 | `[1, 2, 3, 4, 5]` |
    | 200, 10, 1 | `[1, 2, 3, 4, 5, DOTS, 20]` |
    | 200, 10, 10 | `[1, DOTS, 9, 10, 11, DOTS, 20]` |
    | 200, 10, 20 | `[1, DOTS, 16, 17, 18, 19, 20]` |
    | 0 | `[]` |

  - **`search-params.test.ts`:**
    - `createUrl('/strive/clubs', new URLSearchParams('tags=a,b'))` is `'/strive/clubs?tags=a,b'`.
    - `readListParams(new URLSearchParams('page=-3&size=500&sortBy=gone&sortOrder=up&isPublic=maybe&nope=1'), clubs)` equals `{ page: 1, size: 20, filters: {} }`.
    - `'page=2&size=50&query=%20lag%20&sortBy=name&sortOrder=asc&isPublic=true&ownerId=u1'` parses to `{ page: 2, size: 50, query: 'lag', sortBy: 'name', sortOrder: 'asc', filters: { isPublic: 'true', ownerId: 'u1' } }`.
    - `withParam(new URLSearchParams('page=3&query=x'), 'query', '')` is empty, and `withParam(…, 'page', '2')` keeps `query`.
  - **`resource-list.test.tsx`:** `renderApp('/strive/clubs', { token: FAKE_TOKEN })`.
    - **The page:** the heading reads `Clubs` with `45` at 50%, the eyebrow `Strive · Clubs`, and the button `New club`. There are 20 body rows, and `Lagos Runners` is a link. Its Owner cell links to `/strive/users/<ada key>`, labelled `ada@x.co`.
    - **Paging:** clicking page `2` sets the URL search to `?page=2` and shows `Club 22`.
    - **Searching:** typing `lag` updates the URL to `?query=lag` once 500ms of fake timers have passed, and the fake's last request has `query=lag` and no `page`.
    - **Sorting:** clicking the `Name` header cycles `sortBy=name&sortOrder=asc`, then `desc`, then no sort parameters. The `th` carries `aria-sort="ascending"`, then `"descending"`.
    - **Filtering:** choosing Public → Yes adds `isPublic=true`.
    - **No matches:** searching `zzz` shows `No clubs match.`, and `Clear search and filters` empties the URL search.
    - **No records:** with the fake's sessions emptied, `/strive/sessions` shows `No sessions yet.`
    - **A stale manifest:** with the fake's `rejectSortBy: ['name']`, visiting `?sortBy=name` shows the error with `Reset the table`, and that button clears the search.
    - **A failed load:** when the list request answers `HttpResponse.error()`, the page shows `Couldn't load clubs. Strive didn't answer.` with `Try again`. Once the fake answers again, `Try again` shows the rows.
    - **Creating:** `New club` opens the dialog `New club` over the table, and the URL is unchanged. Fill and submit it:
      - the fake receives `POST /api/admin/clubs` with exactly the filled fields;
      - the dialog closes and the toast reads `Club created.`;
      - the list shows `Clubs 46`, and the toast's `View` navigates to `/strive/clubs/fake-1`.
    - **Editing:** the row menu `Edit` on `Lagos Runners` opens `Edit club`. Changing `Name` sends `PUT /api/admin/clubs/<key>` with `{ name: 'Lagos Night Runners' }`. The dialog closes, the toast reads `Saved.`, the row shows the new name, and focus returns to that row's link.
    - **A failed save:** a fake 422 `name: Too short` keeps the dialog open with `Too short` under `Name`.
    - **Deleting:** the row menu `Delete` opens `Delete Lagos Runners?`. Typing `delete` and confirming sends one `DELETE`, closes the dialog, and toasts `Deleted Lagos Runners.`; the row is gone. With the key in `referenced`, the dialog stays open, described by `Other records still point at this one`, and the row remains.
    - **Sign-in resources:** `/strive/sessions` has no `New session` button, and its row menu has View and Delete but no Edit.
    - **A huge value:** a 5,000-character `description` in a column renders in a cell whose class includes `truncate`.
- [ ] **Step 2: Run them to see them fail.** Run `yarn test tests/unit/use-pagination.test.ts tests/unit/search-params.test.ts tests/unit/resource-list.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.** The page layout from top to bottom:
  - the eyebrow `{product.name} · {resource.group}`;
  - an `h1` with the label and the count at 50%;
  - the `note`, if there is one;
  - the toolbar;
  - the `DataTable`, captioned with an sr-only label;
  - the pagination;
  - `<Outlet context={…}>` for the record view;
  - the two modals.

  A resource key the manifest doesn't know shows the not-found page.
- [ ] **Step 4: Run the tests.** Run `yarn test tests/unit/use-pagination.test.ts tests/unit/search-params.test.ts tests/unit/resource-list.test.tsx`. Expected: PASS.
- [ ] **Step 5: Commit.** Run `git commit -m "feat: dandys-style tables with sara-style create, edit and delete modals"`.

---

### Task 10: Record view

**Files:**
- Create: `src/app/routes/record-view.tsx`
- Modify: `src/app/router.tsx` (`:key` as a child of the list route)
- Test: `tests/unit/record-view.test.tsx`

**Interfaces:**
- Consumes: `useRecordQuery`, `useManifestQuery`, `FieldValue`, `Modal`, and `ListOutletContext` from `resource-list.tsx`.
- Produces: `RecordView`, a route element that reads `product`, `resource` and `key` from `useParams` and decodes them. It renders an open `Modal` whose `Modal.Content` has `sm:max-w-[640px]`.

- [ ] **Step 1: Write the failing test** `tests/unit/record-view.test.tsx`.
  - **`renderApp('/strive/clubs/<lagos key>')`:**
    - The dialog is named `Lagos Runners`, with the eyebrow `Strive · Clubs`, rendered with `Modal.Handle` and `Modal.Dismiss`.
    - Its `<dl>` has `Owner` → a link `ada@x.co` to `/strive/users/<ada key>`, `Is public` → `No`, `Member count` → `3`, and read-only `Created at` present.
    - It has the buttons `Edit` and `Delete`.
  - **Related links:** a user's view lists `Clubs →`, linking to `/strive/clubs?ownerId=<ada key>`, and `Sessions →`, linking to `/strive/sessions?userId=<ada key>`.
  - **Edit and Delete:**
    - `Edit` closes the view: the URL becomes `/strive/clubs`, with the list's previous search when there was one. Exactly one dialog is then open, `Edit club`, prefilled with `Lagos Runners`.
    - `Delete` likewise leaves one dialog, `Delete Lagos Runners?`.
  - **Closing:** pressing Escape, or the `Close` button, navigates to `/strive/clubs`. When the view was opened from the table on `?page=2`, closing returns to `/strive/clubs?page=2` and focus lands on that row's `[data-record-link]` link.
  - **A session's view** has `Delete` but no `Edit`.
  - **A huge value:** a club whose `settings` JSON is 200 nested keys renders inside a `pre` with `whitespace-pre-wrap`.
  - **A missing record:** `renderApp('/strive/clubs/gone')` shows `This record doesn't exist any more.` and `Back to clubs`.
- [ ] **Step 2: Run it to see it fail.** Run `yarn test tests/unit/record-view.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **Closing:** `navigate(-1)` when `location.state?.fromList` is set, otherwise `navigate(listPath)`.
  - **Edit and Delete** close the same way, then call `openEditor(record)` or `confirmDelete(record)` from `useOutletContext<ListOutletContext>()`.
  - **Focus:** `onCloseAutoFocus` prevents radix's default and focuses `document.querySelector('[data-record-link="' + CSS.escape(key) + '"]')`.
- [ ] **Step 4: Run the test.** Run `yarn test tests/unit/record-view.test.tsx`. Expected: PASS.
- [ ] **Step 5: Commit.** Run `git commit -m "feat: record views with references, related lists and one modal at a time"`.

---

### Task 11: Journeys, accessibility and phones

**Files:**
- Create: `tests/fake-api/playwright.ts`, `tests/e2e/journey.spec.ts`, `tests/e2e/a11y.spec.ts`, `tests/e2e/phone.spec.ts`
- Modify: `tests/e2e/helpers.ts` (`signIn`), and any component that a check here finds failing

**Interfaces:**
- Consumes: the fake API and every screen.
- Produces:
  - **`installFakeApi(page: Page, origin: string, api: ReturnType<typeof createFakeAdminApi>): Promise<void>`.** It routes `${origin}/api/admin/**` to `api.handle`. It answers `OPTIONS` with 204 and adds `Access-Control-Allow-Origin: http://localhost:4173`, `Access-Control-Allow-Headers: Authorization, Content-Type` and `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS` to every response.
  - **`signIn(page: Page): Promise<void>`:** it installs the fakes (Strive accepting `FAKE_TOKEN`, Sara rejecting it), then signs in at `/sign-in`.

- [ ] **Step 1: Write the failing specs.**
  - **`journey.spec.ts`** (`desktop` and `reduced`):
    1. Sign in.
    2. The overview shows `3 resources · 50 records` for Strive and `Token rejected` for Sara.
    3. Open Strive, then Clubs, and search `lag`.
    4. Open `Lagos Runners`'s view, then choose `Edit`. The edit modal replaces the view.
    5. Rename it `Lagos Night Runners` and choose `Save changes`. The modal closes, `Saved.` shows, and the row reads the new name.
    6. From the row menu, choose `Delete`, type `delete` and confirm. It's gone from the list.
    7. Choose `New club`, create `Night Owls` owned by `ada@x.co`, and choose the toast's `View`. Its view opens.
  - **Keyboard** (`desktop`):
    - from the search field, Tab reaches the first title link;
    - Enter opens its view;
    - Escape closes it, and the focused element is that same link;
    - `Open menu` opens with Enter, and ArrowDown moves through View, Edit and Delete;
    - in the edit modal, Tab cycles inside it and never reaches the table behind.
  - **`a11y.spec.ts`:** `new AxeBuilder({ page }).analyze()` finds no violations on these screens:
    - `/sign-in`;
    - `/`;
    - `/strive`;
    - `/strive/clubs`;
    - an open view;
    - the open create modal;
    - the open edit modal with a server error showing;
    - the open delete modal.

    Every focused control inside a modal has a visible black outline when tabbed to: a computed `outline-style` other than `none`, and `outline-color` `rgb(0, 0, 0)`.
  - **`phone.spec.ts`** (`mobile`):
    - On each of the same screens, `document.documentElement.scrollWidth <= window.innerWidth`. The table frame may scroll sideways.
    - Each modal is a bottom sheet: its content's bottom edge is within 1px of the viewport bottom, its handle is visible, and the create form's submit is reachable by scrolling the overlay.
    - `Menu` opens a full-screen dialog listing the six products, and Harv3st in it isn't a link.
- [ ] **Step 2: Run them to see what fails.** Run `yarn e2e`. Expected: whatever these checks are the first to exercise fails, typically focus outlines on white modals, sideways overflow, or a missing label.
- [ ] **Step 3: Fix each failure in its component,** never in the test.
- [ ] **Step 4: Run them all.** Run `yarn e2e && yarn test && yarn typecheck`. Expected: all pass on `desktop`, `mobile` and `reduced`.
- [ ] **Step 5: Commit.** Run `git commit -m "test: journeys, axe, keyboard and 375px checks against the fake API"`.

---

### Task 12: Deploy kit

**Files:**
- Create: `deploy/nginx/admin.conf.template`, `deploy/setup-host.sh`, `deploy/release.sh`, `deploy/README.md`, `.github/workflows/deploy.yml`
- Modify: `README.md` (deploy and a first-use checklist)
- Test: `tests/unit/deploy.test.ts`

**Interfaces:**
- Consumes: the landing's `deploy/` kit and workflow, which are the models.
- Produces:
  - **The vhost template:** `__SERVER_NAME__` is substituted by `setup-host.sh [server_name]`, which defaults to `admin.interacti.84-12-92-46.sslip.io`. `APP_DIR` defaults to `/srv/interacti-admin`, and `SITE` to `/etc/nginx/conf.d/interacti-admin.conf`.
  - **`release.sh <sha>`:** the landing's script, with `APP_DIR=${APP_DIR:-/srv/interacti-admin}`.
  - **The workflow** "Deploy interacti admin" runs on a push to `main`.

- [ ] **Step 1: Write the failing test** `tests/unit/deploy.test.ts`. It reads the files as text and checks:
  - The template contains `try_files $uri /index.html;`.
  - It contains the exact `Content-Security-Policy` value from spec §11.
  - It contains `X-Robots-Tag "noindex, nofollow"`, `Referrer-Policy no-referrer` and `X-Frame-Options DENY`.
  - Every `location` block repeats the CSP header. `add_header` doesn't inherit into a location with its own `add_header`, so count `add_header Content-Security-Policy` against `location`.
  - `/assets/` is `immutable` and `index.html` is `no-cache`.
  - `release.sh` holds `/srv/interacti-admin`, and `setup-host.sh` defaults to `admin.interacti.84-12-92-46.sslip.io`.
  - The workflow runs `yarn test`, `yarn build` and the rsync to `/srv/interacti-admin/releases/$GITHUB_SHA/`.
- [ ] **Step 2: Run it to see it fail.** Run `yarn test tests/unit/deploy.test.ts`. Expected: FAIL.
- [ ] **Step 3: Write the files from the landing's kit.**
  - **Workflow steps:** verify the secrets, set up Node 24 and yarn, run `yarn install --frozen-lockfile`, `yarn test` and `yarn build`, upload, then release.
  - **`deploy/README.md`:**
    - first-time setup;
    - the certificate step, which is required because the app refuses http, with the landing's dry-run advice;
    - switching on each product (set `ADMIN_API_TOKEN` and `ADMIN_ORIGIN`, then restart; spec §5);
    - rolling back.
- [ ] **Step 4: Run the test and check the scripts.** Run `yarn test tests/unit/deploy.test.ts && bash -n deploy/setup-host.sh && bash -n deploy/release.sh`. Expected: PASS, and no syntax errors.
- [ ] **Step 5: Run every gate.** Run `yarn typecheck && yarn test && yarn build && yarn e2e`. Expected: all pass.
- [ ] **Step 6: Commit.** Run `git commit -m "chore(deploy): static nginx release kit for the admin subdomain"`.

---

## After the last task

- Run superpowers:finishing-a-development-branch for the merge or PR.
- **First use, by the owner:**
  1. Create the GitHub repo and add the `SSH_HOST`, `SSH_USER` and `SSH_KEY` secrets.
  2. On the host, run `deploy/setup-host.sh` and certbot for `admin.interacti.84-12-92-46.sslip.io`.
  3. Set `ADMIN_API_TOKEN` and `ADMIN_ORIGIN` on each product and restart it, after the admin API plan has shipped to that product.
  4. Sign in.
