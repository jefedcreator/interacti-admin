import { ANALYTICS_DAYS, type AnalyticsDays } from '@/types/admin';
import { cn } from '@/utils';

interface PeriodSwitchProps {
  value: AnalyticsDays;
  onChange(days: AnalyticsDays): void;
}

/**
 * 7, 30 or 90 days. Native radios, so the arrow keys and the screen reader's group come from the
 * browser: the checked one is a white pill with black text, the others are plain 50% text.
 */
export function PeriodSwitch({ value, onChange }: PeriodSwitchProps) {
  return (
    <fieldset
      role="radiogroup"
      className="m-0 inline-flex min-w-0 gap-1 rounded-full border border-ink/10 p-1"
    >
      <legend className="sr-only">Period</legend>
      {ANALYTICS_DAYS.map((days) => (
        <label key={days} className="relative">
          <input
            type="radio"
            name="period"
            value={days}
            checked={value === days}
            onChange={() => onChange(days)}
            className="peer sr-only"
          />
          <span
            className={cn(
              'flex min-h-9 cursor-pointer items-center rounded-full px-4 text-micro whitespace-nowrap transition-colors duration-300',
              // Chosen in JS, not with peer-checked: a hover rule of equal specificity would win
              // and turn the checked label white on its own white pill.
              value === days ? 'bg-ink font-medium text-ground' : 'text-ink/50 hover:text-ink',
              'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-[3px] peer-focus-visible:outline-ink',
            )}
          >
            {`${days} days`}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
