import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/utils';
import { useFieldContext } from './Field';

/** A control: a 1px 30% hairline, the control radius, 44px high, the body size. No fill. */
export const controlClasses =
  'w-full min-h-11 rounded-[var(--radius-control)] border border-ink/30 bg-transparent px-3.5 text-body text-ink transition-colors duration-300 placeholder:text-ink/50 focus-visible:border-ink aria-invalid:border-ink disabled:cursor-not-allowed disabled:opacity-50';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, id, ...props }, ref) => {
    const field = useFieldContext();
    return (
      <input
        ref={ref}
        id={id ?? field?.id}
        aria-invalid={field?.invalid ? true : undefined}
        aria-describedby={field?.describedBy}
        className={cn(controlClasses, 'h-11', className)}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';
