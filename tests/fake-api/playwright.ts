// The Playwright side of the fake: `page.route` around the same framework-free `createFakeAdminApi`
// that `msw.ts` wraps for Vitest.
import type { Page } from '@playwright/test';
import type { createFakeAdminApi } from './fake-admin-api';

/** The origin the built app is served from; the fake's answers name it, as a real product would. */
const APP_ORIGIN = 'http://localhost:4173';

/** Lower-case names, so they replace the fake's own wildcard instead of sitting beside it. */
export const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': APP_ORIGIN,
  'access-control-allow-headers': 'Authorization, Content-Type',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const escapeForRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Every URL under `${origin}/api/admin`, the bare manifest path included (`/**` would miss it). */
export function adminUrls(origin: string): RegExp {
  return new RegExp(`^${escapeForRegExp(origin)}/api/admin(?:[/?#].*)?$`);
}

/**
 * Routes `${origin}/api/admin/**` to the fake. `OPTIONS` answers 204, and every response carries
 * the CORS headers the app's origin needs, so the browser lets the cross-origin calls through.
 */
export async function installFakeApi(
  page: Page,
  origin: string,
  api: ReturnType<typeof createFakeAdminApi>,
): Promise<void> {
  await page.route(adminUrls(origin), async (route) => {
    const request = route.request();
    const method = request.method();

    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    const url = new URL(request.url());

    let body: unknown;
    if (method !== 'GET' && method !== 'HEAD') {
      try {
        body = request.postDataJSON() ?? undefined;
      } catch {
        body = undefined;
      }
    }

    const res = api.handle({
      method,
      url: request.url(),
      path: url.pathname,
      search: url.search,
      headers: request.headers(),
      body,
    });

    const headers: Record<string, string> = {};
    for (const [name, value] of Object.entries(res.headers)) headers[name.toLowerCase()] = value;

    await route.fulfill({
      status: res.status,
      headers: { ...headers, ...CORS_HEADERS },
      body: res.body === undefined ? undefined : JSON.stringify(res.body),
    });
  });
}
