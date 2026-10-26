import type { ProductSlug } from '@/config/products';
import type { AnalyticsDays, ListParams } from '@/types/admin';
import { toSearchParams } from '@/utils';

/*
 * The one place query keys are made. Every key is a flat array of strings, so a prefix reaches
 * everything below it: `lists(p, r)` invalidates each page of a resource, `all` the whole app.
 * `list` is keyed by the exact query string the request sends.
 */
export const adminKeys = {
  all: ['admin'],
  manifest: (product: ProductSlug): string[] => ['admin', product, 'manifest'],
  analytics: (product: ProductSlug, days: AnalyticsDays): string[] => [
    'admin',
    product,
    'analytics',
    String(days),
  ],
  lists: (product: ProductSlug, resource: string): string[] => ['admin', product, resource, 'list'],
  list: (product: ProductSlug, resource: string, params: ListParams): string[] => [
    'admin',
    product,
    resource,
    'list',
    toSearchParams(params).toString(),
  ],
  detail: (product: ProductSlug, resource: string, key: string): string[] => [
    'admin',
    product,
    resource,
    'detail',
    key,
  ],
};
