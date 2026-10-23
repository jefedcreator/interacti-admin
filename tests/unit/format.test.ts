import { describe, expect, it } from 'vitest';
import type { ProductConfig } from '@/config/products';
import { adminKeys } from '@/hooks/queries/keys';
import { AdminApiError, describeConnection, fixFor, formatCount, groupResources } from '@/utils';
import { fakeManifest } from '../fake-api/fixture';

const ready: ProductConfig = {
  slug: 'strive',
  name: 'Strive',
  field: 'SaaS',
  status: 'live',
  tile: null,
  connection: { state: 'ready', apiBase: 'https://strive.test' },
};
const withConnection = (connection: ProductConfig['connection']): ProductConfig => ({
  ...ready,
  connection,
});

const idle = { error: null, isLoading: false };
const fail = (kind: ConstructorParameters<typeof AdminApiError>[0]) =>
  new AdminApiError(kind, 'x', null);

describe('describeConnection', () => {
  it('says why a product has no connection, whatever the manifest holds', () => {
    const loading = { error: null, isLoading: true };
    expect(describeConnection(withConnection({ state: 'no-backend' }), loading)).toBe(
      'No backend yet',
    );
    expect(
      describeConnection(withConnection({ state: 'not-configured', envVar: 'VITE_API_X' }), loading),
    ).toBe('Not connected');
    expect(
      describeConnection(withConnection({ state: 'needs-https', apiBase: 'http://x.test' }), loading),
    ).toBe('Needs HTTPS');
  });

  it('reads Checking… while the manifest loads', () => {
    expect(describeConnection(ready, { error: null, isLoading: true })).toBe('Checking…');
  });

  it('names a rejected token and a switched-off admin', () => {
    expect(describeConnection(ready, { error: fail('unauthorized'), isLoading: false })).toBe(
      'Token rejected',
    );
    expect(describeConnection(ready, { error: fail('off'), isLoading: false })).toBe('Admin is off');
  });

  it('says it could not reach a product that is unreachable or failing', () => {
    expect(describeConnection(ready, { error: fail('unreachable'), isLoading: false })).toBe(
      "Couldn't reach it",
    );
    expect(describeConnection(ready, { error: fail('server'), isLoading: false })).toBe(
      "Couldn't reach it",
    );
  });

  it('counts the resources and records of a loaded manifest', () => {
    expect(describeConnection(ready, { ...idle, data: fakeManifest('strive') })).toBe(
      '3 resources · 50 records',
    );
  });

  it('keeps the singular for one resource with one record', () => {
    const base = fakeManifest('strive');
    const first = base.resources[0];
    if (!first) throw new Error('The fixture has no resources.');
    const one = { ...base, resources: [{ ...first, count: 1 }] };
    expect(describeConnection(ready, { ...idle, data: one })).toBe('1 resource · 1 record');
  });

  it('puts thousands separators in the counts', () => {
    const base = fakeManifest('strive');
    const first = base.resources[0];
    if (!first) throw new Error('The fixture has no resources.');
    const big = { ...base, resources: [{ ...first, count: 2340 }] };
    expect(describeConnection(ready, { ...idle, data: big })).toBe('1 resource · 2,340 records');
  });
});

describe('formatCount', () => {
  it('groups thousands the en-GB way', () => {
    expect(formatCount(2340)).toBe('2,340');
    expect(formatCount(7)).toBe('7');
    expect(formatCount(1234567)).toBe('1,234,567');
  });
});

describe('fixFor', () => {
  it('names the env var of a product that is not configured', () => {
    const fluid = withConnection({ state: 'not-configured', envVar: 'VITE_API_FLUID' });
    expect(fixFor(fluid)).toBe('Set VITE_API_FLUID and rebuild.');
  });

  it('asks for an https address when the origin is http', () => {
    const sara: ProductConfig = {
      ...withConnection({ state: 'needs-https', apiBase: 'http://sara.test' }),
      slug: 'sara',
      name: 'Sara',
    };
    expect(fixFor(sara)).toBe('Use an https address for VITE_API_SARA.');
  });

  it('asks for the token on the server when the admin is off', () => {
    expect(fixFor(ready, fail('off'))).toBe('Set ADMIN_API_TOKEN on the server and restart it.');
  });

  it('has nothing to say otherwise', () => {
    expect(fixFor(ready)).toBeNull();
    expect(fixFor(ready, fail('unauthorized'))).toBeNull();
    expect(fixFor(withConnection({ state: 'no-backend' }))).toBeNull();
  });
});

describe('groupResources', () => {
  it('groups in the order each group first appears, keeping registry order inside', () => {
    const groups = groupResources(fakeManifest('strive').resources);
    expect(groups.map((g) => g.group)).toEqual(['People', 'Clubs', 'Sign-in']);
    expect(groups.map((g) => g.resources.map((r) => r.key))).toEqual([
      ['users'],
      ['clubs'],
      ['sessions'],
    ]);
  });
});

describe('adminKeys', () => {
  it('builds flat arrays of strings', () => {
    expect(adminKeys.all).toEqual(['admin']);
    expect(adminKeys.manifest('strive')).toEqual(['admin', 'strive', 'manifest']);
    expect(adminKeys.lists('strive', 'clubs')).toEqual(['admin', 'strive', 'clubs', 'list']);
    expect(adminKeys.detail('strive', 'clubs', 'club-01')).toEqual([
      'admin',
      'strive',
      'clubs',
      'detail',
      'club-01',
    ]);
  });

  it('keys a list by its query string, in the order the filters were given', () => {
    const key = adminKeys.list('strive', 'clubs', {
      page: 2,
      size: 20,
      query: 'run',
      filters: { isPublic: 'true', ownerId: 'user-ada' },
    });
    expect(key).toEqual([
      'admin',
      'strive',
      'clubs',
      'list',
      'page=2&size=20&query=run&isPublic=true&ownerId=user-ada',
    ]);
    // A list key starts with the lists key, so invalidating the one reaches the other.
    expect(key.slice(0, 4)).toEqual(adminKeys.lists('strive', 'clubs'));
  });
});
