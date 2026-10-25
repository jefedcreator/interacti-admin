import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecordFormModal } from '@/components/record-form-modal';
import { productBySlug } from '@/config/products';
import { adminKeys } from '@/hooks/queries/keys';
import {
  useCreateRecordMutation,
  useUpdateRecordMutation,
} from '@/hooks/mutations/use-record-mutations';
import { AuthProvider, TOKEN_STORAGE_KEY, createQueryClient } from '@/provider';
import type { AdminFieldMeta, AdminRecord, AdminResourceMeta } from '@/types/admin';
import { AdminApiError } from '@/utils';
import { createFakeAdminApi } from '../fake-api/fake-admin-api';
import { FAKE_TOKEN, fakeManifest, fakeRecords } from '../fake-api/fixture';
import { adminHandlers, server } from '../fake-api/msw';

const STRIVE = 'https://strive.test';

function pick<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`${what} is missing`);
  return value;
}

const strive = pick(productBySlug('strive'), 'strive');
const clubs = pick(
  fakeManifest('strive').resources.find((r) => r.key === 'clubs'),
  'clubs',
);
const records = fakeRecords();
const lagos: AdminRecord = pick(
  records.clubs?.find((r) => r._key === 'club-01'),
  'Lagos Runners',
);
const ada: AdminRecord = pick(
  records.users?.find((r) => r.email === 'ada@x.co'),
  'ada',
);

type Props = Parameters<typeof RecordFormModal>[0];

let fake: ReturnType<typeof createFakeAdminApi>;

beforeEach(() => {
  fake = createFakeAdminApi({ token: FAKE_TOKEN, product: 'strive' });
  server.use(...adminHandlers(STRIVE, fake));
});

/** A client like the app's, without retry backoff. */
function testClient(): QueryClient {
  const client = createQueryClient();
  client.setDefaultOptions({
    ...client.getDefaultOptions(),
    queries: { ...client.getDefaultOptions().queries, retryDelay: 0 },
  });
  return client;
}

function withProviders(client: QueryClient, children: ReactNode) {
  return (
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}

function renderModal(props: Partial<Props> = {}) {
  sessionStorage.setItem(TOKEN_STORAGE_KEY, FAKE_TOKEN);
  const client = testClient();
  const onSubmit = vi.fn<(payload: Record<string, unknown>) => void>();
  const onOpenChange = vi.fn<(open: boolean) => void>();

  const ui = (overrides: Partial<Props>) =>
    withProviders(
      client,
      <RecordFormModal
        open
        onOpenChange={onOpenChange}
        product={strive}
        resource={clubs}
        onSubmit={onSubmit}
        isPending={false}
        error={null}
        {...props}
        {...overrides}
      />,
    );

  const view = render(ui({}));
  return {
    ...view,
    onSubmit,
    onOpenChange,
    rerender: (overrides: Partial<Props>) => view.rerender(ui(overrides)),
  };
}

/** Whether the picker asked the fake for users matching `query`. */
const searchedFor = (query: string): boolean =>
  fake.requests.some(
    (req) =>
      req.method === 'GET' &&
      req.path === '/api/admin/users' &&
      new URLSearchParams(req.search).get('query') === query,
  );

describe('RecordFormModal: create', () => {
  it("is named New club and says empty fields take Strive's default", () => {
    renderModal();

    const dialog = screen.getByRole('dialog', { name: 'New club' });
    expect(dialog).toHaveAccessibleDescription("Empty fields take Strive's default.");
  });

  it('labels optional fields and offers no read-only ones', () => {
    renderModal();

    expect(screen.getByRole('textbox', { name: 'Description (optional)' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Name \(optional\)/)).toBeNull();

    expect(screen.queryByLabelText(/Member count/)).toBeNull();
    expect(screen.queryByLabelText(/^Id\b/)).toBeNull();
    expect(screen.queryByLabelText(/Created at/)).toBeNull();
  });

  it('sends only the filled fields, with the owner chosen by search', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderModal();

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Night Owls');

    // The manifest labels `ownerId` "Owner id"; the picker is a combobox.
    const owner = screen.getByRole('combobox', { name: /^Owner/ });
    await user.type(owner, 'ada');
    expect(owner).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => expect(searchedFor('ada')).toBe(true));
    await user.click(await screen.findByRole('option', { name: 'ada@x.co' }));
    expect(owner).toHaveValue('ada@x.co');
    expect(owner).toHaveAttribute('aria-expanded', 'false');

    await user.click(screen.getByRole('checkbox', { name: 'Is public' }));
    await user.click(screen.getByRole('button', { name: 'Create club' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Night Owls',
      ownerId: ada._key,
      isPublic: true,
    });
  });

  it('shows each option with its key and chooses one with the keyboard', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderModal();

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Night Owls');
    const owner = screen.getByRole('combobox', { name: /^Owner/ });
    await user.type(owner, 'ada');
    await waitFor(() => expect(searchedFor('ada')).toBe(true));

    const option = await screen.findByRole('option', { name: 'ada@x.co' });
    expect(option).toHaveAccessibleDescription(ada._key);

    await user.keyboard('{ArrowDown}');
    expect(owner).toHaveAttribute('aria-activedescendant', option.id);
    await user.keyboard('{Enter}');
    expect(owner).toHaveValue('ada@x.co');

    await user.click(screen.getByRole('button', { name: 'Create club' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Night Owls', ownerId: ada._key });
  });

  it('keeps a pasted key as typed when the field is left', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderModal();

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Night Owls');
    const owner = screen.getByRole('combobox', { name: /^Owner/ });
    await user.click(owner);
    await user.paste('user-zed');
    await user.tab();

    expect(owner).toHaveValue('user-zed');
    await user.click(screen.getByRole('button', { name: 'Create club' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Night Owls', ownerId: 'user-zed' });
  });

  it('checks shape before sending anything', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Create club' }));

    const name = screen.getByRole('textbox', { name: 'Name' });
    await waitFor(() => expect(name).toHaveAccessibleDescription('Required'));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('RecordFormModal: edit', () => {
  it('is named Edit club, with the record filled in', () => {
    renderModal({ record: lagos });

    const dialog = screen.getByRole('dialog', { name: 'Edit club' });
    expect(dialog).toHaveAccessibleDescription('Only the fields you change are sent.');
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue('Lagos Runners');
    expect(screen.getByRole('combobox', { name: /^Owner/ })).toHaveValue('ada@x.co');
    expect(screen.getByRole('checkbox', { name: 'Is public' })).toBeChecked();
  });

  it('sends only the field that changed', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderModal({ record: lagos });

    const name = screen.getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Lagos Night Runners');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({ name: 'Lagos Night Runners' });
  });

  it('says there is nothing to save when nothing changed', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderModal({ record: lagos });

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    const dialog = screen.getByRole('dialog', { name: 'Edit club' });
    expect(await within(dialog).findByText('Nothing to save.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('uses the note in place of the description when the resource has one', () => {
    const note = 'Renaming a club renames it in the app straight away.';
    renderModal({ record: lagos, resource: { ...clubs, note } });

    expect(screen.getByRole('dialog', { name: 'Edit club' })).toHaveAccessibleDescription(note);
  });
});

describe('RecordFormModal: pending', () => {
  it('reads Saving… and is disabled while the save runs', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderModal({ isPending: true });

    const submit = screen.getByRole('button', { name: 'Saving…' });
    expect(submit).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Create club' })).toBeNull();

    await user.click(submit);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('RecordFormModal: errors', () => {
  it('puts a 422 about a field under that field', async () => {
    renderModal({
      record: lagos,
      error: new AdminApiError('invalid', 'name: Too short', 422, 'name'),
    });

    const name = screen.getByRole('textbox', { name: 'Name' });
    await waitFor(() => expect(name).toHaveAccessibleDescription('Too short'));
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('puts a 409 about a field under that field', async () => {
    renderModal({
      record: lagos,
      error: new AdminApiError('conflict', 'name: already in use', 409, 'name'),
    });

    const name = screen.getByRole('textbox', { name: 'Name' });
    await waitFor(() => expect(name).toHaveAccessibleDescription('already in use'));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows a 422 that names no field in the notice', () => {
    renderModal({ error: new AdminApiError('invalid', 'Expected object', 422) });

    const dialog = screen.getByRole('dialog', { name: 'New club' });
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Expected object');
  });

  it("says a record that's gone doesn't exist any more", () => {
    renderModal({
      record: lagos,
      error: new AdminApiError('not-found', 'Not found', 404),
    });

    const dialog = screen.getByRole('dialog', { name: 'Edit club' });
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      "This record doesn't exist any more.",
    );
  });
});

describe('RecordFormModal: closing', () => {
  it('closes from Cancel', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('closes from the Close button', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderModal();

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('RecordFormModal: a tall form', () => {
  type HappyWindow = { happyDOM?: { setViewport(size: { width: number; height: number }): void } };
  const happy = (window as unknown as HappyWindow).happyDOM;

  afterEach(() => {
    happy?.setViewport({ width: 1024, height: 768 });
  });

  it('scrolls inside the overlay, so the submit can always be reached', () => {
    happy?.setViewport({ width: 375, height: 375 });
    const fields: AdminFieldMeta[] = Array.from({ length: 20 }, (_, n) => ({
      name: `field${n + 1}`,
      label: `Field ${n + 1}`,
      type: 'string',
      list: false,
      required: false,
      nullable: true,
      readOnly: false,
      isId: false,
      enumValues: null,
      relation: null,
    }));
    const tall: AdminResourceMeta = { ...clubs, fields };
    renderModal({ resource: tall });

    const dialog = screen.getByRole('dialog', { name: 'New club' });
    expect(within(dialog).getAllByRole('textbox')).toHaveLength(20);

    // Modal.Portal's wrapper (the overlay) is the scroll container around the sheet.
    const overlay = dialog.parentElement;
    if (!overlay) throw new Error('the dialog has no overlay');
    expect(overlay).toHaveClass('fixed', 'inset-0', 'overflow-y-auto');

    // Nothing between the submit and the overlay clips it or scrolls on its own.
    const submit = within(dialog).getByRole('button', { name: 'Create club' });
    expect(overlay).toContainElement(submit);
    for (let node = submit.parentElement; node && node !== overlay; node = node.parentElement) {
      expect(node.className).not.toMatch(/\b(?:overflow-(?:y-)?(?:hidden|auto|scroll)|max-h-)/);
    }
  });
});

describe('useCreateRecordMutation and useUpdateRecordMutation', () => {
  function mount<T>(hook: () => T) {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, FAKE_TOKEN);
    const client = testClient();
    const wrapper = ({ children }: { children: ReactNode }) => withProviders(client, children);
    const view = renderHook(hook, { wrapper });
    return { client, ...view };
  }

  const params = { page: 1, size: 20, filters: {} };

  it('creates a record, then refreshes the lists and the manifest', async () => {
    const { client, result } = mount(() => useCreateRecordMutation('strive', 'clubs'));
    const listKey = adminKeys.list('strive', 'clubs', params);
    const manifestKey = adminKeys.manifest('strive');
    client.setQueryData(listKey, { data: [] });
    client.setQueryData(manifestKey, { resources: [] });

    let created: AdminRecord | undefined;
    await act(async () => {
      created = await result.current.mutateAsync({ name: 'Night Owls', ownerId: ada._key });
    });

    const sent = fake.requests.find((req) => req.method === 'POST');
    expect(sent?.path).toBe('/api/admin/clubs');
    expect(sent?.body).toEqual({ name: 'Night Owls', ownerId: ada._key });
    expect(created?._key).toBe('fake-1');
    expect(client.getQueryState(listKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(manifestKey)?.isInvalidated).toBe(true);
  });

  it('updates a record by key, then refreshes the lists, the record and the manifest', async () => {
    const { client, result } = mount(() => useUpdateRecordMutation('strive', 'clubs'));
    const listKey = adminKeys.list('strive', 'clubs', params);
    const detailKey = adminKeys.detail('strive', 'clubs', lagos._key);
    const manifestKey = adminKeys.manifest('strive');
    client.setQueryData(listKey, { data: [lagos] });
    client.setQueryData(detailKey, lagos);
    client.setQueryData(manifestKey, { resources: [] });

    await act(async () => {
      await result.current.mutateAsync({
        key: lagos._key,
        body: { name: 'Lagos Night Runners' },
      });
    });

    const sent = fake.requests.find((req) => req.method === 'PUT');
    expect(sent?.path).toBe(`/api/admin/clubs/${lagos._key}`);
    expect(sent?.body).toEqual({ name: 'Lagos Night Runners' });
    expect(fake.records.clubs?.find((r) => r._key === lagos._key)?.name).toBe(
      'Lagos Night Runners',
    );
    expect(client.getQueryState(listKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(detailKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(manifestKey)?.isInvalidated).toBe(true);
  });

  it('keeps the product message on a refused save', async () => {
    const { result } = mount(() => useUpdateRecordMutation('strive', 'clubs'));

    await act(async () => {
      await result.current
        .mutateAsync({ key: lagos._key, body: { memberCount: 9 } })
        .catch(() => undefined);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.kind).toBe('invalid');
    expect(result.current.error?.message).toBe('memberCount: Unrecognized key');
    expect(result.current.error?.field).toBe('memberCount');
  });
});
