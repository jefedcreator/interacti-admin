import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/utils';
import { useFieldContext } from './Field';

/** A native checkbox in black or white (`accent-color`), in a 44px-high row. */
export const Checkbox = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>
>(({ className, id, ...props }, ref) => {
  const field = useFieldContext();
  return (
    <span className="inline-flex min-h-11 items-center">
      <input
        ref={ref}
        type="checkbox"
        id={id ?? field?.id}
        aria-invalid={field?.invalid ? true : undefined}
        aria-describedby={field?.describedBy}
        className={cn(
          'size-5 cursor-pointer accent-ink disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    </span>
  );
});
Checkbox.displayName = 'Checkbox';
