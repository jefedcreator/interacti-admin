import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { buildColumns, recordPath } from '@/components/columns';
import { DataTable } from '@/components/data-table';
import { DeleteModal } from '@/components/delete-modal';
import { Pagination } from '@/components/pagination';
import { RecordFormModal } from '@/components/record-form-modal';
import { StateMessage } from '@/components/state-message';
import { CLEAR_LABEL, TableToolbar } from '@/components/table-toolbar';
import { productBySlug, type ProductConfig } from '@/config/products';
import {
  useCreateRecordMutation,
  useDeleteRecordMutation,
  useUpdateRecordMutation,
} from '@/hooks/mutations/use-record-mutations';
import { useManifestQuery } from '@/hooks/queries/use-manifest';
import { useRecordsQuery } from '@/hooks/queries/use-records';
import { useListParams } from '@/hooks/use-list-params';
import { Button, Skeleton } from '@/primitives';
import type { AdminRecord, AdminResourceMeta } from '@/types/admin';
import { cn, describeConnection, fixFor, formatCount, type AdminApiError } from '@/utils';
import { NotFoundPage } from './not-found';

/** What the record view (the `:key` child route) asks of the list page that owns the modals. */
export type ListOutletContext = {
  openEditor(record?: AdminRecord): void;
  confirmDelete(record: AdminRecord): void;
};

/** The create/edit modal's opening: a fresh key each time, and the record when editing. */
type Editing = { key: number; record?: AdminRecord };
/** The delete modal's opening. The record stays after closing, so the title holds as it leaves. */
type Removing = { key: number; record: AdminRecord | null };

const NO_RECORDS: AdminRecord[] = [];

const pageClasses = 'px-[var(--gutter)] py-10 lg:py-14';
const titleClasses = 'text-large leading-none font-medium tracking-[-0.02em] break-words';

/** The sentence after "Couldn't load …": who didn't answer or said no, or the product's own words. */
function causeOf(product: ProductConfig, error: AdminApiError): string {
  switch (error.kind) {
    case 'unreachable':
    case 'server':
      return `${product.name} didn't answer.`;
    case 'unauthorized':
      return `${product.name} didn't accept this token.`;
    default:
      return error.message;
  }
}

/** The row's title link for a record key. Keys are opaque, so they're compared, never put in a selector. */
function recordLinkIn(root: HTMLElement | null, key: string): HTMLElement | null {
  if (!root) return null;
  for (const node of root.querySelectorAll<HTMLElement>('[data-record-link]')) {
    if (node.dataset.recordLink === key) return node;
  }
  return null;
}

interface ResourceListProps {
  product: ProductConfig;
  resource: AdminResourceMeta;
}

/**
 * One resource's table, with the modals over it. As Sara's ServicesPageClient, the page owns the
 * create/edit modal, the delete modal and the three mutations; the modals only show and ask.
 */
function ResourceList({ product, resource }: ResourceListProps) {
  const navigate = useNavigate();
  const { search } = useLocation();
  const { params, setParam, setParams, reset } = useListParams(resource);
  const list = useRecordsQuery(product.slug, resource.key, params);

  const create = useCreateRecordMutation(product.slug, resource.key);
  const update = useUpdateRecordMutation(product.slug, resource.key);
  const remove = useDeleteRecordMutation(product.slug, resource.key);
  const { reset: resetCreate } = create;
  const { reset: resetUpdate } = update;
  const { reset: resetRemove } = remove;

  // Each modal stays mounted while it animates out; `key` gives each opening a fresh one, and
  // `open` is separate so closing keeps the record it was about.
  const [editing, setEditing] = useState<Editing>({ key: 0 });
  const [formOpen, setFormOpen] = useState(false);
  const [removing, setRemoving] = useState<Removing>({ key: 0, record: null });
  const [deleteOpen, setDeleteOpen] = useState(false);

  const pageRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const plural = resource.label.toLowerCase();

  const openEditor = useCallback(
    (record?: AdminRecord) => {
      resetCreate();
      resetUpdate();
      setEditing((prev) => ({ key: prev.key + 1, record }));
      setFormOpen(true);
    },
    [resetCreate, resetUpdate],
  );

  const confirmDelete = useCallback(
    (record: AdminRecord) => {
      resetRemove();
      setRemoving((prev) => ({ key: prev.key + 1, record }));
      setDeleteOpen(true);
    },
    [resetRemove],
  );

  const columns = useMemo(
    () =>
      buildColumns({ product: product.slug, resource, onEdit: openEditor, onDelete: confirmDelete }),
    [product.slug, resource, openEditor, confirmDelete],
  );

  const outletContext = useMemo<ListOutletContext>(
    () => ({ openEditor, confirmDelete }),
    [openEditor, confirmDelete],
  );

  const saving = editing.record ? update : create;

  function save(payload: Record<string, unknown>): void {
    const current = editing.record;
    if (current) {
      update.mutate(
        { key: current._key, body: payload },
        {
          onSuccess: () => {
            setFormOpen(false);
            toast('Saved.');
          },
        },
      );
      return;
    }

    const fromList = search;
    create.mutate(payload, {
      onSuccess: (created) => {
        setFormOpen(false);
        toast(`${resource.singular} created.`, {
          action: {
            label: 'View',
            onClick: () =>
              void navigate(recordPath(product.slug, resource.key, created._key), {
                state: { fromList },
              }),
          },
        });
      },
    });
  }

  function deleteRecord(): void {
    const record = removing.record;
    if (!record || remove.isPending) return;
    remove.mutate(
      { key: record._key, title: record._title },
      {
        onSuccess: (_data, { title }) => {
          setDeleteOpen(false);
          toast(`Deleted ${title}.`);
        },
      },
    );
  }

  /** Puts focus where the modal came from, or on the page's title when that has gone. */
  function returnFocus(event: Event, target: HTMLElement | null): void {
    const element = target ?? headingRef.current;
    if (!element) return;
    event.preventDefault();
    element.focus();
  }

  function cycleSort(field: string): void {
    // Ascending, then descending, then the resource's default.
    if (params.sortBy !== field) setParams({ sortBy: field, sortOrder: 'asc' });
    else if ((params.sortOrder ?? 'asc') === 'asc') setParams({ sortBy: field, sortOrder: 'desc' });
    else setParams({ sortBy: null, sortOrder: null });
  }

  // The order the rows are in: the one asked for, or the resource's default.
  const sort: { by?: string; order?: 'asc' | 'desc' } = params.sortBy
    ? { by: params.sortBy, order: params.sortOrder ?? 'asc' }
    : { by: resource.defaultSort.by, order: resource.defaultSort.order };

  const narrowed =
    params.query !== undefined || Object.keys(params.filters).length > 0 || params.page > 1;

  const empty = narrowed ? (
    <StateMessage
      title={`No ${plural} match.`}
      action={
        <Button variant="secondary" onClick={reset}>
          {CLEAR_LABEL}
        </Button>
      }
    />
  ) : (
    <StateMessage title={`No ${plural} yet.`} />
  );

  // A failed refresh of a page already shown keeps the page; only a page that never came is an error.
  const failure = list.data ? null : list.error;

  let content: ReactNode;
  if (failure) {
    let action: ReactNode;
    if (failure.kind === 'unreachable' || failure.kind === 'server') {
      action = (
        <Button variant="secondary" onClick={() => void list.refetch()}>
          Try again
        </Button>
      );
    } else if (failure.kind === 'invalid') {
      // A 422 on the list's own parameters, such as a stale sortBy in an old link.
      action = (
        <Button variant="secondary" onClick={reset}>
          Reset the table
        </Button>
      );
    }
    content = (
      <StateMessage
        title={`Couldn't load ${plural}.`}
        detail={causeOf(product, failure)}
        action={action}
      />
    );
  } else {
    content = (
      <>
        <DataTable
          columns={columns}
          data={list.data?.data ?? NO_RECORDS}
          sort={sort}
          sortable={resource.sortable}
          onSort={cycleSort}
          isLoading={list.isPending}
          empty={empty}
          caption={resource.label}
          getRowId={(record) => record._key}
        />
        {list.data ? (
          <div className="mt-6">
            <Pagination
              totalCount={list.data.total}
              pageSize={params.size}
              currentPage={params.page}
              onPageChange={(page) => setParam('page', page > 1 ? String(page) : null)}
            />
          </div>
        ) : null}
      </>
    );
  }

  return (
    <section ref={pageRef} className={pageClasses}>
      <header className="grid justify-items-start gap-4">
        <p className="text-micro text-ink/50">{`${product.name} · ${resource.group}`}</p>
        {/* Focus lands here when the row a modal was about has gone. */}
        <h1 ref={headingRef} tabIndex={-1} className={cn(titleClasses, 'outline-none')}>
          {resource.label}{' '}
          <span className="text-ink/50 tabular-nums">{formatCount(resource.count)}</span>
        </h1>
        {resource.note ? (
          <p className="max-w-prose text-body text-pretty text-ink/80">{resource.note}</p>
        ) : null}
      </header>

      <div className="mt-10">
        <TableToolbar
          resource={resource}
          params={params}
          onSearch={(value) => setParam('query', value)}
          onFilter={setParam}
          onClear={reset}
          onCreate={resource.can.create ? () => openEditor() : null}
        />
      </div>

      <div className="mt-6" aria-busy={list.isFetching || undefined}>
        {content}
      </div>

      {/* The record view (Task 10) opens over the table as this route's child. */}
      <Outlet context={outletContext} />

      <RecordFormModal
        key={editing.key}
        open={formOpen}
        onOpenChange={setFormOpen}
        product={product}
        resource={resource}
        record={editing.record}
        onSubmit={save}
        isPending={saving.isPending}
        error={saving.error}
        onCloseAutoFocus={(event) => {
          const key = editing.record?._key;
          returnFocus(
            event,
            key === undefined
              ? (pageRef.current?.querySelector<HTMLElement>('[data-new-record]') ?? null)
              : recordLinkIn(pageRef.current, key),
          );
        }}
      />

      <DeleteModal
        key={removing.key}
        open={deleteOpen}
        onOpenChange={(open) => {
          // A delete on its way can't be walked away from.
          if (!open && remove.isPending) return;
          setDeleteOpen(open);
        }}
        resource={resource}
        record={removing.record}
        onConfirm={deleteRecord}
        isPending={remove.isPending}
        error={remove.error}
        onCloseAutoFocus={(event) => {
          const key = removing.record?._key;
          returnFocus(event, key === undefined ? null : recordLinkIn(pageRef.current, key));
        }}
      />
    </section>
  );
}

/** The manifest first: it says which resources exist and what their tables hold. */
function ResourceScreen({ product, resourceKey }: { product: ProductConfig; resourceKey: string }) {
  const manifest = useManifestQuery(product.slug);

  if (manifest.data) {
    const resource = manifest.data.resources.find((r) => r.key === resourceKey);
    if (!resource) return <NotFoundPage />;
    return (
      <ResourceList key={`${product.slug}/${resource.key}`} product={product} resource={resource} />
    );
  }

  if (product.connection.state === 'ready' && manifest.isLoading) {
    return (
      <section aria-busy="true" className={pageClasses}>
        <div aria-hidden="true" className="grid gap-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-12 w-56" />
          <Skeleton className="mt-6 h-11 w-full max-w-80" />
          <Skeleton className="mt-4 h-64 w-full" />
        </div>
      </section>
    );
  }

  const { error } = manifest;
  const retry = error?.kind === 'unreachable' || error?.kind === 'server';
  return (
    <section className={pageClasses}>
      <StateMessage
        title={describeConnection(product, {
          data: manifest.data,
          error,
          isLoading: manifest.isLoading,
        })}
        detail={fixFor(product, error) ?? (error ? causeOf(product, error) : undefined)}
        action={
          retry ? (
            <Button variant="secondary" onClick={() => void manifest.refetch()}>
              Try again
            </Button>
          ) : undefined
        }
      />
    </section>
  );
}

/** `/:product/:resource`. A product or resource the app doesn't know is the not-found page. */
export function ResourceListPage() {
  const { product: slug = '', resource: resourceKey = '' } = useParams();
  const product = productBySlug(slug);

  if (!product) return <NotFoundPage />;
  return <ResourceScreen product={product} resourceKey={resourceKey} />;
}
