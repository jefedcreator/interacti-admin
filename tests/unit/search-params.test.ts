import { describe, expect, it } from 'vitest';
import type { AdminResourceMeta } from '@/types/admin';
import { createUrl, readListParams, withParam } from '@/utils';
import { fakeManifest } from '../fake-api/fixture';

function pick<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`${what} is missing`);
  return value;
}

const clubs: AdminResourceMeta = pick(
  fakeManifest('strive').resources.find((r) => r.key === 'clubs'),
  'clubs',
);

describe('createUrl', () => {
  it('keeps commas readable', () => {
    expect(createUrl('/strive/clubs', new URLSearchParams('tags=a,b'))).toBe(
      '/strive/clubs?tags=a,b',
    );
  });

  it('is the bare path when there are no parameters', () => {
    expect(createUrl('/strive/clubs', new URLSearchParams())).toBe('/strive/clubs');
  });
});

describe('readListParams', () => {
  it('falls back to the defaults and drops what the resource does not offer', () => {
    const search = new URLSearchParams(
      'page=-3&size=500&sortBy=gone&sortOrder=up&isPublic=maybe&nope=1',
    );

    expect(readListParams(search, clubs)).toEqual({ page: 1, size: 20, filters: {} });
  });

  it('reads the page, size, search, sort and filters', () => {
    const search = new URLSearchParams(
      'page=2&size=50&query=%20lag%20&sortBy=name&sortOrder=asc&isPublic=true&ownerId=u1',
    );

    expect(readListParams(search, clubs)).toEqual({
      page: 2,
      size: 50,
      query: 'lag',
      sortBy: 'name',
      sortOrder: 'asc',
      filters: { isPublic: 'true', ownerId: 'u1' },
    });
  });

  it("puts the filters in the manifest's order, whatever the URL's", () => {
    const search = new URLSearchParams('isPublic=true&ownerId=u1');

    // clubs.filterable is ['ownerId', 'isPublic'].
    expect(Object.keys(readListParams(search, clubs).filters)).toEqual(['ownerId', 'isPublic']);
  });
});

describe('withParam', () => {
  it('deletes an emptied parameter, and the page with it', () => {
    expect(withParam(new URLSearchParams('page=3&query=x'), 'query', '').toString()).toBe('');
  });

  it('keeps the rest when the page changes', () => {
    const next = withParam(new URLSearchParams('page=3&query=x'), 'page', '2');

    expect(next.get('page')).toBe('2');
    expect(next.get('query')).toBe('x');
  });

  it('returns a copy and leaves the original alone', () => {
    const search = new URLSearchParams('page=3&query=x');

    withParam(search, 'query', 'y');

    expect(search.toString()).toBe('page=3&query=x');
  });
});
