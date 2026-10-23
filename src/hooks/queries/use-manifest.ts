import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ProductSlug } from '@/config/products';
import { useProductApi } from '@/hooks/use-product-api';
import type { AdminManifest } from '@/types/admin';
import { AdminApiError } from '@/utils';
import { adminKeys } from './keys';

/** What a query function throws if it ever runs without an API; `enabled` should prevent it. */
export const notConnected = (): AdminApiError =>
  new AdminApiError('unreachable', 'This product is not connected.');

/** The product's manifest: its resources and their counts. Off until the product is connected. */
export function useManifestQuery(slug: ProductSlug): UseQueryResult<AdminManifest, AdminApiError> {
  const api = useProductApi(slug);

  return useQuery<AdminManifest, AdminApiError>({
    queryKey: adminKeys.manifest(slug),
    queryFn: () => (api ? api.manifest() : Promise.reject(notConnected())),
    enabled: api !== null,
  });
}
