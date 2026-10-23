import { Slot } from 'radix-ui';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/utils';

/*
 * Buttons are full pills. Primary is a filled pill (ink on ground, so white on black and black on
 * white), secondary is a 1px 30% outline, ghost is text only. Disabled is 50% with no pointer.
 */
const base =
  'inline-flex shrink-0 cursor-pointer select-none items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition-[background-color,border-color,color,opacity] duration-300 disabled:cursor-not-allowed disabled:opacity-50';

const variants = {
  primary: 'bg-ink text-ground hover:bg-ink/80',
  secondary: 'border border-ink/30 text-ink hover:border-ink',
  ghost: 'text-ink/80 hover:text-ink',
} as const;

const sizes = {
  md: 'min-h-11 px-6 text-body',
  sm: 'min-h-9 px-4 text-micro',
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = 'primary', size = 'md', asChild = false, type, children, ...props },
    ref,
  ) => {
    const classes = cn(base, variants[variant], sizes[size], className);

    if (asChild) {
      return (
        <Slot.Root ref={ref} className={classes} {...props}>
          {children}
        </Slot.Root>
      );
    }

    return (
      <button ref={ref} type={type ?? 'button'} className={classes} {...props}>
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';
