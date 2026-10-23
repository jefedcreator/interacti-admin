import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ProductSlug } from '@/config/products';
import { useProductApi } from '@/hooks/use-product-api';
import type { AdminRecord } from '@/types/admin';
import type { AdminApiError } from '@/utils';
import { adminKeys } from './keys';
import { notConnected } from './use-manifest';

/** One record by its opaque key. Off until the product is connected. */
export function useRecordQuery(
  slug: ProductSlug,
  resource: string,
  key: string,
): UseQueryResult<AdminRecord, AdminApiError> {
  const api = useProductApi(slug);

  return useQuery<AdminRecord, AdminApiError>({
    queryKey: adminKeys.detail(slug, resource, key),
    queryFn: () => (api ? api.get(resource, key) : Promise.reject(notConnected())),
    enabled: api !== null,
  });
}
