import type { AnalyticsDays, MetricUnit } from '@/types/admin';
import { cn, describeChangeTrend, formatMetricValue } from '@/utils';

interface StatTileProps {
  label: string;
  count: number;
  previous: number;
  days: AnalyticsDays;
  unit?: MetricUnit;
  /** Spans both columns of the tile grid: the headline. */
  wide?: boolean;
}

/** One figure with how it moved against the previous period, with green up and red down indicators. */
export function StatTile({ label, count, previous, days, unit, wide = false }: StatTileProps) {
  const trend = describeChangeTrend(count, previous);

  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'grid min-w-0 content-between gap-3 rounded-[var(--radius-control)] border border-ink/10 p-4 sm:p-5',
        wide && 'col-span-2',
      )}
    >
      <p className="text-micro text-ink/50 truncate">{label}</p>
      <p className="text-statement font-medium tracking-[-0.02em] tabular-nums sm:text-large">
        {formatMetricValue(count, unit)}
      </p>
      <p className="flex flex-wrap items-baseline gap-x-1.5 text-micro">
        <span
          data-testid="stat-tile-trend"
          className={cn(
            'font-medium',
            trend.direction === 'up' && 'text-emerald-600 dark:text-emerald-400',
            trend.direction === 'down' && 'text-rose-600 dark:text-rose-400',
            trend.direction === 'neutral' && 'text-ink/50 font-normal',
          )}
        >
          {trend.arrow ? `${trend.arrow} ${trend.valueText}` : trend.valueText}
        </span>
        <span className="text-ink/50">{`vs previous ${days} days`}</span>
      </p>
    </div>
  );
}
