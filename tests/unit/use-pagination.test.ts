import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DOTS, usePagination } from '@/hooks/use-pagination';

function pages(totalCount: number, pageSize?: number, currentPage = 1) {
  const { result } = renderHook(() => usePagination({ totalCount, pageSize, currentPage }));
  return result.current;
}

describe('usePagination', () => {
  it('lists every page when there are few', () => {
    expect(pages(50, 10, 1)).toEqual([1, 2, 3, 4, 5]);
  });

  it('skips to the last page from the start', () => {
    expect(pages(200, 10, 1)).toEqual([1, 2, 3, 4, 5, DOTS, 20]);
  });

  it('shows the current page and its siblings between the ends', () => {
    expect(pages(200, 10, 10)).toEqual([1, DOTS, 9, 10, 11, DOTS, 20]);
  });

  it('skips from the first page at the end', () => {
    expect(pages(200, 10, 20)).toEqual([1, DOTS, 16, 17, 18, 19, 20]);
  });

  it('gives nothing when there is nothing to page', () => {
    expect(pages(0)).toEqual([]);
  });
});
