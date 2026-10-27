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
