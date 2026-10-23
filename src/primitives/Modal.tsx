import { Dialog } from 'radix-ui';
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { cn } from '@/utils';

/*
 * Modal: a compound wrapper over Radix Dialog, ported from Sara's (Modal / Modal.Button /
 * Modal.Portal / Modal.Content / Modal.Title / Modal.Description / Modal.Close), restyled to
 * interacti: a white sheet on a black 50% overlay.
 *
 * Below 640px the content is a bottom sheet that rises from the edge; from 640px it is a centred
 * panel. Enter and exit are CSS keyframes on `data-state` (tokens in app.css). Radix keeps the
 * element mounted until the exit animation ends, and the global reduced-motion rule reaches it.
 *
 * The overlay wraps the content (Radix's scrollable-overlay pattern), so a tall form scrolls
 * inside the backdrop instead of overflowing the viewport. Its one column is `grid-cols-1`
 * (minmax(0, 1fr)): an implicit `auto` column would grow to fit content that never wraps and
 * push the sheet off-screen.
 */

interface ModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  children: ReactNode;
}

function Modal({ open, onOpenChange, defaultOpen, children }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} defaultOpen={defaultOpen}>
      {children}
    </Dialog.Root>
  );
}

function ModalPortal({
  children,
  className,
  container,
}: {
  children: ReactNode;
  className?: string;
  container?: HTMLElement | null;
}) {
  return (
    <Dialog.Portal container={container}>
      <Dialog.Overlay
        className={cn(
          'fixed inset-0 z-50 grid grid-cols-1 items-end overflow-y-auto overscroll-contain bg-black/50 backdrop-blur-[2px] sm:place-items-center sm:p-6',
          'data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in',
          className,
        )}
      >
        {children}
      </Dialog.Overlay>
    </Dialog.Portal>
  );
}

const ModalContent = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof Dialog.Content>>(
  ({ className, children, ...props }, ref) => (
    <Dialog.Content
      ref={ref}
      className={cn(
        'surface-light relative w-full rounded-t-[var(--radius-sheet)] bg-ground px-5 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-ink focus-visible:outline-none',
        'data-[state=closed]:animate-sheet-out data-[state=open]:animate-sheet-in',
        'sm:max-w-[480px] sm:rounded-[var(--radius-sheet)] sm:p-7',
        'sm:data-[state=closed]:animate-pop-out sm:data-[state=open]:animate-pop-in',
        className,
      )}
      {...props}
    >
      {children}
    </Dialog.Content>
  ),
);
ModalContent.displayName = 'ModalContent';

const ModalTitle = forwardRef<HTMLHeadingElement, ComponentPropsWithoutRef<typeof Dialog.Title>>(
  ({ className, ...props }, ref) => (
    <Dialog.Title
      ref={ref}
      className={cn(
        'pr-10 text-statement leading-[1.2] font-medium tracking-[-0.02em] text-balance',
        className,
      )}
      {...props}
    />
  ),
);
ModalTitle.displayName = 'ModalTitle';

const ModalDescription = forwardRef<
  HTMLParagraphElement,
  ComponentPropsWithoutRef<typeof Dialog.Description>
>(({ className, ...props }, ref) => (
  <Dialog.Description
    ref={ref}
    className={cn('mt-1.5 text-body text-pretty text-ink/80', className)}
    {...props}
  />
));
ModalDescription.displayName = 'ModalDescription';

/** The round close button pinned to the top-right corner of the content. */
function ModalDismiss({ label = 'Close' }: { label?: string }) {
  return (
    <Dialog.Close
      aria-label={label}
      className="absolute top-4 right-4 grid size-9 cursor-pointer place-items-center rounded-full bg-ink/10 text-ink transition-colors duration-300 hover:bg-ink/20 sm:top-5 sm:right-5"
    >
      <span aria-hidden="true" className="text-statement leading-none">
        ×
      </span>
    </Dialog.Close>
  );
}

/** The sheet's grab handle, phone only. Decorative. */
function ModalHandle() {
  return (
    <span
      aria-hidden="true"
      className="absolute top-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-ink/20 sm:hidden"
    />
  );
}

Modal.Button = Dialog.Trigger;
Modal.Portal = ModalPortal;
Modal.Content = ModalContent;
Modal.Title = ModalTitle;
Modal.Description = ModalDescription;
Modal.Close = Dialog.Close;
Modal.Dismiss = ModalDismiss;
Modal.Handle = ModalHandle;

export { Modal };
