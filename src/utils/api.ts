import type { AxiosInstance } from 'axios';
import type {
  AdminAnalytics,
  AdminManifest,
  AdminRecord,
  AnalyticsDays,
  ApiResponse,
  ListParams,
  PaginatedApiResponse,
} from '@/types/admin';
import { AdminApiError, toAdminApiError } from './axios';

/** page, size, query, sortBy, sortOrder, then the filters in key order. Empty values are skipped. */
export function toSearchParams(params: ListParams): URLSearchParams {
  const search = new URLSearchParams();
  const set = (key: string, value: unknown): void => {
    if (value === undefined || value === null || value === '') return;
    search.set(key, String(value));
  };

  set('page', params.page);
  set('size', params.size);
  set('query', params.query);
  set('sortBy', params.sortBy);
  set('sortOrder', params.sortOrder);
  for (const [key, value] of Object.entries(params.filters)) set(key, value);

  return search;
}

async function run<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    throw toAdminApiError(error);
  }
}

const segment = encodeURIComponent;

export function adminApi(client: AxiosInstance) {
  return {
    async manifest(): Promise<AdminManifest> {
      try {
        const res = await run(() => client.get<ApiResponse<AdminManifest>>(''));
        return res.data.data;
      } catch (error) {
        const failure = toAdminApiError(error);
        if (failure.kind === 'not-found') {
          throw new AdminApiError('off', failure.message, failure.status, null);
        }
        throw failure;
      }
    },

    async analytics(days: AnalyticsDays): Promise<AdminAnalytics> {
      const res = await run(() => client.get<ApiResponse<AdminAnalytics>>(`/analytics?days=${days}`));
      return res.data.data;
    },

    async list(
      resource: string,
      params: ListParams,
    ): Promise<PaginatedApiResponse<AdminRecord[]>> {
      const search = toSearchParams(params).toString();
      const url = `/${segment(resource)}${search ? `?${search}` : ''}`;
      const res = await run(() => client.get<PaginatedApiResponse<AdminRecord[]>>(url));
      return res.data;
    },

    async get(resource: string, key: string): Promise<AdminRecord> {
      const res = await run(() =>
        client.get<ApiResponse<AdminRecord>>(`/${segment(resource)}/${segment(key)}`),
      );
      return res.data.data;
    },

    async create(resource: string, body: Record<string, unknown>): Promise<AdminRecord> {
      const res = await run(() =>
        client.post<ApiResponse<AdminRecord>>(`/${segment(resource)}`, body),
      );
      return res.data.data;
    },

    async update(
      resource: string,
      key: string,
      body: Record<string, unknown>,
    ): Promise<AdminRecord> {
      const res = await run(() =>
        client.put<ApiResponse<AdminRecord>>(`/${segment(resource)}/${segment(key)}`, body),
      );
      return res.data.data;
    },

    async remove(resource: string, key: string): Promise<void> {
      await run(() => client.delete(`/${segment(resource)}/${segment(key)}`));
    },
  };
}

export type AdminApi = ReturnType<typeof adminApi>;
