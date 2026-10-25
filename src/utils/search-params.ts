import type { AdminFieldMeta, AdminResourceMeta, ListParams } from '@/types/admin';

/*
 * A table's state lives in its URL (spec §8.2): page, search, sort and filters. These read it back
 * as the list parameters spec §6.5 allows, dropping anything the contract would refuse, and write
 * it the way Dandys' tables do.
 */

const DEFAULT_SIZE = 20;
const MAX_SIZE = 100;
/** The contract's longest `query` (spec §6.5). */
const QUERY_LIMIT = 255;

const WHOLE_NUMBER = /^\d+$/;

/** Dandys' `createUrl`: the path and its search, with commas left readable. */
export function createUrl(pathname: string, params: URLSearchParams): string {
  const paramsString = params.toString().replace(/%2C/g, ',');
  const queryString = `${paramsString.length ? '?' : ''}${paramsString}`;
  return `${pathname}${queryString}`;
}

/** A whole number from 1 up, or null for anything else. */
function countFrom(raw: string | null): number | null {
  if (raw === null || !WHOLE_NUMBER.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= 1 ? n : null;
}

/** Whether `value` is one the field can be filtered by: an enum value, `true` or `false`, or a key. */
function isFilterValue(field: AdminFieldMeta | undefined, value: string): boolean {
  if (!field) return true;
  if (field.type === 'enum') return (field.enumValues ?? []).includes(value);
  if (field.type === 'boolean') return value === 'true' || value === 'false';
  return true;
}

/**
 * The list parameters a URL asks for, as far as the resource allows them. A page or size out of
 * range falls back to the default, and a sort, order or filter the manifest doesn't offer is
 * dropped. Filters follow the manifest's `filterable` order, never the URL's, so the same table
 * always sends the same request.
 */
export function readListParams(search: URLSearchParams, resource: AdminResourceMeta): ListParams {
  const params: ListParams = { page: 1, size: DEFAULT_SIZE, filters: {} };

  params.page = countFrom(search.get('page')) ?? 1;

  const size = countFrom(search.get('size'));
  if (size !== null && size <= MAX_SIZE) params.size = size;

  const query = (search.get('query') ?? '').trim().slice(0, QUERY_LIMIT);
  if (query) params.query = query;

  const sortBy = search.get('sortBy');
  if (sortBy !== null && resource.sortable.includes(sortBy)) {
    params.sortBy = sortBy;
    // An order only means something next to the field it orders.
    const sortOrder = search.get('sortOrder');
    if (sortOrder === 'asc' || sortOrder === 'desc') params.sortOrder = sortOrder;
  }

  for (const name of resource.filterable) {
    const value = (search.get(name) ?? '').trim();
    if (!value) continue;
    const field = resource.fields.find((f) => f.name === name);
    if (isFilterValue(field, value)) params.filters[name] = value;
  }

  return params;
}

/**
 * A copy of `search` with `key` set, or deleted when the value is empty. Changing anything but the
 * page puts the table back on page 1, so the page goes too.
 */
export function withParam(
  search: URLSearchParams,
  key: string,
  value: string | null,
): URLSearchParams {
  const next = new URLSearchParams(search);
  if (value === null || value.trim() === '') next.delete(key);
  else next.set(key, value);
  if (key !== 'page') next.delete('page');
  return next;
}
