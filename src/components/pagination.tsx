import type { ButtonHTMLAttributes } from 'react';
import { DOTS, usePagination } from '@/hooks/use-pagination';
import { cn } from '@/utils';

interface PaginationProps {
  totalCount: number;
  pageSize: number;
  currentPage: number;
  onPageChange(page: number): void;
}

function PageButton({
  current = false,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { current?: boolean }) {
  return (
    <button
      type="button"
      aria-current={current ? 'page' : undefined}
      className={cn(
        'inline-flex min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-full px-3 text-micro tabular-nums transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-50',
        current
          ? 'bg-ink font-medium text-ground'
          : 'text-ink/80 enabled:hover:bg-ink/10 enabled:hover:text-ink',
        className,
      )}
      {...props}
    />
  );
}

/**
 * Dandys' server pager: previous, the pages `usePagination` gives with "…" where it skips, and
 * next. Previous and next are disabled at the ends; the current page is `aria-current="page"`.
 * One page needs no pager, so it shows nothing.
 */
export function Pagination({ totalCount, pageSize, currentPage, onPageChange }: PaginationProps) {
  const items = usePagination({ totalCount, pageSize, currentPage });
  const totalPages = pageSize > 0 ? Math.ceil(totalCount / pageSize) : 0;

  if (totalPages <= 1) return null;

  const go = (page: number): void => {
    if (page !== currentPage) onPageChange(page);
  };

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center gap-1">
      <PageButton
        aria-label="Previous page"
        disabled={currentPage <= 1}
        onClick={() => go(Math.min(currentPage - 1, totalPages))}
      >
        <span aria-hidden="true">←</span>
      </PageButton>
      {items.map((item, index) =>
        item === DOTS ? (
          <span
            key={`dots-${index}`}
            aria-hidden="true"
            className="inline-flex min-w-9 justify-center text-micro text-ink/50"
          >
            {DOTS}
          </span>
        ) : (
          <PageButton
            key={item}
            aria-label={`Page ${item}`}
            current={item === currentPage}
            onClick={() => go(item)}
          >
            {item}
          </PageButton>
        ),
      )}
      <PageButton
        aria-label="Next page"
        disabled={currentPage >= totalPages}
        onClick={() => go(currentPage + 1)}
      >
        <span aria-hidden="true">→</span>
      </PageButton>
    </nav>
  );
}
