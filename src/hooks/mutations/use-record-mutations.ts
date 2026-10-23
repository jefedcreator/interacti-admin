import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { ProductSlug } from '@/config/products';
import { adminKeys } from '@/hooks/queries/keys';
import { notConnected } from '@/hooks/queries/use-manifest';
import { useProductApi } from '@/hooks/use-product-api';
import type { AdminApiError } from '@/utils';

/** The record to delete: its opaque key, and the title the success toast names it by. */
export type DeleteRecordVariables = { key: string; title: string };

/**
 * Deletes one record. On success the record's own detail query is dropped (it would only 404),
 * and every page of the resource's list and the manifest's counts are marked stale and refetched.
 * Errors stay on the mutation so the delete modal can show the product's message.
 */
export function useDeleteRecordMutation(
  slug: ProductSlug,
  resource: string,
): UseMutationResult<void, AdminApiError, DeleteRecordVariables> {
  const api = useProductApi(slug);
  const queryClient = useQueryClient();

  return useMutation<void, AdminApiError, DeleteRecordVariables>({
    mutationFn: ({ key }) => (api ? api.remove(resource, key) : Promise.reject(notConnected())),
    onSuccess: async (_data, { key }) => {
      queryClient.removeQueries({ queryKey: adminKeys.detail(slug, resource, key) });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.lists(slug, resource) }),
        queryClient.invalidateQueries({ queryKey: adminKeys.manifest(slug) }),
      ]);
    },
  });
}
