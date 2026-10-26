import { describe, expect, it } from 'vitest';
import type {
  AdminAnalytics,
  AdminManifest,
  AdminRecord,
  PaginatedApiResponse,
} from '@/types/admin';
import { createFakeAdminApi, type FakeResponse } from '../fake-api/fake-admin-api';
import { FAKE_TOKEN } from '../fake-api/fixture';

function setup(
  options: {
    referenced?: Set<string>;
    rejectSortBy?: string[];
    now?: Date;
    analytics?: 'configured' | 'not-configured';
  } = {},
) {
  const api = createFakeAdminApi({ token: FAKE_TOKEN, product: 'strive', ...options });
  const call = (
    method: string,
    path: string,
    extra: { search?: string; body?: unknown; token?: string | null } = {},
  ): FakeResponse => {
    const token = extra.token === undefined ? FAKE_TOKEN : extra.token;
    return api.handle({
      method,
      url: `https://strive.test${path}${extra.search ?? ''}`,
      path,
      search: extra.search ?? '',
      headers: token === null ? {} : { Authorization: `Bearer ${token}` },
      body: extra.body,
    });
  };
  return { api, call };
}

const message = (res: FakeResponse): unknown => (res.body as { message: string }).message;
const page = (res: FakeResponse) => res.body as PaginatedApiResponse<AdminRecord[]>;

describe('the fake admin API', () => {
  it('has a 40 character token', () => {
    expect(FAKE_TOKEN).toHaveLength(40);
  });

  it('answers 401 to a manifest without the token, and to the wrong one', () => {
    const { call } = setup();
    expect(call('GET', '/api/admin', { token: null }).status).toBe(401);
    expect(call('GET', '/api/admin', { token: 'nope' }).status).toBe(401);
  });

  it('serves the manifest with live counts: 50 records in all', () => {
    const { call } = setup();
    const res = call('GET', '/api/admin');
    expect(res.status).toBe(200);
    const manifest = (res.body as { data: AdminManifest }).data;
    expect(manifest.product).toBe('strive');
    expect(manifest.resources.map((r) => r.key)).toEqual(['users', 'clubs', 'sessions']);
    expect(manifest.resources.reduce((sum, r) => sum + r.count, 0)).toBe(50);
  });

  it('reads the token header whatever its case', () => {
    const { api } = setup();
    const res = api.handle({
      method: 'GET',
      url: 'https://strive.test/api/admin',
      path: '/api/admin',
      search: '',
      headers: { AUTHORIZATION: `Bearer ${FAKE_TOKEN}` },
      body: undefined,
    });
    expect(res.status).toBe(200);
  });

  it('answers a preflight with 204, without a token', () => {
    const { call } = setup();
    expect(call('OPTIONS', '/api/admin/clubs', { token: null }).status).toBe(204);
  });

  it('pages the clubs: page 3 holds the last five', () => {
    const { call } = setup();
    const res = call('GET', '/api/admin/clubs', { search: '?page=3' });
    expect(res.status).toBe(200);
    const body = page(res);
    expect(body.total).toBe(45);
    expect(body.totalPages).toBe(3);
    expect(body.data.map((r) => r['name'])).toEqual([
      'Club 41',
      'Club 42',
      'Club 43',
      'Club 44',
      'Club 45',
    ]);
  });

  it('starts the first page with Lagos Runners, owned by Ada', () => {
    const { call } = setup();
    const body = page(call('GET', '/api/admin/clubs'));
    expect(body.data).toHaveLength(20);
    expect(body.data.slice(0, 3).map((r) => r['name'])).toEqual([
      'Lagos Runners',
      'Abuja Pacers',
      'Club 03',
    ]);
    expect(body.data[0]).toMatchObject({
      memberCount: 3,
      _title: 'Lagos Runners',
      _refs: { ownerId: { key: 'user-ada', title: 'ada@x.co' } },
    });
  });

  it('searches case-insensitively, filters and sorts', () => {
    const { call } = setup();
    const found = page(call('GET', '/api/admin/clubs', { search: '?query=LAGOS' }));
    expect(found.data.map((r) => r['name'])).toEqual(['Lagos Runners']);

    const mine = page(call('GET', '/api/admin/clubs', { search: '?ownerId=user-bola&size=100' }));
    expect(mine.data.every((r) => r['ownerId'] === 'user-bola')).toBe(true);
    expect(mine.total).toBeGreaterThan(1);

    const sorted = page(call('GET', '/api/admin/clubs', { search: '?sortBy=name&sortOrder=desc' }));
    expect(sorted.data[0]?.['name']).toBe('Lagos Runners');
  });

  it('answers 422 for unknown keys and for a sortBy it will not take', () => {
    const { call } = setup({ rejectSortBy: ['name'] });
    const unknown = call('GET', '/api/admin/clubs', { search: '?bogus=1' });
    expect(unknown.status).toBe(422);
    expect(message(unknown)).toBe('Invalid query parameter: bogus');

    const unsortable = call('GET', '/api/admin/clubs', { search: '?sortBy=settings' });
    expect(unsortable.status).toBe(422);
    expect(message(unsortable)).toBe('Invalid query parameter: sortBy');

    const rejected = call('GET', '/api/admin/clubs', { search: '?sortBy=name' });
    expect(rejected.status).toBe(422);
  });

  it('reads one record, and answers 404 for an unknown key or resource', () => {
    const { call } = setup();
    expect(call('GET', '/api/admin/users/user-ada').status).toBe(200);
    expect(call('GET', '/api/admin/users/nobody').status).toBe(404);
    expect(call('GET', '/api/admin/clubs/a%2Fb').status).toBe(404);
    expect(call('GET', '/api/admin/nothing').status).toBe(404);
  });

  it('creates a record as fake-1 with its title and refs', () => {
    const { call } = setup();
    const res = call('POST', '/api/admin/clubs', {
      body: { name: 'Port Harcourt Joggers', ownerId: 'user-chi' },
    });
    expect(res.status).toBe(201);
    expect((res.body as { data: AdminRecord }).data).toMatchObject({
      _key: 'fake-1',
      id: 'fake-1',
      _title: 'Port Harcourt Joggers',
      _refs: { ownerId: { key: 'user-chi', title: 'chi@x.co' } },
      isPublic: false,
      tags: [],
      memberCount: 0,
    });

    const next = call('POST', '/api/admin/users', { body: { email: 'dayo@x.co' } });
    expect((next.body as { data: AdminRecord }).data).toMatchObject({
      _key: 'fake-2',
      role: 'MEMBER',
    });

    expect(call('GET', '/api/admin/clubs/fake-1').status).toBe(200);
    const manifest = (call('GET', '/api/admin').body as { data: AdminManifest }).data;
    expect(manifest.resources.reduce((sum, r) => sum + r.count, 0)).toBe(52);
  });

  it('refuses bad create bodies with 422', () => {
    const { call } = setup();
    const create = (body: unknown) => call('POST', '/api/admin/clubs', { body });

    expect(message(create({ ownerId: 'user-ada' }))).toBe('name: Required');
    expect(message(create({ name: 'x' }))).toBe('ownerId: Required');
    expect(message(create({ name: 'x', ownerId: 'user-ada', memberCount: 4 }))).toBe(
      'memberCount: Unrecognized key',
    );
    expect(message(create({ name: 'x', ownerId: 'user-ada', nope: 1 }))).toBe(
      'nope: Unrecognized key',
    );
    expect(message(create({ name: 'x', ownerId: 'nobody' }))).toBe('ownerId: no such user');
    expect(create({ name: 'x', ownerId: 'nobody' }).status).toBe(422);
  });

  it('answers 403 where the resource does not allow the action', () => {
    const { call } = setup();
    const created = call('POST', '/api/admin/sessions', { body: { userId: 'user-ada' } });
    expect(created.status).toBe(403);
    expect(message(created)).toBe("Sessions can't be created here");
    expect(call('PUT', '/api/admin/sessions/session-1', { body: {} }).status).toBe(403);
    expect(call('DELETE', '/api/admin/sessions/session-1').status).toBe(200);
  });

  it('updates with a partial body and refuses read-only keys', () => {
    const { call } = setup();
    const ok = call('PUT', '/api/admin/users/user-chi', { body: { name: 'Chidi' } });
    expect(ok.status).toBe(200);
    expect((ok.body as { data: AdminRecord }).data).toMatchObject({ name: 'Chidi', email: 'chi@x.co' });

    const readOnly = call('PUT', '/api/admin/users/user-chi', { body: { createdAt: 'x' } });
    expect(readOnly.status).toBe(422);
    expect(message(readOnly)).toBe('createdAt: Unrecognized key');
  });

  it('follows a renamed user into the titles of the records that point at it', () => {
    const { call } = setup();
    call('PUT', '/api/admin/users/user-ada', { body: { email: 'ada@y.co' } });
    const session = (call('GET', '/api/admin/sessions/session-1').body as { data: AdminRecord }).data;
    expect(session._title).toBe('ada@y.co');
  });

  it('deletes, except a key that is still referenced', () => {
    const { call } = setup({ referenced: new Set(['user-ada']) });
    const blocked = call('DELETE', '/api/admin/users/user-ada');
    expect(blocked.status).toBe(409);
    expect(message(blocked)).toBe('Other records still point at this one');

    expect(call('DELETE', '/api/admin/clubs/club-02').status).toBe(200);
    expect(call('GET', '/api/admin/clubs/club-02').status).toBe(404);
    expect(call('DELETE', '/api/admin/clubs/club-02').status).toBe(404);
  });

  it('records every request', () => {
    const { api, call } = setup();
    call('GET', '/api/admin');
    call('GET', '/api/admin/clubs', { search: '?page=2' });
    call('GET', '/api/admin', { token: null });
    expect(api.requests.map((r) => r.path + r.search)).toEqual([
      '/api/admin',
      '/api/admin/clubs?page=2',
      '/api/admin',
    ]);
  });
});

describe('the fake admin API: analytics', () => {
  const NOW = new Date('2026-10-22T12:00:00Z');
  const analytics = (res: FakeResponse) => (res.body as { data: AdminAnalytics }).data;

  it('gives every series one point per day, ending on the last complete day', () => {
    const { call } = setup({ now: NOW });
    const res = call('GET', '/api/admin/analytics', { search: '?days=7' });
    expect(res.status).toBe(200);
    const data = analytics(res);
    expect(data.days).toBe(7);
    expect(data.configured).toBe(true);
    expect(data.series.length).toBeGreaterThan(0);
    for (const line of data.series) {
      expect(line.points).toHaveLength(7);
      expect(line.points.at(-1)?.date).toBe('2026-10-21');
      expect(line.points[0]?.date).toBe('2026-10-15');
    }
  });

  it('refuses a period that is not 7, 30 or 90, and any other parameter', () => {
    const { call } = setup({ now: NOW });
    expect(call('GET', '/api/admin/analytics', { search: '?days=5' }).status).toBe(422);
    expect(call('GET', '/api/admin/analytics', { search: '?days=7&x=1' }).status).toBe(422);
    expect(call('GET', '/api/admin/analytics').status).toBe(422);
  });

  it('answers 401 without the token', () => {
    const { call } = setup({ now: NOW });
    expect(call('GET', '/api/admin/analytics', { search: '?days=7', token: null }).status).toBe(401);
  });

  it('says it is not set up, in the product\'s own words, when asked to', () => {
    const { call } = setup({ now: NOW, analytics: 'not-configured' });
    const data = analytics(call('GET', '/api/admin/analytics', { search: '?days=30' }));
    expect(data.configured).toBe(false);
    expect(data.metrics).toEqual([]);
    expect(data.series).toEqual([]);
    expect(data.note).toBeTruthy();
  });
});
