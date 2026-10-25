import { createContext, useContext, type ReactNode } from 'react';
import { cn } from '@/utils';

type FieldContextValue = {
  id: string;
  /** The label's own id, for a popup that is named by the same label (a combobox's listbox). */
  labelId: string;
  describedBy: string | undefined;
  invalid: boolean;
};

const FieldContext = createContext<FieldContextValue | null>(null);

/** Read by the controls so a field's label, hint and error wire up alone. */
export function useFieldContext() {
  return useContext(FieldContext);
}

interface FieldProps {
  id: string;
  label: ReactNode;
  /** Says "(optional)" after the label. */
  optional?: boolean;
  hint?: ReactNode;
  error?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Label above the control, never placeholder-as-label. The error sits under the field and
 * replaces the hint. There is no colour: the error is black at full strength and weight 500.
 */
export function Field({ id, label, optional, hint, error, className, children }: FieldProps) {
  const labelId = `${id}-label`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <FieldContext.Provider
      value={{ id, labelId, describedBy: errorId ?? hintId, invalid: Boolean(error) }}
    >
      <div className={cn('grid grid-cols-1 gap-1.5', className)}>
        <label
          id={labelId}
          htmlFor={id}
          className="text-micro leading-[1.3] font-medium text-ink/80"
        >
          {label}
          {optional ? ' (optional)' : null}
        </label>
        {children}
        {error ? (
          <p id={errorId} className="text-micro leading-snug font-medium text-ink">
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="text-micro leading-snug text-ink/80">
            {hint}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}
