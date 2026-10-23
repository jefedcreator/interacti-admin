import { cn } from '@/utils';

/**
 * The kit's white logo, unmodified, in an <img>. It only ever appears on black. Never retype,
 * redraw, stretch or recolour it: set a width and let the height follow.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <img
      src="/brand/interacti/logo-white.svg"
      alt="interacti"
      className={cn('h-auto w-24 min-w-[72px]', className)}
    />
  );
}
