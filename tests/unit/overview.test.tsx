import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { TOKEN_STORAGE_KEY } from '@/provider';
import { createFakeAdminApi } from '../fake-api/fake-admin-api';
import { FAKE_TOKEN } from '../fake-api/fixture';
import { adminHandlers, server } from '../fake-api/msw';
import { renderApp } from './render';

const STRIVE = 'https://strive.test';
const SARA = 'https://sara.test';
const SARA_TOKEN = 'f'.repeat(40);

beforeEach(() => {
  server.use(
    ...adminHandlers(STRIVE, createFakeAdminApi({ token: FAKE_TOKEN, product: 'strive' })),
    ...adminHandlers(SARA, createFakeAdminApi({ token: SARA_TOKEN, product: 'sara' })),
  );
});

/** The card is an article named by its product. */
const card = (name: string): HTMLElement => screen.getByRole('article', { name });

describe('overview', () => {
  it('shows a card per product, with its status and connection', async () => {
    renderApp('/', { token: FAKE_TOKEN });

    expect(await screen.findByRole('heading', { level: 1, name: 'Products' })).toBeInTheDocument();

    const strive = card('Strive');
    expect(within(strive).getByText('Strive')).toBeInTheDocument();
    expect(within(strive).getByText('Live · SaaS')).toBeInTheDocument();
    expect(await within(strive).findByText('3 resources · 50 records')).toBeInTheDocument();
    expect(within(strive).getByRole('link', { name: 'Strive' })).toHaveAttribute('href', '/strive');

    const sara = card('Sara');
    expect(within(sara).getByText('Coming soon · AI')).toBeInTheDocument();
    expect(await within(sara).findByText('Token rejected')).toBeInTheDocument();

    expect(within(card('0nbox')).getByText('Not connected')).toBeInTheDocument();
  });

  it('shows Harv3st as coming soon with no backend and no link', async () => {
    renderApp('/', { token: FAKE_TOKEN });
    await screen.findByRole('heading', { level: 1, name: 'Products' });

    const harv3st = card('Harv3st');
    expect(within(harv3st).getByText('Coming soon · Crypto')).toBeInTheDocument();
    expect(within(harv3st).getByText('No backend yet')).toBeInTheDocument();
    expect(within(harv3st).queryByRole('link')).toBeNull();
  });

  it("keeps Strive's card when Sara answers with an HTML 502", async () => {
    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, content-type, accept',
      'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
    };
    server.use(
      http.all(`${SARA}/api/admin`, ({ request }) =>
        request.method === 'OPTIONS'
          ? new HttpResponse(null, { status: 204, headers: cors })
          : new HttpResponse('<html><body>Bad Gateway</body></html>', {
              status: 502,
              headers: { ...cors, 'content-type': 'text/html' },
            }),
      ),
    );
    renderApp('/', { token: FAKE_TOKEN });

    expect(await within(card('Strive')).findByText('3 resources · 50 records')).toBeInTheDocument();
    expect(await within(card('Sara')).findByText("Couldn't reach it")).toBeInTheDocument();
  });
});

describe('product page', () => {
  it("lists the product's resources by group, each with its count", async () => {
    renderApp('/strive');

    const main = within(await screen.findByRole('main'));
    expect(main.getByRole('heading', { level: 1, name: 'Strive' })).toBeInTheDocument();
    expect(main.getByText('SaaS · Live')).toBeInTheDocument();

    expect(await main.findByRole('heading', { name: 'People' })).toBeInTheDocument();
    expect(main.getByRole('heading', { name: 'Clubs' })).toBeInTheDocument();
    expect(main.getByRole('heading', { name: 'Sign-in' })).toBeInTheDocument();

    expect(main.getByRole('link', { name: 'Users 3' })).toHaveAttribute('href', '/strive/users');
    expect(main.getByRole('link', { name: 'Clubs 45' })).toHaveAttribute('href', '/strive/clubs');
    expect(main.getByRole('link', { name: 'Sessions 2' })).toHaveAttribute(
      'href',
      '/strive/sessions',
    );
  });

  it('says what a product that is not connected needs', async () => {
    renderApp('/fluid');

    const main = within(await screen.findByRole('main'));
    expect(main.getByRole('heading', { level: 1, name: 'Fluid' })).toBeInTheDocument();
    expect(main.getByText('Crypto · Coming soon')).toBeInTheDocument();
    expect(main.getByText('Not connected')).toBeInTheDocument();
    expect(main.getByText('Set VITE_API_FLUID and rebuild.')).toBeInTheDocument();
  });

  it('names a rejected token on the page of the product that refused it', async () => {
    renderApp('/sara');

    const main = within(await screen.findByRole('main'));
    expect(await main.findByText('Token rejected')).toBeInTheDocument();
  });
});

describe('not found', () => {
  it('shows the not-found page for a path that is no product', async () => {
    renderApp('/nope');

    expect(
      await screen.findByRole('heading', { name: "This page doesn't exist." }),
    ).toBeInTheDocument();
  });
});

describe('app shell', () => {
  it('lists every product in the rail, with Harv3st as plain text', async () => {
    renderApp('/strive');

    const rail = within(await screen.findByRole('navigation', { name: 'Products' }));
    expect(rail.getByRole('link', { name: 'Strive' })).toHaveAttribute('href', '/strive');
    expect(rail.getByRole('link', { name: /^Sara/ })).toHaveAttribute('href', '/sara');
    expect(rail.getByText('Harv3st')).toBeInTheDocument();
    expect(rail.queryByRole('link', { name: /Harv3st/ })).toBeNull();
    expect(await rail.findByRole('link', { name: 'Users 3' })).toHaveAttribute(
      'href',
      '/strive/users',
    );
  });

  it('opens a menu with the same links and a way out', async () => {
    const user = userEvent.setup();
    renderApp('/strive');

    await user.click(await screen.findByRole('button', { name: 'Menu' }));

    const menu = within(await screen.findByRole('dialog', { name: 'Menu' }));
    expect(menu.getByRole('link', { name: 'Strive' })).toBeInTheDocument();
    expect(await menu.findByRole('link', { name: 'Clubs 45' })).toBeInTheDocument();
    expect(menu.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('signs out to plain sign-in, without a next', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/strive');

    await user.click(await screen.findByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull());
    await waitFor(() => expect(router.state.location.pathname).toBe('/sign-in'));
    expect(router.state.location.search).toBe('');
  });
});
