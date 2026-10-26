import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { AnalyticsChart } from '@/components/analytics-chart';
import { PeriodSwitch } from '@/components/period-switch';
import { StatTile } from '@/components/stat-tile';
import { useDays } from '@/hooks/use-days';
import type { AnalyticsDays, AnalyticsSeries } from '@/types/admin';

const days7 = (counts: number[], key = 'visitors', label = 'Visitors'): AnalyticsSeries => ({
  key,
  label,
  points: counts.map((count, i) => ({
    date: `2026-10-${String(16 + i).padStart(2, '0')}`,
    count,
  })),
});

describe('PeriodSwitch', () => {
  it('is a radio group named Period with the current period checked', () => {
    render(<PeriodSwitch value={30} onChange={() => undefined} />);
    expect(within(screen.getByRole('radiogroup', { name: 'Period' })).getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('radio', { name: '7 days' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: '30 days' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '90 days' })).not.toBeChecked();
  });

  it('calls onChange with the number when an arrow key moves the selection', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    function Held() {
      const [value, setValue] = useState<AnalyticsDays>(30);
      return (
        <PeriodSwitch
          value={value}
          onChange={(days) => {
            onChange(days);
            setValue(days);
          }}
        />
      );
    }
    render(<Held />);
    screen.getByRole('radio', { name: '30 days' }).focus();
    await user.keyboard('{ArrowRight}');
    await user.keyboard('{ArrowLeft}');
    expect(onChange.mock.calls).toEqual([[90], [30]]);
    expect(screen.getByRole('radio', { name: '30 days' })).toBeChecked();
  });

  it('calls onChange when a period is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PeriodSwitch value={30} onChange={onChange} />);
    await user.click(screen.getByText('7 days'));
    expect(onChange).toHaveBeenCalledWith(7);
  });
});

describe('StatTile', () => {
  it('shows the label, the count, the change and what it is against', () => {
    render(<StatTile label="Page views" count={7596} previous={7000} days={30} />);
    expect(screen.getByText('Page views')).toBeInTheDocument();
    expect(screen.getByText('7,596')).toBeInTheDocument();
    expect(screen.getByText('↑ 9%')).toBeInTheDocument();
    expect(screen.getByText('vs previous 30 days')).toBeInTheDocument();
  });

  it('reads New when there was nothing before', () => {
    render(<StatTile label="Enquiries" count={8} previous={0} days={7} />);
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('vs previous 7 days')).toBeInTheDocument();
  });

  it('spans both columns when wide', () => {
    const { container, rerender } = render(
      <StatTile label="Visitors" count={1} previous={1} days={30} wide />,
    );
    expect(container.firstElementChild).toHaveClass('col-span-2');
    rerender(<StatTile label="Visitors" count={1} previous={1} days={30} />);
    expect(container.firstElementChild).not.toHaveClass('col-span-2');
  });
});

describe('AnalyticsChart', () => {
  const visitors = days7([0, 1, 2, 3, 4, 5, 6]);
  const views = days7([2, 4, 6, 8, 10, 12, 14], 'views', 'Page views');

  it('names itself with its legend, its period and the range of each line, never a sum', () => {
    render(<AnalyticsChart series={[visitors, views]} days={7} />);
    expect(
      screen.getByRole('img', {
        name: 'Visitors and Page views per day, last 7 days: Visitors from 0 to 6, highest on 22 Oct; Page views from 2 to 14, highest on 22 Oct',
      }),
    ).toBeInTheDocument();
  });

  it('shows the legend, the shared peak and the first and last dates as text', () => {
    render(<AnalyticsChart series={[visitors, views]} days={7} />);
    const chart = screen.getByTestId('analytics-chart');
    expect(within(chart).getByText('Visitors')).toBeInTheDocument();
    expect(within(chart).getByText('Page views')).toBeInTheDocument();
    expect(within(chart).getByText('14')).toBeInTheDocument();
    expect(within(chart).getByText('16 Oct')).toBeInTheDocument();
    expect(within(chart).getByText('22 Oct')).toBeInTheDocument();
  });

  it('dashes the second line and not the first', () => {
    const { container } = render(<AnalyticsChart series={[visitors, views]} days={7} />);
    const [first, second] = Array.from(container.querySelectorAll('path[data-series]'));
    expect(first?.getAttribute('stroke-dasharray')).toBeNull();
    expect(second?.getAttribute('stroke-dasharray')).toBeTruthy();
  });

  it.each([
    ['all zero', [days7([0, 0, 0, 0, 0, 0, 0])]],
    ['an empty series', [{ key: 'visitors', label: 'Visitors', points: [] }]],
    ['two lengths', [days7([1, 2, 3, 4, 5, 6, 7]), days7([5], 'views', 'Page views')]],
  ])('draws %s without NaN', (_name, series) => {
    const { container } = render(<AnalyticsChart series={series} days={7} />);
    for (const path of container.querySelectorAll('path')) {
      expect(path.getAttribute('d')).not.toMatch(/NaN|Infinity/);
    }
  });
});

describe('useDays', () => {
  function Probe() {
    const [days, setDays] = useDays();
    return (
      <button type="button" onClick={() => setDays(90)}>
        {`days ${days}`}
      </button>
    );
  }

  it('reads the period from the URL and writes it back in place, keeping the rest', async () => {
    const router = createMemoryRouter([{ path: '/strive', element: <Probe /> }], {
      initialEntries: ['/strive?days=7&x=1'],
    });
    const user = userEvent.setup();
    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('button', { name: 'days 7' })).toBeInTheDocument();
    await act(async () => {
      await user.click(screen.getByRole('button'));
    });

    expect(router.state.location.search).toBe('?days=90&x=1');
    expect(router.state.historyAction).toBe('REPLACE');
    expect(screen.getByRole('button', { name: 'days 90' })).toBeInTheDocument();
  });
});
