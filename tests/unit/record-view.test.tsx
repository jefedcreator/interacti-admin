import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AdminRecord } from '@/types/admin';
import { createFakeAdminApi, type FakeAdminApi } from '../fake-api/fake-admin-api';
import { FAKE_TOKEN } from '../fake-api/fixture';
import { adminHandlers, server } from '../fake-api/msw';
import { renderApp } from './render';

const STRIVE = 'https://strive.test';
const LAGOS = 'club-01';
const ADA = 'user-ada';

let fake: FakeAdminApi;

beforeEach(() => {
  fake = createFakeAdminApi({ token: FAKE_TOKEN, product: 'strive' });
  server.use(...adminHandlers(STRIVE, fake));
});

/** Lagos Runners as the fake serves it, so a test can change it first. */
function lagos(): AdminRecord {
  const record = fake.records.clubs?.find((r) => r._key === LAGOS);
  if (!record) throw new Error('Lagos Runners is missing');
  return record;
}

/** The `<dd>` beside the `<dt>` that reads `label`, in the view's `<dl>`. */
function valueOf(view: HTMLElement, label: string): HTMLElement {
  const list = view.querySelector('dl');
  if (!list) throw new Error('the view has no <dl>');
  const term = within(list).getByText(label, { selector: 'dt' });
  const value = term.nextElementSibling;
  if (!(value instanceof HTMLElement) || value.tagName !== 'DD') {
    throw new Error(`no <dd> beside ${label}`);
  }
  return value;
}

/** Opens a view straight from its URL, as a shared link would, and waits for it by its title. */
async function openView(path: string, title: string) {
  const rendered = renderApp(path);
  const view = await screen.findByRole('dialog', { name: title });
  return { ...rendered, view };
}

/** Opens the table at `path`, then the view of the row titled `title` from the row's link. */
async function openFromTable(user: UserEvent, path: string, title: string) {
  const rendered = renderApp(path);
  await user.click(await screen.findByRole('link', { name: title }));
  const view = await screen.findByRole('dialog', { name: title });
  return { ...rendered, view };
}

describe('record view: a club', () => {
  it('shows the eyebrow, the title, every field as a row, and Edit and Delete', async () => {
    // The fixture's Lagos Runners is public; it's private here, so "Is public" reads No.
    lagos().isPublic = false;
    const { view } = await openView(`/strive/clubs/${LAGOS}`, 'Lagos Runners');

    expect(view).toHaveClass('sm:max-w-[640px]');
    expect(within(view).getByText('Strive · Clubs')).toBeInTheDocument();
    expect(within(view).getByRole('button', { name: 'Close' })).toBeInTheDocument();
    const handle = Array.from(view.querySelectorAll('[aria-hidden="true"]')).find((el) =>
      el.classList.contains('sm:hidden'),
    );
    expect(handle).toBeDefined();

    const owner = within(valueOf(view, 'Owner')).getByRole('link', { name: 'ada@x.co' });
    expect(owner).toHaveAttribute('href', `/strive/users/${ADA}`);
    expect(valueOf(view, 'Is public').textContent).toBe('No');
    expect(valueOf(view, 'Member count').textContent).toBe('3');
    // Read-only, and shown all the same.
    expect(valueOf(view, 'Created at')).toHaveTextContent('2026');

    expect(within(view).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(within(view).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });
});

describe('record view: related lists', () => {
  it('links each related list, already filtered to the record', async () => {
    const { view } = await openView(`/strive/users/${ADA}`, 'ada@x.co');

    const clubs = within(view).getByRole('link', { name: 'Clubs' });
    expect(clubs).toHaveTextContent('Clubs →');
    expect(clubs).toHaveAttribute('href', `/strive/clubs?ownerId=${ADA}`);

    const sessions = within(view).getByRole('link', { name: 'Sessions' });
    expect(sessions).toHaveTextContent('Sessions →');
    expect(sessions).toHaveAttribute('href', `/strive/sessions?userId=${ADA}`);
  });
});

describe('record view: Edit and Delete', () => {
  it('closes for Edit, back to the search behind it, then opens the one edit modal', async () => {
    const user = userEvent.setup();
    const { router, view } = await openFromTable(
      user,
      '/strive/clubs?isPublic=true',
      'Lagos Runners',
    );
    // The table behind the view keeps its filter.
    expect(router.state.location.pathname).toBe(`/strive/clubs/${LAGOS}`);
    expect(router.state.location.search).toBe('?isPublic=true');

    await user.click(within(view).getByRole('button', { name: 'Edit' }));

    const form = await screen.findByRole('dialog', { name: 'Edit club' });
    expect(router.state.location.pathname).toBe('/strive/clubs');
    expect(router.state.location.search).toBe('?isPublic=true');
    expect(screen.getAllByRole('dialog', { hidden: true })).toHaveLength(1);
    expect(within(form).getByRole('textbox', { name: 'Name' })).toHaveValue('Lagos Runners');
  });

  it('closes for Delete, then opens the one delete modal', async () => {
    const user = userEvent.setup();
    const { router, view } = await openView(`/strive/clubs/${LAGOS}`, 'Lagos Runners');

    await user.click(within(view).getByRole('button', { name: 'Delete' }));

    await screen.findByRole('dialog', { name: 'Delete Lagos Runners?' });
    expect(router.state.location.pathname).toBe('/strive/clubs');
    expect(router.state.location.search).toBe('');
    expect(screen.getAllByRole('dialog', { hidden: true })).toHaveLength(1);
  });
});

describe('record view: closing', () => {
  it('closes on Escape, to the table', async () => {
    const user = userEvent.setup();
    const { router } = await openView(`/strive/clubs/${LAGOS}`, 'Lagos Runners');

    await user.keyboard('{Escape}');

    await waitFor(() => expect(router.state.location.pathname).toBe('/strive/clubs'));
    expect(router.state.location.search).toBe('');
    // Nothing of the table's is behind it in history, so the table takes the view's place.
    expect(router.state.historyAction).toBe('REPLACE');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('closes from the Close button, to the table', async () => {
    const user = userEvent.setup();
    const { router, view } = await openView(`/strive/clubs/${LAGOS}`, 'Lagos Runners');

    await user.click(within(view).getByRole('button', { name: 'Close' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/strive/clubs'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('goes back to the page of the table it came from, with focus on the row', async () => {
    const user = userEvent.setup();
    const { router } = await openFromTable(user, '/strive/clubs?page=2', 'Club 21');
    expect(router.state.location.pathname).toBe('/strive/clubs/club-21');
    expect(router.state.location.search).toBe('?page=2');

    await user.keyboard('{Escape}');

    await waitFor(() => expect(router.state.location.pathname).toBe('/strive/clubs'));
    expect(router.state.location.search).toBe('?page=2');
    // A step back to the table's own entry, not a new one.
    expect(router.state.historyAction).toBe('POP');
    await waitFor(() => expect(screen.getByRole('link', { name: 'Club 21' })).toHaveFocus());
    expect(document.activeElement).toHaveAttribute('data-record-link', 'club-21');
  });
});

describe('record view: a session', () => {
  it('offers Delete but no Edit', async () => {
    const { view } = await openView('/strive/sessions/session-1', 'ada@x.co');

    expect(within(view).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(within(view).queryByRole('button', { name: 'Edit' })).toBeNull();
  });
});

describe('record view: a huge value', () => {
  it('wraps JSON 200 keys deep inside the panel', async () => {
    let settings: Record<string, unknown> = { leaf: true };
    for (let depth = 200; depth >= 1; depth -= 1) settings = { [`key${depth}`]: settings };
    lagos().settings = settings;

    const { view } = await openView(`/strive/clubs/${LAGOS}`, 'Lagos Runners');

    const pre = valueOf(view, 'Settings').querySelector('pre');
    expect(pre).not.toBeNull();
    expect(pre).toHaveClass('whitespace-pre-wrap');
    expect(pre?.textContent).toBe(JSON.stringify(settings, null, 2));
  });
});

describe('record view: a missing record', () => {
  it("says it doesn't exist any more, with a way back to the table", async () => {
    const user = userEvent.setup();
    const { router, view } = await openView(
      '/strive/clubs/gone',
      "This record doesn't exist any more.",
    );

    await user.click(within(view).getByRole('button', { name: 'Back to clubs' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/strive/clubs'));
  });
});
