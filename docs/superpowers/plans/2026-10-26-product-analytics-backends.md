# Product Analytics Backends Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each of 0nbox, Strive, Parcours, Sara and Fluid answers `GET /api/admin/analytics?days=7|30|90` with its Google Analytics 4 visitors, page views and (where configured) enquiries, in the shape the dashboard already renders (admin spec §6.7), so every product page in the dashboard shows real numbers.

**Architecture:** One self-contained kit module, `src/backend/admin/kit/analytics.ts`, is written and fully tested once in Strive, then copied **byte-identical** into the other four repos (their other kit files are already byte-identical; verified by md5). It reads GA4 through the Data API `batchRunReports` with a service account (`google-auth-library` for the token, `fetch` for the call, both injectable for tests), keeps a short in-process cache, and maps every failure to a fixed 502 message that can never contain the credential. Per repo, only the thin wiring differs: env schema, one middleware, one handler in that repo's envelope, one route, docs, deploy secrets.

**Tech Stack:** Next.js route handlers, TypeScript, Zod (env and query), Vitest, `google-auth-library`, yarn (every repo uses yarn.lock).

**Spec:** `admin/docs/superpowers/specs/2026-10-22-interacti-admin-design.md` §5 (access), §6.7 (analytics contract), §7.1. The dashboard side is already on `main` of the admin repo (plan `2026-10-25-product-analytics.md`, commits `3923913..b300de0`).

## Global Constraints

- **Contract (spec §6.7), verbatim:** `GET /api/admin/analytics?days=7|30|90`, bearer-protected like every admin route; 200 `ApiResponse<AdminAnalytics>`; `OPTIONS` answers 204; `days` outside 7, 30, 90 and any other parameter answer 422; admin off answers 404 before anything else; Google failing answers 502 with `{ message }`; a product with no Google Analytics answers 200 with `configured: false`, empty `metrics` and `series`, and a `note` saying what to set. A window is `days` whole days ending **yesterday**, in the **property's reporting time zone**; `previous` is the same number of days immediately before; `points` has one entry per window day, `date` as `YYYY-MM-DD`, a day GA has no row for sent as 0. The key `analytics` is reserved: no resource may use it.
- **The response shape** is exactly the dashboard's `AdminAnalytics`: `{ days, configured, note, metrics: {key,label,count,previous}[], series: {key,label,points:{date,count}[]}[] }`. Metric and series keys: `visitors` "Visitors", `views` "Page views", `enquiries` "Enquiries". Metrics are in that order; the series are `visitors` then `views`; `enquiries` is absent when the product sets no enquiry event.
- **Credentials:** the service account is read only from the server environment. It is never returned, logged, placed in an error message or put in a cache key. Every Google failure maps to one of four fixed strings (Task 1).
- **No schema or Prisma change** anywhere. This feature touches no database.
- **Same kit file everywhere:** `kit/analytics.ts` and `kit/__tests__/analytics.test.ts` are identical in all five repos (`md5 -q` equal). Per-repo files are the only place repos differ.
- **Each repo is its own git repository** with its own conventions. Four have uncommitted work today (0nbox, Parcours, Sara, Fluid): never stash, reset or commit it. Do each repo's work in a fresh `git worktree` on a new branch cut from `main`.
- **Gates per repo:** `yarn check` (lint + typecheck, plus vitest in Parcours) and `yarn test` where the repo has one, green before every commit. Plain commit messages, no attribution trailers (the owner's standing rule).
- **Node:** whatever each repo's `engines` says (Sara: `>=24.15.0 <25`).

## What the owner does outside the code (blocks the live check in Task 8, not the build)

1. Enable the **Google Analytics Data API** in a Google Cloud project and create one **service account** (no roles needed in GCP); download its JSON key.
2. In each GA4 property: **Admin → Property access management → add the service account's email as Viewer.**
3. Copy each property's **numeric Property ID** (Admin → Property details). It is not the `G-…` measurement ID.
4. `base64 -i key.json | tr -d '\n'` gives the value for `GA_SERVICE_ACCOUNT_B64` (base64 because the JSON's quotes break a `.env` heredoc and Sara's YAML).
5. For enquiries only: the exact GA **event name** a product sends when someone enquires (`GA_ENQUIRY_EVENT`). A product with none gets no Enquiries tile.
6. Add repository secrets `GA_PROPERTY_ID`, `GA_SERVICE_ACCOUNT_B64` (and `GA_ENQUIRY_EVENT` where used) in each repo that has a deploy workflow. Only 0nbox and Strive send page hits to GA today; Parcours, Sara and Fluid answer `configured: false` until they carry a GA tag and a property.

## Review Focus

- **Unique visitors are never summed from daily rows.** Totals come from a report with no `date` dimension, so a returning visitor counts once per period. Pinned in Task 1.
- **Days GA omits are 0**, at the start, middle and end of the window, so `points.length === days` always. Pinned in Task 1.
- **A property in a non-UTC zone** (`Pacific/Auckland`, where "yesterday" is a different calendar date than in UTC): the dates come from the zone GA reports in. Pinned in Task 1.
- **A mistyped variable never takes the site down or leaks:** `GA_PROPERTY_ID` given as `G-ABC123`, `GA_SERVICE_ACCOUNT_B64` that is not base64, not JSON, or lacks `private_key`/`client_email` answer 200 `configured: false` with a note that names the variable, not a 500 and not a boot failure. Pinned in Tasks 1 and 2.
- **No credential in any output:** a 401 from Google, a 429, a network error, an auth-library throw and a thrown error carrying the key text all produce the fixed messages, and neither the JSON body nor any message contains the private key. Pinned in Task 1.
- **Quota protection:** four dashboard requests for one page load make one Google call; a failure is remembered for 60 s so the dashboard's own retries do not hammer a failing quota. Pinned in Task 1.
- **Order of refusal:** admin off is 404 and a bad token is 401 even when `days` is also invalid. Pinned in Task 2.

## File Structure

| File (per repo) | Responsibility | Same in all five? |
|---|---|---|
| `src/backend/admin/kit/analytics.ts` (create) | query parsing, GA calls, window maths, mapping, cache, fixed errors | **identical** |
| `src/backend/admin/kit/__tests__/analytics.test.ts` (create) | the kit's tests | **identical** |
| `src/env.js` (modify) | `GA_PROPERTY_ID`, `GA_SERVICE_ACCOUNT_B64`, `GA_ENQUIRY_EVENT`, optional strings like `ADMIN_API_TOKEN` | wiring |
| `src/backend/admin/middleware.ts` (modify) | `adminAnalyticsQueryMiddleware` | per repo |
| `src/backend/admin/handlers.ts` (modify) | `analyticsHandler` in the repo's envelope | per repo |
| `src/backend/admin/docs.ts` (modify) | `adminAnalyticsQueryDoc` for the OpenAPI generator | per repo |
| `src/app/api/admin/analytics/route.ts` (create) | `GET` and `OPTIONS` | per repo |
| `src/backend/admin/__tests__/analytics.test.ts` (create) | middleware and handler tests | per repo |
| `src/backend/admin/__tests__/registry.test.ts` (modify) | `analytics` is not a resource key | per repo |
| `.env.example`, `deploy/README.md`, `.github/workflows/deploy.yml` (modify; Fluid has no workflow) | document and carry the three variables | per repo |
| `public/openapi.json` (regenerate with `yarn docs:generate`) | the route appears | per repo |
| `package.json`, `yarn.lock` (modify) | `google-auth-library` | per repo |

---

### Task 1: The kit module, in Strive (the reference)

**Files (in `/Users/jefedcreator/Documents/Development/interacti/strive`, worktree `../strive-analytics` on branch `feat/admin-analytics`):**
- Create: `src/backend/admin/kit/analytics.ts`, `src/backend/admin/kit/__tests__/analytics.test.ts`
- Modify: `package.json`, `yarn.lock` (`yarn add google-auth-library`)

**Interfaces:**
- Produces, exported from `kit/analytics.ts`:
  ```ts
  export const ANALYTICS_DAYS = [7, 30, 90] as const;
  export type AnalyticsDays = (typeof ANALYTICS_DAYS)[number];
  export type AdminAnalytics = { days: AnalyticsDays; configured: boolean; note: string | null;
    metrics: { key: string; label: string; count: number; previous: number }[];
    series: { key: string; label: string; points: { date: string; count: number }[] }[] };
  export type AnalyticsEnv = { GA_PROPERTY_ID?: string; GA_SERVICE_ACCOUNT_B64?: string; GA_ENQUIRY_EVENT?: string };
  export type AnalyticsDeps = {
    fetch: typeof fetch;
    accessToken: (account: { client_email: string; private_key: string }) => Promise<string>;
    now: () => Date;
  };
  export function parseAnalyticsQuery(params: URLSearchParams): { days: AnalyticsDays } | { error: string };
  export function createAnalytics(env: AnalyticsEnv, deps?: Partial<AnalyticsDeps>): { read(days: AnalyticsDays): Promise<AdminAnalytics> };
  export function readAnalytics(days: AnalyticsDays): Promise<AdminAnalytics>;   // createAnalytics(env) from '@/env', created once
  ```
- Consumes: `HttpException(message: string, statusCode: number)` from `@/utils/exceptions` (the 502s); `env` from `@/env`.

Behaviour the tests pin (the implementer writes the bodies):
- **Query:** `parseAnalyticsQuery(new URLSearchParams('days=30'))` is `{ days: 30 }`; `''`, `days=5`, `days=abc`, `days=30&days=7` are `{ error: 'days' }`; `days=7&x=1` is `{ error: 'x' }` (the first offending name).
- **Request:** one `POST https://analyticsdata.googleapis.com/v1beta/properties/<id>:batchRunReports` with `Authorization: Bearer <token>` and `AbortSignal.timeout(10_000)`, whose body has `requests`: (1) totals, dateRanges `[{startDate:'<d>daysAgo',endDate:'yesterday'},{startDate:'<2d>daysAgo',endDate:'<d+1>daysAgo'}]`, metrics `activeUsers`, `screenPageViews`, no dimensions; (2) the series, current range only, dimension `date`, same metrics, ordered by `date` ascending; (3) only when `GA_ENQUIRY_EVENT` is set, both ranges, metric `eventCount`, `dimensionFilter` on `eventName` EXACT the event.
- **Mapping:** rows of a two-range report are told apart by the `dateRange` dimension value (`date_range_0` current, `date_range_1` previous), never by row order, and metric values by `metricHeaders` names, never by position; values are parsed as integers and a non-number is 0. A report with no rows (no events) is 0 for both periods.
- **Window:** the response's `metadata.timeZone` (default `UTC` when absent) decides what "yesterday" is: the calendar is `days` dates ending at `deps.now()`'s date in that zone minus one day, by `Intl.DateTimeFormat('en-CA', { timeZone })` and calendar arithmetic on the `YYYY-MM-DD` string (no DST maths). Each series gets one point per calendar date, 0 where GA sent no row; GA's `YYYYMMDD` becomes `YYYY-MM-DD`.
- **Result:** `configured: true`, `note: 'Google Analytics figures can lag by up to a day. Each period ends on the last complete day.'`, metrics in the order visitors, views, enquiries (the last only with an event), series visitors then views.
- **Not configured** (200, `configured:false`, empty arrays, no fetch made), each with a `note` naming the variable: both variables unset → `'Set GA_PROPERTY_ID and GA_SERVICE_ACCOUNT_B64 on the server and restart it.'`; `GA_PROPERTY_ID` not all digits → `'GA_PROPERTY_ID must be the numeric property id, not the G- measurement id.'`; `GA_SERVICE_ACCOUNT_B64` not base64 → `'GA_SERVICE_ACCOUNT_B64 isn't valid base64.'`, not JSON → `'GA_SERVICE_ACCOUNT_B64 doesn't decode to JSON.'`, JSON without string `client_email` and `private_key` → `'GA_SERVICE_ACCOUNT_B64 needs client_email and private_key.'`.
- **Failures → `HttpException(message, 502)`**, exactly these strings and no others: Google 401/403 or `accessToken` throwing → `'Google Analytics rejected the service account'`; 400/404 → `"Google Analytics doesn't know that property"`; 429 → `'Google Analytics quota exceeded'`; fetch rejecting or timing out → `"Google Analytics didn't answer"`; any other status or an unparseable body → `'Google Analytics answered with an error'`.
- **Cache:** key is `<propertyId>|<days>|<event ?? ''>`; a success is reused for 15 minutes, a failure (the same `HttpException`) for 60 seconds, both by `deps.now()`; concurrent calls for one key share one in-flight request; a different `days` is a different call.

- [ ] **Step 1: Create the worktree.** `git -C strive worktree add ../strive-analytics -b feat/admin-analytics main`, `cd ../strive-analytics`, `yarn install --frozen-lockfile`. Run `yarn test src/backend/admin` to see the baseline green.

- [ ] **Step 2: Write the failing tests** in `kit/__tests__/analytics.test.ts`, one `it` per bullet above with its exact values, using a hand-built Google response helper `report({ rows, headers, timeZone })` and `vi.fn()` for `fetch` and `accessToken` (Strive's `access.test.ts` shows the `vi.mock('@/env')` style). Names: `parseAnalyticsQuery accepts 7, 30 and 90`, `…names the first offending parameter`, `asks Google for totals with no dimension and for the series by date`, `adds the enquiry report only when an event is set`, `reads two-range rows by dateRange, not by order`, `reads metrics by header name`, `treats a missing report row as zero`, `fills days Google omitted with 0 at the start, the middle and the end`, `ends the window on yesterday in the property's own zone (Pacific/Auckland, now 2026-10-22T20:00Z gives 2026-10-23 there, so the window ends 2026-10-22)`, `one answer per key within 15 minutes, then asks again`, `a failure is remembered for 60 seconds`, `concurrent calls share one request`, one `it.each` over the five not-configured cases, one `it.each` over the five failure mappings, and `no output ever contains the private key` (feed an `accessToken` that throws an error whose message contains the key text and a Google body that echoes it; assert the thrown message equals a fixed string and `JSON.stringify` of results and errors lacks the key).

- [ ] **Step 3: Run them to see them fail.** `yarn vitest run src/backend/admin/kit/__tests__/analytics.test.ts`. Expected: FAIL (module not found).

- [ ] **Step 4: Implement** `kit/analytics.ts` to the Interfaces and behaviour above, in the style of the other kit files (single quotes, 2-space indent, `/** … */` comments that say why). `yarn add google-auth-library`; the default `accessToken` builds one `JWT` per `client_email` with scope `https://www.googleapis.com/auth/analytics.readonly` and reuses it, so its token cache works.

- [ ] **Step 5: Run to see them pass,** then `yarn check` and `yarn test` for the repo. Expected: PASS, no lint or type errors.

- [ ] **Step 6: Commit.** `git add src/backend/admin/kit package.json yarn.lock && git commit -m "feat(admin): read Google Analytics for the admin analytics route"`

---

### Task 2: Wire the route in Strive

**Files (Strive worktree):**
- Modify: `src/env.js`, `src/backend/admin/middleware.ts`, `src/backend/admin/handlers.ts`, `src/backend/admin/docs.ts`, `src/backend/admin/__tests__/registry.test.ts`, `.env.example`, `deploy/README.md`, `.github/workflows/deploy.yml`
- Create: `src/app/api/admin/analytics/route.ts`, `src/backend/admin/__tests__/analytics.test.ts`
- Regenerate: `public/openapi.json`

**Interfaces:**
- Consumes: `parseAnalyticsQuery`, `readAnalytics`, `AdminAnalytics`, `AnalyticsDays` (Task 1); `adminAuthMiddleware`, `adminRoute`, `adminPreflight` (existing).
- Produces: `adminAnalyticsQueryMiddleware<B, Q>(request): Promise<MiddlewareResponse>` (sets `request.query = { days }`, else `stop(422, 'Invalid query parameter: <name>')`); `analyticsHandler(request: AuthRequest<unknown, { days: AnalyticsDays }>): Promise<Response>` answering `{ status: 200, message: 'Analytics retrieved', data }`; `adminAnalyticsQueryDoc` (zod, `days` enum `'7'|'30'|'90'`).

- [ ] **Step 1: Write the failing tests** in `__tests__/analytics.test.ts` (mock `../kit/analytics`'s `readAnalytics` and `@/env` as Strive's other admin tests do):
  - `middleware sets request.query for days=30` and `…answers 422 'Invalid query parameter: days' for days=5` and `…names x for days=7&x=1`.
  - `handler wraps the answer in Strive's envelope` (`status 200`, `message 'Analytics retrieved'`, `data` equal to what `readAnalytics` returned for the query's `days`).
  - `a bad token is 401 and admin-off is 404 before days is looked at`: run `[adminAuthMiddleware, adminAnalyticsQueryMiddleware]` in order with `days=bogus` and assert the first non-`next` result's status.
  - In `registry.test.ts`: `no resource is keyed analytics` (`expect(resolved.byKey.has('analytics')).toBe(false)`).

- [ ] **Step 2: Run to see them fail.** `yarn vitest run src/backend/admin`. Expected: FAIL (middleware and handler not exported).

- [ ] **Step 3: Implement** the middleware (copy `adminListQueryMiddleware`'s shape: read `request.nextUrl.searchParams`, call `parseAnalyticsQuery`), the handler, the doc schema, and `route.ts` (`GET = adminRoute(withMiddleware<unknown, { days: AnalyticsDays }>(analyticsHandler, [adminAuthMiddleware, adminAnalyticsQueryMiddleware]))` with JSDoc `@queryParams adminAnalyticsQueryDoc`, `@description` stating what it returns and that it answers 404 until `ADMIN_API_TOKEN` is set, `@auth bearer`; `OPTIONS = adminPreflight`). Env: three optional server strings in `env.js` and `runtimeEnv`, exactly the `ADMIN_API_TOKEN` pattern but with no format rules (the kit validates at request time, so a typo cannot stop the site booting). `.env.example`: a "Google Analytics for the admin dashboard" block naming the three variables, saying all are optional and what each is. `deploy.yml`: the three variables from repository secrets of the same names beside `ADMIN_ORIGIN`. `deploy/README.md`: one bullet after the Admin API bullet.

- [ ] **Step 4: Regenerate the OpenAPI.** `yarn docs:generate`. Expected: `public/openapi.json` gains `/api/admin/analytics` with a `days` query parameter and bearer auth, and nothing else changes.

- [ ] **Step 5: Run `yarn check` and `yarn test`.** Expected: PASS.

- [ ] **Step 6: Commit.** `git add -A src public .env.example deploy .github && git commit -m "feat(admin): serve GET /api/admin/analytics"`

---

### Tasks 3 to 6: Port to 0nbox, Parcours, Sara, Fluid

One task per repo, in this order: **3 Parcours, 4 0nbox, 5 Sara, 6 Fluid** (Parcours first because its envelope is the one that differs most). Each is: worktree off `main`, copy, wire, verify, commit.

**Files per repo:** exactly the "per repo" rows of the File Structure table, in `<repo>-analytics` worktrees on `feat/admin-analytics`.

**Interfaces:** consumes Task 1's kit exports unchanged and Task 2's names (`adminAnalyticsQueryMiddleware`, `analyticsHandler`, `adminAnalyticsQueryDoc`); produces the same route and the same response.

- [ ] **Step 1: Worktree and baseline.** `git -C <repo> worktree add ../<repo>-analytics -b feat/admin-analytics main`; `yarn install --frozen-lockfile`; run the repo's `yarn check` and tests once to see the baseline.
- [ ] **Step 2: Copy the kit.** Copy `kit/analytics.ts` and `kit/__tests__/analytics.test.ts` from the Strive worktree, then `yarn add google-auth-library`. Verify `md5 -q` of both files equals Strive's. If a repo's formatter or lint rewrites either file, stop and rule: the files must stay identical, so adjust the formatter ignore for the file rather than the file.
- [ ] **Step 3: Write the per-repo tests first** (the same four as Task 2, adapted), run to see them fail, then wire. Adaptations that are the only differences:
  - **Parcours** (`AppRequest`, double quotes, `success` flag, `docs:generate` pins `next-openapi-gen@1.8.1` and then runs `scripts/postprocess-openapi.mjs`): the handler returns `{ status: 200, success: true, message: "Analytics retrieved", data }`; the route's middleware list uses Parcours' own `withMiddleware` signature, copied from its `src/app/api/admin/route.ts`; `yarn check` already includes vitest. Its handler error path answers `success: false`, so the 502 test asserts that shape.
  - **0nbox** (`env.js` admin variables at lines 50–52 and 89–90; `docs:generate` also runs `scripts/postprocess-openapi.mjs`; the repo also has `test:integration`, which is not run here): otherwise as Strive. Its working tree has unrelated uncommitted files: work only in the worktree.
  - **Sara** (`engines` Node `>=24.15.0 <25`; its `deploy.yml` passes secrets through an `env:` block and a generated runtime-env object at lines 128–129 and 173–174, not a heredoc): add the three variables in **both** places, or the value never reaches the app.
  - **Fluid** (no `.github/workflows/deploy.yml`, no deploy step to edit): skip the workflow edit, document the variables in `.env.example` and `README.md` only.
- [ ] **Step 4: `yarn docs:generate`** (the repo's own form) and check the diff adds only the new path.
- [ ] **Step 5: `yarn check` and the repo's tests.** Expected: PASS.
- [ ] **Step 6: Commit** in the worktree: `git commit -m "feat(admin): serve GET /api/admin/analytics"` (one commit for the kit, one for the wiring if the repo's history is granular; match `git log` there).

---

### Task 7: Dashboard documentation and the one cross-repo test

**Files (admin repo, branch `docs/analytics-contract-tail`):**
- Modify: `docs/superpowers/specs/2026-10-22-interacti-admin-design.md` (§6.1 route table gains the analytics row, §10 `adminKeys` list gains `analytics(product, days)`), `README.md` (name the three variables under "Analytics")
- Test: `tests/unit/fake-api.test.ts`

**Interfaces:** none new.

- [ ] **Step 1: Write a failing contract test** in `tests/unit/fake-api.test.ts`: `the fake's analytics answer has the response shape the backends promise` asserts the exact key set of the answer (`days, configured, note, metrics, series`), of a metric (`key, label, count, previous`) and of a series (`key, label, points`), and that metric keys are `visitors, views, enquiries` in order. Run it; expected: PASS already if the fake is faithful (this guards drift, so also change one key locally to watch it fail, then revert).
- [ ] **Step 2: Edit the spec and README** as above; the README names `GA_PROPERTY_ID`, `GA_SERVICE_ACCOUNT_B64`, `GA_ENQUIRY_EVENT` and links the owner checklist in this plan.
- [ ] **Step 3: Run `yarn typecheck && yarn test`.** Expected: PASS.
- [ ] **Step 4: Commit.** `git commit -m "docs: the analytics route in the route table, the key list and the README"`

---

### Task 8: Live verification (manual; needs the owner's Google setup)

No code. In Strive's worktree with the three variables in `.env.local` (a real property the service account can read):

- [ ] **Step 1:** `yarn dev`, then `curl -s -H "Authorization: Bearer $ADMIN_API_TOKEN" "$STRIVE_URL/api/admin/analytics?days=7" | jq` (`STRIVE_URL` is Strive's dev origin; the admin README lists the dev ports). Expected: `configured: true`, 7 points per series ending yesterday, and a visitors `count` that matches GA's Reports → Users for the same 7 days (within GA's lag).
- [ ] **Step 2:** the same call with `days=5` (422), with no token (401), and with `ADMIN_API_TOKEN` unset (404). With `GA_PROPERTY_ID=G-ABC123` (200, `configured:false`, the numeric-id note). With the key's base64 corrupted (200, `configured:false`, a decode note). `grep -c "BEGIN PRIVATE KEY"` over every response body prints 0.
- [ ] **Step 3:** run the dashboard (`yarn dev` in `admin` with `VITE_API_STRIVE=$STRIVE_URL`), open `/strive`: tiles, a "Visitors & Page views" chart and the note show; switching 7/30/90 changes the numbers; unplugging the network shows "Couldn't load analytics." with the fixed message.
- [ ] **Step 4:** record the result, repo by repo, in each PR description. Merging and deploying each repo is the owner's call (a push to a product's `main` deploys it).

---

## Self-review

- **Spec coverage:** every sentence of spec §6.7 has an owner: parameters and 422 (Task 1 query tests, Task 2 middleware), 401/404 order (Task 2), window and time zone (Task 1), zero fill (Task 1), `configured:false` and its notes (Task 1), 502 and the fixed messages (Task 1), reserved key (Task 2 registry test, repeated per repo), response shape (Task 1 and the Task 7 contract test), Google credential never returned (Task 1 test, Task 8 grep).
- **Type consistency:** `AnalyticsDays`, `AdminAnalytics`, `parseAnalyticsQuery`, `createAnalytics`, `readAnalytics` are defined once in Task 1 and used with those exact names in Tasks 2 to 6; `adminAnalyticsQueryMiddleware`, `analyticsHandler`, `adminAnalyticsQueryDoc` once in Task 2 and reused unchanged in 3 to 6.
- **Decisions this plan makes that differ from the dashboard plan's outline:** `activeUsers` (GA's own "Users") instead of `totalUsers`; `GA_SERVICE_ACCOUNT_B64` instead of `GA_SERVICE_ACCOUNT_JSON` (quoting in `.env` heredocs and YAML); `google-auth-library` plus `fetch` instead of `@google-analytics/data` (one small dependency, testable without the gRPC stack); the window ends yesterday in the property's zone; failures cached for 60 s. The dashboard's test fake still says `GA_SERVICE_ACCOUNT_JSON` in its not-configured note: it is only a fixture string, but the real note is the one in Task 1.
- **Left out on purpose:** per-page or per-source breakdowns, real-time numbers, writing to GA, a shared npm package for the kit (five identical copies match how the repos already share the rest of the kit), and adding GA tags to Parcours, Sara and Fluid.
