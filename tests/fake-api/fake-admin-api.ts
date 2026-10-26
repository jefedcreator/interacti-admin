// A framework-free, in-memory fake of the admin contract (spec §6). Nothing here imports MSW or
// Playwright: `msw.ts` wraps it for Vitest, and the e2e tests wrap the same object for `page.route`.
import type {
  AdminAnalytics,
  AdminFieldMeta,
  AdminManifest,
  AdminRecord,
  AdminResourceMeta,
  ApiResponse,
  PaginatedApiResponse,
} from '@/types/admin';
import { decorate, fakeManifest, fakeRecords } from './fixture';

export type FakeRequest = {
  method: string;
  /** The full URL, as the client sent it. */
  url: string;
  /** The path, still percent-encoded: `/api/admin/clubs/a%2Fb`. */
  path: string;
  /** The query string with its leading `?`, or an empty string. */
  search: string;
  headers: Record<string, string>;
  /** The parsed JSON body, or undefined when there was none. */
  body: unknown;
};

export type FakeResponse = {
  status: number;
  headers: Record<string, string>;
  /** A JSON-serialisable body, or undefined for none (204). */
  body: unknown;
};

export type FakeAdminApiOptions = {
  token: string;
  product: string;
  /** Record keys that other records still point at: deleting one answers 409. */
  referenced?: Set<string>;
  /** Field names that answer 422 when used as `sortBy`, even if the manifest lists them. */
  rejectSortBy?: string[];
  /** What "today" is for analytics windows. Defaults to the real clock. */
  now?: Date;
  /** `'not-configured'` answers as a product with no Google Analytics. Defaults to configured. */
  analytics?: 'configured' | 'not-configured';
};

export type FakeAdminApi = {
  handle(req: FakeRequest): FakeResponse;
  requests: FakeRequest[];
  records: Record<string, AdminRecord[]>;
};

/** Looks a header up whatever its case. */
export function headerOf(req: FakeRequest, name: string): string | undefined {
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(req.headers)) {
    if (key.toLowerCase() === wanted) return value;
  }
  return undefined;
}

const CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, accept',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const DEFAULTS: Record<string, unknown> = { 'users.role': 'MEMBER' };

function reply(status: number, body: unknown): FakeResponse {
  return {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
    body: body === undefined ? undefined : structuredClone(body),
  };
}

const fail = (status: number, message: string): FakeResponse => reply(status, { message });

function compare(a: unknown, b: unknown): number {
  if (a === null || a === undefined) return b === null || b === undefined ? 0 : -1;
  if (b === null || b === undefined) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return String(a).localeCompare(String(b));
}

function typeProblem(f: AdminFieldMeta, value: unknown): string | null {
  if (f.list) {
    if (!Array.isArray(value)) return 'Expected array';
    return null;
  }
  switch (f.type) {
    case 'string':
    case 'text':
      return typeof value === 'string' ? null : 'Expected string';
    case 'int':
      return Number.isInteger(value) ? null : 'Expected integer';
    case 'float':
      return typeof value === 'number' && Number.isFinite(value) ? null : 'Expected number';
    case 'decimal': {
      const numeric = typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value));
      return typeof value === 'number' || numeric ? null : 'Expected a number or a numeric string';
    }
    case 'boolean':
      return typeof value === 'boolean' ? null : 'Expected boolean';
    case 'datetime':
      return typeof value === 'string' && !Number.isNaN(Date.parse(value))
        ? null
        : 'Expected an ISO date';
    case 'enum':
      return typeof value === 'string' && (f.enumValues ?? []).includes(value)
        ? null
        : 'Invalid option';
    case 'json':
      return null;
  }
}

export function createFakeAdminApi(options: FakeAdminApiOptions): FakeAdminApi {
  const {
    token,
    product,
    referenced = new Set<string>(),
    rejectSortBy = [],
    now,
    analytics: analyticsMode = 'configured',
  } = options;

  const base = fakeManifest(product);
  const metas = base.resources;
  const records = fakeRecords();
  const requests: FakeRequest[] = [];
  let nextN = 1;

  const metaOf = (key: string): AdminResourceMeta | undefined =>
    metas.find((meta) => meta.key === key);

  const manifest = (): AdminManifest => ({
    ...base,
    resources: metas.map((meta) => ({ ...meta, count: records[meta.key]?.length ?? 0 })),
  });

  const invalidQuery = (name: string): FakeResponse =>
    fail(422, `Invalid query parameter: ${name}`);

  function list(meta: AdminResourceMeta, search: string): FakeResponse {
    const params = new URLSearchParams(search);

    const allowed = new Set(['page', 'size', 'query', 'sortBy', 'sortOrder', ...meta.filterable]);
    for (const key of params.keys()) {
      if (!allowed.has(key)) return invalidQuery(key);
    }

    const page = params.has('page') ? Number(params.get('page')) : 1;
    if (!Number.isInteger(page) || page < 1) return invalidQuery('page');

    const size = params.has('size') ? Number(params.get('size')) : 20;
    if (!Number.isInteger(size) || size < 1 || size > 100) return invalidQuery('size');

    const query = params.get('query') ?? '';
    if (query.length > 255) return invalidQuery('query');

    const sortBy = params.get('sortBy') ?? undefined;
    if (sortBy !== undefined && (!meta.sortable.includes(sortBy) || rejectSortBy.includes(sortBy))) {
      return invalidQuery('sortBy');
    }

    const sortOrder = params.get('sortOrder') ?? undefined;
    if (sortOrder !== undefined && sortOrder !== 'asc' && sortOrder !== 'desc') {
      return invalidQuery('sortOrder');
    }

    let rows = [...(records[meta.key] ?? [])];

    const needle = query.toLowerCase();
    if (needle) {
      rows = rows.filter(
        (row) =>
          row._key === query ||
          meta.searchable.some((name) =>
            String(row[name] ?? '')
              .toLowerCase()
              .includes(needle),
          ),
      );
    }

    for (const name of meta.filterable) {
      const wanted = params.get(name);
      if (wanted === null) continue;
      rows = rows.filter((row) => String(row[name]) === wanted);
    }

    const by = sortBy ?? meta.defaultSort.by;
    const direction = sortOrder ?? (sortBy ? 'asc' : meta.defaultSort.order);
    rows.sort((a, b) => (direction === 'asc' ? 1 : -1) * compare(a[by], b[by]));

    const total = rows.length;
    const body: PaginatedApiResponse<AdminRecord[]> = {
      status: 200,
      message: 'OK',
      data: rows.slice((page - 1) * size, page * size),
      total,
      page,
      size,
      totalPages: Math.ceil(total / size),
    };
    return reply(200, body);
  }

  const DAY_MS = 24 * 60 * 60 * 1000;
  const PERIODS = [7, 30, 90];

  /**
   * Fixed numbers, so a test can name them: the series wobble, the totals don't. The window ends
   * yesterday, the last complete day (spec §6.7).
   */
  function analytics(search: string): FakeResponse {
    const params = new URLSearchParams(search);
    for (const key of params.keys()) if (key !== 'days') return invalidQuery(key);
    const days = Number(params.get('days'));
    if (!PERIODS.includes(days)) return invalidQuery('days');

    const window = days as AdminAnalytics['days'];
    let data: AdminAnalytics;
    if (analyticsMode === 'not-configured') {
      data = {
        days: window,
        configured: false,
        note: 'Set GA_PROPERTY_ID and GA_SERVICE_ACCOUNT_JSON on the server and restart it.',
        metrics: [],
        series: [],
      };
    } else {
      const today = Date.UTC(
        (now ?? new Date()).getUTCFullYear(),
        (now ?? new Date()).getUTCMonth(),
        (now ?? new Date()).getUTCDate(),
      );
      const dates = Array.from({ length: window }, (_, i) =>
        new Date(today - (window - i) * DAY_MS).toISOString().slice(0, 10),
      );
      data = {
        days: window,
        configured: true,
        note: 'Google Analytics can lag by up to a day.',
        metrics: [
          { key: 'visitors', label: 'Visitors', count: 5265, previous: 4100 },
          { key: 'views', label: 'Page views', count: 7596, previous: 7596 },
          { key: 'enquiries', label: 'Enquiries', count: 8, previous: 0 },
        ],
        series: [
          {
            key: 'visitors',
            label: 'Visitors',
            points: dates.map((date, i) => ({ date, count: 100 + ((i * 37) % 60) })),
          },
          {
            key: 'views',
            label: 'Page views',
            points: dates.map((date, i) => ({ date, count: 150 + ((i * 53) % 90) })),
          },
        ],
      };
    }
    const res: ApiResponse<AdminAnalytics> = { status: 200, message: 'OK', data };
    return reply(200, res);
  }

  /** The first thing wrong with a create or update body, or null. */
  function problem(
    meta: AdminResourceMeta,
    body: unknown,
    mode: 'create' | 'update',
  ): string | null {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return 'body: Expected object';
    }
    const input = body as Record<string, unknown>;
    const writable = meta.fields.filter((f) => !f.readOnly && !f.isId);

    for (const key of Object.keys(input)) {
      if (!writable.some((f) => f.name === key)) return `${key}: Unrecognized key`;
    }

    for (const f of writable) {
      const value = input[f.name];
      if (value === undefined) {
        if (mode === 'create' && f.required) return `${f.name}: Required`;
        continue;
      }
      if (value === null) {
        if (!f.nullable) return `${f.name}: Invalid input: received null`;
        continue;
      }
      const wrong = typeProblem(f, value);
      if (wrong) return `${f.name}: ${wrong}`;
    }

    for (const f of writable) {
      const value = input[f.name];
      if (!f.relation || value === undefined || value === null) continue;
      const exists = records[f.relation.resource]?.some((r) => r._key === value);
      if (!exists) {
        const target = metaOf(f.relation.resource)?.singular ?? f.relation.resource;
        return `${f.name}: no such ${target.toLowerCase()}`;
      }
    }
    return null;
  }

  function create(meta: AdminResourceMeta, body: unknown): FakeResponse {
    if (!meta.can.create) return fail(403, `${meta.label} can't be created here`);
    const wrong = problem(meta, body, 'create');
    if (wrong) return fail(422, wrong);

    const input = body as Record<string, unknown>;
    const n = nextN;
    nextN += 1;
    const key = `fake-${n}`;
    const row: Record<string, unknown> = {};
    for (const f of meta.fields) {
      if (f.isId) row[f.name] = key;
      else if (f.readOnly && f.type === 'datetime') {
        row[f.name] = new Date(Date.UTC(2026, 9, 22, 10, 0, n)).toISOString();
      } else if (f.readOnly) row[f.name] = f.type === 'int' ? 0 : null;
      else if (input[f.name] !== undefined) row[f.name] = input[f.name];
      else if (`${meta.key}.${f.name}` in DEFAULTS) row[f.name] = DEFAULTS[`${meta.key}.${f.name}`];
      else if (f.list) row[f.name] = [];
      else if (f.type === 'boolean') row[f.name] = false;
      else row[f.name] = null;
    }

    const record: AdminRecord = { ...row, _key: key, _title: key, _refs: {} };
    (records[meta.key] ??= []).push(record);
    decorate(metas, records);
    const res: ApiResponse<AdminRecord> = { status: 201, message: 'Created', data: record };
    return reply(201, res);
  }

  function update(meta: AdminResourceMeta, key: string, body: unknown): FakeResponse {
    if (!meta.can.update) return fail(403, `${meta.label} can't be changed here`);
    const record = records[meta.key]?.find((r) => r._key === key);
    if (!record) return fail(404, 'Not found');
    const wrong = problem(meta, body, 'update');
    if (wrong) return fail(422, wrong);

    Object.assign(record, body as Record<string, unknown>);
    decorate(metas, records);
    const res: ApiResponse<AdminRecord> = { status: 200, message: 'Updated', data: record };
    return reply(200, res);
  }

  function remove(meta: AdminResourceMeta, key: string): FakeResponse {
    if (!meta.can.delete) return fail(403, `${meta.label} can't be deleted here`);
    const rows = records[meta.key] ?? [];
    const at = rows.findIndex((r) => r._key === key);
    if (at === -1) return fail(404, 'Not found');
    if (referenced.has(key)) return fail(409, 'Other records still point at this one');

    rows.splice(at, 1);
    decorate(metas, records);
    const res: ApiResponse<null> = { status: 200, message: 'Deleted', data: null };
    return reply(200, res);
  }

  function route(req: FakeRequest): FakeResponse {
    const method = req.method.toUpperCase();

    const match = /^\/api\/admin(?:\/(.*))?$/.exec(req.path);
    if (!match) return fail(404, 'Not found');
    const rest = match[1] ?? '';

    let segments: string[];
    try {
      segments = rest === '' ? [] : rest.split('/').map((part) => decodeURIComponent(part));
    } catch {
      return fail(404, 'Not found');
    }

    if (segments.length === 0) {
      if (method !== 'GET') return fail(405, 'Method not allowed');
      const res: ApiResponse<AdminManifest> = { status: 200, message: 'OK', data: manifest() };
      return reply(200, res);
    }

    if (segments[0] === 'analytics' && segments.length === 1) {
      if (method !== 'GET') return fail(405, 'Method not allowed');
      return analytics(req.search);
    }

    const meta = metaOf(segments[0] ?? '');
    if (!meta || segments.length > 2) return fail(404, 'Not found');

    if (segments.length === 1) {
      if (method === 'GET') return list(meta, req.search);
      if (method === 'POST') return create(meta, req.body);
      return fail(405, 'Method not allowed');
    }

    const key = segments[1] ?? '';
    if (method === 'GET') {
      const record = records[meta.key]?.find((r) => r._key === key);
      if (!record) return fail(404, 'Not found');
      const res: ApiResponse<AdminRecord> = { status: 200, message: 'OK', data: record };
      return reply(200, res);
    }
    if (method === 'PUT') return update(meta, key, req.body);
    if (method === 'DELETE') return remove(meta, key);
    return fail(405, 'Method not allowed');
  }

  function handle(req: FakeRequest): FakeResponse {
    requests.push(req);
    if (req.method.toUpperCase() === 'OPTIONS') {
      return { status: 204, headers: { ...CORS }, body: undefined };
    }
    if (headerOf(req, 'authorization') !== `Bearer ${token}`) return fail(401, 'Unauthorized');
    decorate(metas, records);
    return route(req);
  }

  return { handle, requests, records };
}
