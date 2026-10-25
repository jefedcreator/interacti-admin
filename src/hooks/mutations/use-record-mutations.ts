import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { ProductSlug } from '@/config/products';
import { adminKeys } from '@/hooks/queries/keys';
import { notConnected } from '@/hooks/queries/use-manifest';
import { useProductApi } from '@/hooks/use-product-api';
import type { AdminRecord } from '@/types/admin';
import type { AdminApiError } from '@/utils';

/*
 * The writes. Each takes the body the form built (writable, changed fields only) and sends it as
 * is. On success every page of the resource's list, the record's detail and the manifest's counts
 * are marked stale and refetched. Errors stay on the mutation, so the modal can show the product's
 * message where it belongs.
 */

/** The record to change, by its opaque key, and the fields to send. */
export type UpdateRecordVariables = { key: string; body: Record<string, unknown> };

/** The record to delete: its opaque key, and the title the success toast names it by. */
export type DeleteRecordVariables = { key: string; title: string };

/** Creates one record. The product answers with it, `_key` and all. */
export function useCreateRecordMutation(
  slug: ProductSlug,
  resource: string,
): UseMutationResult<AdminRecord, AdminApiError, Record<string, unknown>> {
  const api = useProductApi(slug);
  const queryClient = useQueryClient();

  return useMutation<AdminRecord, AdminApiError, Record<string, unknown>>({
    mutationFn: (body) => (api ? api.create(resource, body) : Promise.reject(notConnected())),
    onSuccess: async (created) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.lists(slug, resource) }),
        queryClient.invalidateQueries({ queryKey: adminKeys.detail(slug, resource, created._key) }),
        queryClient.invalidateQueries({ queryKey: adminKeys.manifest(slug) }),
      ]);
    },
  });
}

/** Changes one record: `PUT` with only the fields that changed. */
export function useUpdateRecordMutation(
  slug: ProductSlug,
  resource: string,
): UseMutationResult<AdminRecord, AdminApiError, UpdateRecordVariables> {
  const api = useProductApi(slug);
  const queryClient = useQueryClient();

  return useMutation<AdminRecord, AdminApiError, UpdateRecordVariables>({
    mutationFn: ({ key, body }) =>
      api ? api.update(resource, key, body) : Promise.reject(notConnected()),
    onSuccess: async (_record, { key }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: adminKeys.lists(slug, resource) }),
        queryClient.invalidateQueries({ queryKey: adminKeys.detail(slug, resource, key) }),
        queryClient.invalidateQueries({ queryKey: adminKeys.manifest(slug) }),
      ]);
    },
  });
}

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
