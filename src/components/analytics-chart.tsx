import type { AnalyticsDays, AnalyticsSeries } from '@/types/admin';
import { chartPaths, formatCount } from '@/utils';

const WIDTH = 600;
const HEIGHT = 160;

const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** `2026-10-22` as "22 Oct", or the text as it came when it is no date. */
function dayLabel(date: string | undefined): string {
  if (!date) return '';
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? date : shortDate.format(parsed);
}

/**
 * A line's shape in words: its lowest and highest day and when the highest was. Never a sum: the
 * daily rows of a figure like unique visitors don't add up to the tile's number.
 */
function describeLine(line: AnalyticsSeries): string {
  if (line.points.length === 0) return `${line.label} has no data`;
  let top = line.points[0];
  let low = line.points[0]?.count ?? 0;
  for (const point of line.points) {
    if (point.count > (top?.count ?? 0)) top = point;
    low = Math.min(low, point.count);
  }
  return `${line.label} from ${formatCount(low)} to ${formatCount(top?.count ?? 0)}, highest on ${dayLabel(top?.date)}`;
}

/** The first line is 80% and solid, the second 50% and dashed. Told apart without colour. */
const LINES = [
  { opacity: 0.8, dash: undefined },
  { opacity: 0.5, dash: '6 5' },
] as const;

interface AnalyticsChartProps {
  series: AnalyticsSeries[];
  days: AnalyticsDays;
}

/**
 * Each series as a line over one shared scale, with a legend, the scale's peak and the first and
 * last dates as text outside the SVG so nothing is stretched. One `role="img"` carries the totals.
 */
export function AnalyticsChart({ series, days }: AnalyticsChartProps) {
  const drawn = series.slice(0, LINES.length);
  const peak = Math.max(0, ...drawn.flatMap((line) => line.points.map((point) => point.count)));
  const dates = drawn.reduce<AnalyticsSeries['points']>(
    (longest, line) => (line.points.length > longest.length ? line.points : longest),
    [],
  );

  const name = `${drawn.map((line) => line.label).join(' and ')} per day, last ${days} days: ${drawn
    .map(describeLine)
    .join('; ')}`;

  return (
    <div data-testid="analytics-chart" className="grid gap-3">
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-micro">
        {drawn.map((line, i) => (
          <li key={line.key} className="flex items-center gap-2">
            <svg width="20" height="2" aria-hidden="true">
              <line
                x1="0"
                x2="20"
                y1="1"
                y2="1"
                stroke="currentColor"
                strokeOpacity={LINES[i]?.opacity}
                strokeWidth="2"
                strokeDasharray={LINES[i]?.dash}
              />
            </svg>
            <span>{line.label}</span>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-[auto_1fr] gap-x-3">
        <div
          aria-hidden="true"
          className="flex flex-col justify-between text-micro text-ink/50 tabular-nums"
        >
          <span>{formatCount(peak)}</span>
          <span>{formatCount(Math.round(peak / 2))}</span>
          <span>0</span>
        </div>
        <svg
          role="img"
          aria-label={name}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="h-40 w-full overflow-visible text-ink"
        >
          {[0, HEIGHT / 2, HEIGHT].map((y) => (
            <line
              key={y}
              x1="0"
              x2={WIDTH}
              y1={y}
              y2={y}
              stroke="currentColor"
              strokeOpacity="0.1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {drawn.map((line, i) => {
            const { line: d, area } = chartPaths(
              line.points.map((point) => point.count),
              WIDTH,
              HEIGHT,
              peak,
            );
            return (
              <g key={line.key}>
                {i === 0 ? <path d={area} fill="currentColor" fillOpacity="0.1" /> : null}
                <path
                  data-series={line.key}
                  d={d}
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity={LINES[i]?.opacity}
                  strokeWidth="2"
                  strokeDasharray={LINES[i]?.dash}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          })}
        </svg>
        <span aria-hidden="true" />
        <div
          aria-hidden="true"
          className="mt-2 flex justify-between text-micro text-ink/50 tabular-nums"
        >
          <span>{dayLabel(dates[0]?.date)}</span>
          <span>{dayLabel(dates.at(-1)?.date)}</span>
        </div>
      </div>
    </div>
  );
}
