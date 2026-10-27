# Product Analytics Dashboard Redesign Implementation Plan

> **Status:** Complete (2026-10-27). Tasks 1–5 done; the expanded `kit/analytics.ts` is byte-identical across `strive`, `0nbox`, `parcours`, `sara` and `fluid` (md5 verified), and `yarn typecheck`, `yarn test`, `yarn build` pass in `admin`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the product overview screen (`/:product`, e.g. `/parcours`) so it displays exclusively Google Analytics data within the exact viewport height (`100dvh` / no page scroll on desktop), styles down trends with red arrows and numbers and up trends with green arrows and numbers, and expands GA4 data fetching across product backends for the full engagement metric suite (Users, Views, Sessions, Engagement Rate, Bounce Rate, Duration, Clicks, and Enquiries).

**Architecture:**
- **Frontend (`admin`):**
  - Update `src/app/routes/product.tsx` to remove the resource list (which is already navigable in `ProductNav` sidebar) and lock container height to `h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-col`.
  - Update `src/components/stat-tile.tsx` and `src/utils/analytics.ts` to separate trend direction and format units (`number`, `percent`, `duration`). Apply `text-emerald-600 dark:text-emerald-400` to `↑` and its number, and `text-rose-600 dark:text-rose-400` to `↓` and its number.
  - Keep `src/components/analytics-section.tsx` responsive with an adaptive stat grid and a flex-constrained chart that fits alongside tiles without scrolling.
- **Backend (`strive`, etc. `kit/analytics.ts`):**
  - Update the GA4 `batchRunReports` query to request totals for `sessions`, `engagementRate`, `bounceRate`, `averageSessionDuration`, and outbound `click` events.
  - Return typed metric objects with `unit` metadata, remaining backwards-compatible.

**Tech Stack:** React 19, Vite, Tailwind CSS, TypeScript, Vitest, React Testing Library, Google Analytics Data API v1beta (`google-auth-library`).

## Global Constraints

- **Viewport constraint:** Desktop views of `/:product` must fit inside `100dvh` without inducing a vertical scrollbar on the page body.
- **Resource navigation:** Resource links must remain intact in `ProductNav` in the sidebar; only the duplicate list in `ProductScreen` is removed.
- **Indicator colors:** `↑` and accompanying percentage/number must be styled green (`text-emerald-600 dark:text-emerald-400 font-medium`); `↓` and accompanying percentage/number must be styled red (`text-rose-600 dark:text-rose-400 font-medium`). Neutral/no-change states remain secondary ink (`text-ink/50`).
- **Gates:** `yarn check` and `yarn test` must pass cleanly before any task commit.

---

### Task 1: Admin Types & Trend Formatting Utilities

**Files:**
- Modify: `src/types/admin.ts:1-20`
- Modify: `src/utils/analytics.ts:1-35`
- Test: `tests/unit/analytics-utils.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type MetricUnit = 'number' | 'percent' | 'duration';
  export type AdminAnalyticsMetric = {
    key: string;
    label: string;
    count: number;
    previous: number;
    unit?: MetricUnit;
  };
  export type TrendChange = {
    arrow: '↑' | '↓' | null;
    valueText: string;
    direction: 'up' | 'down' | 'neutral';
  };
  export function describeChangeTrend(count: number, previous: number): TrendChange;
  export function formatMetricValue(value: number, unit?: MetricUnit): string;
  ```

- [x] **Step 1: Write the failing tests**

Create `tests/unit/analytics-utils.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { describeChangeTrend, formatMetricValue } from '@/utils/analytics';

describe('analytics utilities', () => {
  describe('describeChangeTrend', () => {
    it('returns up trend with arrow and percent when count > previous', () => {
      const res = describeChangeTrend(150, 100);
      expect(res).toEqual({
        arrow: '↑',
        valueText: '50%',
        direction: 'up',
      });
    });

    it('returns down trend with arrow and percent when count < previous', () => {
      const res = describeChangeTrend(80, 100);
      expect(res).toEqual({
        arrow: '↓',
        valueText: '20%',
        direction: 'down',
      });
    });

    it('returns neutral without arrow when count == previous', () => {
      const res = describeChangeTrend(100, 100);
      expect(res).toEqual({
        arrow: null,
        valueText: 'No change',
        direction: 'neutral',
      });
    });

    it('returns New when previous was 0 and count > 0', () => {
      const res = describeChangeTrend(10, 0);
      expect(res).toEqual({
        arrow: null,
        valueText: 'New',
        direction: 'neutral',
      });
    });

    it('returns No activity when both are 0', () => {
      const res = describeChangeTrend(0, 0);
      expect(res).toEqual({
        arrow: null,
        valueText: 'No activity',
        direction: 'neutral',
      });
    });
  });

  describe('formatMetricValue', () => {
    it('formats numbers as standard counts', () => {
      expect(formatMetricValue(1234)).toBe('1,234');
      expect(formatMetricValue(1234, 'number')).toBe('1,234');
    });

    it('formats percentages with one decimal place', () => {
      expect(formatMetricValue(68.42, 'percent')).toBe('68.4%');
      expect(formatMetricValue(0.5, 'percent')).toBe('0.5%');
    });

    it('formats durations as minutes and seconds', () => {
      expect(formatMetricValue(135, 'duration')).toBe('2m 15s');
      expect(formatMetricValue(45, 'duration')).toBe('45s');
      expect(formatMetricValue(0, 'duration')).toBe('0s');
    });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `yarn vitest run tests/unit/analytics-utils.test.ts`  
Expected: FAIL with missing exports `describeChangeTrend` and `formatMetricValue`.

- [x] **Step 3: Update `src/types/admin.ts` and `src/utils/analytics.ts`**

In `src/types/admin.ts`:
```ts
export type MetricUnit = 'number' | 'percent' | 'duration';

export interface AdminAnalyticsMetric {
  key: string;
  label: string;
  count: number;
  previous: number;
  unit?: MetricUnit;
}

export interface AdminAnalytics {
  days: AnalyticsDays;
  configured: boolean;
  note: string | null;
  metrics: AdminAnalyticsMetric[];
  series: {
    key: string;
    label: string;
    points: { date: string; count: number }[];
  }[];
}
```

In `src/utils/analytics.ts`:
```ts
import { ANALYTICS_DAYS, type AnalyticsDays, type MetricUnit } from '@/types/admin';
import { formatCount } from './format';

export const DEFAULT_DAYS: AnalyticsDays = 30;

export function readDays(search: URLSearchParams): AnalyticsDays {
  const given = search.getAll('days');
  if (given.length !== 1) return DEFAULT_DAYS;
  return ANALYTICS_DAYS.find((days) => String(days) === given[0]) ?? DEFAULT_DAYS;
}

export type TrendChange = {
  arrow: '↑' | '↓' | null;
  valueText: string;
  direction: 'up' | 'down' | 'neutral';
};

export function describeChangeTrend(count: number, previous: number): TrendChange {
  if (previous === 0) {
    return {
      arrow: null,
      valueText: count === 0 ? 'No activity' : 'New',
      direction: 'neutral',
    };
  }
  if (count === previous) {
    return {
      arrow: null,
      valueText: 'No change',
      direction: 'neutral',
    };
  }
  const percent = Math.max(1, Math.round((Math.abs(count - previous) / previous) * 100));
  const isUp = count > previous;
  return {
    arrow: isUp ? '↑' : '↓',
    valueText: `${formatCount(percent)}%`,
    direction: isUp ? 'up' : 'down',
  };
}

export function describeChange(count: number, previous: number): string {
  const trend = describeChangeTrend(count, previous);
  return trend.arrow ? `${trend.arrow} ${trend.valueText}` : trend.valueText;
}

export function formatMetricValue(value: number, unit?: MetricUnit): string {
  if (unit === 'percent') {
    return `${Number(value.toFixed(1))}%`;
  }
  if (unit === 'duration') {
    const totalSecs = Math.round(value);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  }
  return formatCount(Math.round(value));
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `yarn vitest run tests/unit/analytics-utils.test.ts`  
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/types/admin.ts src/utils/analytics.ts tests/unit/analytics-utils.test.ts
git commit -m "feat(analytics): add trend parsing and metric unit formatting utilities"
```

---

### Task 2: Red and Green Trend Indicators in `StatTile`

**Files:**
- Modify: `src/components/stat-tile.tsx:1-35`
- Test: `tests/unit/stat-tile.test.tsx`

**Interfaces:**
- Consumes: `describeChangeTrend`, `formatMetricValue`, `MetricUnit`
- Produces: Updated `<StatTile label count previous days unit? wide? />` component with green/red trend styling.

- [x] **Step 1: Write the failing tests**

Create `tests/unit/stat-tile.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatTile } from '@/components/stat-tile';

describe('StatTile', () => {
  it('renders green indicator when count > previous', () => {
    render(<StatTile label="Visitors" count={120} previous={100} days={30} />);
    const indicator = screen.getByTestId('stat-tile-trend');
    expect(indicator).toHaveTextContent('↑ 20%');
    expect(indicator).toHaveClass('text-emerald-600');
  });

  it('renders red indicator when count < previous', () => {
    render(<StatTile label="Visitors" count={80} previous={100} days={30} />);
    const indicator = screen.getByTestId('stat-tile-trend');
    expect(indicator).toHaveTextContent('↓ 20%');
    expect(indicator).toHaveClass('text-rose-600');
  });

  it('renders neutral indicator when count === previous', () => {
    render(<StatTile label="Visitors" count={100} previous={100} days={30} />);
    const indicator = screen.getByTestId('stat-tile-trend');
    expect(indicator).toHaveTextContent('No change');
    expect(indicator).not.toHaveClass('text-emerald-600');
    expect(indicator).not.toHaveClass('text-rose-600');
  });

  it('formats metric values according to unit', () => {
    render(<StatTile label="Bounce Rate" count={42.3} previous={50} days={30} unit="percent" />);
    expect(screen.getByText('42.3%')).toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `yarn vitest run tests/unit/stat-tile.test.tsx`  
Expected: FAIL (missing `data-testid="stat-tile-trend"` and color classes).

- [x] **Step 3: Update `src/components/stat-tile.tsx`**

```tsx
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
        <span className="text-ink/50">{`vs previous ${days}d`}</span>
      </p>
    </div>
  );
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `yarn vitest run tests/unit/stat-tile.test.tsx`  
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/components/stat-tile.tsx tests/unit/stat-tile.test.tsx
git commit -m "feat(ui): add green and red trend arrow styling to StatTile"
```

---

### Task 3: Viewport Height & Dedicated Analytics Home in `ProductScreen`

**Files:**
- Modify: `src/app/routes/product.tsx:39-106`
- Modify: `src/components/analytics-section.tsx:50-86`
- Test: `tests/unit/product-screen.test.tsx`

**Interfaces:**
- Produces: `ProductScreen` that contains only the compact product header and the `AnalyticsSection`, filling `h-[100dvh] max-h-[100dvh] overflow-hidden`.

- [x] **Step 1: Write the failing tests**

Create `tests/unit/product-screen.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { ProductPage } from '@/app/routes/product';

vi.mock('@/hooks/queries/use-manifest', () => ({
  useManifestQuery: () => ({
    data: {
      product: 'Parcours',
      resources: [
        { key: 'courses', label: 'Courses', group: 'Content', count: 5 },
      ],
    },
    isLoading: false,
    error: null,
  }),
}));

vi.mock('@/hooks/queries/use-analytics', () => ({
  useAnalyticsQuery: () => ({
    data: {
      days: 30,
      configured: true,
      note: 'Lag note',
      metrics: [
        { key: 'visitors', label: 'Visitors', count: 120, previous: 100 },
      ],
      series: [
        { key: 'visitors', label: 'Visitors', points: [{ date: '2026-10-26', count: 10 }] },
      ],
    },
    isLoading: false,
    error: null,
  }),
}));

describe('ProductPage', () => {
  it('renders analytics data and header without rendering resource list', () => {
    render(
      <MemoryRouter initialEntries={['/parcours']}>
        <Routes>
          <Route path="/:product" element={<ProductPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Product Header is present
    expect(screen.getByRole('heading', { level: 1, name: 'Parcours' })).toBeInTheDocument();

    // Analytics section is present
    expect(screen.getByRole('heading', { level: 2, name: 'Analytics' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Visitors' })).toBeInTheDocument();

    // Resource list items are NOT rendered on product home
    expect(screen.queryByText('Courses')).not.toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `yarn vitest run tests/unit/product-screen.test.tsx`  
Expected: FAIL (`Courses` is currently found on the page).

- [x] **Step 3: Update `src/app/routes/product.tsx` and `src/components/analytics-section.tsx`**

In `src/app/routes/product.tsx`:
Replace the manifest resource list mapping so the body only contains `<AnalyticsSection product={product} />`.
Lock the outer container to:
`className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden px-[var(--gutter)] py-6 lg:py-8"`
And header to a compact layout:
```tsx
function ProductScreen({ product }: { product: ProductConfig }) {
  const live = product.status === 'live';

  return (
    <section className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden px-[var(--gutter)] py-6 lg:py-8">
      <header className="flex items-center justify-between gap-4 border-b border-ink/10 pb-4">
        <div className="flex items-center gap-3 min-w-0">
          <ProductMark product={product} size={32} />
          <div className="min-w-0">
            <h1 className="text-body font-medium tracking-[-0.02em] truncate sm:text-title">
              {product.name}
            </h1>
            <p className="text-micro text-ink/50 truncate">
              {product.field}
            </p>
          </div>
        </div>
        <span className="text-micro text-ink/50 rounded-full border border-ink/10 px-2.5 py-0.5 whitespace-nowrap">
          {live ? 'Live' : 'Coming soon'}
        </span>
      </header>

      <div className="mt-4 flex flex-1 min-h-0 flex-col">
        <AnalyticsSection product={product} />
      </div>
    </section>
  );
}
```

In `src/components/analytics-section.tsx`:
Adjust grid and chart layout so it fits cleanly into the flex container:
- Stat tiles in an adaptive 2 to 4 column grid: `grid grid-cols-2 lg:grid-cols-4 gap-3`.
- Pass `unit={metric.unit}` to `<StatTile>`.
- Chart container has `flex-1 min-h-[160px] max-h-[260px]` to stay within the display height.

- [x] **Step 4: Run test to verify it passes**

Run: `yarn vitest run tests/unit/product-screen.test.tsx`  
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/app/routes/product.tsx src/components/analytics-section.tsx tests/unit/product-screen.test.tsx
git commit -m "feat(ui): dedicate product home to analytics and lock display viewport height"
```

---

### Task 4: Expand Google Analytics Kit Query & Metrics

**Files:**
- Modify: `../strive/src/backend/admin/kit/analytics.ts`
- Modify: `../strive/src/backend/admin/kit/__tests__/analytics.test.ts`

**Interfaces:**
- Produces: Updated `kit/analytics.ts` requesting engagement metrics:
  - `activeUsers` (Visitors, unit: `number`)
  - `screenPageViews` (Page views, unit: `number`)
  - `sessions` (Sessions, unit: `number`)
  - `engagementRate` (Engagement rate, unit: `percent`)
  - `bounceRate` (Bounce rate, unit: `percent`)
  - `averageSessionDuration` (Avg session duration, unit: `duration`)
  - `click` event count (Clicks, unit: `number`)
  - `GA_ENQUIRY_EVENT` event count (Enquiries, unit: `number`, if set)

- [x] **Step 1: Write test case in `../strive/src/backend/admin/kit/__tests__/analytics.test.ts`**

Add test verifying the batch request requests `sessions`, `engagementRate`, `bounceRate`, `averageSessionDuration`, and click events, and returns `unit` on each metric.

- [x] **Step 2: Run test to verify failure**

Run: `cd ../strive && yarn vitest run src/backend/admin/kit/__tests__/analytics.test.ts`  
Expected: FAIL.

- [x] **Step 3: Update `../strive/src/backend/admin/kit/analytics.ts`**

In Report 1 (Totals), add `sessions`, `engagementRate`, `bounceRate`, and `averageSessionDuration` to `metrics`.
Add Report 3 for clicks (`eventName == 'click'`).
Map metrics into `metrics` array with corresponding `key`, `label`, `count`, `previous`, and `unit`.

- [x] **Step 4: Run test to verify it passes**

Run: `cd ../strive && yarn vitest run src/backend/admin/kit/__tests__/analytics.test.ts`  
Expected: PASS.

- [x] **Step 5: Commit in Strive**

```bash
git -C ../strive add src/backend/admin/kit/analytics.ts src/backend/admin/kit/__tests__/analytics.test.ts
git -C ../strive commit -m "feat(analytics): expand GA4 batch query to include sessions, rates, duration and clicks"
```

---

### Task 5: Full Verification & Integration Test

**Files:**
- `admin` workspace

- [x] **Step 1: Run typecheck**
Run: `yarn typecheck`  
Expected: PASS with 0 errors.

- [x] **Step 2: Run all unit tests**
Run: `yarn test`  
Expected: PASS all tests.

- [x] **Step 3: Commit any final integration adjustments**
```bash
git add -A
git commit -m "chore: verify analytics dashboard layout and trend styling"
```

---

## Self-Review Checklist
- **Spec coverage:** Viewport constraint (Task 3), resource list removal (Task 3), red down / green up arrows (Task 2), full GA4 metrics & units (Task 1 & Task 4). All spec requirements covered.
- **Placeholder scan:** None. All commands, code snippets, and expected values are fully specified.
- **Type consistency:** `MetricUnit`, `TrendChange`, `describeChangeTrend`, and `formatMetricValue` are defined in Task 1 and consistently used across Tasks 2, 3, and 4.
