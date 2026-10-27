# Product Analytics Dashboard Redesign Spec

**Date:** 2026-10-27  
**Status:** Approved  
**Scope:** Admin Dashboard (`admin`) & Product Backends (`strive`, `0nbox`, `parcours`, `sara`, `fluid`)

---

## 1. Goal

1. Make each product's home page (e.g., `/:product` such as `/parcours` or `/strive`) exclusively focused on Google Analytics data, fitting exactly within the display viewport height (`100dvh` / `h-screen`, no desktop vertical scrolling).
2. Remove the duplicate resources list on the product home page (since all resources remain readily available and navigable in the persistent sidebar).
3. Display colored indicators for trends: down arrows (`↓`) and their accompanying numbers must be colored red (`text-rose-600 dark:text-rose-400`), and up arrows (`↑`) and their numbers must be colored green (`text-emerald-600 dark:text-emerald-400`).
4. Expand Google Analytics 4 data fetching across product backends to capture the full engagement suite: Active Users, Page Views, Sessions, Engagement Rate, Bounce Rate, Average Session Duration, Clicks (outbound clicks), and Enquiries (where configured).

---

## 2. User Experience & Layout

### 2.1 Viewport-Constrained Product Home (`ProductScreen`)
- **File:** `src/app/routes/product.tsx`
- **Container:** Constrained to `h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-col px-[var(--gutter)] py-6`.
- **Header:** Compact row displaying `<ProductMark size={32} />`, product name (`text-title font-medium`), field, and live status badge.
- **Resource List Removed:** The resource groups and individual resource links are removed from the home screen body. All resources remain accessible in the left navigation sidebar via `ProductNav`.
- **Analytics Body:** Fills the remaining vertical height with `flex-1 min-h-0 flex flex-col justify-between gap-4`.

### 2.2 Analytics Section Layout
- **File:** `src/components/analytics-section.tsx`
- **Controls Bar:** Heading "Analytics" and `PeriodSwitch` (7 / 30 / 90 days).
- **Stat Tiles Grid:** Responsive grid (4 columns on desktop `lg:grid-cols-4`, 2 columns on mobile/tablet `grid-cols-2`) displaying each metric with its formatted value, change descriptor, and baseline comparison.
- **Chart:** Responsive area chart (`AnalyticsChart`) filling the available lower space, bound within `flex-1 min-h-[160px] max-h-[280px]`.
- **Note:** Lag notice ("Google Analytics figures can lag by up to a day...") rendered in `text-micro text-ink/50` at the very bottom.

---

## 3. Stat Tile & Trend Formatting

### 3.1 Indicator Colors
- **Files:** `src/components/stat-tile.tsx`, `src/utils/analytics.ts`
- **Rules:**
  - If `count > previous`: Trend displays `↑ {percent}%` in green (`text-emerald-600 dark:text-emerald-400 font-medium`).
  - If `count < previous`: Trend displays `↓ {percent}%` in red (`text-rose-600 dark:text-rose-400 font-medium`).
  - If `count === previous`: Displays "No change" in neutral secondary ink (`text-ink/50`).
  - If `previous === 0`: Displays "New" (or "No activity" if count is 0) in neutral secondary ink (`text-ink/50`).
  - Baseline text (`vs previous {days} days`) remains in neutral muted ink (`text-ink/50`).

### 3.2 Metric Value Units & Formatting
Support three metric units:
1. `number` (default): Formatted using `formatCount(value)` (e.g. `1,240`).
2. `percent`: Formatted as percentage with 1 decimal place (e.g. `68.4%`).
3. `duration`: Formatted as minutes and seconds (e.g. `2m 14s` or `45s`).

---

## 4. API & Backend Contract

### 4.1 Type Definitions (`src/types/admin.ts`)
```ts
export type MetricUnit = 'number' | 'percent' | 'duration';

export type AdminAnalyticsMetric = {
  key: string;
  label: string;
  count: number;
  previous: number;
  unit?: MetricUnit;
};

export type AdminAnalytics = {
  days: AnalyticsDays;
  configured: boolean;
  note: string | null;
  metrics: AdminAnalyticsMetric[];
  series: { key: string; label: string; points: { date: string; count: number }[] }[];
};
```

### 4.2 GA4 Data API Batch Query (`kit/analytics.ts`)
The backend batch request requests:
1. **Totals (Report 1):**
   - Metrics: `activeUsers`, `screenPageViews`, `sessions`, `engagementRate`, `bounceRate`, `averageSessionDuration`.
   - Date ranges: Current period (`{days}daysAgo` to `yesterday`) and Previous period (`{2*days}daysAgo` to `{days+1}daysAgo`).
2. **Series (Report 2):**
   - Dimension: `date`
   - Metrics: `activeUsers`, `screenPageViews`
   - Current period, ordered by `date` ascending.
3. **Clicks (Report 3):**
   - Metric: `eventCount`
   - Dimension filter: `eventName == "click"`
   - Both date ranges.
4. **Enquiries (Report 4, optional):**
   - Only included if `GA_ENQUIRY_EVENT` is configured.
   - Metric: `eventCount`
   - Dimension filter: `eventName == GA_ENQUIRY_EVENT`.

### 4.3 Backwards-Compatibility
If a backend has not yet updated to return `unit` or the full metric set, the dashboard safely defaults to displaying whatever metrics are present formatted as integers in neutral styling.

---

## 5. Verification & Testing

1. **Unit Tests (`admin`):**
   - Verify `describeChangeParts` or `StatTile` produces emerald classes on `↑` and rose classes on `↓`.
   - Verify `ProductScreen` renders the analytics section without rendering the manifest resource list.
   - Verify formatting helpers for `percent` and `duration`.
2. **Type Check & Lint:**
   - Run `yarn check` / `yarn typecheck` in `admin` to verify strict TypeScript adherence.
3. **Responsive Display Verification:**
   - Verify the viewport constraint on `/:product` routes does not induce window scrollbars at standard laptop viewport heights (e.g. 800px+).
