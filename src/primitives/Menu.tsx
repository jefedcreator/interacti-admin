import { DropdownMenu } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/utils';

/* A row's "⋯" menu: Radix DropdownMenu, black with a 30% hairline. It sits above a modal (z-60). */

export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;

export function MenuContent({
  className,
  align = 'end',
  sideOffset = 6,
  ...props
}: ComponentProps<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-[60] min-w-40 rounded-[var(--radius-control)] border border-ink/30 bg-ground p-1 text-body text-ink',
          'data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in',
          className,
        )}
        {...props}
      />
    </DropdownMenu.Portal>
  );
}

export function MenuItem({ className, ...props }: ComponentProps<typeof DropdownMenu.Item>) {
  return (
    <DropdownMenu.Item
      className={cn(
        'flex min-h-10 cursor-pointer items-center rounded-lg px-3 outline-none select-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[highlighted]:bg-ink/10',
        className,
      )}
      {...props}
    />
  );
}
