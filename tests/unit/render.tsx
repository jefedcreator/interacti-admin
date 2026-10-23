import { render, type RenderResult } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { routes } from '@/app/router';
import { Provider, TOKEN_STORAGE_KEY, createQueryClient } from '@/provider';
import { FAKE_TOKEN } from '../fake-api/fixture';

type Rendered = RenderResult & { router: ReturnType<typeof createMemoryRouter> };

/**
 * Mounts the real routes at `path` inside a fresh Provider. The token is preset in sessionStorage:
 * the fake's token unless `options.token` says otherwise, and `null` for a signed-out visitor.
 */
export function renderApp(path: string, options: { token?: string | null } = {}): Rendered {
  const token = options.token === undefined ? FAKE_TOKEN : options.token;
  if (token === null) sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  else sessionStorage.setItem(TOKEN_STORAGE_KEY, token);

  // Same defaults as the app, but a retry doesn't wait: set once on the client, never per query.
  const client = createQueryClient();
  client.setDefaultOptions({
    ...client.getDefaultOptions(),
    queries: { ...client.getDefaultOptions().queries, retryDelay: 0 },
  });

  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const view = render(
    <Provider client={client}>
      <RouterProvider router={router} />
    </Provider>,
  );

  return { ...view, router };
}
