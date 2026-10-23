import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeleteModal } from '@/components/delete-modal';
import { adminKeys } from '@/hooks/queries/keys';
import { useDeleteRecordMutation } from '@/hooks/mutations/use-record-mutations';
import { AuthProvider, TOKEN_STORAGE_KEY, createQueryClient } from '@/provider';
import type { AdminRecord, AdminResourceMeta } from '@/types/admin';
import { AdminApiError } from '@/utils';
import { createFakeAdminApi } from '../fake-api/fake-admin-api';
import { FAKE_TOKEN, fakeManifest } from '../fake-api/fixture';
import { adminHandlers, server } from '../fake-api/msw';

const STRIVE = 'https://strive.test';

const clubs = fakeManifest('strive').resources.find((r) => r.key === 'clubs') as AdminResourceMeta;

const lagos: AdminRecord = {
  id: 'club-01',
  name: 'Lagos Runners',
  _key: 'club-01',
  _title: 'Lagos Runners',
  _refs: {},
};

const DESCRIPTION = "This can't be undone. Records that belong to it may be deleted with it.";

type Props = Partial<Parameters<typeof DeleteModal>[0]>;

function modal(props: Props = {}) {
  return (
    <DeleteModal
      open
      resource={clubs}
      record={lagos}
      onOpenChange={() => {}}
      onConfirm={() => {}}
      isPending={false}
      error={null}
      {...props}
    />
  );
}

const confirmField = () => screen.getByLabelText('Type delete to confirm');

describe('DeleteModal', () => {
  it('is named after the record and says it cannot be undone', () => {
    render(modal());

    const dialog = screen.getByRole('dialog', { name: 'Delete Lagos Runners?' });
    expect(dialog).toHaveAccessibleDescription(DESCRIPTION);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('keeps Delete club disabled until the field reads delete, whatever the case or spacing', async () => {
    const user = userEvent.setup();
    render(modal());
    const button = screen.getByRole('button', { name: 'Delete club' });

    expect(button).toBeDisabled();

    await user.type(confirmField(), 'delet');
    expect(button).toBeDisabled();

    await user.type(confirmField(), 'e');
    expect(button).toBeEnabled();

    await user.clear(confirmField());
    await user.type(confirmField(), ' DELETE ');
    expect(button).toBeEnabled();

    await user.clear(confirmField());
    await user.type(confirmField(), 'delete it');
    expect(button).toBeDisabled();
  });

  it('calls onConfirm once when confirmed', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(modal({ onConfirm }));

    await user.type(confirmField(), 'delete');
    await user.click(screen.getByRole('button', { name: 'Delete club' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('reads Deleting… while pending, stays disabled and ignores a second click', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const { rerender } = render(modal({ onConfirm }));

    await user.type(confirmField(), 'delete');
    await user.click(screen.getByRole('button', { name: 'Delete club' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    rerender(modal({ onConfirm, isPending: true }));
    const pending = screen.getByRole('button', { name: 'Deleting…' });
    expect(pending).toBeDisabled();

    await user.click(pending);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("puts the product's message in place of the description and stays open", () => {
    const error = new AdminApiError('conflict', 'Other records still point at this one', 409);
    render(modal({ error }));

    const dialog = screen.getByRole('dialog', { name: 'Delete Lagos Runners?' });
    expect(dialog).toHaveAccessibleDescription('Other records still point at this one');
    expect(screen.queryByText(DESCRIPTION)).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete club' })).toBeInTheDocument();
  });

  it('closes from Cancel', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(modal({ onOpenChange }));

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('starts with an empty field each time it opens', async () => {
    const user = userEvent.setup();
    const { rerender } = render(modal());

    await user.type(confirmField(), 'delete');
    rerender(modal({ open: false }));
    rerender(modal({ open: true }));

    expect(confirmField()).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Delete club' })).toBeDisabled();
  });
});

describe('useDeleteRecordMutation', () => {
  let fake: ReturnType<typeof createFakeAdminApi>;

  beforeEach(() => {
    fake = createFakeAdminApi({ token: FAKE_TOKEN, product: 'strive' });
    server.use(...adminHandlers(STRIVE, fake));
  });

  function mount() {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, FAKE_TOKEN);
    const client = createQueryClient();
    client.setDefaultOptions({
      ...client.getDefaultOptions(),
      queries: { ...client.getDefaultOptions().queries, retryDelay: 0 },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    );
    const view = renderHook(() => useDeleteRecordMutation('strive', 'clubs'), { wrapper });
    return { client, ...view };
  }

  it('deletes the record, refreshes the lists and the manifest, and drops the detail', async () => {
    const { client, result } = mount();
    const params = { page: 1, size: 20, filters: {} };
    const listKey = adminKeys.list('strive', 'clubs', params);
    const manifestKey = adminKeys.manifest('strive');
    const detailKey = adminKeys.detail('strive', 'clubs', 'club-01');
    client.setQueryData(listKey, { data: [lagos] });
    client.setQueryData(manifestKey, { resources: [] });
    client.setQueryData(detailKey, lagos);
    expect(client.getQueryState(listKey)?.isInvalidated).toBe(false);

    await act(async () => {
      await result.current.mutateAsync({ key: 'club-01', title: 'Lagos Runners' });
    });

    const sent = fake.requests.find((req) => req.method === 'DELETE');
    expect(sent?.path).toBe('/api/admin/clubs/club-01');
    expect(fake.records.clubs?.some((r) => r._key === 'club-01')).toBe(false);
    expect(client.getQueryState(listKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(manifestKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(detailKey)).toBeUndefined();
  });
});
