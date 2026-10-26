import { ANALYTICS_DAYS, type AnalyticsDays } from '@/types/admin';
import { formatCount } from './format';

export const DEFAULT_DAYS: AnalyticsDays = 30;

/** The period a URL asks for: 7, 30 or 90, and 30 for anything else, a repeated key included. */
export function readDays(search: URLSearchParams): AnalyticsDays {
  const given = search.getAll('days');
  if (given.length !== 1) return DEFAULT_DAYS;
  return ANALYTICS_DAYS.find((days) => String(days) === given[0]) ?? DEFAULT_DAYS;
}

/**
 * How a count moved against the previous period, in words and glyphs and never in colour. A change
 * that rounds to nothing still reads as 1%, and a previous period of zero is "New", not a ratio.
 */
export function describeChange(count: number, previous: number): string {
  if (previous === 0) return count === 0 ? 'No activity' : 'New';
  if (count === previous) return 'No change';
  const percent = Math.max(1, Math.round((Math.abs(count - previous) / previous) * 100));
  return `${count > previous ? '↑' : '↓'} ${formatCount(percent)}%`;
}

const at = (n: number): number => Math.round(n * 100) / 100;

/**
 * The SVG path of a series and of the area under it, in a `width` by `height` box. `max` is the
 * top of the scale, shared by every series on one chart; a series of fewer than two points is
 * drawn as one segment across the width.
 */
export function chartPaths(
  counts: number[],
  width: number,
  height: number,
  max: number,
): { line: string; area: string } {
  const top = max > 0 ? max : 1;
  const y = (count: number): number => at(height - (count / top) * height);

  const points: [number, number][] =
    counts.length >= 2
      ? counts.map((count, i) => [at((i * width) / (counts.length - 1)), y(count)])
      : [
          [0, y(counts[0] ?? 0)],
          [width, y(counts[0] ?? 0)],
        ];

  const line = points.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px},${py}`).join(' ');
  return { line, area: `${line} L${width},${height} L0,${height} Z` };
}
