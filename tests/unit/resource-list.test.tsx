import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminRecord } from '@/types/admin';
import {
  createFakeAdminApi,
  type FakeAdminApi,
  type FakeAdminApiOptions,
  type FakeRequest,
} from '../fake-api/fake-admin-api';
import { FAKE_TOKEN, fakeManifest } from '../fake-api/fixture';
import { adminHandlers, server } from '../fake-api/msw';
import { renderApp } from './render';

const STRIVE = 'https://strive.test';
const CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, accept',
  'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

let fake: FakeAdminApi;

/** Serves a fresh fake for Strive. A later call shadows the earlier one for the rest of the test. */
function serveFake(options: Pick<FakeAdminApiOptions, 'referenced' | 'rejectSortBy'> = {}): void {
  fake = createFakeAdminApi({ token: FAKE_TOKEN, product: 'strive', ...options });
  server.use(...adminHandlers(STRIVE, fake));
}

beforeEach(() => {
  serveFake();
});

/** The fake's live rows for a resource, so a test can change what it serves. */
function rowsOf(resource: string): AdminRecord[] {
  const rows = fake.records[resource];
  if (!rows) throw new Error(`the fake has no ${resource}`);
  return rows;
}

function sent(method: string): FakeRequest[] {
  return fake.requests.filter((req) => req.method === method);
}

function only<T>(items: T[]): T {
  expect(items).toHaveLength(1);
  const [item] = items;
  if (item === undefined) throw new Error('expected exactly one');
  return item;
}

/** The query of the last list request the fake answered for `resource`. */
function lastList(resource = 'clubs'): URLSearchParams {
  const lists = fake.requests.filter(
    (req) => req.method === 'GET' && req.path === `/api/admin/${resource}`,
  );
  const last = lists[lists.length - 1];
  if (!last) throw new Error(`no list request for ${resource}`);
  return new URLSearchParams(last.search);
}

/** Renders the page at `path` and waits for the row titled `first`. */
async function openList(path = '/strive/clubs', first = 'Lagos Runners') {
  const view = renderApp(path, { token: FAKE_TOKEN });
  await screen.findByRole('link', { name: first });
  return view;
}

const table = (name = 'Clubs'): HTMLElement => screen.getByRole('table', { name });

function bodyRows(name = 'Clubs'): HTMLElement[] {
  const body = within(table(name)).getAllByRole('rowgroup')[1];
  if (!body) throw new Error('the table has no body');
  return within(body).getAllByRole('row');
}

/** The row whose title link reads `title`. */
function rowOf(title: string): HTMLElement {
  const row = screen.getByRole('link', { name: title }).closest('tr');
  if (!row) throw new Error(`no row for ${title}`);
  return row;
}

async function openRowMenu(user: UserEvent, title: string): Promise<void> {
  await user.click(within(rowOf(title)).getByRole('button', { name: 'Open menu' }));
}

describe('resource list: the page', () => {
  it('shows the title with its count, the eyebrow, New club and a page of rows', async () => {
    await openList();

    const heading = screen.getByRole('heading', { level: 1, name: 'Clubs 45' });
    expect(within(heading).getByText('45')).toHaveClass('text-ink/50');
    expect(screen.getByText('Strive · Clubs')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New club' })).toBeInTheDocument();

    expect(bodyRows()).toHaveLength(20);
    expect(screen.getByRole('link', { name: 'Lagos Runners' })).toHaveAttribute(
      'href',
      '/strive/clubs/club-01',
    );

    const owner = within(rowOf('Lagos Runners')).getByRole('link', { name: 'ada@x.co' });
    expect(owner).toHaveAttribute('href', '/strive/users/user-ada');

    for (const header of within(table()).getAllByRole('columnheader')) {
      expect(header).toHaveAttribute('scope', 'col');
    }
  });

  it("shows the not-found page for a resource the manifest doesn't know", async () => {
    renderApp('/strive/nope', { token: FAKE_TOKEN });

    expect(
      await screen.findByRole('heading', { name: "This page doesn't exist." }),
    ).toBeInTheDocument();
  });
});

describe('resource list: paging', () => {
  it('moves to page 2 in the URL and shows its rows', async () => {
    const user = userEvent.setup();
    const { router } = await openList();

    const pager = screen.getByRole('navigation', { name: 'Pagination' });
    expect(within(pager).getByRole('button', { name: 'Page 1' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(pager).getByRole('button', { name: 'Previous page' })).toBeDisabled();

    const page2 = within(pager).getByRole('button', { name: 'Page 2' });
    await user.click(page2);

    await waitFor(() => expect(router.state.location.search).toBe('?page=2'));
    expect(await screen.findByRole('link', { name: 'Club 22' })).toBeInTheDocument();

    // The pager stayed mounted through the load: the same button, current now, still focused.
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBe(pager);
    expect(within(pager).getByRole('button', { name: 'Page 2' })).toBe(page2);
    expect(page2).toHaveAttribute('aria-current', 'page');
    expect(page2).toHaveFocus();
  });
});

describe('resource list: searching', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('searches once typing has stopped for 500ms, back on page 1', async () => {
    const { router } = await openList('/strive/clubs?page=2', 'Club 21');
    const box = screen.getByRole('searchbox', { name: 'Search clubs' });

    // fireEvent, not userEvent: Testing Library's async wrapper waits on a setTimeout that fake
    // timers would never fire.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    for (const value of ['l', 'la', 'lag']) {
      fireEvent.change(box, { target: { value } });
      act(() => {
        vi.advanceTimersByTime(100);
      });
    }
    // 100ms after the last keystroke: nothing sent yet.
    expect(router.state.location.search).toBe('?page=2');

    act(() => {
      vi.advanceTimersByTime(400);
    });
    vi.useRealTimers();

    await waitFor(() => expect(router.state.location.search).toBe('?query=lag'));
    await waitFor(() => expect(lastList().get('query')).toBe('lag'));
    // The URL dropped its page, so the request is for the first one.
    expect(lastList().get('page')).toBe('1');
  });
});

describe('resource list: sorting', () => {
  it('cycles a header through ascending, descending and the default', async () => {
    const user = userEvent.setup();
    const { router } = await openList();
    const nameHeader = (): HTMLElement => screen.getByRole('columnheader', { name: 'Name' });
    const sortByName = () => user.click(within(nameHeader()).getByRole('button', { name: 'Name' }));

    expect(nameHeader()).not.toHaveAttribute('aria-sort');

    await sortByName();
    await waitFor(() => expect(router.state.location.search).toBe('?sortBy=name&sortOrder=asc'));
    await waitFor(() => expect(nameHeader()).toHaveAttribute('aria-sort', 'ascending'));

    await sortByName();
    await waitFor(() => expect(router.state.location.search).toBe('?sortBy=name&sortOrder=desc'));
    await waitFor(() => expect(nameHeader()).toHaveAttribute('aria-sort', 'descending'));

    await sortByName();
    await waitFor(() => expect(router.state.location.search).toBe(''));
    await waitFor(() => expect(nameHeader()).not.toHaveAttribute('aria-sort'));
  });
});

describe('resource list: filtering', () => {
  it('adds a boolean filter from the menu', async () => {
    const user = userEvent.setup();
    const { router } = await openList();

    await user.click(screen.getByRole('button', { name: 'Filter' }));
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Is public' }), 'Yes');

    await waitFor(() => expect(router.state.location.search).toBe('?isPublic=true'));
    await waitFor(() => expect(lastList().get('isPublic')).toBe('true'));
  });

  it('shows a reference filter from the URL as a chip that removes it', async () => {
    const user = userEvent.setup();
    const { router } = await openList('/strive/clubs?ownerId=user-ada');
    expect(lastList().get('ownerId')).toBe('user-ada');

    await user.click(screen.getByRole('button', { name: 'Remove filter Owner: user-ada' }));

    await waitFor(() => expect(router.state.location.search).toBe(''));
  });
});

describe('resource list: empty', () => {
  it('says nothing matches, and clears the search and filters', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/strive/clubs?query=zzz', { token: FAKE_TOKEN });

    expect(await screen.findByText('No clubs match.')).toBeInTheDocument();
    await user.click(within(table()).getByRole('button', { name: 'Clear search and filters' }));

    await waitFor(() => expect(router.state.location.search).toBe(''));
  });

  it('says a resource has no records yet', async () => {
    fake.records.sessions = [];
    renderApp('/strive/sessions', { token: FAKE_TOKEN });

    expect(await screen.findByText('No sessions yet.')).toBeInTheDocument();
  });
});

describe('resource list: errors', () => {
  it('offers to reset a table whose link sorts by a field the product refuses', async () => {
    serveFake({ rejectSortBy: ['name'] });
    const user = userEvent.setup();
    const { router } = renderApp('/strive/clubs?sortBy=name', { token: FAKE_TOKEN });

    expect(await screen.findByRole('heading', { name: "Couldn't load clubs." })).toBeInTheDocument();
    expect(screen.getByText('Invalid query parameter: sortBy')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reset the table' }));

    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(await screen.findByRole('link', { name: 'Lagos Runners' })).toBeInTheDocument();
  });

  it("says the product didn't answer, and tries again", async () => {
    let down = true;
    // While down, every list request fails at the network; after, it falls through to the fake.
    server.use(
      http.get(`${STRIVE}/api/admin/clubs`, () => (down ? HttpResponse.error() : undefined)),
    );
    const user = userEvent.setup();
    renderApp('/strive/clubs', { token: FAKE_TOKEN });

    expect(await screen.findByRole('heading', { name: "Couldn't load clubs." })).toBeInTheDocument();
    expect(screen.getByText("Strive didn't answer.")).toBeInTheDocument();

    down = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('link', { name: 'Lagos Runners' })).toBeInTheDocument();
  });
});

describe('resource list: creating', () => {
  it('creates a record in the modal over the table, then offers to view it', async () => {
    const user = userEvent.setup();
    const { router } = await openList();

    await user.click(screen.getByRole('button', { name: 'New club' }));
    const dialog = await screen.findByRole('dialog', { name: 'New club' });

    // Over the table, not a page of its own.
    expect(screen.getByRole('table', { name: 'Clubs', hidden: true })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/strive/clubs');
    expect(router.state.location.search).toBe('');

    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'Night Owls');
    const owner = within(dialog).getByRole('combobox', { name: /^Owner/ });
    await user.click(owner);
    await user.paste('user-ada');
    await user.tab();
    await user.click(within(dialog).getByRole('button', { name: 'Create club' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New club' })).toBeNull());
    const post = only(sent('POST'));
    expect(post.path).toBe('/api/admin/clubs');
    // The checkbox shows unticked, so its false is sent.
    expect(post.body).toEqual({ name: 'Night Owls', ownerId: 'user-ada', isPublic: false });

    expect(await screen.findByText('Club created.')).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Clubs 46' }),
    ).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'View' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/strive/clubs/fake-1'));
  });
});

describe('resource list: editing', () => {
  it('saves only the changed field and returns focus to the row', async () => {
    const user = userEvent.setup();
    await openList();

    await openRowMenu(user, 'Lagos Runners');
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit club' });

    const name = within(dialog).getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Lagos Night Runners');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit club' })).toBeNull());
    const put = only(sent('PUT'));
    expect(put.path).toBe('/api/admin/clubs/club-01');
    expect(put.body).toEqual({ name: 'Lagos Night Runners' });
    expect(await screen.findByText('Saved.')).toBeInTheDocument();

    const link = await screen.findByRole('link', { name: 'Lagos Night Runners' });
    await waitFor(() => expect(link).toHaveFocus());
  });

  it("keeps the modal open with the product's 422 under its field", async () => {
    server.use(
      http.put(`${STRIVE}/api/admin/clubs/:key`, () =>
        HttpResponse.json({ message: 'name: Too short' }, { status: 422, headers: CORS }),
      ),
    );
    const user = userEvent.setup();
    await openList();

    await openRowMenu(user, 'Lagos Runners');
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit club' });

    const name = within(dialog).getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'L');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(name).toHaveAccessibleDescription('Too short'));
    expect(screen.getByRole('dialog', { name: 'Edit club' })).toBeInTheDocument();
  });
});

describe('resource list: deleting', () => {
  async function confirmDeleteOf(user: UserEvent, title: string): Promise<HTMLElement> {

  it('keeps the modal open while a save is pending, so a failure shows in it', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.put(`${STRIVE}/api/admin/clubs/:key`, async () => {
        await gate;
        return HttpResponse.json({ message: 'name: Too short' }, { status: 422, headers: CORS });
      }),
    );
    const user = userEvent.setup();
    await openList();

    await openRowMenu(user, 'Lagos Runners');
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit club' });

    const name = within(dialog).getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'L');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await within(dialog).findByRole('button', { name: 'Saving…' })).toBeDisabled();

    // Escape, the Close button and Cancel all leave it open.
    await user.keyboard('{Escape}');
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('dialog', { name: 'Edit club' })).toBeInTheDocument();

    release();
    await waitFor(() => expect(name).toHaveAccessibleDescription('Too short'));
    expect(screen.getByRole('dialog', { name: 'Edit club' })).toBeInTheDocument();
  });
    await openRowMenu(user, title);
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: `Delete ${title}?` });
    await user.type(within(dialog).getByLabelText('Type delete to confirm'), 'delete');
    await user.click(within(dialog).getByRole('button', { name: 'Delete club' }));
    return dialog;
  }

  it('deletes the row once delete is typed and confirmed', async () => {
    const user = userEvent.setup();
    await openList();

    await confirmDeleteOf(user, 'Lagos Runners');

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Delete Lagos Runners?' })).toBeNull(),
    );
    expect(only(sent('DELETE')).path).toBe('/api/admin/clubs/club-01');
    expect(await screen.findByText('Deleted Lagos Runners.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Lagos Runners' })).toBeNull();
  });

  it('stays open, with the row, when other records still point at it', async () => {
    serveFake({ referenced: new Set(['club-01']) });
    const user = userEvent.setup();
    await openList();

    const dialog = await confirmDeleteOf(user, 'Lagos Runners');

    await waitFor(() =>
      expect(dialog).toHaveAccessibleDescription('Other records still point at this one'),
    );
    expect(only(sent('DELETE')).path).toBe('/api/admin/clubs/club-01');
    expect(screen.getByRole('dialog', { name: 'Delete Lagos Runners?' })).toBeInTheDocument();
    expect(rowsOf('clubs').some((r) => r._key === 'club-01')).toBe(true);
    expect(screen.getByRole('link', { name: 'Lagos Runners', hidden: true })).toBeInTheDocument();
  });
});

describe('resource list: sign-in records', () => {
  it('offers no New session, and View and Delete but no Edit', async () => {
    const user = userEvent.setup();
    await openList('/strive/sessions', 'ada@x.co');

    expect(screen.getByRole('heading', { level: 1, name: 'Sessions 2' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New session' })).toBeNull();

    await openRowMenu(user, 'ada@x.co');
    expect(await screen.findByRole('menuitem', { name: 'View' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Edit' })).toBeNull();
  });
});

describe('resource list: a huge value', () => {
  it('cuts a 5,000-character description to one line in its cell', async () => {
    const huge = 'x'.repeat(5000);
    const lagos = rowsOf('clubs').find((r) => r._key === 'club-01');
    if (!lagos) throw new Error('Lagos Runners is missing');
    lagos.description = huge;

    // The same manifest, with description as a column.
    const manifest = fakeManifest('strive');
    const clubs = manifest.resources.find((r) => r.key === 'clubs');
    if (!clubs) throw new Error('clubs is missing');
    clubs.columns = [...clubs.columns, 'description'];
    server.use(
      http.get(`${STRIVE}/api/admin`, () =>
        HttpResponse.json({ status: 200, message: 'OK', data: manifest }, { headers: CORS }),
      ),
    );

    await openList();

    expect(screen.getByText(huge).closest('td')).toHaveClass('truncate');
  });
});
