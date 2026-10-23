import { Toaster as Sonner } from 'sonner';

/**
 * Sonner, unstyled: a white pill with black text for every type, errors included. The words carry
 * the difference. An action button is underlined text.
 */
export function Toaster() {
  return (
    <Sonner
      position="bottom-center"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'flex w-full items-center gap-4 rounded-full bg-white px-5 py-3 text-body leading-[1.3] text-black sm:w-auto',
          title: 'font-medium',
          description: 'text-black/80',
          icon: 'hidden',
          actionButton: 'ml-auto cursor-pointer font-medium underline underline-offset-4',
          cancelButton: 'cursor-pointer underline underline-offset-4',
        },
      }}
    />
  );
}
