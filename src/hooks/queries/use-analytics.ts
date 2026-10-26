import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ProductSlug } from '@/config/products';
import { useProductApi } from '@/hooks/use-product-api';
import type { AdminAnalytics, AnalyticsDays } from '@/types/admin';
import type { AdminApiError } from '@/utils';
import { adminKeys } from './keys';
import { notConnected } from './use-manifest';

/** The product's analytics for the last `days` days. Off until the product is connected. */
export function useAnalyticsQuery(
  slug: ProductSlug,
  days: AnalyticsDays,
): UseQueryResult<AdminAnalytics, AdminApiError> {
  const api = useProductApi(slug);

  return useQuery<AdminAnalytics, AdminApiError>({
    queryKey: adminKeys.analytics(slug, days),
    queryFn: () => (api ? api.analytics(days) : Promise.reject(notConnected())),
    enabled: api !== null,
  });
}
