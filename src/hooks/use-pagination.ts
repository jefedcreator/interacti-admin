import { useMemo } from 'react';

/** Stands for the pages a pager skips. */
export const DOTS = '…' as const;

export type PageItem = number | typeof DOTS;

interface UsePaginationOptions {
  totalCount: number;
  pageSize?: number;
  /** Pages shown either side of the current one. */
  siblingCount?: number;
  currentPage: number;
}

/** Every whole number from `start` to `end`, both included. */
function range(start: number, end: number): number[] {
  const result: number[] = [];
  for (let n = start; n <= end; n += 1) result.push(n);
  return result;
}

/**
 * Dandys' `usePagination`: the page numbers a pager shows, with `DOTS` where it skips. The first
 * and last pages are always there, and the current one with `siblingCount` either side. Nothing to
 * page gives `[]`.
 */
export function usePagination({
  totalCount,
  pageSize = 20,
  siblingCount = 1,
  currentPage,
}: UsePaginationOptions): PageItem[] {
  return useMemo<PageItem[]>(() => {
    const totalPageCount = pageSize > 0 ? Math.ceil(totalCount / pageSize) : 0;

    // The first and last pages, the current one, its siblings and two DOTS.
    const totalPagesNumber = siblingCount + 5;
    if (totalPagesNumber >= totalPageCount) return range(1, totalPageCount);

    const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
    const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPageCount);

    const shouldShowLeftDots = leftSiblingIndex > 2;
    const shouldShowRightDots = rightSiblingIndex < totalPageCount - 2;

    const firstPageIndex = 1;
    const lastPageIndex = totalPageCount;

    if (!shouldShowLeftDots && shouldShowRightDots) {
      const leftItemCount = 3 + 2 * siblingCount;
      return [...range(1, leftItemCount), DOTS, lastPageIndex];
    }

    if (shouldShowLeftDots && !shouldShowRightDots) {
      const rightItemCount = 3 + 2 * siblingCount;
      return [firstPageIndex, DOTS, ...range(totalPageCount - rightItemCount + 1, totalPageCount)];
    }

    return [
      firstPageIndex,
      DOTS,
      ...range(leftSiblingIndex, rightSiblingIndex),
      DOTS,
      lastPageIndex,
    ];
  }, [totalCount, pageSize, siblingCount, currentPage]);
}
