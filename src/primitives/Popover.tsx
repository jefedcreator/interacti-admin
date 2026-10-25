import { Popover as PopoverPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/utils';

/*
 * Radix Popover (filters, details, the relation picker): the surface's ground with a 30% hairline.
 * It sits above a modal (z-60). Inside a modal, pass the modal's content as `container` so the
 * popover renders inside the dialog's focus trap.
 */

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
/** Positions the popover against an element that doesn't toggle it, such as a combobox input. */
export const PopoverAnchor = PopoverPrimitive.Anchor;

export function PopoverContent({
  className,
  align = 'end',
  sideOffset = 6,
  container,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content> & { container?: HTMLElement | null }) {
  return (
    <PopoverPrimitive.Portal container={container}>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-[60] w-72 max-w-[calc(100vw-2rem)] rounded-[var(--radius-control)] border border-ink/30 bg-ground p-4 text-body text-ink',
          'data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
