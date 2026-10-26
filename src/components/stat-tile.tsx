import type { AnalyticsDays } from '@/types/admin';
import { cn, describeChange, formatCount } from '@/utils';

interface StatTileProps {
  label: string;
  count: number;
  previous: number;
  days: AnalyticsDays;
  /** Spans both columns of the tile grid: the headline. */
  wide?: boolean;
}

/** One figure with how it moved against the previous period, in words and glyphs, never colour. */
export function StatTile({ label, count, previous, days, wide = false }: StatTileProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'grid min-w-0 content-between gap-4 rounded-[var(--radius-control)] border border-ink/10 p-5',
        wide && 'col-span-2',
      )}
    >
      <p className="text-micro text-ink/50">{label}</p>
      <p className="text-statement font-medium tracking-[-0.02em] tabular-nums sm:text-large">
        {formatCount(count)}
      </p>
      <p className="flex flex-wrap items-baseline gap-x-2 text-micro">
        <span>{describeChange(count, previous)}</span>
        <span className="text-ink/50">{`vs previous ${days} days`}</span>
      </p>
    </div>
  );
}
