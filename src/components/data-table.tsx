import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import type { ReactNode } from 'react';
import { Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/primitives';
import { cn } from '@/utils';

const SKELETON_ROWS = 8;

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  /** The order the rows are in, as the product sorted them. */
  sort: { by?: string; order?: 'asc' | 'desc' };
  /** The column ids whose headers sort. */
  sortable: string[];
  onSort(field: string): void;
  isLoading: boolean;
  /** What the one row says when there are no rows. */
  empty: ReactNode;
  /** The table's name, for assistive technology. */
  caption: string;
  /** A stable id per row, so a row keeps its elements (and focus) when the page refreshes. */
  getRowId?: (row: T) => string;
}

/**
 * Dandys' DataTable over TanStack Table, sorted and paged by the product (`manualSorting`,
 * `manualPagination`). A sortable header is a button showing ↑ or ↓, with `aria-sort` on its
 * `th`. While loading it shows skeleton rows; with no rows, one row spans every column.
 */
export function DataTable<T>({
  columns,
  data,
  sort,
  sortable,
  onSort,
  isLoading,
  empty,
  caption,
  getRowId,
}: DataTableProps<T>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
  });

  const rows = table.getRowModel().rows;

  let body: ReactNode;
  if (isLoading) {
    body = Array.from({ length: SKELETON_ROWS }, (_, index) => (
      <tr key={index} aria-hidden="true" className="border-b border-ink/10">
        {columns.map((_column, cell) => (
          <td key={cell} className="px-3 py-3">
            <Skeleton className="h-6 w-full max-w-40" />
          </td>
        ))}
      </tr>
    ));
  } else if (rows.length === 0) {
    body = (
      <tr>
        <td colSpan={columns.length} className="px-3">
          {empty}
        </td>
      </tr>
    );
  } else {
    body = rows.map((row) => (
      <TableRow key={row.id}>
        {row.getVisibleCells().map((cell) => (
          <TableCell key={cell.id}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        ))}
      </TableRow>
    ));
  }

  return (
    <Table aria-busy={isLoading || undefined}>
      <caption className="sr-only">{caption}</caption>
      <TableHeader>
        {table.getHeaderGroups().map((group) => (
          <TableRow key={group.id} className="hover:bg-transparent">
            {group.headers.map((header) => {
              const id = header.column.id;
              const content = header.isPlaceholder
                ? null
                : flexRender(header.column.columnDef.header, header.getContext());

              if (!sortable.includes(id)) return <TableHead key={header.id}>{content}</TableHead>;

              const order = sort.by === id ? (sort.order ?? 'asc') : undefined;
              return (
                <TableHead
                  key={header.id}
                  aria-sort={
                    order === 'asc' ? 'ascending' : order === 'desc' ? 'descending' : undefined
                  }
                >
                  <button
                    type="button"
                    onClick={() => onSort(id)}
                    className={cn(
                      'inline-flex cursor-pointer items-center gap-1.5 transition-colors duration-300 hover:text-ink',
                      order && 'text-ink',
                    )}
                  >
                    {content}
                    {order ? <span aria-hidden="true">{order === 'asc' ? '↑' : '↓'}</span> : null}
                  </button>
                </TableHead>
              );
            })}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>{body}</TableBody>
    </Table>
  );
}
