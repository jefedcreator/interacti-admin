import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ProductSlug } from '@/config/products';
import { useProductApi } from '@/hooks/use-product-api';
import type { AdminRecord, ListParams, PaginatedApiResponse } from '@/types/admin';
import type { AdminApiError } from '@/utils';
import { adminKeys } from './keys';
import { notConnected } from './use-manifest';

/** One page of a resource's records. Off until the product is connected. */
export function useRecordsQuery(
  slug: ProductSlug,
  resource: string,
  params: ListParams,
): UseQueryResult<PaginatedApiResponse<AdminRecord[]>, AdminApiError> {
  const api = useProductApi(slug);

  return useQuery<PaginatedApiResponse<AdminRecord[]>, AdminApiError>({
    queryKey: adminKeys.list(slug, resource, params),
    queryFn: () => (api ? api.list(resource, params) : Promise.reject(notConnected())),
    enabled: api !== null,
  });
}
