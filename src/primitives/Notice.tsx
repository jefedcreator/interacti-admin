import type { ReactNode } from 'react';
import { cn } from '@/utils';

/** An inline message: a 1px 30% bordered block of body text. There is no colour. */
export function Notice({
  role = 'status',
  className,
  children,
}: {
  role?: 'alert' | 'status';
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role={role}
      className={cn(
        'rounded-[var(--radius-control)] border border-ink/30 px-4 py-3 text-body leading-normal text-pretty',
        className,
      )}
    >
      {children}
    </div>
  );
}
