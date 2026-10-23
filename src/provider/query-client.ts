import { QueryClient } from '@tanstack/react-query';
import { isAdminApiError } from '@/utils';

/**
 * Strive's defaults, set once here and never per query. Only a product that couldn't be reached or
 * that failed on its side is worth retrying: a 4xx won't change on a second try.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60_000,
        refetchOnMount: 'always',
        refetchOnWindowFocus: 'always',
        retry: (count, error) =>
          count < 3 && isAdminApiError(error) && (error.kind === 'unreachable' || error.kind === 'server'),
      },
    },
  });
}
