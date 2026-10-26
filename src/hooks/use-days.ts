import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { AnalyticsDays } from '@/types/admin';
import { createUrl, readDays, withParam } from '@/utils';

/**
 * The analytics period, read from `?days=` and written back in place: replaced, not pushed, and
 * without scrolling, with every other parameter kept.
 */
export function useDays(): [AnalyticsDays, (days: AnalyticsDays) => void] {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();

  const current = useMemo(() => new URLSearchParams(search), [search]);
  const days = useMemo(() => readDays(current), [current]);

  const setDays = useCallback(
    (next: AnalyticsDays) => {
      const params = withParam(current, 'days', String(next));
      void navigate(createUrl(pathname, params), { replace: true, preventScrollReset: true });
    },
    [current, navigate, pathname],
  );

  return [days, setDays];
}
