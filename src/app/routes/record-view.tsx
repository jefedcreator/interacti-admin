import { useRef, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useOutletContext, useParams } from 'react-router';
import type { RecordViewState } from '@/components/columns';
import { FieldValue } from '@/components/field-value';
import { productBySlug, type ProductConfig } from '@/config/products';
import { NOT_FOUND_MESSAGE } from '@/forms/fields';
import { useManifestQuery } from '@/hooks/queries/use-manifest';
import { useRecordQuery } from '@/hooks/queries/use-record';
import { Button, Modal, Skeleton } from '@/primitives';
import type { AdminResourceMeta } from '@/types/admin';
import { createUrl, displayLabel } from '@/utils';
import { causeOf, type ListOutletContext } from './resource-list';

/** One label/value row, on a hairline. The value's column can shrink, so long values wrap. */
const rowClasses =
  'grid gap-1 border-b border-ink/10 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:gap-4';

interface RecordModalProps {
  product: ProductConfig;
  resource: AdminResourceMeta;
  /** The product's resources, which name the related lists. */
  resources: AdminResourceMeta[];
  recordKey: string;
}

/**
 * A record in the shared modal over its table (spec §8.3): the eyebrow, the title, the note, every
 * exposed field as a label/value row, the related lists, and Edit and Delete where `can` allows.
 * Edit and Delete close the view before the list page opens their modal, so one modal is open.
 */
function RecordModal({ product, resource, resources, recordKey }: RecordModalProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { openEditor, confirmDelete, returnFocusTo } = useOutletContext<ListOutletContext>();
  const query = useRecordQuery(product.slug, resource.key, recordKey);

  /** The history entry being left, so a second Esc or click on the way out does nothing. */
  const leaving = useRef<string | null>(null);
  /** The modal to open once the view has gone: edit or delete. */
  const handoff = useRef<(() => void) | null>(null);

  const plural = resource.label.toLowerCase();
  const noun = resource.singular.toLowerCase();
  const fromList = (location.state as Partial<RecordViewState> | null)?.fromList === true;

  /**
   * Closes the view, then runs `then` once it has gone. One way back: a view opened from its table
   * (`viewFromList`) has the table's search in its URL and `fromList` in history state, so closing
   * steps back to that entry. Any other way in has no table behind it in history, so the table
   * replaces the view, with the search the view's URL carries. Not `useListParams`: it writes to
   * the current path, which is the view's.
   */
  function close(then?: () => void): void {
    if (leaving.current === location.key) return;
    leaving.current = location.key;
    handoff.current = then ?? null;
    if (fromList) {
      void navigate(-1);
    } else {
      void navigate(
        { pathname: `/${product.slug}/${resource.key}`, search: location.search },
        { replace: true },
      );
    }
  }

  /** Runs once the view has unmounted, however it went: Close, Esc, Back, Edit or Delete. */
  function afterClose(event: Event): void {
    const next = handoff.current;
    handoff.current = null;
    if (next) {
      // The view has let go of focus; the modal it hands over to takes it.
      event.preventDefault();
      next();
      return;
    }
    // Focus a dialog holds stays put: a view that replaced this one, or this one while StrictMode
    // replays its effects in development.
    if (document.activeElement?.closest('[role="dialog"]')) {
      event.preventDefault();
      return;
    }
    returnFocusTo(event, recordKey);
  }

  const record = query.data;
  const error = query.error;
  const gone = error?.kind === 'not-found';
  const loading = !gone && !record && !error;

  let body: ReactNode;
  if (gone) {
    body = (
      <>
        <Modal.Title className="mt-1.5">{NOT_FOUND_MESSAGE}</Modal.Title>
        <div className="mt-7">
          <Button variant="secondary" onClick={() => close()}>
            {`Back to ${plural}`}
          </Button>
        </div>
      </>
    );
  } else if (record) {
    const canAct = resource.can.update || resource.can.delete;
    body = (
      <>
        <Modal.Title className="mt-1.5 break-words">{record._title}</Modal.Title>
        {resource.note ? <Modal.Description>{resource.note}</Modal.Description> : null}

        <dl className="mt-6 border-t border-ink/10">
          {resource.fields.map((field) => (
            <div key={field.name} className={rowClasses}>
              <dt className="text-micro text-ink/80">{displayLabel(field)}</dt>
              <dd className="min-w-0 text-body">
                <FieldValue
                  product={product.slug}
                  field={field}
                  value={record[field.name]}
                  ref={record._refs[field.name] ?? null}
                  full
                />
              </dd>
            </div>
          ))}
        </dl>

        {resource.related.length > 0 ? (
          <div className="mt-6">
            <h3 className="text-micro text-ink/80">Related</h3>
            <ul className="mt-2 grid justify-items-start gap-2">
              {resource.related.map((related) => {
                const target = resources.find((r) => r.key === related.resource);
                const filter = new URLSearchParams({ [related.field]: record._key });
                return (
                  <li key={`${related.resource}.${related.field}`}>
                    <Link
                      to={createUrl(`/${product.slug}/${related.resource}`, filter)}
                      className="underline decoration-ink/30 underline-offset-4 hover:decoration-ink"
                    >
                      {target?.label ?? related.resource} <span aria-hidden="true">→</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {canAct ? (
          <div className="mt-7 grid gap-2.5 sm:flex sm:flex-row-reverse">
            {resource.can.update ? (
              <Button onClick={() => close(() => openEditor(record))}>Edit</Button>
            ) : null}
            {resource.can.delete ? (
              <Button variant="secondary" onClick={() => close(() => confirmDelete(record))}>
                Delete
              </Button>
            ) : null}
          </div>
        ) : null}
      </>
    );
  } else if (error) {
    const retry = error.kind === 'unreachable' || error.kind === 'server';
    body = (
      <>
        <Modal.Title className="mt-1.5">{`Couldn't load this ${noun}.`}</Modal.Title>
        <Modal.Description>{causeOf(product, error)}</Modal.Description>
        {retry ? (
          <div className="mt-7">
            <Button variant="secondary" onClick={() => void query.refetch()}>
              Try again
            </Button>
          </div>
        ) : null}
      </>
    );
  } else {
    body = (
      <>
        <Modal.Title className="mt-1.5">
          <span className="sr-only">Loading…</span>
          <Skeleton className="h-7 w-56 max-w-full" />
        </Modal.Title>
        <div className="mt-6 grid gap-3">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-2/3" />
        </div>
      </>
    );
  }

  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <Modal.Portal>
        <Modal.Content
          className="sm:max-w-[640px]"
          aria-busy={loading || undefined}
          onCloseAutoFocus={afterClose}
        >
          <Modal.Handle />
          <Modal.Dismiss />
          <p className="pr-10 text-micro text-ink/80">{`${product.name} · ${resource.label}`}</p>
          {body}
        </Modal.Content>
      </Modal.Portal>
    </Modal>
  );
}

/** The resource from the manifest, which the list above has already loaded. */
function RecordScreen({
  product,
  resourceKey,
  recordKey,
}: {
  product: ProductConfig;
  resourceKey: string;
  recordKey: string;
}) {
  const manifest = useManifestQuery(product.slug);
  const resources = manifest.data?.resources;
  const resource = resources?.find((r) => r.key === resourceKey);
  if (!resources || !resource) return null;
  return (
    <RecordModal
      product={product}
      resource={resource}
      resources={resources}
      recordKey={recordKey}
    />
  );
}

/**
 * `/:product/:resource/:key`, the list route's child, rendered in its Outlet over the table. React
 * Router hands the params over already decoded from the URL, so they're used as they come:
 * decoding a key a second time would break one with a `%` in it. The list only renders its Outlet
 * once the product and resource exist, so neither lookup misses in practice.
 */
export function RecordView() {
  const { product: slug = '', resource: resourceKey = '', key = '' } = useParams();
  const product = productBySlug(slug);
  if (!product) return null;
  return <RecordScreen product={product} resourceKey={resourceKey} recordKey={key} />;
}
