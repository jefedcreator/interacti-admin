import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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

async function signInWith(token: string) {
  const user = userEvent.setup();
  if (token) await user.type(screen.getByLabelText('Admin token'), token);
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('sign-in', () => {
  it('refuses a wrong token and stays on sign-in', async () => {
    const { router } = renderApp('/signin', { token: null });

    await signInWith('not-a-token');

    expect(await screen.findByText("That token wasn't accepted.")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/signin');
    expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('asks for a token when the field is empty', async () => {
    renderApp('/signin', { token: null });

    await signInWith('');

    expect(await screen.findByText('Enter the admin token.')).toBeInTheDocument();
  });

  it('goes to next once one product accepts the token, whatever the others say', async () => {
    const { router } = renderApp('/signin?next=%2Fstrive%2Fclubs', { token: null });

    await signInWith(FAKE_TOKEN);

    await waitFor(() => expect(router.state.location.pathname).toBe('/strive/clubs'));
    expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBe(FAKE_TOKEN);
  });

  it('goes to the products page when there is no next', async () => {
    const { router } = renderApp('/signin', { token: null });

    await signInWith(FAKE_TOKEN);

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('ignores a next that points at another host', async () => {
    const { router } = renderApp('/signin?next=%2F%2Fevil.example', { token: null });

    await signInWith(FAKE_TOKEN);

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(router.state.location.search).toBe('');
  });

  it('says so when no product answers', async () => {
    server.use(
      http.all(`${STRIVE}/api/admin`, () => HttpResponse.error()),
      http.all(`${SARA}/api/admin`, () => HttpResponse.error()),
    );
    const { router } = renderApp('/signin', { token: null });

    await signInWith(FAKE_TOKEN);

    expect(
      await screen.findByText("Couldn't reach any product. Check that their admin is switched on."),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/signin');
  });

  it('reads Checking… and is disabled while it waits', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const cors = { 'access-control-allow-origin': '*' };
    const held = (origin: string) =>
      http.all(`${origin}/api/admin`, async ({ request }) => {
        if (request.method === 'OPTIONS') return new HttpResponse(null, { status: 204, headers: cors });
        await gate;
        return HttpResponse.json({ message: 'Unauthorized' }, { status: 401, headers: cors });
      });
    server.use(held(STRIVE), held(SARA));
    renderApp('/signin', { token: null });

    await signInWith('whatever');

    const busy = await screen.findByRole('button', { name: 'Checking…' });
    expect(busy).toBeDisabled();

    release();
    expect(await screen.findByText("That token wasn't accepted.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  describe('on a page that cannot carry the token', () => {
    // happy-dom's own handle on the page URL; vitest's default page is http://localhost:3000.
    const setPageUrl = (url: string): void =>
      (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL(url);

    afterEach(() => setPageUrl('http://localhost:3000/'));

    it('refuses over http', () => {
      setPageUrl('http://admin.example/signin');
      renderApp('/signin', { token: null });

      expect(screen.getByText('Sign-in needs HTTPS.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
    });
  });
});
