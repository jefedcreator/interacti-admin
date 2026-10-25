import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { AdminResourceMeta, ListParams } from '@/types/admin';
import { createUrl, readListParams, withParam } from '@/utils';

export interface ListParamsControls {
  /** What the URL asks for, as far as the resource allows it. */
  params: ListParams;
  /** Sets one parameter, or deletes it when the value is empty. Anything but `page` resets the page. */
  setParam(key: string, value: string | null): void;
  /** Several at once, such as `sortBy` with `sortOrder`, in one navigation. */
  setParams(changes: Record<string, string | null>): void;
  /** Back to the table's defaults: no search, filters, sort or page. */
  reset(): void;
}

/**
 * A table's page, search, sort and filters, read from the URL and written back to it in place:
 * replaced, not pushed, and without scrolling, as Dandys' tables do.
 */
export function useListParams(resource: AdminResourceMeta): ListParamsControls {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();

  const current = useMemo(() => new URLSearchParams(search), [search]);
  const params = useMemo(() => readListParams(current, resource), [current, resource]);

  const write = useCallback(
    (next: URLSearchParams) => {
      void navigate(createUrl(pathname, next), { replace: true, preventScrollReset: true });
    },
    [navigate, pathname],
  );

  const setParams = useCallback(
    (changes: Record<string, string | null>) => {
      let next = current;
      for (const [key, value] of Object.entries(changes)) next = withParam(next, key, value);
      write(next);
    },
    [current, write],
  );

  const setParam = useCallback(
    (key: string, value: string | null) => setParams({ [key]: value }),
    [setParams],
  );

  const reset = useCallback(() => write(new URLSearchParams()), [write]);

  return { params, setParam, setParams, reset };
}
