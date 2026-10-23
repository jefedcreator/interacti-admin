import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/utils';
import { useFieldContext } from './Field';
import { controlClasses } from './Input';

/** A native select, so the platform's picker does the work. The ↓ glyph stands in for its arrow. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, id, children, ...props }, ref) => {
    const field = useFieldContext();
    return (
      <div className="relative">
        <select
          ref={ref}
          id={id ?? field?.id}
          aria-invalid={field?.invalid ? true : undefined}
          aria-describedby={field?.describedBy}
          className={cn(
            controlClasses,
            'h-11 cursor-pointer appearance-none pr-10 [&>option]:bg-ground [&>option]:text-ink',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-ink/50 [.surface-light_&]:text-ink/80"
        >
          ↓
        </span>
      </div>
    );
  },
);
Select.displayName = 'Select';
