import { cn } from '@/utils';

/** A 10% block that stands in for content, pulsing only when motion is welcome. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'block rounded-[var(--radius-control)] bg-ink/10 motion-safe:animate-pulse',
        className,
      )}
    />
  );
}
