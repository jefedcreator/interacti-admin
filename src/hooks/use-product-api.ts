import { useMemo } from 'react';
import { productBySlug, type ProductSlug } from '@/config/products';
import { useAuth } from '@/provider';
import { adminApi, createAdminClient } from '@/utils';

/** The product's admin API, or null until it is connected (ready) and a token exists. */
export function useProductApi(slug: ProductSlug): ReturnType<typeof adminApi> | null {
  const { token } = useAuth();
  const connection = productBySlug(slug)?.connection;
  const apiBase = connection?.state === 'ready' ? connection.apiBase : null;

  return useMemo(
    () => (apiBase && token ? adminApi(createAdminClient(apiBase, token)) : null),
    [apiBase, token],
  );
}
