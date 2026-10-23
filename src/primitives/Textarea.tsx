import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/utils';
import { useFieldContext } from './Field';
import { controlClasses } from './Input';

/** Grows with its content (`field-sizing: content`) and never drops under three rows. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, id, rows = 3, ...props }, ref) => {
    const field = useFieldContext();
    return (
      <textarea
        ref={ref}
        id={id ?? field?.id}
        rows={rows}
        aria-invalid={field?.invalid ? true : undefined}
        aria-describedby={field?.describedBy}
        className={cn(
          controlClasses,
          'field-sizing-content min-h-[calc(3lh+1.5rem+2px)] resize-y py-3 leading-normal',
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';
