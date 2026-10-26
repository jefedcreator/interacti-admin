# Product Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/:product` (for example `/0nbox`) opens with an Analytics section: a 7 / 30 / 90 day switch, a headline tile (visitors), tiles for page views and enquiries where the product tracks them, each with its change against the previous period, and a chart of visitors and page views per day, above the existing resource list.

**Architecture:** The numbers come from Google Analytics 4, read by each product's **server** through the GA4 Data API and handed to the dashboard by one new read-only admin route, `GET /api/admin/analytics?days=`. The Google credential therefore lives only in the product's server environment; the dashboard stays a static, secret-free page that talks to `/api/admin` only. The route sends labelled metrics and series, so the dashboard holds no product rules: it renders whatever tiles it is given, and a product that tracks no enquiries simply sends no enquiries tile.

**Tech Stack:** Dashboard: React 19, TypeScript, Tailwind v4, TanStack Query, react-router 7, Vitest + Testing Library + MSW, Playwright; no chart library (one inline SVG). Backends (second plan): Next.js route handlers, `@google-analytics/data`.

**Spec:** `docs/superpowers/specs/2026-10-22-interacti-admin-design.md` (§3 non-goals, §5 access, §6 API, §8.1 screens, §9 design). Task 1 amends it.

## Global Constraints

- **Colour:** black `#000` and white `#fff` only, opacity steps 80/50/30/20/10. Nothing green, purple or red. A rise and a fall are told apart by the glyphs ↑ and ↓ and by the words; the chart's two lines are told apart by solid versus dashed and by a text legend.
- **Type:** Switzer 400 and 500 only. Tokens: `--text-micro` 14px, `--text-body` 16px, `--text-statement` 24px, `--text-large` 48px. Numbers use `tabular-nums`. Secondary text is `text-ink/50`.
- **No product rules:** no resource key, metric key, event name or label is written in the dashboard. Tiles and legend entries use the `label` the product sends.
- **Credentials:** the dashboard never handles a Google credential, and the analytics route never returns one. The admin token stays in `sessionStorage` only and is never logged, rendered, put in a URL or echoed in an error.
- **State in the URL:** the period is `?days=`, written with `createUrl` and replaced, never pushed (spec §8.2.3).
- **Queries:** keys come only from `adminKeys`; no optimistic updates, no `setQueryData`, no `placeholderData` (spec §10).
- **Phones:** everything holds at 375px with no sideways page scroll. **Accessibility:** WCAG 2.2 AA, `aria-busy` on loading regions, a text alternative for the chart.
- **Tooling:** yarn 1.22, Node 24. Run `yarn typecheck && yarn test` before every commit.
- **Commits:** plain messages. No `Co-Authored-By`, "Generated with" or other attribution trailers (the owner's standing rule in CLAUDE.md).

## Decisions already made

1. **Source:** Google Analytics Data API (chosen by the owner). Because the dashboard has no server and holds no secret (spec §4, §5), GA is read server-side by each product behind the admin route.
2. **Enquiries** show only where a product tracks them: the product sends an "Enquiries" metric or it doesn't.
3. **Backend work is a second plan** (outlined at the end): five repos, each with its own `src/backend/admin/kit`. This plan defines the contract and builds the dashboard against the test fake, so it ships first. Until a product implements the route its page says so in one line.
4. **Spec amendment:** §3 lists "charts or metrics" as a non-goal. Task 1 removes it.

## What the owner must do outside the code (the backend plan depends on it)

- Enable the **Google Analytics Data API** in a Google Cloud project and create a **service account**; add its email as a **Viewer** on each product's GA4 property.
- Find each property's **numeric property ID**. It is not the `G-…` measurement ID that the sites already load. Today only 0nbox and Strive send page hits to GA; Parcours, Sara and Fluid have no GA tag, so they show "not set up" until one is added.
- For enquiries: name the GA event a product sends when someone enquires (a key event in GA). A product with no such event gets no Enquiries tile.
- GA reports lag by up to a day, and today is partial. The product's `note` says so and the dashboard shows it.

## Review Focus

- **A product without the route** (404) or with its admin off: the section says so in one line and the resource list below still works. Pinned in Task 4.
- **GA not configured for a product** (`configured: false`): the product's own `note` is shown verbatim; no tiles, no chart. Pinned in Task 4.
- **GA failing upstream** (the product answers 502 with a message, for example quota or a revoked service account): "Couldn't load analytics." with the product's message and Try again; the rest of the page is unaffected. Pinned in Task 4.
- **A previous period of zero:** no division by zero and no "Infinity%". It reads "New", or "No activity" when both are zero. A change that rounds to 0% reads "↑ 1%" or "↓ 1%". Pinned in Task 2.
- **Empty, all-zero or one-point series, or two series of different lengths:** the chart draws flat or short lines with no `NaN` in any path and both lines on one shared scale. Pinned in Tasks 2 and 3.
- **`?days=` that is not 7, 30 or 90** (`abc`, `0`, `30&days=7`): falls back to 30; switching the period keeps every other query parameter. Pinned in Tasks 2 and 4.

## File Structure

| File | Responsibility |
|---|---|
| `src/types/admin.ts` (modify) | `ANALYTICS_DAYS`, `AnalyticsDays`, `AnalyticsMetric`, `AnalyticsSeries`, `AdminAnalytics` |
| `src/utils/api.ts` (modify) | `adminApi(...).analytics(days)` |
| `src/hooks/queries/keys.ts` (modify) | `adminKeys.analytics(product, days)` |
| `src/hooks/queries/use-analytics.ts` (create) | `useAnalyticsQuery(slug, days)` |
| `src/utils/analytics.ts` (create) | pure helpers: `readDays`, `describeChange`, `chartPaths` |
| `src/hooks/use-days.ts` (create) | the period, read from and written to the URL |
| `src/components/period-switch.tsx` (create) | the 7 / 30 / 90 radio group |
| `src/components/stat-tile.tsx` (create) | label, value, change line |
| `src/components/analytics-chart.tsx` (create) | monochrome SVG chart with legend and text alternative |
| `src/components/analytics-section.tsx` (create) | composes the above and owns every state |
| `src/app/routes/product.tsx` (modify) | renders `AnalyticsSection` above the resource groups |
| `tests/fake-api/fake-admin-api.ts` (modify) | answers `GET /api/admin/analytics` |

---

### Task 1: The contract, the client and the fake

**Files:**
- Modify: `docs/superpowers/specs/2026-10-22-interacti-admin-design.md` (§3 non-goals; new §6.7; §8.1 `/:product` row; §9 new "Analytics" bullet)
- Modify: `src/types/admin.ts`, `src/utils/api.ts`, `src/hooks/queries/keys.ts`
- Create: `src/hooks/queries/use-analytics.ts`
- Modify: `tests/fake-api/fake-admin-api.ts`
- Test: `tests/unit/api.test.ts`, `tests/unit/fake-api.test.ts`

**Interfaces:**
- Produces (in `src/types/admin.ts`):
  ```ts
  export const ANALYTICS_DAYS = [7, 30, 90] as const;
  export type AnalyticsDays = (typeof ANALYTICS_DAYS)[number];
  export type AnalyticsMetric = { key: string; label: string; count: number; previous: number };
  export type AnalyticsSeries = { key: string; label: string; points: { date: string; count: number }[] };
  export type AdminAnalytics = {
    days: AnalyticsDays;
    configured: boolean;            // false: the product has no Google Analytics set up
    note: string | null;            // the product's own words: what's missing, or that GA lags
    metrics: AnalyticsMetric[];     // tiles in order; the first is the headline; absent = not tracked
    series: AnalyticsSeries[];      // chart lines, at most two; points oldest first, one per UTC day
  };
  ```
- Produces: `adminApi(client).analytics(days: AnalyticsDays): Promise<AdminAnalytics>`; `adminKeys.analytics(product: ProductSlug, days: AnalyticsDays): string[]`; `useAnalyticsQuery(slug: ProductSlug, days: AnalyticsDays): UseQueryResult<AdminAnalytics, AdminApiError>`.
- Produces: `FakeAdminApiOptions.analytics?: 'configured' | 'not-configured'` (default `'configured'`) and a handled route `GET /api/admin/analytics`. The fake returns fixed numbers: metrics `visitors` "Visitors" 5265 vs 4100, `views` "Page views" 7596 vs 7596, `enquiries` "Enquiries" 8 vs 0; series `visitors` and `views` with `days` points each ending yesterday.

- [ ] **Step 1: Amend the spec.** In §3 delete "charts or metrics; " from the non-goals. Add §6.7 "Analytics" after §6.6 stating exactly:
  - `GET /api/admin/analytics?days=7|30|90`, bearer-protected like every route, 200 `ApiResponse<AdminAnalytics>`, `OPTIONS` answers 204.
  - A window is `days` whole days ending yesterday, the last complete day, in the property's reporting time zone; `previous` is the same number of days immediately before it. `points` has one entry per window day, `date` as `YYYY-MM-DD`; a day GA has no row for is sent as 0.
  - Numbers come from Google Analytics 4, read by the product's server; the credential is a server environment variable and is never returned, logged or placed in an error.
  - A product with no GA set up answers 200 with `configured: false`, empty `metrics` and `series`, and a `note` that says what to set. A product that tracks no enquiries sends no enquiries metric. GA failing answers 502 with `{ message }`.
  - `days` outside 7, 30, 90 and any other parameter answer 422 (`.strict()`, as §6.5). The key `analytics` is reserved: no resource may use it.
  - Add the `AdminAnalytics` interface from the Interfaces block. In §8.1 make the `/:product` row read "Analytics for the last 7, 30 or 90 days, then the product's resources by group, each with its record count". In §9 add: "**Analytics:** tiles and chart are white on black with 10% hairlines. A change reads `↑ 12%`, `↓ 8%`, `New`, `No change` or `No activity`, never in colour. The chart's first line is 80% and solid, its second 50% and dashed, over 10% gridlines, with a text legend."

- [ ] **Step 2: Write failing tests.**
  - `api.test.ts`: `api.analytics(30)` sends `GET /analytics?days=30` and returns the unwrapped `data`; a 404 rejects with `kind === 'not-found'`; a 502 with `{ message: 'Quota exceeded' }` rejects with that message.
  - `fake-api.test.ts` (fake pinned with `now: new Date('2026-10-22T12:00:00Z')`): `days=7` returns every series with 7 points whose last date is `2026-10-21`; `days=5` and `?days=7&x=1` answer 422; a missing token answers 401; with `analytics: 'not-configured'` the answer is `configured: false`, `metrics: []`, `series: []` and a non-empty `note`.

- [ ] **Step 3: Run them to see them fail.** `yarn test tests/unit/api.test.ts tests/unit/fake-api.test.ts`. Expected: FAIL (`analytics` is not a function; the fake answers 404).

- [ ] **Step 4: Implement** the types, `analytics(days)` in `adminApi` (wrapped in `run`, like `get`), the key (`['admin', product, 'analytics', String(days)]`), `useAnalyticsQuery` (same shape as `useManifestQuery`: `enabled: api !== null`, `notConnected()` fallback), and the fake route with a `now?: Date` option (default `new Date()`). Mutations do not invalidate analytics: GA does not change when a record does.

- [ ] **Step 5: Run `yarn typecheck && yarn test`.** Expected: PASS.

- [ ] **Step 6: Commit.** `git commit -m "feat(analytics): the analytics contract, its client and its fake"`

---

### Task 2: Pure helpers

**Files:**
- Create: `src/utils/analytics.ts` (and export from `src/utils/index.ts`)
- Test: `tests/unit/analytics.test.ts`

**Interfaces:**
- Consumes: `AnalyticsDays`, `ANALYTICS_DAYS` (Task 1); `formatCount` (`src/utils/format.ts`).
- Produces:
  ```ts
  export const DEFAULT_DAYS: AnalyticsDays;                                   // 30
  export function readDays(search: URLSearchParams): AnalyticsDays;
  export function describeChange(count: number, previous: number): string;
  export function chartPaths(counts: number[], width: number, height: number, max: number): { line: string; area: string };
  ```

- [ ] **Step 1: Write failing tests** (names and assertions):
  - `readDays`: `''` → 30; `days=7` → 7; `days=90` → 90; `days=14`, `days=abc`, `days=0`, `days=-7`, `days=7.5` → 30; `days=30&days=7` → 30 (a repeated key is not trusted).
  - `describeChange`: `(12, 10)` → `'↑ 20%'`; `(8, 10)` → `'↓ 20%'`; `(10, 10)` → `'No change'`; `(5, 0)` → `'New'`; `(0, 0)` → `'No activity'`; `(0, 4)` → `'↓ 100%'`; `(10001, 10000)` → `'↑ 1%'` (never 0%); `(15000, 1000)` → `'↑ 1,400%'`.
  - `chartPaths`: for `[0, 5, 10]` at 100×40 with `max` 10 the line starts at `M0,40` and ends at `100,0`, and `area` ends with `Z`; with `max` 20 the same counts end at `100,20` (a shared scale is respected); `[0, 0, 0]` with `max` 0, `[3]` with `max` 3 and `[]` with `max` 0 return paths containing no `NaN` or `Infinity`, and `[]` is a flat line at the baseline.

- [ ] **Step 2: Run to see them fail.** `yarn test tests/unit/analytics.test.ts`. Expected: FAIL (module not found).

- [ ] **Step 3: Implement** the three functions. `describeChange` rounds `|count − previous| / previous × 100` with `Math.round`, floors a non-zero change at 1, and formats it with `formatCount`. `chartPaths` scales y by `max` (treat 0 as 1) and x by `width / (n − 1)` (treat `n < 2` as one segment across the width), y inverted so larger counts sit higher.

- [ ] **Step 4: Run to see them pass.** Same command. Expected: PASS.

- [ ] **Step 5: Commit.** `git commit -m "feat(analytics): read the period, describe a change, draw the chart path"`

---

### Task 3: The pieces

**Files:**
- Create: `src/hooks/use-days.ts`, `src/components/period-switch.tsx`, `src/components/stat-tile.tsx`, `src/components/analytics-chart.tsx`
- Test: `tests/unit/analytics-parts.test.tsx`

**Interfaces:**
- Consumes: `readDays`, `describeChange`, `chartPaths`, `DEFAULT_DAYS` (Task 2); `createUrl`, `withParam` (`src/utils`).
- Produces:
  ```ts
  export function useDays(): [AnalyticsDays, (days: AnalyticsDays) => void];   // use-days.ts
  export function PeriodSwitch(props: { value: AnalyticsDays; onChange(days: AnalyticsDays): void }): JSX.Element;
  export function StatTile(props: { label: string; count: number; previous: number; days: AnalyticsDays; wide?: boolean }): JSX.Element;
  export function AnalyticsChart(props: { series: AnalyticsSeries[]; days: AnalyticsDays }): JSX.Element;
  ```

- [ ] **Step 1: Write failing tests.**
  - `PeriodSwitch`: renders a `radiogroup` named "Period" with radios "7 days", "30 days", "90 days"; the one matching `value` is checked; arrow keys move the selection and call `onChange` with the new number (assert on `aria-checked` and calls, not class names).
  - `StatTile` (`count 7596, previous 7000, days 30`): shows the label, `7,596`, `↑ 9%` and `vs previous 30 days`; `previous 0` shows `New`; `wide` makes the tile span both columns.
  - `AnalyticsChart` with the fake's two series: one `role="img"` whose accessible name states the legend labels, the period and each line's lowest and highest day (`Visitors and Page views per day, last 7 days: Visitors from 0 to 6, highest on 22 Oct; Page views from 2 to 14, highest on 22 Oct`), never a sum; a legend with both labels as visible text; the shared peak value and the first and last dates as visible text; an all-zero series, an empty `points` array and two series of different lengths render with no `NaN` in any `d` attribute; the second series' path has a `stroke-dasharray` and the first does not.
  - `useDays`, rendered in a `MemoryRouter` at `/strive?days=7&x=1`: returns `7`; calling the setter with `90` navigates to `/strive?days=90&x=1` by replace (history length unchanged).

- [ ] **Step 2: Run to see them fail.** `yarn test tests/unit/analytics-parts.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement** the four. `PeriodSwitch` is native radio inputs in a `<fieldset>` with a visually hidden `<legend>Period`, so keyboard and screen-reader behaviour comes from the browser; the checked label is a white pill with black text and the others 50% text, focus ring per spec §9. `StatTile` is a `border border-ink/10 rounded-[var(--radius-control)]` block: label `text-micro text-ink/50`, value `text-statement sm:text-large font-medium tabular-nums`, change line `text-micro` from `describeChange`. `AnalyticsChart` is an inline `<svg viewBox>` with two 10% gridlines (peak and half), the shared maximum taken over every series, the first series an 80% solid line over a 10% area and the second a 50% dashed line, `preserveAspectRatio="none"` on the paths only (text sits outside the SVG so it is never stretched), and a legend of the series labels. `useDays` follows `useListParams` (`useLocation`, `useNavigate`, `withParam`, `createUrl`, `{ replace: true, preventScrollReset: true }`).

- [ ] **Step 4: Run to see them pass.** Same command. Expected: PASS.

- [ ] **Step 5: Commit.** `git commit -m "feat(analytics): period switch, stat tile and chart"`

---

### Task 4: The section on the product page

**Files:**
- Create: `src/components/analytics-section.tsx`
- Modify: `src/app/routes/product.tsx` (render `<AnalyticsSection product={product} />` as the first child of the body, inside the `manifest.data` branch)
- Test: `tests/unit/overview.test.tsx` (the existing `describe('product page', …)`)

**Interfaces:**
- Consumes: `useAnalyticsQuery` (Task 1); `useDays`, `PeriodSwitch`, `StatTile`, `AnalyticsChart` (Task 3); `Skeleton`, `Button` (`@/primitives`); `StateMessage`.
- Produces: `export function AnalyticsSection(props: { product: ProductConfig }): JSX.Element`.

States, in order: loading (skeleton tiles and chart block, `aria-busy`); error; not configured; loaded. Loaded layout: heading "Analytics" with the `PeriodSwitch` beside it; the first metric as a wide `StatTile`; the rest in a two-column grid; the chart under a heading built from the series labels joined with " & " (the screenshot's "Visitors & views"); the product's `note` as secondary text underneath when it is not null. Not configured: the `note` verbatim and nothing else. Error copy: `not-found` or `off` → "Analytics isn't available from {name} yet."; `unauthorized` → "{name} didn't accept this token."; anything else → "Couldn't load analytics." followed by the error's message, with a "Try again" secondary button that calls `refetch`.

- [ ] **Step 1: Write failing tests** in the product-page `describe`, with the Strive fake at `https://strive.test`:
  - Shows the headline tile "Visitors" `5,265` with `↑ 28%`, tiles "Page views" `7,596` with `No change` and "Enquiries" `8` with `New`, and a chart legend "Visitors" and "Page views"; none of those words is hard-coded in `src/` (the test reads them from the fake).
  - A fake whose metrics omit `enquiries` shows no Enquiries tile.
  - The manifest's resource list is still below the section, in the same groups with the same counts.
  - Choosing "7 days" requests `GET /api/admin/analytics?days=7` and the URL becomes `/strive?days=7`; opening `/strive?days=bogus` requests `days=30`; other query parameters survive a switch.
  - The fake with `analytics: 'not-configured'` shows its `note` verbatim, no tiles and no chart.
  - 404 on `/analytics` shows "Analytics isn't available from Strive yet." and the resource list still renders.
  - 401 on `/analytics` shows "Strive didn't accept this token." while the list still renders.
  - 502 with `{ message: 'Quota exceeded' }` shows "Couldn't load analytics." and `Quota exceeded`, and "Try again" requests it again.
  - A product that is not connected shows no Analytics section, only its existing reason.

- [ ] **Step 2: Run to see them fail.** `yarn test tests/unit/overview.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement** `AnalyticsSection` and the one-line wiring in `product.tsx`. The query is `useAnalyticsQuery(product.slug, days)`.

- [ ] **Step 4: Run `yarn typecheck && yarn test`.** Expected: PASS.

- [ ] **Step 5: Commit.** `git commit -m "feat(analytics): show a product's analytics above its resources"`

---

### Task 5: End to end, accessibility and docs

**Files:**
- Modify: `tests/e2e/a11y.spec.ts`, `tests/e2e/phone.spec.ts`, `tests/e2e/journey.spec.ts`
- Modify: `README.md` (one paragraph), `deploy/README.md` if it lists the API routes

- [ ] **Step 1: Write the specs.**
  - `a11y.spec.ts`: `/strive` signed in; axe reports no violations (covers the 50% text and the chart's text alternative).
  - `phone.spec.ts`: `/strive` signed in on the mobile project: `expectNoSidewaysScroll`; the two tiles in a row fit side by side at 375px with the largest number the fake produces not clipped (`scrollWidth <= clientWidth` on each tile).
  - `journey.spec.ts`: from `/strive`, switch to 7 days, see the URL change, open a resource from the list below, return, and still be on 7 days.

- [ ] **Step 2: Run them.** `yarn e2e`. Expected: the new specs PASS and no existing spec regresses.

- [ ] **Step 3: Docs.** README: one paragraph saying each product page opens with its Google Analytics figures, read by the product's server and served from `GET /api/admin/analytics` (link to spec §6.7), and that a product without it shows "not available yet".

- [ ] **Step 4: Run `yarn typecheck && yarn test && yarn e2e`.** Expected: all PASS.

- [ ] **Step 5: Commit.** `git commit -m "test(analytics): axe, phone and journey coverage; document the route"`

---

## Out of scope here: the backend plan (write it next, one per product repo)

Each of `0nbox`, `strive`, `parcours`, `sara` and `fluid` needs the same pieces, with spec §6.7 as its test:

1. **Environment** (`src/env.js`, `.env.example`, `deploy/README.md`): `GA_PROPERTY_ID` (numeric), `GA_SERVICE_ACCOUNT_JSON` (secret), optional `GA_ENQUIRY_EVENT`. All unset means `configured: false`.
2. **Service** in `src/backend/admin/kit/`: `analytics(days, now)` through `BetaAnalyticsDataClient.runReport`, three reports per call: this window's totals, the previous window's totals (metrics `totalUsers` "Visitors" and `screenPageViews` "Page views", plus `eventCount` filtered to `GA_ENQUIRY_EVENT` as "Enquiries" when set), and a per-day report with the `date` dimension for the two chart series, filling any day GA omits with 0. Totals must come from no-dimension reports: unique visitors cannot be summed from daily rows. Cache each answer in process for 15 minutes to respect GA quota; map any GA failure to a 502 with a message that never contains the credential.
3. **Route** `src/app/api/admin/analytics/route.ts`: `GET` and `OPTIONS` through `adminRoute`, `withMiddleware` and `adminAuthMiddleware`, exactly as `src/app/api/admin/route.ts`; a strict Zod schema on the query (`days` is 7, 30 or 90; nothing else).
4. **Tests:** the response never contains `GA_SERVICE_ACCOUNT_JSON` or any part of it, `days=5` and an unknown parameter answer 422, no token answers 401, and a registry test fails when a resource is keyed `analytics`.
5. **`public/openapi.json`** entry for the route. For Parcours, Sara and Fluid, which load no GA tag today, the route answers `configured: false` with a note until a tag and a property exist.

## Self-review

- **Spec coverage:** the screenshot's period switch, headline tile, tile grid, "Visitors & views" chart and delta pills are Tasks 3 and 4. The owner's metrics (visitors, page views, enquiries per product) are the fake's fixed metrics and the contract's `metrics`. Colour, type, URL-state and no-product-rules are Global Constraints, each exercised (colour by asserting `aria-checked`, glyph text and `stroke-dasharray`; product rules by the Task 4 test that names are read from the fake).
- **Type consistency:** `AnalyticsDays`, `AdminAnalytics`, `AnalyticsMetric`, `AnalyticsSeries`, `adminKeys.analytics(product, days)`, `useAnalyticsQuery(slug, days)`, `useDays()`, `describeChange`, `chartPaths(counts, width, height, max)` and `readDays` are defined once in Task 1 or 2 and used with the same signatures later.
- **Left out on purpose:** hover or tap tooltips, custom date ranges, auto-refresh (the spec's "live updates" non-goal stands), the screenshot's product clicks and click-rate tiles (not requested), and its bottom tab bar (another app's navigation).
