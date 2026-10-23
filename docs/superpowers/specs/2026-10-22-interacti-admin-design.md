# interacti admin: design

**Status:** draft for the owner's review, 2026-10-22 · **Repos:** `interacti/admin` (not yet a repo: it holds only an empty `home/` folder, left alone) plus an `/api/admin` surface in each product repo: `0nbox`, `strive`, `parcours`, `sara`, `fluid`.
**Plans:** `docs/superpowers/plans/2026-10-22-interacti-admin-api.md` (the product endpoints) and `docs/superpowers/plans/2026-10-22-interacti-admin-dashboard.md` (the web app).
**Revised 2026-10-22 (owner's instruction):** creating and editing open in Sara's modal over the table, not on pages of their own. Every dialog in the app now uses that one modal (§8.4).

Each decision is marked:

- **Decided:** in the owner's request of 2026-10-22. Don't change it without asking.
- **Call:** chosen while designing, with the reason given. The owner can override it.
- **Builder:** left open. Use your judgement.

---

## 1. What this is

A private web app where the owner manages the data of every interacti product from one place: find any record, create one, change its fields, delete it. It lives on a subdomain of the landing page and talks to each product only through that product's own `/api/admin` endpoints. (Decided)

**Who uses it (Call):** the owner, alone. There are no staff and no roles. One admin token opens every product.

**What success means:** a fix that today needs SSH, `psql` or Prisma Studio on the server takes a minute in the browser, and no product is less safe because of it.

**What exists today:** nothing. No product has an `/admin` route on any branch (checked 2026-10-22), so both halves are built by these plans: the endpoints in each product first, then the dashboard that uses them.

## 2. The products (Decided: every product)

| Product | Repo | Status on the landing | Database | Admin API origin in production | In the admin |
|---|---|---|---|---|---|
| 0nbox | `../0nbox` | Live | Postgres, UUID ids | `https://onbox.live` | Managed |
| Strive | `../strive` | Live | MongoDB, ObjectId ids | `https://www.usestrive.run` | Managed |
| Parcours | `../parcours` | Live | Postgres, cuid ids | `https://parcours.live` | Managed |
| Sara | `../sara` | Coming soon | Postgres, cuid ids | `https://sara.84-12-92-46.sslip.io` | Managed, labelled "Coming soon" |
| Fluid | `../fluid` | Coming soon | Postgres, cuid ids | not deployed | Managed once its origin is configured, labelled "Coming soon" |
| Harv3st | none | Coming soon | none | none | Listed as "Coming soon · No backend", not navigable |

- **Coming soon (Call):** Sara, Fluid and Harv3st carry "Coming soon" wherever they appear, as on the landing. Sara and Fluid can still be managed, because their backends exist and the landing's rule is about not presenting them to visitors as usable. The admin has no visitors.
- **Imagery:** each product's own tile, copied from `landing/public/brand/<slug>/tile.svg` (0nbox, Strive, Parcours, Sara). Fluid and Harv3st have no logo, so their names are typeset, as on the landing.
- **Not in scope (Call):** the landing page's own product list and copy. They live in `landing/src/content/` and ship with a build; the landing spec rules out a CMS.

## 3. Goals, non-goals, anti-goals

**Goals**
1. Every product with a backend lists its resources, and each resource has a table with search, sort, filters and pagination, following the Dandys admin's table patterns (Decided; §8.2).
2. Every resource a person manages can be created, edited field by field, and deleted (Decided). Sign-in records (§7.1) are the exception: they can be listed and revoked, never forged (Call).
3. The product decides what's valid. The dashboard holds no copy of a product's rules; it reads them from the product's manifest (§6.2) and shows the product's own error messages.
4. One sign-in covers every product.
5. It looks and reads like interacti: the landing's colour, type and logo (Decided), applied to a working tool (§9).
6. A model added to a product later shows up once it's registered in that product, with no dashboard release, and a model nobody registered fails that product's tests (§7.1).

**Non-goals (v1):** roles or more than one admin; an audit log beyond each product's existing request log; bulk edit or bulk delete; CSV or PDF export (Dandys has both; Call: left out until it's needed); charts or metrics; file uploads (image fields take a URL); acting as a user; editing the landing page; live updates.

**Anti-goals: failure even if it works**
- The admin can read or write a credential: a password hash, an OAuth or API token, a session token, an encrypted mailbox credential or a token hash.
- The admin can create a session or a sign-in token, which would let it sign in as someone.
- The admin token travels over plain http, or an `/api/admin` route answers without it.
- A record is deleted in one click.
- A colour other than black and white carries meaning (status, danger, success). Product colour appears only inside product tiles.
- A coming-soon product looks live.
- A product's validation is rewritten in the dashboard and drifts.

## 4. How it fits together (Call)

```
admin.interacti.<host>   static app: Vite, React, TypeScript, Tailwind, TanStack Query
  │  HTTPS · Authorization: Bearer <admin token> · CORS from this origin only
  ├─► https://onbox.live/api/admin/…                    0nbox     Next.js + Prisma
  ├─► https://www.usestrive.run/api/admin/…             Strive
  ├─► https://parcours.live/api/admin/…                 Parcours
  ├─► https://sara.84-12-92-46.sslip.io/api/admin/…     Sara
  └─► <fluid origin>/api/admin/…                        Fluid
```

- **The dashboard** is static files served by nginx on the landing's host, with no server of its own. It holds no secret: the owner types the token.
- **Each product** gets the same small admin module (`src/backend/admin/`) and three route files. The module reads the product's Prisma schema at runtime (`Prisma.dmmf`) to build the validators and the manifest. A registry in each product says which models are resources and what each may expose. Call: there are 78 resources across five repos. A hand-written validator per model would drift from the schema, and the registry keeps every security decision for a product in one reviewable file.
- **Established patterns, kept:** `withMiddleware` with the order auth → path params → query → body; Zod validation answering 422 with `path: message` from the first issue; schemas `.strict()` with `.partial()` for updates; the typed `HttpException` classes; the `ApiResponse` and `PaginatedApiResponse` envelopes; `db` from `@/server/db`; `env` from `@/env`; JSDoc for `next-openapi-gen`. Where a product diverges, the module follows that product: 0nbox and Parcours type `withMiddleware<B, Q>` and their reusable middleware with `AnyMiddleware`/`BodyMiddleware<B>`/`QueryMiddleware<Q>`, and Parcours' envelope carries `success`.

## 5. Access (Call)

- **The token:** one random secret of at least 32 characters (`openssl rand -base64 32`), set as `ADMIN_API_TOKEN` in every product's server environment. Use the same value everywhere, so one sign-in covers every product. Rotating it means changing the environment and restarting.
- **Off by default:** a product without `ADMIN_API_TOKEN` answers every `/api/admin` request with 404, so the surface doesn't exist until it's switched on. The env schema rejects a value shorter than 32 characters at boot.
- **Checking it:** `Authorization: Bearer <token>`, compared in constant time: SHA-256 both values, then `crypto.timingSafeEqual`. Missing or wrong gives 401 `Unauthorized`.
- **CORS:** `ADMIN_ORIGIN` names the dashboard's origin. Every admin response, errors included, carries `Access-Control-Allow-Origin: <ADMIN_ORIGIN>` when the request's `Origin` matches it exactly, and always `Vary: Origin`. `OPTIONS` answers 204 with `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`, `Access-Control-Allow-Headers: Authorization, Content-Type` and `Access-Control-Max-Age: 600`, without the token. There are no cookies, so no `Allow-Credentials`.
- **No caching:** every admin response carries `Cache-Control: no-store`.
- **HTTPS only:** the dashboard refuses to sign in on a page that isn't https, and never sends the token to an http API origin. `localhost` and `127.0.0.1` are the only exceptions, for development. A product configured with an http origin shows "Needs HTTPS". The landing's host serves plain http until a domain gets TLS (landing spec §9), so the admin subdomain needs its certificate before first use (§11).
- **In the browser:** the token lives in `sessionStorage` under `ix-admin-token`, so closing the tab signs out. The dashboard loads no third-party script, and nginx sends a `Content-Security-Policy` with `script-src 'self'` (§11).
- **A product rejects the token (401):** that product shows "Token rejected" and the others keep working. Signing in needs at least one product to accept the token. This is the one place the dashboard departs from the products' sign-out-on-401 interceptor: a product with a rotated token shouldn't lock the owner out of the rest.

## 6. The admin API (Call: identical in every product)

### 6.1 Routes

| Method and path | Does | Success |
|---|---|---|
| `GET /api/admin` | The manifest: every resource, its fields and its record count | 200 `ApiResponse<AdminManifest>` |
| `GET /api/admin/:resource` | One page of records | 200 `PaginatedApiResponse<AdminRecord[]>` |
| `POST /api/admin/:resource` | Create a record | 201 `ApiResponse<AdminRecord>` |
| `GET /api/admin/:resource/:key` | One record | 200 `ApiResponse<AdminRecord>` |
| `PUT /api/admin/:resource/:key` | Change some fields. The body is partial, as the products' own `PUT` routes take | 200 `ApiResponse<AdminRecord>` |
| `DELETE /api/admin/:resource/:key` | Delete it | 200 `ApiResponse<null>` |
| `OPTIONS` on each path | CORS preflight | 204 |

`:resource` is a registry key (§7). `:key` is the record's `_key` (§6.3), URL-encoded.

### 6.2 The manifest

```ts
interface AdminManifest {
  product: '0nbox' | 'strive' | 'parcours' | 'sara' | 'fluid';
  resources: AdminResourceMeta[];          // registry order
}

interface AdminResourceMeta {
  key: string;                             // 'medal-claims'
  label: string;                           // 'Medal claims'
  singular: string;                        // 'Medal claim'
  model: string;                           // 'MedalClaim'
  group: string;                           // nav group, from §7.2
  titleField: string;                      // the field that names a record
  columns: string[];                       // table columns, in order
  searchable: string[];
  sortable: string[];
  filterable: string[];
  defaultSort: { by: string; order: 'asc' | 'desc' };
  can: { create: boolean; update: boolean; delete: boolean };
  note: string | null;                     // shown above the table, in the record view and in the form modal
  count: number;                           // rows in the table now
  fields: AdminFieldMeta[];                // exposed fields, in schema order
  related: { resource: string; field: string }[];   // resources whose `field` points at this one
}

interface AdminFieldMeta {
  name: string;
  label: string;                           // 'emailVerifiedAt' → 'Email verified at'
  type: 'string' | 'text' | 'int' | 'float' | 'decimal' | 'boolean' | 'datetime' | 'enum' | 'json';
  list: boolean;                           // a scalar list: String[], Int[]
  required: boolean;                       // must be given on create
  nullable: boolean;
  readOnly: boolean;                       // shown, never accepted
  isId: boolean;
  enumValues: string[] | null;
  relation: { resource: string } | null;   // a foreign key to a registered resource
}
```

- **Types:** Prisma `String` is `string`, or `text` when the name ends in `description`, `body`, `notes`, `Md`, `transcript`, `message`, `prompt`, `caption` or `reason` (Builder: tune the list). `Int` is `int`, `Float` is `float`, `Decimal` is `decimal`, `Boolean` is `boolean`, `DateTime` is `datetime`, `Json` is `json`, and an enum is `enum` with its values. `Bytes` is never exposed.
- **Required:** Prisma requires the field, it has no default, it isn't `@updatedAt`, and it isn't read-only.
- **Read-only:** an id with a default, `createdAt`, any `@updatedAt` field, and the fields the registry lists. An id without a default, such as Parcours' `RetiredHandle.handle`, is writable on create and never on update.
- **Defaults (Builder: override per resource in the registry):**
  - `columns`: the title field, then up to four foreign keys, enums and booleans, then `createdAt` when there is one.
  - `searchable`: the title field when it's a string, plus `email`, `name`, `slug` and `title` where they exist.
  - `sortable`: every exposed scalar that isn't a list or JSON.
  - `filterable`: every exposed enum, boolean and foreign key.
  - `defaultSort`: `createdAt` descending when the model has it, otherwise the first id field ascending.
- Hidden fields are never searchable, sortable or filterable.

### 6.3 Records

```ts
type AdminRecord = Record<string, unknown> & {
  _key: string;     // opaque: the dashboard never builds one
  _title: string;   // the title field's value; _key when that's empty
  _refs: Record<string, { key: string; title: string } | null>;  // per foreign key: the record it points at
};
```

- **Values are JSON:** dates as ISO strings, `Decimal` as a string (Prisma's own serialisation), and `Json` as it is.
- **Keys:** `_key` is the id as a string. For a composite id (`@@id` on 0nbox `TrustedSender`, and Parcours `SkillEstimate` and `BoardMember`), it's base64url of the JSON array of the id values, in `@@id` order. A key that doesn't decode, or an id of the wrong shape such as a malformed ObjectId, gets a 404.
- **Titles:** when the title field is a foreign key, `_title` is that reference's title, so a join row reads as the person it belongs to.
- **Reads always select explicitly.** Each read is a Prisma `select` of the exposed fields, plus each foreign key's target `{ id fields, title field }`. It is never a whole row filtered afterwards. This is 0nbox's rule, applied in every product.

### 6.4 Writes

- **Validation:** the body is a JSON object of writable fields. The product builds a `.strict()` Zod schema from its Prisma model and registry, so a read-only, hidden or unknown key gets a 422 that names it. `PUT` uses the same schema with `.partial()`.
- **Wire types:**
  - strings;
  - numbers for `int` and `float`, with integers checked;
  - `decimal` as a number or a numeric string;
  - `datetime` as an ISO string;
  - an enum as one of its values;
  - `json` as any JSON value;
  - lists as arrays;
  - `null` for a nullable field (stored as `DbNull` for JSON).

  An empty string is a value, not a null.
- **Foreign keys** must name an existing record of the target. The module checks before writing and answers 422 `<field>: no such <target singular, lowercased>`. MongoDB doesn't enforce this for Strive, and checking everywhere gives one behaviour.
- **Rows, not operations:** the admin changes the rows it's given. It recomputes nothing except the hooks in §7.2, and resources with a known knock-on effect carry a `note` that says so.

### 6.5 Lists

- **Parameters:**
  - `page`, from 1, default 1;
  - `size`, 1–100, default 20;
  - `query`, up to 255 characters;
  - `sortBy`, one of `sortable`;
  - `sortOrder`, `asc` or `desc`;
  - one `<field>=<value>` per `filterable` field: an enum value, `true` or `false`, or a key.

  Unknown parameters get a 422 (`.strict()`, as in every product).
- **Search:** `query` matches any `searchable` field (contains, case-insensitive). When `query` is also a well-formed id, it matches that record's id exactly as well.
- **Combining:** filters combine with AND, and `query` combines with the filters by AND.

### 6.6 Errors

Errors use the product's own shape: `{ message }`, or Parcours' envelope with `success: false`.

| Status | When |
|---|---|
| 401 | Missing or wrong token |
| 403 | The resource doesn't allow that action: "Sessions can't be created here" |
| 404 | Admin off, unknown resource, bad key, or no such record |
| 409 | A unique clash (P2002): "`email`: already in use". Still referenced (P2003, P2014): "Other records still point at this one" |
| 422 | Validation: `path: message`, as everywhere |
| 500 | Anything else, reported to Sentry by `withMiddleware` as today |

## 7. What each product exposes (Call: every row)

### 7.1 Rules for every product

- **Registered or excluded:** every Prisma model is either a resource in the product's registry or in its `excluded` list with a reason. A test fails when a model is neither, so a new model is a decision, not an accident.
- **Never exposed:** `Bytes` fields; any field whose name matches `/hash|token|secret|password|credential|enc$/i`; and the fields the tables below add. A test fails if a registered resource exposes a field matching that pattern. Hidden fields aren't in the manifest, aren't selected, and can't be searched, sorted, filtered or written.
- **Sign-in records** (sessions, OAuth accounts, identities, auth tokens, login attempts and chat link tokens) allow read and delete only. Delete one to revoke it or unlock an email. Creating or editing one would forge a sign-in.
- **Everything else** allows create, update and delete.
- **Hooks:** when writes to a resource must keep another value in step, its registry entry calls the product's own code. Only the hooks listed below exist.
- **Concurrency:** the last write wins. Two tabs editing one record is the owner racing themselves.

### 7.2 The resources

"All" means create, update and delete. "Read, delete" means the sign-in rule above.

**0nbox** (7 resources, none excluded)

| Key | Model | Title | Group | Can | Notes |
|---|---|---|---|---|---|
| `users` | User | email | People | all | |
| `mail-accounts` | MailAccount | email | People | read, delete | Exposes `ACCOUNT_PUBLIC_FIELDS` (`src/backend/services/accounts/fields.ts`) plus `userId`, nothing else. Deleting disconnects the mailbox |
| `trusted-senders` | TrustedSender | addr | People | all | Composite key (userId, addr) |
| `user-identities` | UserIdentity | provider | Sign-in | read, delete | Deleting unlinks Google |
| `sessions` | Session | userId | Sign-in | read, delete | Deleting signs that device out |
| `login-attempts` | LoginAttempt | identifier | Sign-in | read, delete | Deleting unlocks that email |
| `auth-tokens` | AuthToken | purpose | Sign-in | read, delete | |

**Strive** (14 resources, 1 excluded)

| Key | Model | Title | Group | Can | Notes |
|---|---|---|---|---|---|
| `users` | User | email | People | all | Also hidden: `nrc_auth_meta` |
| `clubs` | Club | name | Clubs | all | Read-only: `memberCount` |
| `user-clubs` | UserClub | userId | Clubs | all | Hook: after a create, update or delete, recount `memberCount` on each club it touched, counting the rows Strive's own accept and exit routes count |
| `club-invites` | ClubInvites | code | Clubs | all | |
| `leaderboards` | Leaderboard | name | Leaderboards | all | |
| `user-leaderboards` | UserLeaderboard | userId | Leaderboards | all | |
| `leaderboard-invites` | LeaderboardInvites | code | Leaderboards | all | |
| `rewards` | Reward | title | Rewards | all | |
| `user-rewards` | UserReward | userId | Rewards | all | |
| `medal-claims` | MedalClaim | userId | Rewards | all | |
| `notifications` | Notification | message | Messages | all | |
| `paystack-transactions` | PaystackTransaction | reference | Payments | all | Note: "Changes this record only. Paystack isn't contacted." |
| `accounts` | Account | provider | Sign-in | read, delete | Also hidden: `session_state`. Deleting unlinks Strava or NRC |
| `sessions` | Session | userId | Sign-in | read, delete | |

Excluded: `VerificationToken` (sign-in tokens; nothing to manage).

**Parcours** (31 resources, 4 excluded)

Every Content resource carries the note "Seeded from the repo. The next `seed:*` run overwrites the fields it seeds." (`scripts/seed-*.ts` upsert by id.)

| Key | Model | Title | Group | Can | Notes |
|---|---|---|---|---|---|
| `descriptors` | Descriptor | code | Content | all | |
| `grammar-points` | GrammarPoint | title | Content | all | |
| `modules` | Module | title | Content | all | |
| `module-days` | ModuleDay | functionLabel | Content | all | |
| `vocab` | Vocab | lemma | Content | all | |
| `vocab-forms` | VocabForm | form | Content | all | |
| `sentences` | Sentence | textFr | Content | all | |
| `exercises` | Exercise | id | Content | all | |
| `test-items` | TestItem | id | Content | all | |
| `documents` | Document | title | Content | all | |
| `audio-clips` | AudioClip | providerRef | Content | all | Note: "Ingested by `ingest:*`. The next run overwrites it." |
| `users` | User | email | People | all | |
| `boards` | Board | name | Boards | all | `inviteToken` is hidden by the pattern |
| `board-members` | BoardMember | userId | Boards | all | Composite key (boardId, userId) |
| `score-cards` | ScoreCard | slug | Boards | all | |
| `duels` | Duel | slug | Boards | all | |
| `retired-handles` | RetiredHandle | handle | People | all | Id without a default: set on create |
| `day-sessions` | DaySession | userId | Activity | all | |
| `day-session-blocks` | DaySessionBlock | block | Activity | all | |
| `attempts` | Attempt | itemId | Activity | all | |
| `mock-sessions` | MockSession | userId | Activity | all | |
| `mock-section-results` | MockSectionResult | skill | Activity | all | |
| `cards` | Card | vocabId | Activity | all | |
| `skill-estimates` | SkillEstimate | userId | Activity | all | Composite key (userId, skill) |
| `module-results` | ModuleResult | moduleId | Activity | all | |
| `speech-attempts` | SpeechAttempt | promptId | Activity | all | |
| `ingest-manifests` | IngestManifest | source | Pipeline | all | |
| `user-identities` | UserIdentity | provider | Sign-in | read, delete | |
| `sessions` | Session | userId | Sign-in | read, delete | |
| `auth-tokens` | AuthToken | purpose | Sign-in | read, delete | |
| `login-attempts` | LoginAttempt | identifier | Sign-in | read, delete | Deleting unlocks that email |

Excluded: `StagingLexique`, `StagingKaikki`, `StagingTatoeba`, `StagingCommonVoice` (scratch tables that every `ingest:*` run rebuilds).

**Sara** (22 resources, 1 excluded)

Every Sales resource marked "totals" carries the note "Totals aren't recomputed from lines or payments."

| Key | Model | Title | Group | Can | Notes |
|---|---|---|---|---|---|
| `users` | User | email | People | all | |
| `businesses` | Business | name | Businesses | all | Google Calendar tokens are hidden by the pattern |
| `business-hours` | BusinessHours | dayOfWeek | Businesses | all | |
| `business-closures` | BusinessClosure | date | Businesses | all | |
| `services` | Service | name | Catalogue | all | |
| `products` | Product | name | Catalogue | all | |
| `product-options` | ProductOption | name | Catalogue | all | |
| `gallery-items` | GalleryItem | url | Catalogue | all | |
| `customers` | Customer | name | Customers | all | Read-only: `nameKey`. Hook: before a write that sets `name`, set `nameKey` with Sara's `nameKey()` from `src/backend/services/customer/normalize.ts` |
| `bookings` | Booking | clientName | Sales | all | |
| `invoices` | Invoice | invoiceNumber | Sales | all | totals |
| `invoice-lines` | InvoiceLine | name | Sales | all | totals |
| `receipts` | Receipt | receiptNumber | Sales | all | totals |
| `receipt-lines` | ReceiptLine | name | Sales | all | totals |
| `orders` | Order | clientName | Sales | all | totals |
| `order-lines` | OrderLine | name | Sales | all | totals |
| `payments` | Payment | clientName | Sales | all | Note: "Changes this record only. Paystack isn't contacted." |
| `chat-identities` | ChatIdentity | externalId | Chat | all | |
| `chat-sessions` | ChatSession | state | Chat | all | Note: "Live chat state. Editing it changes what Sara does next in that chat." |
| `chat-link-tokens` | ChatLinkToken | externalId | Sign-in | read, delete | `token` is hidden by the pattern |
| `accounts` | Account | provider | Sign-in | read, delete | Also hidden: `session_state` |
| `sessions` | Session | userId | Sign-in | read, delete | |

Excluded: `VerificationToken` (sign-in tokens with no single id).

**Fluid** (4 resources, none excluded)

| Key | Model | Title | Group | Can | Notes |
|---|---|---|---|---|---|
| `users` | User | email | People | all | `passwordHash` and `access_token` are hidden by the pattern |
| `payment-links` | PaymentLink | title | Payments | all | |
| `payments` | Payment | externalRef | Payments | all | Note: "Changes this record only. No payment rail is contacted." |
| `sessions` | Session | userId | Sign-in | read, delete | |

## 8. The dashboard

### 8.1 Screens (Call)

| Path | Screen |
|---|---|
| `/sign-in` | The logo, the eyebrow "Admin", one field "Admin token", and "Sign in". It returns to `?next=` afterwards |
| `/` | Products: a card per product with its tile, name, status ("● Live · SaaS", "○ Coming soon · AI"), and connection: "14 resources · 2,340 records", "Not connected", "Needs HTTPS", "Couldn't reach it", "Admin is off" or "Token rejected" |
| `/:product` | The product's resources by group, each with its record count |
| `/:product/:resource` | The table (§8.2) |
| `/:product/:resource/:key` | The table with the record's view over it (§8.3) |

- **No pages for create and edit (Decided 2026-10-22).** They open in a modal over the table, as Sara's do (§8.4).
- **Rail:** on desktop (1024px and up), a fixed left rail holds the logo, the six products, and the open product's resources by group with their counts at 50%. "Sign out" sits at its foot.
- **Phones:** the logo and "Menu" sit at the top. "Menu" opens a full-screen black menu with the same contents, as on the landing.
- **A product that isn't connected** shows its reason and what fixes it ("Set `VITE_API_FLUID` and rebuild"). Harv3st's card isn't a link.

### 8.2 Tables (Decided: the Dandys admin's patterns, `Dandys_AdminDashboardrd/src/primitives/DataTable.tsx` and its pages)

Carried over:
1. **`DataTable`:** a generic component over TanStack Table `ColumnDef[]`, built on shadcn-style `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead` and `TableCell` parts. Header cells don't wrap. One "No results." row spans every column when the page is empty.
2. **Toolbar above the table:** search on the left, debounced 500ms with `useDebounce`; the filter menu next to it (Dandys' `ISubMenu` filter dialog); actions on the right. Here the action is "New <singular>", not Dandys' exports.
3. **URL state:** page, search, sort and filters live in the URL, written with `createUrl(pathname, params)` and replaced without scrolling. Setting an empty value deletes the parameter. Changing anything but the page resets the page to 1.
4. **Server pagination:** a `Pagination` component driven by `usePagination({ totalCount, pageSize, siblingCount, currentPage })`, Dandys' algorithm with `DOTS`. Previous and next are disabled at the ends and carry `aria-label`s.
5. **Row actions:** a last column `id: 'actions'` with a kebab menu (View, Edit, Delete) and an sr-only "Open menu".
6. **Details:** label/value rows separated by hairlines, with the actions underneath (Edit first, Delete second).

Changed:
- Dandys' Redux Toolkit Query becomes TanStack Query (Decided).
- Dandys' separate create and edit pages become Sara's create/edit modal (Decided 2026-10-22; §8.4).
- Its coloured `StatusBadge` becomes a monochrome pill, and its fonts, colours, icon packs, PDF and CSV export are dropped.

Added (Call):
- Sortable column headers cycle ascending, descending, then the default, with `↑`/`↓` and `aria-sort`.
- A row's title cell is a link to its record's view, so every row is reachable by keyboard.
- A foreign key cell shows the reference's title and links to that record's view.
- Long values are cut to one line with an ellipsis; the view shows them in full.
- The table scrolls sideways inside its own frame, never the page.

### 8.3 Record view (Call)

- **The view** opens in the shared modal (§8.4.1) over the table, up to 640px wide as a panel. It holds an eyebrow ("Strive · Clubs"), the title, the resource's `note` if it has one, and every exposed field as a label/value row, read-only fields included.
- **Links:** references link to their records. A "Related" list links to each resource in `related`, already filtered: "User clubs →" opens `/strive/user-clubs?clubId=<key>`.
- **Actions:** "Edit" and "Delete", shown only when `can` allows them. Each closes the view and opens its own modal for that record: edit (§8.4.2) or delete (§8.5). Only one modal is ever open, as in Sara.
- **Closing:** the modal's round "Close" button, Esc or Back close it, and focus returns to the row's link. It has `role="dialog"`, a focus trap, and its title as its label.
- **A record that's gone** (404) shows "This record doesn't exist any more." with a way back to the list.

### 8.4 Create and edit (Decided 2026-10-22: Sara's modal, not pages)

#### 8.4.1 The modal

`Modal` is Sara's primitive (`../sara/src/primitives/Modal.tsx`), with the same compound API and behaviour, restyled to interacti (§9).
- **Its parts:** `Modal` (Radix `Dialog.Root`), `Modal.Button`, `Modal.Portal`, `Modal.Content`, `Modal.Title`, `Modal.Description`, `Modal.Close`, `Modal.Dismiss` (the round "Close" button pinned top right) and `Modal.Handle` (the grab handle, phones only, decorative).
- **The overlay wraps the content,** so a tall form scrolls inside the backdrop. Its one column is `minmax(0, 1fr)`, so content that never wraps can't push the panel off-screen.
- **Its shape:** below 640px it's a bottom sheet that rises from the edge. From 640px it's a centred panel, 480px wide by default.
- **Motion:** enter and exit are CSS keyframes on `data-state`, so Radix keeps the modal mounted until it has left.

Every dialog in the app uses it: the record view, create and edit, and delete.

#### 8.4.2 One modal for create and edit

- **The component:** `RecordFormModal` follows Sara's `ServiceModal` (`../sara/src/components/services/service-modal.tsx`). It takes `open`, `onOpenChange`, `record` (present when editing), `onSubmit`, `isPending` and `error`, and its panel is 560px wide.
- **Who owns it:** the resource list page holds it and both mutations, as Sara's `ServicesPageClient` does.
  - `editing` holds `{ key, record? }`, and a separate `open` flag lets closing keep the last record while the modal animates out.
  - `key={editing.key}` gives each opening a fresh form.
  - Opening resets both mutations.
- **It opens from** "New <singular>" in the toolbar, "Edit" in a row's menu, or "Edit" in the record view.
- **Inside, top to bottom:**
  - the handle and the Close button;
  - the title, "New club" or "Edit club";
  - the description: the resource's `note` when it has one, otherwise "Empty fields take Strive's default." on create or "Only the fields you change are sent." on edit;
  - the form (`noValidate`, `autoComplete="off"`);
  - a form-level notice when there is one;
  - the actions: "Create club" or "Save changes" (primary, reading "Saving…" while pending) and "Cancel" (secondary, closing the modal). They're stacked on phones; from 640px they sit side by side with the primary on the right, as in Sara.
- **Fields** are generated from the manifest: the writable fields, in schema order. Each label sits above its control, never as a placeholder. An optional field says "(optional)" after its label, as Sara's do: not required on create, nullable on edit.

  | Type | Input |
  |---|---|
  | `string` | Text input |
  | `text` | Growing textarea |
  | `int`, `float`, `decimal` | Text input with a numeric `inputMode`, checked on submit |
  | `boolean` | Checkbox |
  | `datetime` | `datetime-local` in the browser's time zone, sent as ISO |
  | `enum` | Native select, with "None" for a nullable field |
  | `json` | Monospace textarea, checked with `JSON.parse` |
  | list | Textarea, one value per line |
  | foreign key | A relation picker: a combobox that searches the target resource and shows titles. A pasted key works too |

- **Edit** sends only the fields that changed. With no changes, the modal's notice says "Nothing to save." and nothing is sent.
- **Clearing a field** sends `null` on edit when it's nullable. On create, an empty field is left out so the product's default applies.
- **The client checks shape only:** required, number, date, JSON and enum membership. The product's 422 or 409 is authoritative: `path: message` lands under that field when `path` names one, otherwise in the notice. A 404 says "This record doesn't exist any more."
- **After saving,** the modal closes and the table refreshes, as in Sara. A toast says "Club created.", with a "View" action that opens the new record, or "Saved."

### 8.5 Delete (Call)

- **The delete modal** is the same `Modal`, laid out like Sara's `ConfirmModal`. It reads "Delete Lagos Runners?", then "This can't be undone. Records that belong to it may be deleted with it.", then a field "Type delete to confirm", then "Delete club" and "Cancel". "Delete club" is enabled only once the field reads `delete`, so no record goes in one click.
- **A 409** keeps the modal open with the product's message in place of the description, as Sara's `ConfirmModal` does ("Other records still point at this one"). Nothing is deleted.
- **On success:** the modal closes, the table refreshes, and the toast says "Deleted Lagos Runners."

### 8.6 States and copy (Call)

- **Loading:** skeleton rows at the table's height, white at 10%. No spinners, and no pulse under reduced motion.
- **Empty:** "No clubs yet." With a search or filter applied: "No clubs match." with "Clear search and filters".
- **Errors** name the thing and the cause: "Couldn't load clubs. Strive didn't answer." with "Try again". A 422 on list parameters, such as a stale `sortBy` in an old link, offers "Reset the table".
- **Copy:** sentence case, short declaratives, no exclamation marks, as on the landing.

## 9. Design (Decided: the landing's system; Call: how it applies to a tool)

- **Colour:** `#000` and `#fff` only, with opacity steps 80/50/30/20/10, from the landing's `@theme` (`--color-*: initial`). The app is black with white text. Modals are white with black text.
  - Secondary text is white at 50% on black, but black at 80% on white, as the landing raises its eyebrows on white sheets. Black at 50% on white is under 4.5:1.
  - Hairlines are white 10% on black and black 10% on white. Row hover is white 10%, and the open row is white 20%.
  - Primary buttons are white pills with black text, secondary buttons are 1px outlined pills at 30%, and ghost buttons are text. Delete is a secondary button whose label says what it does. Danger is never red.
- **Type:** Switzer, 400 and 500 only, self-hosted as the landing's unmodified Fontshare WOFF2 files (copied from `landing/public/fonts/`). The scale uses the landing's tokens:
  - 14px (`--text-micro`) for labels, table headers and meta;
  - 16px (`--text-body`) for cells and inputs;
  - 24px (`--text-statement`) for modal titles and empty states;
  - 48px (`--text-large`) for page titles at 500, tracking −0.02em.

  Numbers in tables use `tabular-nums`.
- **The logo:** the kit's white logo, `landing/brand/interacti/logo-white.svg`, copied unmodified and shown in an `<img>`, because it only ever appears on black. It's at least 72px wide, and never retyped, redrawn, stretched or recoloured. The favicon is `brand/interacti/favicon.svg`. Nothing animates it here, so the dancing i stays in its `arch-back` pose.
- **Status markers:** the landing's filled dot ● for live and hollow dot ○ for coming soon. Enum values are monochrome pills.
- **Glyphs, not an icon set (Call):** ↗ ↓ → ← ↑ × ⋯, as on the landing.
- **Shape:** modals take the landing's 24px `--radius-sheet`, on the top corners only as a phone bottom sheet and on all four as a panel. Controls have a new `--radius-control: 0.75rem`. The gutter is the landing's `--gutter: max(16px, 2.2vw)`.
- **Motion:** modals move as Sara's do.
  - The overlay fades in over 0.24s and out over 0.15s.
  - A phone sheet rises over 0.42s and leaves over 0.2s.
  - A panel pops in over 0.32s, from 8px lower at 97% scale, and out over 0.16s.

  Ins ease on `--ease-reveal` and outs on `ease-out`. The overlay is black at 50% with a 2px backdrop blur. Other UI fades take 0.3s. Under reduced motion, Sara's global rule cuts every animation and transition to 0.01ms. There's no GSAP, no Lenis and no loader screen.
- **Focus:** the landing's ring (`outline: 2px solid #fff; outline-offset: 3px; box-shadow: 0 0 0 1px #000`), drawn black on white modals.
- **Toasts:** white pills with black text, the same for errors. The words carry the difference ("Couldn't save. …").
- **Phones:** everything holds at 375px with no sideways page scroll; tables scroll inside their own frame. Pinch-zoom stays on.
- **Accessibility:** WCAG 2.2 AA. Tables are real `<table>`s with `<th scope="col">`. Every input has a label. Modals trap focus and return it. The lowest opacity for readable text is 50% on black and 80% on white; 30% and below is decoration only.

## 10. Technical approach (Call unless marked)

- **Stack (Decided):** Vite, TypeScript, Tailwind CSS (v4 through `@tailwindcss/vite`, as on the landing), and TanStack Query.
- **Libraries (Call):**
  - React 19 (TanStack Query's React binding);
  - React Router 7;
  - `@tanstack/react-table` 8 (Dandys);
  - react-hook-form with `@hookform/resolvers` and Zod 4 (every product);
  - axios (every product);
  - `radix-ui`, the unified package, for Dialog, DropdownMenu and Popover (Sara and Parcours);
  - sonner, restyled (0nbox and Strive).

  Shared tools pin the versions the landing uses: Vite, TypeScript, Tailwind, Vitest, happy-dom and Playwright.
- **Following the products' frontend guides:**
  - a query key factory, `adminKeys`, with `all`, `manifest(product)`, `lists(product, resource)`, `list(…)` and `detail(…)`, as in the Sara and Parcours guides;
  - query hooks in `src/hooks/queries/` and mutation hooks in `src/hooks/mutations/` that invalidate the list, the detail and the manifest (counts) on success;
  - no optimistic updates, no `setQueryData` and no `placeholderData`;
  - mutation errors toast the API's `message` or a fallback that names the action;
  - the QueryClient defaults copy Strive's (`staleTime` 5 minutes, `refetchOnMount: 'always'`, `refetchOnWindowFocus: 'always'`);
  - Sara's modal pattern: `src/primitives/Modal.tsx`, `ConfirmModal.tsx` and `Field.tsx`, where a field context wires each control's id, `aria-describedby` and `aria-invalid`; and `src/components/services/service-modal.tsx` with `services-page-client.tsx` for one create/edit modal owned by its page;
  - `primitives/` for dumb UI and `components/` for feature pieces;
  - forms with `noValidate`;
  - barrels in `primitives/index.ts` and `utils/index.ts`;
  - the `@/*` alias.
- **Product origins** come from build-time env: `VITE_API_0NBOX`, `VITE_API_STRIVE`, `VITE_API_PARCOURS`, `VITE_API_SARA` and `VITE_API_FLUID`, without trailing slashes.
  - `.env.production` is committed with the origins in §2 and Fluid empty; they aren't secrets.
  - `.env.development` points at local dev servers: Strive `http://localhost:3000`, Parcours `:3001`, 0nbox `:3002`, Sara `:3003`, Fluid `:3004`. The dashboard's own dev server runs on `:5174`.
- **Tests:**
  - Vitest with happy-dom and Testing Library for units and components.
  - One in-memory fake admin API that implements §6 (`tests/fake-api/`), served to unit tests through MSW and to Playwright through `page.route`, so both exercise the same contract.
  - Playwright for the journeys, axe, keyboard and 375px checks.

## 11. Deploy (Call: follows the landing's kit)

- **Host:** the landing's Oracle host, `84.12.92.46`. nginx serves `/srv/interacti-admin/current`, a symlink to `releases/<sha>`, keeping three releases. `deploy/release.sh` is the landing's, with `APP_DIR=/srv/interacti-admin`.
- **Hostname:** `admin.interacti.84-12-92-46.sslip.io`, a subdomain of the landing's `interacti.84-12-92-46.sslip.io`. It becomes `admin.<landing domain>` once the landing gets a domain. A certificate (certbot, as in the landing's README) is needed before first sign-in, because the app refuses http.
- **nginx:**
  - SPA fallback `try_files $uri /index.html`;
  - hashed `/assets/*` immutable for a year, and `index.html` `no-cache`;
  - `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`;
  - `X-Robots-Tag: noindex, nofollow`;
  - `Referrer-Policy: no-referrer`;
  - `X-Frame-Options: DENY`;
  - `X-Content-Type-Options: nosniff`.

  `connect-src` allows any https origin so the CSP needn't track the product list. `script-src 'self'` is what stops injected script.
- **CI:** a GitHub Actions workflow like the landing's: build on `ubuntu-latest`, rsync to `releases/<sha>`, run `release.sh`, with the existing `SSH_HOST`, `SSH_USER` and `SSH_KEY` secrets.
- **Products:** each product's server environment gains `ADMIN_API_TOKEN` and `ADMIN_ORIGIN=https://admin.interacti.84-12-92-46.sslip.io`, documented in its `.env.example` and deploy README.

## 12. Left to the builder

- Column, search and sort choices per resource beyond the defaults in §6.2.
- The `text` name list.
- Breakpoints between the rail and the phone menu, as long as 375px holds.
- Skeleton row count and exact timings within §9.
- Copy edits that keep the meaning.
