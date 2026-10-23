// The Vitest side of the fake: MSW handlers around the framework-free `createFakeAdminApi`.
import { http, HttpResponse, type HttpHandler } from 'msw';
import { setupServer } from 'msw/node';
import type { FakeAdminApi } from './fake-admin-api';

/** One server for the whole test run; `tests/setup.ts` starts, resets and closes it. */
export const server = setupServer();

export function adminHandlers(origin: string, api: FakeAdminApi): HttpHandler[] {
  const resolver = async ({ request }: { request: Request }): Promise<Response> => {
    const url = new URL(request.url);

    let body: unknown;
    if (request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'OPTIONS') {
      try {
        body = await request.json();
      } catch {
        body = undefined;
      }
    }

    const res = api.handle({
      method: request.method,
      url: request.url,
      path: url.pathname,
      search: url.search,
      headers: Object.fromEntries(request.headers.entries()),
      body,
    });

    if (res.body === undefined) {
      return new HttpResponse(null, { status: res.status, headers: res.headers });
    }
    return HttpResponse.json(res.body, { status: res.status, headers: res.headers });
  };

  // `/api/admin/*` does not match the bare manifest path, so it gets its own handler.
  return [http.all(`${origin}/api/admin`, resolver), http.all(`${origin}/api/admin/*`, resolver)];
}
