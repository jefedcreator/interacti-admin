import type { ReactNode } from 'react';
import type { ProductConfig } from '@/config/products';
import { useAnalyticsQuery } from '@/hooks/queries/use-analytics';
import { useDays } from '@/hooks/use-days';
import { Button, Skeleton } from '@/primitives';
import type { AdminApiError } from '@/utils';
import { AnalyticsChart } from './analytics-chart';
import { PeriodSwitch } from './period-switch';
import { StatTile } from './stat-tile';

function Skeletons() {
  return (
    <div aria-hidden="true" className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="col-span-2 h-36" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      <Skeleton className="h-52" />
    </div>
  );
}

/** One plain line, and under it what the product said, with an optional way to try again. */
function Problem({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return (
    <div className="grid justify-items-start gap-1">
      <p className="text-body">{title}</p>
      {detail ? <p className="text-micro text-ink/50">{detail}</p> : null}
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}

/**
 * A product's Google Analytics figures for the last 7, 30 or 90 days: a tile per metric the
 * product sends, then its chart. Every name on screen is the product's own; a product without the
 * route, without Google Analytics or without our token gets one line and nothing else.
 */
export function AnalyticsSection({ product }: { product: ProductConfig }) {
  const [days, setDays] = useDays();
  const query = useAnalyticsQuery(product.slug, days);
  const { data, error } = query;

  let showSwitch = true;
  let body: ReactNode;

  if (data?.configured) {
    const [headline, ...rest] = data.metrics;
    body = (
      <div className="grid gap-6">
        <div className="grid grid-cols-2 gap-3">
          {headline ? (
            <StatTile
              wide
              label={headline.label}
              count={headline.count}
              previous={headline.previous}
              days={days}
            />
          ) : null}
          {rest.map((metric) => (
            <StatTile
              key={metric.key}
              label={metric.label}
              count={metric.count}
              previous={metric.previous}
              days={days}
            />
          ))}
        </div>
        {data.series.length > 0 ? (
          <div className="grid gap-3">
            <h3 className="text-body font-medium">
              {data.series
                .slice(0, 2)
                .map((line) => line.label)
                .join(' & ')}
            </h3>
            <AnalyticsChart series={data.series} days={days} />
          </div>
        ) : null}
        {data.note ? <p className="text-micro text-ink/50">{data.note}</p> : null}
      </div>
    );
  } else if (data) {
    showSwitch = false;
    body = (
      <Problem
        title={data.note ?? `Analytics isn't set up for ${product.name}.`}
      />
    );
  } else if (error) {
    const missing = (e: AdminApiError) => e.kind === 'not-found' || e.kind === 'off';
    if (missing(error)) {
      showSwitch = false;
      body = <Problem title={`Analytics isn't available from ${product.name} yet.`} />;
    } else if (error.kind === 'unauthorized') {
      showSwitch = false;
      body = <Problem title={`${product.name} didn't accept this token.`} />;
    } else {
      body = (
        <Problem
          title="Couldn't load analytics."
          detail={error.kind === 'server' ? error.message : undefined}
          action={
            <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
              Try again
            </Button>
          }
        />
      );
    }
  } else {
    body = <Skeletons />;
  }

  return (
    <section aria-labelledby="analytics-heading" aria-busy={query.isLoading} className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="analytics-heading" className="text-micro font-normal text-ink/50">
          Analytics
        </h2>
        {showSwitch ? <PeriodSwitch value={days} onChange={setDays} /> : null}
      </div>
      {body}
    </section>
  );
}
