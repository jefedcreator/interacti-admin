# interacti Admin API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each of the five product backends (Strive, Sara, Parcours, 0nbox, Fluid) a token-guarded `/api/admin` surface that serves a manifest and lists, reads, creates, updates and deletes the product's registered resources, as spec §5–§7 describe.

**Architecture:**
- **The kit:** every product gets the same admin module, `src/backend/admin/kit/`. It reads the product's Prisma schema at runtime (`Prisma.dmmf.datamodel`) to build field metadata, Zod validators, Prisma queries and the manifest.
- **Built once, copied:** the kit is built and tested in Strive (Tasks 1–2), then copied byte for byte into the other four products.
- **Per product:** each product adds four files of its own:
  - a Prisma re-export, so the kit's imports resolve;
  - the registry of resources from spec §7.2;
  - middleware typed for that product's `withMiddleware`;
  - handlers that build that product's response envelopes.

  The three route files under `src/app/api/admin/` stay tiny.

**Tech Stack:** Next.js route handlers, Prisma 6 (`Prisma.dmmf`, `Prisma.PrismaClientKnownRequestError`, `Prisma.DbNull`), Zod (3.25 in Strive, Parcours, 0nbox and Fluid; 4.3 in Sara), Node `crypto`, Vitest.

**Spec:** `/Users/jefedcreator/Documents/Development/interacti/admin/docs/superpowers/specs/2026-10-22-interacti-admin-design.md`. Section numbers (§6.2 and so on) refer to it. The dashboard plan beside this one consumes exactly this contract.

## Global Constraints

- **Contract:** routes, envelopes, manifest and record shapes, key encoding, list parameters and error statuses are exactly spec §6. Resource keys, models, titles, groups, abilities, hidden fields, notes and hooks are exactly spec §7.2.
- **Exposure:** a field is never exposed when it's `Bytes`, matches `/hash|token|secret|password|credential|enc$/i`, or is in the resource's `hidden` list. This holds even if `expose` names it. Reads always use an explicit Prisma `select`.
- **Access:** `ADMIN_API_TOKEN` unset means every admin route and preflight answers 404. A wrong or missing bearer gets 401. The comparison is constant-time (SHA-256 both, `timingSafeEqual`). CORS echoes `ADMIN_ORIGIN` only on an exact match, and every admin response carries `Vary: Origin` and `Cache-Control: no-store` (spec §5).
- **Env:** add `ADMIN_API_TOKEN: z.string().min(32).optional()` and `ADMIN_ORIGIN: z.string().url().optional()` to the `server` block of `src/env.js`, and to `runtimeEnv`. Document both in `.env.example`. Read them only through `env` from `@/env`.
- **No new runtime dependency.** The kit uses `zod`, the product's Prisma client and `node:crypto`. Strive and Fluid gain `vitest` as a dev dependency only.
- **Each repo's own `CLAUDE.md` wins:**
  - **Every repo:** plain commit messages, with no `Co-Authored-By`, "Generated with" or other AI trailer.
  - **0nbox and Parcours:** no optional or conditional object spread (`...(cond ? {...} : {})`, `...(x ?? {})`); assign with an `if` instead. Don't run `yarn test`, `lint`, `typecheck` or `build` between tasks; run them once at the end of that repo's task.
  - **0nbox:** backend code only. Every route is documented and `public/openapi.json` is regenerated. `withMiddleware<B, Q>` declares a generic only when the matching validator is in the list, and `validatedData` or `query` is never cast.
- **Branches:** each repo works on `feat/admin-api`. Sara's inventory was taken from `feat/merchants-and-voice-notes` (2204bce): branch from it unless it has merged into `main`. Every other repo branches from `main`.
- **Copying the kit:** `src/backend/admin/kit/**` must be identical in all five repos. Port it with `rsync -a --delete ../strive/src/backend/admin/kit/ src/backend/admin/kit/`, never by hand. A change found while porting goes back into Strive's copy first, and is re-copied everywhere.

## Review Focus

These are failure modes the spec implies but no journey exercises. Each one has a test in the task named.

1. **A model added to a product later and never classified.** Expected: that product's `registry.test.ts` fails, naming the model. Tested in Task 3 (Strive) and in each port.
2. **A malformed key:** an invalid ObjectId, a non-UUID on 0nbox, broken base64, or the wrong number of composite parts. Expected: 404, never 500. Tested in Tasks 1 and 2.
3. **A hidden field reached sideways:** `sortBy=passwordHash`, `?passwordHash=x` as a filter, or a reference title. Expected: 422 for the parameter; the field is never selected. Tested in Tasks 1 and 2.
4. **Deleting a record other rows still reference.** Expected: 409 "Other records still point at this one", and the row is still there. Tested in Task 2.
5. **A foreign key that names nothing,** which Strive's MongoDB won't reject. Expected: 422 `<field>: no such <thing>` before any write. Tested in Task 2.

---

## Repos and order

| Task | Repo | What |
|---|---|---|
| 1–3 | `../strive` | The kit, built and tested here, then Strive's registry and routes |
| 4 | `../sara` | Port: Zod 4, envelopes from the root `types` |
| 5 | `../parcours` | Port: `AnyMiddleware` types, `success` envelope, gates at the end |
| 6 | `../0nbox` | Port: `AnyMiddleware` types, OpenAPI rules, gates at the end |
| 7 | `../fluid` | Port: adds Vitest |

All paths below are relative to the repo named in the task.

## File map (every product)

```
src/backend/admin/
├─ prisma.ts                 export { Prisma } from the product's generated client   (per product)
├─ kit/                      identical everywhere; Strive's copy is the source
│  ├─ types.ts               contract types (spec §6.2–6.3) + resolved resource types
│  ├─ dmmf.ts                datamodel lookups, id fields, labels
│  ├─ policy.ts              ResourcePolicy, AdminRegistry, SECRET_FIELD, resolveRegistry, uncoveredModels
│  ├─ keys.ts                encodeKey, whereForKey
│  ├─ schema.ts              writeSchema, listQuerySchema
│  ├─ query.ts               selectFor, whereFor, listArgs
│  ├─ records.ts             toAdminRecord
│  ├─ manifest.ts            manifestFor
│  ├─ errors.ts              toHttpException
│  ├─ access.ts              adminEnabled, tokenMatches, corsHeaders, withAdminHeaders, adminPreflight, adminRoute
│  ├─ service.ts             readManifest, listRecords, readRecord, createRecord, updateRecord, deleteRecord
│  └─ __tests__/             fixture.ts + one test file per module (no database)
├─ registry.ts               adminRegistry + resolvedAdmin                                (per product)
├─ middleware.ts             adminAuth, adminResource, adminCan, adminListQuery, adminBody (per product)
├─ handlers.ts               manifest, list, create, read, update, remove handlers        (per product)
└─ __tests__/registry.test.ts                                                             (per product)
src/app/api/admin/route.ts                   GET, OPTIONS
src/app/api/admin/[resource]/route.ts        GET, POST, OPTIONS
src/app/api/admin/[resource]/[key]/route.ts  GET, PUT, DELETE, OPTIONS
src/env.js · .env.example
```

---

### Task 1 (Strive): kit foundations: metadata, policy, keys and schemas

**Files:**
- Create: `src/backend/admin/prisma.ts`, `src/backend/admin/kit/types.ts`, `kit/dmmf.ts`, `kit/policy.ts`, `kit/keys.ts`, `kit/schema.ts`, `vitest.config.ts`
- Modify: `package.json` (dev dependency `vitest@^4.1.10`, script `"test": "vitest run"`)
- Test: `src/backend/admin/kit/__tests__/fixture.ts`, `policy.test.ts`, `keys.test.ts`, `schema.test.ts`

**Interfaces:**
- Produces:
  - **`prisma.ts`:** `export { Prisma } from '@prisma/client'`. Every kit file imports `Prisma` from `'../prisma'` and from nowhere else.
  - **`types.ts`:** the spec's `AdminFieldType`, `AdminFieldMeta`, `AdminResourceMeta`, `AdminManifest`, `AdminRecord`, plus:
    - `AdminRef = { key: string; title: string }`;
    - `AdminCan = { create: boolean; update: boolean; delete: boolean }`;
    - `AdminWriteBody = Record<string, unknown>`;
    - `AdminListQuery = { page: number; size: number; query?: string; sortBy?: string; sortOrder?: 'asc' | 'desc'; [filter: string]: unknown }`;
    - `AdminRelation = { field: string; via: string; resource: string }`: the foreign key scalar, the Prisma relation field, and the target resource key;
    - `AdminResource` = the `AdminResourceMeta` fields minus `count` and `related`, plus `delegate: string`, `idFields: string[]`, `idKinds: Record<string, 'string' | 'int'>`, `idFormat: 'uuid' | 'objectid' | 'any'`, `compoundName: string | null`, `relations: AdminRelation[]` and `hooks: ResourceHooks`;
    - `ResolvedRegistry = { product: AdminRegistry['product']; resources: AdminResource[]; byKey: Map<string, AdminResource>; byModel: Map<string, AdminResource> }`.
  - **`dmmf.ts`:**
    - `type Datamodel = Prisma.DMMF.Datamodel` (fall back to `typeof Prisma.dmmf.datamodel` if `DMMF` isn't exported);
    - `findModel(dm: Datamodel, name: string): Prisma.DMMF.Model | undefined`;
    - `enumValues(dm: Datamodel, name: string): string[]`;
    - `idFieldsOf(model): string[]`, which returns `primaryKey.fields` when set, else the one `isId` field;
    - `delegateName(model: string): string`, which lowercases the first character;
    - `labelFrom(name: string): string`.
  - **`policy.ts`:**
    - `SECRET_FIELD = /hash|token|secret|password|credential|enc$/i`;
    - `ResourceHooks = { beforeWrite?: (data: AdminWriteBody, mode: 'create' | 'update') => AdminWriteBody; afterWrite?: (change: { mode: 'create' | 'update' | 'delete'; before: Record<string, unknown> | null; after: Record<string, unknown> | null }) => Promise<void> }`;
    - `ResourcePolicy = { key; model; group; title; label?; singular?; signIn?: true; can?: Partial<AdminCan>; hidden?: string[]; readOnly?: string[]; expose?: string[]; columns?; searchable?; sortable?; filterable?; defaultSort?; note?: string; hooks?: ResourceHooks }`;
    - `AdminRegistry = { product: '0nbox' | 'strive' | 'parcours' | 'sara' | 'fluid'; resources: ResourcePolicy[]; excluded: Record<string, string> }`;
    - `resolveRegistry(registry: AdminRegistry, dm: Datamodel = Prisma.dmmf.datamodel): ResolvedRegistry`;
    - `uncoveredModels(registry: AdminRegistry, dm?: Datamodel): string[]`.
  - **`keys.ts`:** `encodeKey(resource: AdminResource, row: Record<string, unknown>): string` and `whereForKey(resource: AdminResource, key: string): Record<string, unknown> | null`.
  - **`schema.ts`:** `writeSchema(resource: AdminResource, mode: 'create' | 'update'): z.ZodTypeAny` and `listQuerySchema(resource: AdminResource): z.ZodTypeAny`, whose output is `AdminListQuery`.

- [ ] **Step 1: Branch and add Vitest.**
  - Run `git switch main && git pull && git switch -c feat/admin-api`, then `yarn add -D vitest@^4.1.10`, and add `"test": "vitest run"` to `package.json`.
  - Write `vitest.config.ts` with `test.environment: 'node'`, `test.include: ['src/**/__tests__/**/*.test.ts']` and `resolve.alias: { '@': path.resolve(__dirname, 'src') }`.

- [ ] **Step 2: Write the fixture** `kit/__tests__/fixture.ts`.
  - It builds a `Datamodel` by hand, holding only the DMMF properties the kit reads. On models: `name`, `fields` and `primaryKey`. On fields: `name`, `kind`, `type`, `isList`, `isRequired`, `isId`, `hasDefaultValue`, `isUpdatedAt`, `relationName`, `relationFromFields` and `nativeType`. It also builds one enum, `Role { ADMIN MEMBER }`.
  - It defines four models, written to fit the tests below:
    - **`User`:** `id` (String, `@id`, default, `nativeType ['Uuid', []]`), `email` (String, unique), `passwordHash` (String?), `name` (String?), `bio` (String?), `role` (Role, default MEMBER), `tags` (String[]), `score` (Decimal?), `payload` (Json?), `createdAt` (default), `updatedAt` (`@updatedAt`) and `clubs` (relation list).
    - **`Club`:** `id` (`@id`, default), `name` (String), `ownerId` (String), `owner` (the relation to User through `ownerId`), `isPublic` (Boolean, default false) and `memberCount` (Int, default 0).
    - **`Member`:** `clubId` (String) and `userId` (String), each with a relation, `joinedAt` (DateTime), `meta` (Json, required) and `primaryKey: { name: null, fields: ['clubId', 'userId'] }`.
    - **`Blob`:** `id` (Int, `@id`) and `data` (Bytes).
  - It exports `fixtureRegistry: AdminRegistry` with these resources:
    - `users`: title `email`, group `People`;
    - `clubs`: title `name`, `readOnly: ['memberCount']`;
    - `members`: title `userId`;
    - `excluded: { Blob: 'test' }`.

- [ ] **Step 3: Write the failing tests.**
  - **`policy.test.ts`:**
    - `resolveRegistry(fixtureRegistry, dm).byKey.get('users')!.fields.map(f => f.name)` equals `['id', 'email', 'name', 'bio', 'role', 'tags', 'score', 'payload', 'createdAt', 'updatedAt']`. `passwordHash` is gone and so is the relation list.
    - With `expose: ['id', 'passwordHash', 'email']` on `users`, the fields are `['id', 'email']`. The pattern beats `expose`.
    - The `users` field `id` has `readOnly: true, isId: true`. `createdAt` and `updatedAt` are `readOnly: true`. `email` has `required: true, type: 'string'`. `bio` has `type: 'text', nullable: true, required: false`. `role` has `type: 'enum', enumValues: ['ADMIN', 'MEMBER'], required: false`. `tags` has `list: true`. `score` has `type: 'decimal'`. `payload` has `type: 'json'`.
    - The `clubs` field `ownerId` has `relation: { resource: 'users' }`, and `clubs.relations` equals `[{ field: 'ownerId', via: 'owner', resource: 'users' }]`. `memberCount` is `readOnly: true`.
    - `members.idFields` is `['clubId', 'userId']` and `members.compoundName` is `'clubId_userId'`. `users.idFormat` is `'uuid'`.
    - The defaults: `users.columns[0]` is `'email'`; `users.searchable` is `['email', 'name']`; `users.sortable` doesn't contain `tags` or `payload`; `users.filterable` is `['role']`; `users.defaultSort` is `{ by: 'createdAt', order: 'desc' }`; `members.defaultSort` is `{ by: 'clubId', order: 'asc' }`.
    - `signIn: true` gives `can` `{ create: false, update: false, delete: true }`, and no flags gives all `true`.
    - Labels: `labelFrom('emailVerifiedAt')` is `'Email verified at'`, `labelFrom('access_token')` is `'Access token'`, `labelFrom('medal-claims')` is `'Medal claims'` and `labelFrom('MedalClaim')` is `'Medal claim'`.
    - `resolveRegistry` throws `/admin registry/` for an unknown model, a duplicate key, a title that isn't exposed, or a column, searchable, sortable or filterable name that isn't an exposed field.
    - `uncoveredModels(fixtureRegistry, dm)` is `[]`, and becomes `['Blob']` once `excluded` is emptied.
  - **`keys.test.ts`:**
    - `encodeKey(users, { id: 'u1' })` is `'u1'`.
    - For members, `encodeKey` gives `Buffer.from(JSON.stringify(['c1', 'u1'])).toString('base64url')`, and `whereForKey(members, thatKey)` equals `{ clubId_userId: { clubId: 'c1', userId: 'u1' } }`.
    - `whereForKey(users, 'not-a-uuid')` is `null`, and so is an ObjectId-format resource given `'xyz'`.
    - The composite key returns `null` for undecodable base64, for JSON that isn't an array, and for an array of the wrong length.
    - A resource with `idKinds { id: 'int' }` turns `'42'` into `{ id: 42 }`, and turns `'4x'` into `null`.
  - **`schema.test.ts`:**
    - For `users` on create: `{ email: 'a@b.co' }` passes; `{}` fails at path `email`; `{ email: 'a@b.co', passwordHash: 'x' }` fails as an unrecognized key; `{ email: 'a@b.co', createdAt: '2026-01-01T00:00:00Z' }` fails; `{ role: 'OWNER', email: 'x' }` fails at `role`; `{ email: 'x', score: '12.50' }` passes; `{ email: 'x', score: 'abc' }` fails; `{ email: 'x', bio: null }` passes; `{ email: 'x', tags: ['a', 'b'] }` passes.
    - For `users` on update: `{}` passes, `{ email: null }` fails, and `{ id: 'x' }` fails.
    - A date field accepts `'2026-10-22T14:32:00.000Z'` (output `instanceof Date`), and rejects `'yesterday'` and `12`.
    - `writeSchema(members, 'create')` fails at path `meta` when `meta` is missing, and passes with `meta: { a: 1 }` and with `meta: 0`.
    - `listQuerySchema(users)`:
      - parses `{}` to `{ page: 1, size: 20 }`;
      - parses `{ page: '2', size: '50', sortBy: 'email', sortOrder: 'asc', role: 'ADMIN' }` to numbers and strings;
      - rejects `{ size: '101' }`, `{ sortBy: 'passwordHash' }`, `{ passwordHash: 'x' }`, `{ role: 'OWNER' }` and `{ nope: '1' }`.
    - A boolean filter (`clubs` `isPublic`) parses `'true'` to `true`.

- [ ] **Step 4: Run them to see them fail.** Run `yarn test src/backend/admin/kit`. Expected: FAIL, because the modules don't exist.

- [ ] **Step 5: Implement `dmmf.ts`, `policy.ts`, `keys.ts` and `schema.ts`** against those interfaces.
  - **Type mapping** (spec §6.2):
    - **Enum fields** have `kind: 'enum'`. **Relation fields** have `kind: 'object'` and are never exposed: their `relationFromFields[0]` becomes an `AdminRelation` when the target model is registered. A foreign key to an unregistered model is still exposed as a plain string, with no relation.
    - **`text`:** a string field whose name matches `/(description|body|notes|Md|transcript|message|prompt|caption|reason)$/`.
    - **`idFormat`:** `'uuid'` when the single id's `nativeType[0]` is `'Uuid'`, `'objectid'` when it's `'ObjectId'`, otherwise `'any'`.
    - **`compoundName`:** `primaryKey.name ?? primaryKey.fields.join('_')` for composite ids, `null` otherwise.
  - **The write schema** is a `z.object(...).strict()` over the writable fields:
    - Writable means exposed, not read-only, and on update not `isId`.
    - **Per type:**
      - `string`/`text`: `z.string()`;
      - `int`: `z.number().int()`;
      - `float`: `z.number()`;
      - `decimal`: `z.union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)])`;
      - `boolean`: `z.boolean()`;
      - `datetime`: `z.string().pipe(z.coerce.date())`;
      - `enum`: `z.enum(values)`;
      - `json`: `z.unknown().refine(v => v !== undefined)`.
    - **Wrappers:** a list wraps the item in `z.array`. A nullable field gets `.nullable()`, and a field that isn't required on create gets `.optional()`.
    - **Update** is the same object `.partial()`.
  - **The list schema** is `z.object(...).strict()` with:
    - `page`: string to int, ≥1, default `'1'`;
    - `size`: 1–100, default `'20'`;
    - `query`: `.max(255)`;
    - `sortBy`: `z.enum(sortable)`;
    - `sortOrder`: `asc` or `desc`;
    - one optional key per filterable field: an enum gives `z.enum(values)`; a boolean gives a `'true'`/`'false'` transform; a foreign key gives `z.string().min(1)`.

  Write only Zod that behaves the same in 3.25 and 4.3, because the same file must pass under Sara's Zod 4:
  - **No `.default()` after a transform.** Zod 4 applies a default to the parsed output and skips the transform, so put defaults inside it: `z.string().optional().transform(v => (v === undefined ? 1 : Number(v))).pipe(z.number().int().min(1))`. This is where the kit departs from Strive's `baseQueryValidatorSchema` idiom.
  - **Required `json` fields:** the shape holds `z.unknown()`, and the create schema adds an object-level `.superRefine` that reports each missing required JSON key with `code: 'custom'`, `path: [field]` and `message: 'Required'`. Zod 4 can skip a missing key whose schema accepts `undefined`, so a per-field refine isn't enough. Take `.partial()` for update from the unrefined object.
  - No `z.record` and no `z.nativeEnum`, and issue codes are written as strings.

- [ ] **Step 6: Run the tests.** Run `yarn test src/backend/admin/kit`. Expected: PASS.

- [ ] **Step 7: Commit.**

```bash
git add package.json yarn.lock vitest.config.ts src/backend/admin
git commit -m "feat(admin): kit metadata, registry policy, keys and validators"
```

---

### Task 2 (Strive): kit runtime: queries, records, manifest, errors, access and service

**Files:**
- Create: `kit/query.ts`, `kit/records.ts`, `kit/manifest.ts`, `kit/errors.ts`, `kit/access.ts`, `kit/service.ts`
- Test: `kit/__tests__/query.test.ts`, `records.test.ts`, `manifest.test.ts`, `errors.test.ts`, `access.test.ts`, `service.test.ts`

**Interfaces:**
- Consumes: Task 1's types, `resolveRegistry`, `encodeKey`, `whereForKey`, `writeSchema` and `listQuerySchema`.
- Produces:
  - **`query.ts`:**
    - `selectFor(resource: AdminResource, registry: ResolvedRegistry): Record<string, unknown>`;
    - `whereFor(resource: AdminResource, q: AdminListQuery): Record<string, unknown>`;
    - `listArgs(resource, q, registry): { where; orderBy; skip: number; take: number; select }`.
  - **`records.ts`:** `toAdminRecord(resource: AdminResource, row: Record<string, unknown>, registry: ResolvedRegistry): AdminRecord`.
  - **`manifest.ts`:** `manifestFor(registry: ResolvedRegistry, counts: Record<string, number>): AdminManifest`.
  - **`errors.ts`:** `toHttpException(error: unknown, resource: AdminResource): unknown`. It returns an `HttpException` from `@/utils/exceptions` for the codes below, and anything else unchanged.
  - **`access.ts`:**
    - `adminEnabled(): boolean`;
    - `tokenMatches(authorization: string | null): boolean`;
    - `corsHeaders(origin: string | null): Headers`;
    - `withAdminHeaders(request: Request, response: Response): Response`;
    - `adminPreflight(request: Request): Response`;
    - `adminRoute<C>(handler: (request: Request, context: C) => Promise<Response>): (request: Request, context: C) => Promise<Response>`.
  - **`service.ts`:**
    - `readManifest(registry): Promise<AdminManifest>`;
    - `listRecords(registry, resource, q): Promise<{ data: AdminRecord[]; total: number }>`;
    - `readRecord(registry, resource, key: string): Promise<AdminRecord>`;
    - `createRecord(registry, resource, body: AdminWriteBody): Promise<AdminRecord>`;
    - `updateRecord(registry, resource, key, body): Promise<AdminRecord>`;
    - `deleteRecord(registry, resource, key): Promise<void>`.

- [ ] **Step 1: Write the failing tests** (fixture from Task 1).
  - **`query.test.ts`:**
    - `selectFor(clubs)` equals `{ id: true, name: true, ownerId: true, isPublic: true, memberCount: true, owner: { select: { id: true, email: true } } }`.
    - `selectFor(users)` has no `passwordHash` key.
    - `whereFor(users, { page: 1, size: 20, query: 'ada' })` equals `{ AND: [{ OR: [{ email: { contains: 'ada', mode: 'insensitive' } }, { name: { contains: 'ada', mode: 'insensitive' } }] }] }`.
    - With `query` set to a well-formed UUID, `OR` also holds `{ id: <uuid> }`. A malformed UUID adds nothing.
    - Filters: `{ role: 'ADMIN' }` adds `{ role: 'ADMIN' }` to `AND`.
    - `listArgs` with `page: 3, size: 20` gives `skip: 40, take: 20`. With no `sortBy` it gives `orderBy: [{ createdAt: 'desc' }]`.
  - **`records.test.ts`:**
    - A `clubs` row `{ id: 'c1', name: 'Lagos Runners', ownerId: 'u1', owner: { id: 'u1', email: 'ada@x.co' }, isPublic: true, memberCount: 3 }` becomes a record with `_key: 'c1'`, `_title: 'Lagos Runners'` and `_refs: { ownerId: { key: 'u1', title: 'ada@x.co' } }`, with no `owner` property.
    - A `members` record's `_title` is its `userId` reference's title.
    - An empty title falls back to `_key`.
    - A null foreign key gives a `null` ref.
  - **`manifest.test.ts`:**
    - `manifestFor(resolved, { users: 2, clubs: 1, members: 0 })` has `product: 'strive'`, the resources in registry order, `users.count === 2` and `users.note === null`.
    - `users.related` equals `[{ resource: 'clubs', field: 'ownerId' }, { resource: 'members', field: 'userId' }]`.
    - No field in the manifest matches `SECRET_FIELD`.
  - **`errors.test.ts`:** each case is a `new Prisma.PrismaClientKnownRequestError(msg, { code, clientVersion: 'x', meta })`.
    - P2002 with `meta.target ['email']` gives a `ConflictException` reading `'email: already in use'`.
    - P2003 and P2014 give `ConflictException('Other records still point at this one')`.
    - P2025 and P2023 give `NotFoundException('User not found')`, using the resource's `singular`.
    - A plain `Error` comes back as the same object.
  - **`access.test.ts`:** uses `vi.mock('@/env', ...)` with a mutable env.
    - Token unset: `adminEnabled()` is false, and `adminPreflight` answers 404.
    - Token set:
      - `tokenMatches('Bearer ' + token)` is true; a wrong token, `null` and `'Bearer '` are false.
      - Preflight answers 204 with `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`, `Access-Control-Allow-Headers: Authorization, Content-Type` and `Access-Control-Max-Age: 600`.
      - `Access-Control-Allow-Origin` is present only when `Origin` equals `ADMIN_ORIGIN`.
      - `withAdminHeaders` adds `Vary: Origin` and `Cache-Control: no-store` to any response, a 500 included.
  - **`service.test.ts`:** uses `vi.mock('@/server/db', ...)` with in-memory delegates (`findMany`, `findUnique`, `count`, `create`, `update`, `delete`) and `resolveRegistry(fixtureRegistry, dm)`.
    - Creating a club with `ownerId: 'missing'` throws `UnprocessableEntityException('ownerId: no such user')`, and `create` is never called.
    - Creating a club with an existing owner returns a record with `_refs.ownerId.title`.
    - A `beforeWrite` hook's added key reaches `create`.
    - `afterWrite` receives `{ mode: 'delete', before: <row>, after: null }`.
    - A delegate `delete` rejecting with P2003 surfaces as a 409, and the row stays.
    - `readRecord` with a malformed key throws `NotFoundException`.
    - On a nullable JSON field, `null` reaches the delegate as `Prisma.DbNull`.
    - Calling `createRecord` on a `signIn` resource throws `ForbiddenException`.

- [ ] **Step 2: Run them to see them fail.** Run `yarn test src/backend/admin/kit`. Expected: the new files FAIL.

- [ ] **Step 3: Implement the six modules.**
  - **`selectFor`:** every exposed field, plus `{ [via]: { select: { ...target id fields, [target.titleField]: true } } }` per relation. A target whose title is itself a foreign key contributes that raw value, one level only.
  - **`withAdminHeaders`:** copies the response with the CORS and no-store headers set, preserving status and body.
  - **`adminRoute`:** awaits the handler and passes its response through `withAdminHeaders`.
  - **Delegates:** `service.ts` reaches them via `(db as unknown as Record<string, AdminDelegate>)[resource.delegate]`, typing `AdminDelegate` with only the six methods it calls. That is the module's one cast.
  - **Every write** runs in this order:
    1. Check `can`.
    2. Check each foreign key in the body with the target's `findUnique`, where a P2023 counts as missing.
    3. Run `beforeWrite`.
    4. Map JSON `null` to `Prisma.DbNull`.
    5. Write through the delegate with `select: selectFor(...)`.
    6. Run `afterWrite`.
    7. Return `toAdminRecord`.

    Prisma errors pass through `toHttpException`. `updateRecord` and `deleteRecord` read the row first: it's 404 when absent, and it's `before` for the hook.

- [ ] **Step 4: Run the tests.** Run `yarn test src/backend/admin/kit`. Expected: PASS, every kit test.

- [ ] **Step 5: Commit.**

```bash
git add src/backend/admin/kit
git commit -m "feat(admin): kit queries, records, manifest, access and service"
```

---

### Task 3 (Strive): registry, middleware, handlers, routes and env

**Files:**
- Create: `src/backend/admin/registry.ts`, `src/backend/admin/middleware.ts`, `src/backend/admin/handlers.ts`, `src/app/api/admin/route.ts`, `src/app/api/admin/[resource]/route.ts`, `src/app/api/admin/[resource]/[key]/route.ts`
- Modify: `src/env.js`, `.env.example`, `deploy/README.md` (the two variables)
- Test: `src/backend/admin/__tests__/registry.test.ts`

**Interfaces:**
- Consumes: the whole kit (Tasks 1–2).
- Produces. These are the names every port re-creates with its own types:
  - `adminRegistry: AdminRegistry` and `resolvedAdmin: ResolvedRegistry`, which is `resolveRegistry(adminRegistry)`.
  - **Middleware,** typed `<B, Q>(request: AuthRequest<B, Q>) => Promise<MiddlewareResponse>` to match Strive's own:
    - `adminAuthMiddleware`: 404 `Not Found` when off, 401 `Unauthorized` on a bad token.
    - `adminResourceMiddleware`: 404 when `params.resource` isn't in `resolvedAdmin.byKey`, or when `params.key` is present and `whereForKey` returns `null`.
    - `adminCanMiddleware(action: 'create' | 'update' | 'delete')`: 403 `"<Label> can't be created here"`, with "changed" or "deleted" for the other actions.
    - `adminListQueryMiddleware`: parses `request.nextUrl.searchParams` with `listQuerySchema` and answers 422 in exactly the format of Strive's `queryValidatorMiddleware`.
    - `adminBodyMiddleware(mode: 'create' | 'update')`: validates `request.parsedBody` with `writeSchema`, answers 422 `path: message` like `bodyValidatorMiddleware`, and sets `validatedData`.
  - **Handlers:** `manifestHandler`, `listHandler`, `createHandler`, `readHandler`, `updateHandler` and `removeHandler`, returning Strive's `ApiResponse`/`PaginatedApiResponse` with these messages:
    - `'Manifest retrieved'`;
    - `'<Label> retrieved'`;
    - `'<Singular> created'`, with status 201;
    - `'<Singular> retrieved'`;
    - `'<Singular> updated'`;
    - `'<Singular> deleted'`, with `data: null`.

- [ ] **Step 1: Write the failing test** `registry.test.ts`.

```ts
import { describe, expect, it } from 'vitest';
import { SECRET_FIELD, resolveRegistry, uncoveredModels } from '../kit/policy';
import { adminRegistry } from '../registry';

describe('strive admin registry', () => {
  const resolved = resolveRegistry(adminRegistry);
  const fieldsOf = (key: string) => resolved.byKey.get(key)!.fields.map(f => f.name);

  it('classifies every model', () => expect(uncoveredModels(adminRegistry)).toEqual([]));
  it('registers the spec §7.2 keys in order', () =>
    expect(resolved.resources.map(r => r.key)).toEqual([
      'users', 'clubs', 'user-clubs', 'club-invites', 'leaderboards', 'user-leaderboards',
      'leaderboard-invites', 'rewards', 'user-rewards', 'medal-claims', 'notifications',
      'paystack-transactions', 'accounts', 'sessions',
    ]));
  it('exposes nothing secret', () =>
    expect(resolved.resources.flatMap(r => r.fields.filter(f => SECRET_FIELD.test(f.name)).map(f => `${r.key}.${f.name}`))).toEqual([]));
  it('hides NRC metadata and the account session state', () => {
    expect(fieldsOf('users')).not.toContain('nrc_auth_meta');
    expect(fieldsOf('accounts')).not.toContain('session_state');
  });
  it('keeps memberCount read-only and hooked', () => {
    expect(resolved.byKey.get('clubs')!.fields.find(f => f.name === 'memberCount')!.readOnly).toBe(true);
    expect(resolved.byKey.get('user-clubs')!.hooks.afterWrite).toBeTypeOf('function');
  });
  it('lets sign-in records be revoked only', () => {
    for (const key of ['accounts', 'sessions']) expect(resolved.byKey.get(key)!.can).toEqual({ create: false, update: false, delete: true });
  });
});
```

- [ ] **Step 2: Run it to see it fail.** Run `yarn test src/backend/admin/__tests__`. Expected: FAIL, because `../registry` doesn't exist.

- [ ] **Step 3: Write `registry.ts`** from spec §7.2's Strive table: keys, models, titles, groups, `signIn: true` for `accounts` and `sessions`, the extra `hidden` lists, `readOnly: ['memberCount']` on `clubs`, the `paystack-transactions` note, and `excluded: { VerificationToken: 'Sign-in tokens; nothing to manage.' }`.
  - Set `singular` where the model name is plural: `ClubInvites` is "Club invite" and `LeaderboardInvites` is "Leaderboard invite".
  - The `user-clubs` `afterWrite` collects the distinct non-null `clubId` from `before` and `after`. For each one it sets `memberCount` to `await db.userClub.count({ where: { clubId } })`: Strive's join and accept routes create one row per member, and exit deletes it.

- [ ] **Step 4: Run it.** Run `yarn test src/backend/admin`. Expected: PASS.

- [ ] **Step 5: Wire up env, middleware, handlers and routes.**
  - **Env:** add the two env vars from Global Constraints.
  - **Middleware order:** auth → resource → can → list query or body. A route's exports, with each `withMiddleware` wrapped in `adminRoute(...)`:

    | File | Exports |
    |---|---|
    | `admin/route.ts` | `GET` with `[adminAuthMiddleware]`, and `OPTIONS = adminPreflight` |
    | `[resource]/route.ts` | `GET` with `[auth, resource, listQuery]`; `POST` with `[auth, resource, can('create'), body('create')]`; `OPTIONS` |
    | `[resource]/[key]/route.ts` | `GET` with `[auth, resource]`; `PUT` with `[auth, resource, can('update'), body('update')]`; `DELETE` with `[auth, resource, can('delete')]`; `OPTIONS` |

  - **Docs:** annotate each export with JSDoc in Strive's existing style (`@description`, `@pathParams`, `@queryParams`, `@body`, `@auth bearer`), then run `yarn docs:generate` and commit what it regenerates.

- [ ] **Step 6: Smoke it against the dev database.**
  - Start the server: `T=$(openssl rand -base64 32); ADMIN_API_TOKEN=$T ADMIN_ORIGIN=http://localhost:5174 yarn dev`.
  - Then check each of these:

    | Request | Expected |
    |---|---|
    | `curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/api/admin` | `401` |
    | `curl -s localhost:3000/api/admin -H "Authorization: Bearer $T" \| jq '.data.resources \| length'` | `14` |
    | `curl -s "localhost:3000/api/admin/clubs?size=2" -H "Authorization: Bearer $T" \| jq '{total, page, size, n: (.data \| length)}'` | `page: 1`, `size: 2` |
    | `curl -s "localhost:3000/api/admin/users?sortBy=access_token" -H "Authorization: Bearer $T" -o /dev/null -w '%{http_code}\n'` | `422` |
    | `curl -s localhost:3000/api/admin/clubs/nope -H "Authorization: Bearer $T" -o /dev/null -w '%{http_code}\n'` | `404` |
    | `curl -si -X OPTIONS -H 'Origin: http://localhost:5174' localhost:3000/api/admin/clubs \| grep -i '^access-control-allow-origin'` | `http://localhost:5174` |
    | `curl -s -X POST localhost:3000/api/admin/sessions -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d '{}' -o /dev/null -w '%{http_code}\n'` | `403` |

  - Finally, restart without `ADMIN_API_TOKEN` and check that `curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/api/admin` gives `404`.

- [ ] **Step 7: Run the repo's gates.** Run `yarn test && yarn typecheck && yarn lint`. Expected: all pass.

- [ ] **Step 8: Commit.**

```bash
git add src/backend/admin src/app/api/admin src/env.js .env.example deploy/README.md public/openapi.json
git commit -m "feat(admin): token-guarded /api/admin for every strive resource"
```

---

### Task 4 (Sara): port the kit

**Files:**
- Create: `src/backend/admin/prisma.ts` (`export { Prisma } from '@prisma/client'`), the `kit/` copy, `registry.ts`, `middleware.ts`, `handlers.ts`, the three route files
- Modify: `src/env.js`, `.env.example`, `deploy/README.md`
- Test: `src/backend/admin/__tests__/registry.test.ts`, plus the copied kit tests

**Interfaces:**
- Consumes: the kit from Strive's `feat/admin-api`, and Task 3's export names.
- Produces the same names as Task 3. Differences:
  - Envelope types come from Sara's root `types` package (`import type { ApiResponse, PaginatedApiResponse } from "types"`).
  - Middleware is typed with Sara's `MiddlewareFunction`.
  - The hook imports `nameKey` from `@/backend/services/customer/normalize`.

- [ ] **Step 1: Branch and copy the kit.** Run `git switch feat/merchants-and-voice-notes && git pull && git switch -c feat/admin-api` (or branch from `main` if that branch has merged), then `rsync -a --delete ../strive/src/backend/admin/kit/ src/backend/admin/kit/`.
- [ ] **Step 2: Run the kit tests under Zod 4.** Run `yarn test src/backend/admin/kit`. Expected: PASS. If one fails because of a Zod 3/4 difference, fix it in Strive's copy, re-run Strive's kit tests, and re-copy.
- [ ] **Step 3: Write the failing `registry.test.ts`.** It has the same shape as Strive's, with:
  - Sara's 22 keys in spec §7.2 order;
  - `uncoveredModels` returns `[]` (`VerificationToken` excluded);
  - nothing secret is exposed, and `businesses` exposes neither `googleCalendarAccessToken` nor `googleCalendarRefreshToken`;
  - `customers.fields.find(f => f.name === 'nameKey')!.readOnly` is true, and `beforeWrite({ name: 'Adaeze  Obi' }, 'create').nameKey` equals `nameKey('Adaeze  Obi')`;
  - `can` is read and delete only for `chat-link-tokens`, `accounts` and `sessions`;
  - every resource marked "totals" in §7.2 has the note "Totals aren't recomputed from lines or payments."
- [ ] **Step 4: Run it to see it fail.** Run `yarn test src/backend/admin/__tests__`. Expected: FAIL.
- [ ] **Step 5: Write `registry.ts`, then port `middleware.ts`, `handlers.ts`, the routes and env from Strive.** Adjust types only. The customers `beforeWrite` sets `nameKey` when `data.name` is a string.
- [ ] **Step 6: Run the tests and smoke it.** Run `yarn test src/backend/admin`. Expected: PASS. Repeat Task 3 Step 6's checks on Sara's dev port. The manifest has `22` resources, `POST /api/admin/accounts` gives `403`, and `GET /api/admin/businesses/<key>` has no `googleCalendar*Token` key.
- [ ] **Step 7: Regenerate the docs and run the gates.** Run `yarn docs:generate && yarn test && yarn typecheck && yarn lint`. Expected: all pass.
- [ ] **Step 8: Commit.** Run `git commit -m "feat(admin): token-guarded /api/admin for every sara resource"` after `git add` of the same paths as Task 3.

---

### Task 5 (Parcours): port the kit

**Files:**
- Create: `src/backend/admin/prisma.ts` (`export { Prisma } from "../../../generated/prisma"`), the `kit/` copy, `registry.ts`, `middleware.ts`, `handlers.ts`, the three route files
- Modify: `src/env.js`, `.env.example`, `deploy/README.md`
- Test: `src/backend/admin/__tests__/registry.test.ts`, plus the copied kit tests

**Interfaces:**
- Consumes: the kit, and Task 3's export names.
- Produces the same names. Differences:
  - **Middleware typing:** reusable middleware is typed with Parcours' `AnyMiddleware` (auth, resource, can), `QueryMiddleware<AdminListQuery>` (list query) and `BodyMiddleware<AdminWriteBody>` (body), from `src/backend/middleware/types.ts`.
  - **Raw query:** the list query middleware parses `request.rawQuery`, never `request.query`.
  - **Generics:** routes declare `withMiddleware<unknown, AdminListQuery>`, `withMiddleware<AdminWriteBody>` or `withMiddleware<unknown>` exactly as the validators present require.
  - **Envelopes** carry `success: true`, and errors use Parcours' own envelope through `withMiddleware`.

- [ ] **Step 1: Branch and copy the kit.** Run `git switch main && git pull && git switch -c feat/admin-api && rsync -a --delete ../strive/src/backend/admin/kit/ src/backend/admin/kit/`.
- [ ] **Step 2: Write `registry.test.ts`.** It has the same shape as Strive's, with:
  - Parcours' 31 keys in spec §7.2 order;
  - `uncoveredModels` returns `[]`, with `StagingLexique`, `StagingKaikki`, `StagingTatoeba` and `StagingCommonVoice` excluded;
  - `boards` doesn't expose `inviteToken`, and `users` doesn't expose `passwordHash`;
  - `board-members.compoundName` is `'boardId_userId'` and `skill-estimates.compoundName` is `'userId_skill'`;
  - the `retired-handles` field `handle` is writable on create (`readOnly: false`) and absent from `writeSchema(…, 'update')`;
  - all 11 Content resources carry the seeded note verbatim;
  - `user-identities`, `sessions`, `auth-tokens` and `login-attempts` are read and delete only.
- [ ] **Step 3: Write `registry.ts`, then port `middleware.ts`, `handlers.ts`, the routes and env.** Follow Parcours' `CLAUDE.md`:
  - no optional object spread anywhere (build `select` and `where` objects with `if`);
  - no casts of `validatedData` or `query`;
  - JSDoc in Parcours' style (`@auth`, `@responseSet`).

  The kit itself mustn't use optional spread either. If Strive's copy does, rewrite it there and re-copy, so the kit stays identical everywhere.
- [ ] **Step 4: Run the gates once, now that the task is complete** (Parcours' `CLAUDE.md` defers them to the end). Run `yarn test && yarn typecheck && yarn lint && yarn docs:generate`. Expected: all pass, and `registry.test.ts` and the kit tests are green.
- [ ] **Step 5: Smoke it.** Repeat Task 3 Step 6's checks on Parcours' dev port. The manifest has `31` resources, `GET /api/admin/board-members/<key>` round-trips a composite key taken from a list response, and the error bodies carry `success: false`.
- [ ] **Step 6: Commit.** Run `git commit -m "feat(admin): token-guarded /api/admin for every parcours resource"`.

---

### Task 6 (0nbox): port the kit

**Files:**
- Create: `src/backend/admin/prisma.ts` (`export { Prisma } from "../../../generated/prisma"`), the `kit/` copy, `registry.ts`, `middleware.ts`, `handlers.ts`, the three route files
- Modify: `src/env.js`, `.env.example`, `deploy/README.md`, `src/types/api.ts` (response interfaces), `scripts/postprocess-openapi.mjs` (the 201), `public/openapi.json` (regenerated)
- Test: `src/backend/admin/__tests__/registry.test.ts`, plus the copied kit tests

**Interfaces:**
- Consumes: the kit, Task 3's export names, and 0nbox's `ACCOUNT_PUBLIC_FIELDS` from `src/backend/services/accounts/fields.ts`.
- Produces the same names. Differences:
  - **Middleware typing:** `AnyMiddleware`, `QueryMiddleware<Q>` and `BodyMiddleware<B>` from 0nbox's `src/backend/middleware/types.ts`; the query is parsed from `rawQuery`; `withMiddleware<B, Q>` generics follow 0nbox's `CLAUDE.md` § Route Handler middleware.
  - **Response interfaces:** `AdminManifestResponse`, `AdminRecordListResponse`, `AdminRecordResponse` and `AdminDeleteResponse` in `src/types/api.ts`. They're concrete and non-generic, because the generator can't read `ApiResponse<T>`.

- [ ] **Step 1: Branch and copy the kit.** Run `git switch main && git pull && git switch -c feat/admin-api && rsync -a --delete ../strive/src/backend/admin/kit/ src/backend/admin/kit/`.
- [ ] **Step 2: Write `registry.test.ts`.** It has the same shape, with:
  - the 7 keys in spec §7.2 order;
  - `uncoveredModels` returns `[]`;
  - mail accounts pinned exactly: `expect(fieldsOf('mail-accounts').sort()).toEqual([...Object.keys(ACCOUNT_PUBLIC_FIELDS), 'userId'].sort())`;
  - `trusted-senders.compoundName` is `'userId_addr'`;
  - `mail-accounts`, `user-identities`, `sessions`, `login-attempts` and `auth-tokens` are read and delete only;
  - `users` doesn't expose `passwordHash`.
- [ ] **Step 3: Write `registry.ts`, `middleware.ts`, `handlers.ts` and the routes, following 0nbox's `CLAUDE.md`:**
  - `mail-accounts` sets `expose: [...Object.keys(ACCOUNT_PUBLIC_FIELDS), 'userId']`, so the selection is pinned by construction, never a whole row filtered afterwards.
  - **Docs:** each route export carries `@description`, `@auth`, `@pathParams`/`@queryParams`/`@body` naming Zod-inferred types, `@response <one of the four interfaces>` and `@responseSet resource`. Add `POST /api/admin/{resource}` to `CORRECTIONS` with status 201.
  - No optional object spread, and no casts of `validatedData` or `query`.
- [ ] **Step 4: Run the gates once, at the end** (0nbox's `CLAUDE.md`). Run `yarn docs:generate && yarn test && yarn typecheck && yarn lint`. Expected: all pass, with no generator diagnostics. `public/openapi.json` lists the four admin paths, and no admin response schema contains `credentialEnc`, `oauthAccessEnc`, `passwordHash` or `tokenHash`: check with `grep -E 'credentialEnc|oauthAccessEnc|passwordHash|tokenHash' public/openapi.json`, whose admin-path output should be empty.
- [ ] **Step 5: Smoke it.** Repeat Task 3 Step 6's checks on 0nbox's dev port (`3002` in production; whatever `yarn dev` binds locally). `GET /api/admin/mail-accounts?size=1` returns records whose keys are exactly the pinned set plus `_key`, `_title` and `_refs`.
- [ ] **Step 6: Commit.** Run `git commit -m "feat(admin): token-guarded /api/admin for every 0nbox resource"`.

---

### Task 7 (Fluid): port the kit

**Files:**
- Create: `src/backend/admin/prisma.ts` (`export { Prisma } from '@prisma/client'`), the `kit/` copy, `registry.ts`, `middleware.ts`, `handlers.ts`, the three route files, `vitest.config.ts`
- Modify: `package.json` (`vitest@^4.1.10` as a dev dependency, a `test` script), `src/env.js`, `.env.example`
- Test: `src/backend/admin/__tests__/registry.test.ts`, plus the copied kit tests

**Interfaces:**
- Consumes: the kit, and Task 3's export names.
- Produces the same names, with Fluid's `MiddlewareFunction` and `src/types` envelopes. Fluid has no `deploy/` directory, so the variables are documented in `.env.example` and `README.md` only.

- [ ] **Step 1: Branch, add Vitest and copy the kit.** Branch from `main`, add Vitest and its config exactly as Task 1 Step 1 did, and copy the kit with `rsync`.
- [ ] **Step 2: Write `registry.test.ts`.** It has the same shape, with:
  - the 4 keys in §7.2 order;
  - `uncoveredModels` returns `[]`;
  - `users` exposes neither `passwordHash` nor `access_token`;
  - `sessions` is read and delete only;
  - `payments` carries its note;
  - a `payment-links` `amount` field of type `decimal`.
- [ ] **Step 3: Run it to see it fail, then write `registry.ts` and port the rest.** Run `yarn test src/backend/admin`. Expected: FAIL first, then PASS once the registry exists.
- [ ] **Step 4: Run the gates and smoke it.** Run `yarn test && yarn typecheck && yarn lint`, then `yarn docs:generate`, then Task 3 Step 6's checks. The manifest has `4` resources, and a `PUT /api/admin/payment-links/<key>` with `{"amount":"12.50"}` returns `"amount":"12.5"`, Prisma's Decimal string.
- [ ] **Step 5: Commit.** Run `git commit -m "feat(admin): token-guarded /api/admin for every fluid resource"`.

---

## After the last task

- In each repo, run superpowers:finishing-a-development-branch to merge or open a PR, per the owner's choice.
- Before the dashboard is deployed, set `ADMIN_API_TOKEN` (one value for all five) and `ADMIN_ORIGIN=https://admin.interacti.84-12-92-46.sslip.io` on each product's server, and restart each app. This is spec §5 and §11, and it's an owner action: the token never goes into a repo.
