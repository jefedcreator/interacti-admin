import type { ComponentProps } from 'react';
import { cn } from '@/utils';

/**
 * A real table in a frame that scrolls sideways on its own, so the page never does. The frame is
 * `relative` so it contains the cells' absolutely positioned `sr-only` labels too; otherwise they
 * escape its clip and widen the page.
 */
export function Table({ className, ...props }: ComponentProps<'table'>) {
  return (
    <div className="relative overflow-x-auto">
      <table className={cn('w-full text-body tabular-nums', className)} {...props} />
    </div>
  );
}

export function TableHeader(props: ComponentProps<'thead'>) {
  return <thead {...props} />;
}

export function TableBody(props: ComponentProps<'tbody'>) {
  return <tbody {...props} />;
}

export function TableRow({ className, ...props }: ComponentProps<'tr'>) {
  return (
    <tr
      className={cn('border-b border-ink/10 transition-colors duration-300 hover:bg-ink/10', className)}
      {...props}
    />
  );
}

export function TableHead({ className, scope = 'col', ...props }: ComponentProps<'th'>) {
  return (
    <th
      scope={scope}
      className={cn(
        'px-3 py-3 text-left text-micro font-normal whitespace-nowrap text-ink/50',
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: ComponentProps<'td'>) {
  return <td className={cn('max-w-[24rem] truncate px-3 py-3', className)} {...props} />;
}
