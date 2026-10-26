import { describe, expect, it } from 'vitest';
import { chartPaths, DEFAULT_DAYS, describeChange, readDays } from '@/utils';

describe('readDays', () => {
  it('reads 7, 30 and 90, and defaults to 30', () => {
    expect(DEFAULT_DAYS).toBe(30);
    expect(readDays(new URLSearchParams(''))).toBe(30);
    expect(readDays(new URLSearchParams('days=7'))).toBe(7);
    expect(readDays(new URLSearchParams('days=90'))).toBe(90);
  });

  it.each(['days=14', 'days=abc', 'days=0', 'days=-7', 'days=7.5', 'days='])(
    'falls back to 30 for %s',
    (query) => {
      expect(readDays(new URLSearchParams(query))).toBe(30);
    },
  );

  it('does not trust a repeated key', () => {
    expect(readDays(new URLSearchParams('days=30&days=7'))).toBe(30);
  });
});

describe('describeChange', () => {
  it.each([
    [12, 10, '↑ 20%'],
    [8, 10, '↓ 20%'],
    [10, 10, 'No change'],
    [5, 0, 'New'],
    [0, 0, 'No activity'],
    [0, 4, '↓ 100%'],
    [10001, 10000, '↑ 1%'],
    [9999, 10000, '↓ 1%'],
    [15000, 1000, '↑ 1,400%'],
  ])('reads %i against %i as %s', (count, previous, expected) => {
    expect(describeChange(count, previous)).toBe(expected);
  });
});

describe('chartPaths', () => {
  it('runs from the baseline to the top on the series maximum', () => {
    const { line, area } = chartPaths([0, 5, 10], 100, 40, 10);
    expect(line.startsWith('M0,40')).toBe(true);
    expect(line.endsWith('100,0')).toBe(true);
    expect(area.endsWith('Z')).toBe(true);
  });

  it('honours a shared maximum larger than its own', () => {
    expect(chartPaths([0, 5, 10], 100, 40, 20).line.endsWith('100,20')).toBe(true);
  });

  it.each([
    ['all zero', [0, 0, 0], 0],
    ['one point', [3], 3],
    ['empty', [], 0],
  ])('draws a finite path for %s', (_name, counts, max) => {
    const { line, area } = chartPaths(counts, 100, 40, max);
    for (const path of [line, area]) {
      expect(path).not.toMatch(/NaN|Infinity/);
      expect(path.length).toBeGreaterThan(0);
    }
  });

  it('draws an empty series as a flat line on the baseline', () => {
    expect(chartPaths([], 100, 40, 0).line).toBe('M0,40 L100,40');
  });
});
