import { useState } from 'react';
import { Link } from 'react-router';
import type { ProductSlug } from '@/config/products';
import { Pill } from '@/primitives';
import type { AdminFieldMeta, AdminRef } from '@/types/admin';
import { cn, formatValue, NO_VALUE } from '@/utils';

/** The surface's secondary text: 50% on black, 80% on a white modal. */
const SECONDARY = 'text-ink/50 [.surface-light_&]:text-ink/80';

/** An https address, the only kind the CSP lets an image load from. */
function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * A string field holding an https address, shown as the picture it points at with the address kept
 * beneath it. The manifest doesn't say which fields are images, so any such address is tried; one
 * that isn't a picture, or doesn't load, falls back to the address as text.
 */
function ImageValue({ label, url }: { label: string; url: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="break-words">{url}</span>;
  return (
    <div className="grid justify-items-start gap-2">
      <img
        src={url}
        alt={label}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="max-h-40 max-w-full rounded-lg border border-ink/10 object-contain"
      />
      <span className={cn('break-all text-micro', SECONDARY)}>{url}</span>
    </div>
  );
}

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
 * points at, named by that record's title. An enum is a pill. In the record view an https address
 * in a string field is shown as an image. "No" and "—" are secondary text.
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

  if (full && field.type === 'string' && !field.list && isHttpsUrl(value)) {
    return <ImageValue label={field.label} url={value} />;
  }

  const text = formatValue(field, value);
  if (field.type === 'boolean' && value === false) return <span className={SECONDARY}>{text}</span>;
  return <span className={wrap}>{text}</span>;
}
