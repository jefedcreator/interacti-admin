import { products, type ProductSlug } from '@/config/products';
import { adminApi } from './api';
import { createAdminClient, isAdminApiError } from './axios';

export type TokenVerdict = {
  accepted: ProductSlug[];
  rejected: ProductSlug[];
  failed: ProductSlug[];
};

/**
 * Asks every connected product for its manifest at once. A 401 means that product rejected the
 * token; anything else (off, down, a bad answer) says nothing about the token, so it is `failed`.
 */
export async function verifyToken(token: string, list = products): Promise<TokenVerdict> {
  const ready = list.flatMap((product) =>
    product.connection.state === 'ready'
      ? [{ slug: product.slug, apiBase: product.connection.apiBase }]
      : [],
  );

  const results = await Promise.all(
    ready.map(async ({ slug, apiBase }) => {
      try {
        await adminApi(createAdminClient(apiBase, token)).manifest();
        return { slug, outcome: 'accepted' as const };
      } catch (error) {
        const rejected = isAdminApiError(error) && error.kind === 'unauthorized';
        return { slug, outcome: rejected ? ('rejected' as const) : ('failed' as const) };
      }
    }),
  );

  const pick = (outcome: keyof TokenVerdict) =>
    results.filter((result) => result.outcome === outcome).map((result) => result.slug);

  return { accepted: pick('accepted'), rejected: pick('rejected'), failed: pick('failed') };
}
