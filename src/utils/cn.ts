import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/*
 * The type scale is custom (`text-micro`, `text-body`, `text-statement`, `text-large`). Without
 * naming them, tailwind-merge reads `text-micro` as a text colour and drops it whenever a colour
 * such as `text-ink/50` follows.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['micro', 'body', 'statement', 'large'] }],
    },
  },
});

export type { ClassValue };

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
