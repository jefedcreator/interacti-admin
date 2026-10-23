import type { ReactNode } from 'react';

/** A title, what to do about it, and an optional action. Plain text at 50%: no icon, no colour. */
export function StateMessage({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid justify-items-start gap-3 py-8">
      <h2 className="text-statement leading-[1.2] font-medium tracking-[-0.02em] text-balance">
        {title}
      </h2>
      {detail ? <p className="max-w-prose text-body text-pretty text-ink/50">{detail}</p> : null}
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}
