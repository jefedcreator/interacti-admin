import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  adminApi,
  createAdminClient,
  isAdminApiError,
  toSearchParams,
  type AdminApiError,
} from '@/utils';
import { createFakeAdminApi, type FakeAdminApi } from '../fake-api/fake-admin-api';
import { FAKE_TOKEN } from '../fake-api/fixture';
import { adminHandlers, server } from '../fake-api/msw';

const ORIGIN = 'https://strive.test';

let fake: FakeAdminApi;
let api: ReturnType<typeof adminApi>;

beforeEach(() => {
  fake = createFakeAdminApi({ token: FAKE_TOKEN, product: 'strive' });
  server.use(...adminHandlers(ORIGIN, fake));
  api = adminApi(createAdminClient(ORIGIN, FAKE_TOKEN));
});

async function failure(call: Promise<unknown>): Promise<AdminApiError> {
  let caught: unknown;
  try {
    await call;
  } catch (error) {
    caught = error;
  }
  expect(isAdminApiError(caught)).toBe(true);
  return caught as AdminApiError;
}

const listParams = { page: 1, size: 20, filters: {} };

describe('createAdminClient', () => {
  it('sends the bearer token and asks for JSON', async () => {
    await api.manifest();
    const sent = fake.requests.at(-1);
    expect(sent?.path).toBe('/api/admin');
    expect(sent?.headers['authorization']).toBe(`Bearer ${FAKE_TOKEN}`);
    expect(sent?.headers['accept']).toContain('application/json');
  });
});

describe('the requests', () => {
  it('reads the manifest', async () => {
    const manifest = await api.manifest();
    expect(manifest.product).toBe('strive');
    expect(manifest.resources.map((r) => r.key)).toEqual(['users', 'clubs', 'sessions']);
  });

  it('puts the list parameters in the URL in a fixed order', async () => {
    const res = await api.list('clubs', {
      page: 2,
      size: 20,
      query: 'lag',
      sortBy: 'name',
      sortOrder: 'asc',
      filters: { isPublic: 'true' },
    });
    const sent = fake.requests.at(-1);
    expect(`${sent?.path}${sent?.search}`).toBe(
      '/api/admin/clubs?page=2&size=20&query=lag&sortBy=name&sortOrder=asc&isPublic=true',
    );
    // Only Lagos Runners matches, so page 2 is empty.
    expect(res.page).toBe(2);
    expect(res.total).toBe(1);
    expect(res.data).toEqual([]);
  });

  it('returns the whole paginated envelope', async () => {
    const res = await api.list('clubs', { page: 3, size: 20, filters: {} });
    expect(res.total).toBe(45);
    expect(res.data).toHaveLength(5);
  });

  it('encodes the key', async () => {
    await expect(api.get('clubs', 'a/b')).rejects.toMatchObject({ kind: 'not-found' });
    expect(fake.requests.at(-1)?.path).toBe('/api/admin/clubs/a%2Fb');
  });

  it('gets, creates, updates and removes', async () => {
    const got = await api.get('users', 'user-ada');
    expect(got).toMatchObject({ _key: 'user-ada', email: 'ada@x.co' });

    const created = await api.create('clubs', { name: 'Kano Trail', ownerId: 'user-ada' });
    expect(created._key).toBe('fake-1');

    const updated = await api.update('clubs', 'fake-1', { name: 'Kano Trail Club' });
    expect(updated).toMatchObject({ name: 'Kano Trail Club', _title: 'Kano Trail Club' });

    await expect(api.remove('clubs', 'fake-1')).resolves.toBeUndefined();
    await expect(api.get('clubs', 'fake-1')).rejects.toMatchObject({ kind: 'not-found' });
  });
});

describe('toSearchParams', () => {
  it('skips undefined, null and empty values, filters included', () => {
    const search = toSearchParams({
      page: 1,
      size: 20,
      query: '',
      sortBy: undefined,
      filters: { ownerId: '', isPublic: 'false', role: 'ADMIN' },
    });
    expect(search.toString()).toBe('page=1&size=20&isPublic=false&role=ADMIN');
  });
});

describe('error mapping', () => {
  it('maps a wrong token to unauthorized', async () => {
    const wrong = adminApi(createAdminClient(ORIGIN, 'wrong'));
    const error = await failure(wrong.manifest());
    expect(error).toMatchObject({ kind: 'unauthorized', status: 401 });
  });

  it('maps a 404 on the manifest to off', async () => {
    server.use(
      http.get(`${ORIGIN}/api/admin`, () => HttpResponse.json({ message: 'Not found' }, { status: 404 })),
    );
    const error = await failure(api.manifest());
    expect(error).toMatchObject({ kind: 'off', status: 404 });
  });

  it('maps a 404 on a record to not-found', async () => {
    const error = await failure(api.get('clubs', 'nope'));
    expect(error).toMatchObject({ kind: 'not-found', status: 404 });
  });

  it('maps a network failure to unreachable with no status', async () => {
    server.use(http.get(`${ORIGIN}/api/admin/clubs`, () => HttpResponse.error()));
    const error = await failure(api.list('clubs', listParams));
    expect(error).toMatchObject({ kind: 'unreachable', status: null, field: null });
  });

  it('maps a 502 with an HTML body to unreachable', async () => {
    server.use(
      http.get(
        `${ORIGIN}/api/admin/clubs`,
        () =>
          new HttpResponse('<html><body>Bad gateway</body></html>', {
            status: 502,
            headers: { 'content-type': 'text/html' },
          }),
      ),
    );
    const error = await failure(api.list('clubs', listParams));
    expect(error).toMatchObject({ kind: 'unreachable', status: 502 });
    expect(error.message).toBe("Couldn't reach it.");
  });

  it('maps a 500 to server and keeps its message', async () => {
    server.use(
      http.get(`${ORIGIN}/api/admin/clubs`, () => HttpResponse.json({ message: 'boom' }, { status: 500 })),
    );
    const error = await failure(api.list('clubs', listParams));
    expect(error).toMatchObject({ kind: 'server', status: 500, message: 'boom' });
  });

  it('falls back to a plain message when the body has none', async () => {
    server.use(http.get(`${ORIGIN}/api/admin/clubs`, () => HttpResponse.json({}, { status: 500 })));
    const error = await failure(api.list('clubs', listParams));
    expect(error).toMatchObject({ kind: 'server', message: 'Unexpected response.' });
  });

  it('maps a 422 to invalid and reads the field', async () => {
    server.use(
      http.post(`${ORIGIN}/api/admin/clubs`, () =>
        HttpResponse.json({ message: 'name: Required' }, { status: 422 }),
      ),
    );
    const error = await failure(api.create('clubs', {}));
    expect(error).toMatchObject({
      kind: 'invalid',
      status: 422,
      field: 'name',
      message: 'name: Required',
    });
  });

  it('reads no field from a 422 that is not about one', async () => {
    const error = await failure(api.list('clubs', { ...listParams, filters: { bogus: '1' } }));
    expect(error).toMatchObject({
      kind: 'invalid',
      field: null,
      message: 'Invalid query parameter: bogus',
    });
  });

  it('maps a 409 to conflict and reads the field', async () => {
    server.use(
      http.put(`${ORIGIN}/api/admin/users/user-ada`, () =>
        HttpResponse.json({ message: 'email: already in use' }, { status: 409 }),
      ),
    );
    const error = await failure(api.update('users', 'user-ada', { email: 'bola@x.co' }));
    expect(error).toMatchObject({ kind: 'conflict', status: 409, field: 'email' });
  });

  it('maps a 409 about references to conflict with no field', async () => {
    server.use(
      http.delete(`${ORIGIN}/api/admin/users/user-ada`, () =>
        HttpResponse.json({ message: 'Other records still point at this one' }, { status: 409 }),
      ),
    );
    const error = await failure(api.remove('users', 'user-ada'));
    expect(error).toMatchObject({ kind: 'conflict', status: 409, field: null });
  });

  it('maps a 403 to forbidden', async () => {
    const error = await failure(api.create('sessions', { userId: 'user-ada' }));
    expect(error).toMatchObject({
      kind: 'forbidden',
      status: 403,
      message: "Sessions can't be created here",
    });
  });
});
