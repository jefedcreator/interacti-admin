import type { ColumnDef } from '@tanstack/react-table';
import { Link, useLocation, type To } from 'react-router';
import type { ProductSlug } from '@/config/products';
import { Button, Menu, MenuContent, MenuItem, MenuTrigger } from '@/primitives';
import type { AdminRecord, AdminResourceMeta } from '@/types/admin';
import { FieldValue } from './field-value';

/** Where a record's view lives: the table's path and the record's opaque key, encoded. */
export function recordPath(product: ProductSlug, resource: string, key: string): string {
  return `/${product}/${resource}/${encodeURIComponent(key)}`;
}

/** The history state of a view opened from its own table. */
export type RecordViewState = { fromList: true };

/**
 * A record's view, opened from its own table. The table's search goes along in the URL, so the
 * page, sort and filters behind the view stay put; `fromList` marks the table as the entry before
 * it, so closing steps back to it (`close` in record-view.tsx).
 */
export function viewFromList(
  product: ProductSlug,
  resource: string,
  key: string,
  search: string,
): { to: To; state: RecordViewState } {
  return {
    to: { pathname: recordPath(product, resource, key), search },
    state: { fromList: true },
  };
}

interface RecordLinkProps {
  product: ProductSlug;
  resource: AdminResourceMeta;
  record: AdminRecord;
}

/** The row's title, linked to its view over the table. */
function RecordLink({ product, resource, record }: RecordLinkProps) {
  const { search } = useLocation();
  const view = viewFromList(product, resource.key, record._key, search);
  return (
    <Link
      to={view.to}
      state={view.state}
      data-record-link={record._key}
      className="font-medium underline-offset-4 hover:underline"
    >
      {record._title}
    </Link>
  );
}

interface RowActionsProps extends RecordLinkProps {
  onEdit(record: AdminRecord): void;
  onDelete(record: AdminRecord): void;
}

/** The row's "⋯" menu: View, then Edit and Delete where the resource allows them. */
function RowActions({ product, resource, record, onEdit, onDelete }: RowActionsProps) {
  const { search } = useLocation();
  const view = viewFromList(product, resource.key, record._key, search);
  return (
    <Menu>
      <MenuTrigger asChild>
        <Button variant="ghost" size="sm" className="px-3">
          <span aria-hidden="true">⋯</span>
          <span className="sr-only">Open menu</span>
        </Button>
      </MenuTrigger>
      <MenuContent>
        <MenuItem asChild>
          <Link to={view.to} state={view.state}>
            View
          </Link>
        </MenuItem>
        {resource.can.update ? <MenuItem onSelect={() => onEdit(record)}>Edit</MenuItem> : null}
        {resource.can.delete ? <MenuItem onSelect={() => onDelete(record)}>Delete</MenuItem> : null}
      </MenuContent>
    </Menu>
  );
}

interface ColumnsContext {
  product: ProductSlug;
  resource: AdminResourceMeta;
  onEdit(record: AdminRecord): void;
  onDelete(record: AdminRecord): void;
}

/**
 * A resource's table, from its manifest: the title first, as a link to the record's view; then the
 * manifest's columns without the title; then the row's menu. Each column's id is its field name,
 * so it matches `sortable`.
 */
export function buildColumns({
  product,
  resource,
  onEdit,
  onDelete,
}: ColumnsContext): ColumnDef<AdminRecord>[] {
  const fieldOf = (name: string) => resource.fields.find((field) => field.name === name);

  const columns: ColumnDef<AdminRecord>[] = [
    {
      id: resource.titleField,
      header: fieldOf(resource.titleField)?.label ?? resource.singular,
      cell: ({ row }) => <RecordLink product={product} resource={resource} record={row.original} />,
    },
  ];

  for (const name of resource.columns) {
    if (name === resource.titleField) continue;
    const field = fieldOf(name);
    if (!field) continue;
    columns.push({
      id: name,
      header: field.label,
      cell: ({ row }) => (
        <FieldValue
          product={product}
          field={field}
          value={row.original[name]}
          ref={row.original._refs[name] ?? null}
        />
      ),
    });
  }

  columns.push({
    id: 'actions',
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <RowActions
        product={product}
        resource={resource}
        record={row.original}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    ),
  });

  return columns;
}
