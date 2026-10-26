import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { TOKEN_STORAGE_KEY } from '@/provider';
import type { AdminAnalytics } from '@/types/admin';
import { createFakeAdminApi, type FakeAdminApi } from '../fake-api/fake-admin-api';
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
    await waitFor(() => expect(router.state.location.pathname).toBe('/signin'));
    expect(router.state.location.search).toBe('');
  });
});

describe('product page: analytics', () => {
  let fake: FakeAdminApi;
  const ANALYTICS = `${STRIVE}/api/admin/analytics`;
  const analyticsRequests = (search: string) =>
    fake.requests.filter(
      (r) => r.method === 'GET' && r.path === '/api/admin/analytics' && r.search === search,
    );

  beforeEach(() => {
    fake = createFakeAdminApi({
      token: FAKE_TOKEN,
      product: 'strive',
      now: new Date('2026-10-22T12:00:00Z'),
    });
    server.use(...adminHandlers(STRIVE, fake));
  });

  const reply = (data: Partial<AdminAnalytics>) =>
    http.get(ANALYTICS, () =>
      HttpResponse.json({
        status: 200,
        message: 'OK',
        data: { days: 30, configured: true, note: null, metrics: [], series: [], ...data },
      }),
    );

  it("shows the product's own tiles, each with its change, and a legend for the chart", async () => {
    renderApp('/strive');
    const main = within(await screen.findByRole('main'));

    const visitors = within(await main.findByRole('group', { name: 'Visitors' }));
    expect(visitors.getByText('5,265')).toBeInTheDocument();
    expect(visitors.getByText('↑ 28%')).toBeInTheDocument();
    expect(visitors.getByText('vs previous 30 days')).toBeInTheDocument();

    const views = within(main.getByRole('group', { name: 'Page views' }));
    expect(views.getByText('7,596')).toBeInTheDocument();
    expect(views.getByText('No change')).toBeInTheDocument();

    const enquiries = within(main.getByRole('group', { name: 'Enquiries' }));
    expect(enquiries.getByText('8')).toBeInTheDocument();
    expect(enquiries.getByText('New')).toBeInTheDocument();

    expect(main.getByRole('heading', { name: 'Visitors & Page views' })).toBeInTheDocument();
    // The daily rows can't be summed into the tile's figure (a returning visitor counts once a
    // day), so the chart's name describes the shape of each line and claims no total.
    expect(
      main.getByRole('img', {
        name: 'Visitors and Page views per day, last 30 days: Visitors from 100 to 157, highest on 13 Oct; Page views from 150 to 236, highest on 14 Oct',
      }),
    ).toBeInTheDocument();
    expect(main.getByText('Google Analytics can lag by up to a day.')).toBeInTheDocument();
  });

  it('names tiles from what the product sends, and shows no tile it did not send', async () => {
    server.use(
      reply({ metrics: [{ key: 'signups', label: 'Sign-ups', count: 3, previous: 3 }] }),
    );
    renderApp('/strive');
    const main = within(await screen.findByRole('main'));

    expect(await main.findByRole('group', { name: 'Sign-ups' })).toBeInTheDocument();
    expect(main.queryByRole('group', { name: 'Enquiries' })).toBeNull();
    expect(main.queryByRole('group', { name: 'Visitors' })).toBeNull();
    expect(main.queryByRole('img')).toBeNull();
  });

  it('keeps the resource list below it, in the same groups with the same counts', async () => {
    renderApp('/strive');
    const main = within(await screen.findByRole('main'));

    expect(await main.findByRole('group', { name: 'Visitors' })).toBeInTheDocument();
    expect(main.getByRole('heading', { name: 'People' })).toBeInTheDocument();
    expect(main.getByRole('link', { name: 'Clubs 45' })).toHaveAttribute('href', '/strive/clubs');
  });

  it('is busy while it loads and not afterwards', async () => {
    renderApp('/strive');
    const region = await screen.findByRole('region', { name: 'Analytics' });
    expect(region).toHaveAttribute('aria-busy', 'true');
    await within(region).findByRole('group', { name: 'Visitors' });
    expect(region).toHaveAttribute('aria-busy', 'false');
  });

  it('asks for the period that is chosen, and writes it to the URL', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/strive?x=1');
    const main = within(await screen.findByRole('main'));
    await main.findByRole('group', { name: 'Visitors' });
    expect(analyticsRequests('?days=30')).toHaveLength(1);

    await user.click(main.getByText('7 days'));

    await waitFor(() => expect(analyticsRequests('?days=7')).toHaveLength(1));
    expect(router.state.location.search).toBe('?x=1&days=7');
    expect(await main.findByRole('group', { name: 'Visitors' })).toBeInTheDocument();
  });

  it('asks for 30 days when the URL names a period that does not exist', async () => {
    renderApp('/strive?days=bogus');
    await within(await screen.findByRole('main')).findByRole('group', { name: 'Visitors' });
    expect(analyticsRequests('?days=30')).toHaveLength(1);
    expect(fake.requests.some((r) => r.search.includes('bogus'))).toBe(false);
  });

  it("shows the product's own note, and nothing else, when Google Analytics is not set up", async () => {
    const unset = createFakeAdminApi({
      token: FAKE_TOKEN,
      product: 'strive',
      analytics: 'not-configured',
    });
    server.use(...adminHandlers(STRIVE, unset));
    renderApp('/strive');
    const main = within(await screen.findByRole('main'));

    expect(
      await main.findByText('Set GA_PROPERTY_ID and GA_SERVICE_ACCOUNT_JSON on the server and restart it.'),
    ).toBeInTheDocument();
    expect(main.queryByRole('group', { name: 'Visitors' })).toBeNull();
    expect(main.queryByRole('img')).toBeNull();
    expect(await main.findByRole('link', { name: 'Users 3' })).toBeInTheDocument();
  });

  it('says analytics are not available yet from a product without the route, and keeps the list', async () => {
    server.use(http.get(ANALYTICS, () => HttpResponse.json({ message: 'Not found' }, { status: 404 })));
    renderApp('/strive');
    const main = within(await screen.findByRole('main'));

    expect(await main.findByText("Analytics isn't available from Strive yet.")).toBeInTheDocument();
    expect(await main.findByRole('link', { name: 'Users 3' })).toBeInTheDocument();
  });

  it('names the product that refused the token, and keeps the list', async () => {
    server.use(http.get(ANALYTICS, () => HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })));
    renderApp('/strive');
    const main = within(await screen.findByRole('main'));

    expect(await main.findByText("Strive didn't accept this token.")).toBeInTheDocument();
    expect(await main.findByRole('link', { name: 'Users 3' })).toBeInTheDocument();
  });

  it("carries the product's message when Google fails, and tries again on request", async () => {
    const user = userEvent.setup();
    let calls = 0;
    server.use(
      http.get(ANALYTICS, () => {
        calls += 1;
        return HttpResponse.json({ message: 'Quota exceeded' }, { status: 502 });
      }),
    );
    renderApp('/strive');
    const main = within(await screen.findByRole('main'));

    expect(await main.findByText("Couldn't load analytics.")).toBeInTheDocument();
    expect(main.getByText('Quota exceeded')).toBeInTheDocument();
    const before = calls;

    await user.click(main.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(calls).toBeGreaterThan(before));
  });

  it("shows the product's message whatever the failure, not only a server one", async () => {
    server.use(
      http.get(ANALYTICS, () => HttpResponse.json({ message: 'days: Invalid option' }, { status: 422 })),
    );
    renderApp('/strive');
    const main = within(await screen.findByRole('main'));

    expect(await main.findByText("Couldn't load analytics.")).toBeInTheDocument();
    expect(main.getByText('days: Invalid option')).toBeInTheDocument();
  });

  it('shows no analytics for a product that is not connected', async () => {
    renderApp('/fluid');
    const main = within(await screen.findByRole('main'));

    expect(await main.findByText('Not connected')).toBeInTheDocument();
    expect(main.queryByRole('heading', { name: 'Analytics' })).toBeNull();
  });
});
