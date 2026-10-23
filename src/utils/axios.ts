import axios, { isAxiosError, type AxiosInstance } from 'axios';

export type AdminApiErrorKind =
  | 'unreachable'
  | 'unauthorized'
  | 'off'
  | 'not-found'
  | 'forbidden'
  | 'conflict'
  | 'invalid'
  | 'server';

export class AdminApiError extends Error {
  readonly kind: AdminApiErrorKind;
  readonly status: number | null;
  readonly field: string | null;

  constructor(
    kind: AdminApiErrorKind,
    message: string,
    status: number | null = null,
    field: string | null = null,
  ) {
    super(message);
    this.name = 'AdminApiError';
    this.kind = kind;
    this.status = status;
    this.field = field;
  }
}

export function isAdminApiError(error: unknown): error is AdminApiError {
  return error instanceof AdminApiError;
}

export function createAdminClient(apiBase: string, token: string): AxiosInstance {
  return axios.create({
    adapter: 'fetch',
    baseURL: `${apiBase}/api/admin`,
    timeout: 15000,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
}

const FALLBACK_UNREACHABLE = "Couldn't reach it.";
const FALLBACK_UNEXPECTED = 'Unexpected response.';

const FIELD_NAME = /^[A-Za-z_][\w.]*$/;

function kindFor(status: number, hasMessage: boolean): AdminApiErrorKind {
  switch (status) {
    case 401:
      return 'unauthorized';
    case 403:
      return 'forbidden';
    case 404:
      return 'not-found';
    case 409:
      return 'conflict';
    case 422:
      return 'invalid';
    case 502:
    case 503:
    case 504:
      // A gateway answering with a page instead of the product's own JSON means the product isn't there.
      return hasMessage ? 'server' : 'unreachable';
    default:
      return 'server';
  }
}

/** The text before the first ': ', when it reads as a field name ("name: Required" gives "name"). */
function fieldOf(message: string): string | null {
  const at = message.indexOf(': ');
  if (at < 1) return null;
  const head = message.slice(0, at);
  return FIELD_NAME.test(head) ? head : null;
}

export function toAdminApiError(error: unknown): AdminApiError {
  if (isAdminApiError(error)) return error;

  if (!isAxiosError(error)) {
    return new AdminApiError('server', FALLBACK_UNEXPECTED);
  }

  const response = error.response;
  if (!response) {
    return new AdminApiError('unreachable', FALLBACK_UNREACHABLE);
  }

  const data: unknown = response.data;
  const raw =
    typeof data === 'object' && data !== null && 'message' in data
      ? (data as { message: unknown }).message
      : undefined;
  const given = typeof raw === 'string' && raw.length > 0 ? raw : null;

  const status = response.status;
  const kind = kindFor(status, given !== null);
  const message = given ?? (kind === 'unreachable' ? FALLBACK_UNREACHABLE : FALLBACK_UNEXPECTED);
  const field = status === 409 || status === 422 ? fieldOf(message) : null;

  return new AdminApiError(kind, message, status, field);
}
