import type { ComponentProps } from 'react';
import { cn } from '@/utils';

/** A monochrome pill: a 1px 30% outline around a short value, such as an enum. */
export function Pill({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-ink/30 px-2.5 py-0.5 text-micro leading-[1.3] whitespace-nowrap',
        className,
      )}
      {...props}
    />
  );
}
