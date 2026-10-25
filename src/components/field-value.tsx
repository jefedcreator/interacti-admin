import { Link } from 'react-router';
import type { ProductSlug } from '@/config/products';
import { Pill } from '@/primitives';
import type { AdminFieldMeta, AdminRef } from '@/types/admin';
import { cn, formatValue, NO_VALUE } from '@/utils';

/** The surface's secondary text: 50% on black, 80% on a white modal. */
const SECONDARY = 'text-ink/50 [.surface-light_&]:text-ink/80';

interface FieldValueProps {
  product: ProductSlug;
  field: AdminFieldMeta;
  value: unknown;
  /** For a foreign key: the record it points at, from the record's `_refs`. */
  ref?: AdminRef | null;
  /** In the record view: JSON pretty-printed and long text wrapped, not cut to one line. */
  full?: boolean;
}

/**
 * One field's value, in a table cell or the record view. A reference is a link to the record it
 * points at, named by that record's title. An enum is a pill. "No" and "—" are secondary text.
 */
export function FieldValue({ product, field, value, ref, full = false }: FieldValueProps) {
  const wrap = full ? 'whitespace-pre-wrap break-words' : undefined;

  if (field.relation && ref) {
    return (
      <Link
        to={`/${product}/${field.relation.resource}/${encodeURIComponent(ref.key)}`}
        className={cn('underline decoration-ink/30 underline-offset-4 hover:decoration-ink', wrap)}
      >
        {ref.title}
      </Link>
    );
  }

  if (value === null || value === undefined) return <span className={SECONDARY}>{NO_VALUE}</span>;

  if (field.type === 'enum' && !field.list) return <Pill>{String(value)}</Pill>;

  if (field.type === 'json' && full) {
    // Switzer, not the browser's monospace: the app has one typeface.
    return (
      <pre className="font-sans whitespace-pre-wrap break-words">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }

  const text = formatValue(field, value);
  if (field.type === 'boolean' && value === false) return <span className={SECONDARY}>{text}</span>;
  return <span className={wrap}>{text}</span>;
}
