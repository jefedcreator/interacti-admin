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
