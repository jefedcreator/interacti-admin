import type { ProductConfig } from '@/config/products';
import { cn } from '@/utils';

/**
 * A product's own tile with a 10% hairline or, when it has none, a square holding the first
 * letter of its name. Decorative: the name is always written beside it.
 */
export function ProductMark({ product, size = 20 }: { product: ProductConfig; size?: 20 | 32 | 40 }) {
  const box = { width: size, height: size };

  if (product.tile) {
    return (
      <img
        src={product.tile}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-[4px] outline outline-1 -outline-offset-1 outline-ink/10"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      style={box}
      className={cn(
        'inline-grid shrink-0 place-items-center rounded-[4px] border border-ink/30 leading-none font-medium',
        size === 40 ? 'text-statement' : size === 32 ? 'text-body' : 'text-micro',
      )}
    >
      {product.name.charAt(0)}
    </span>
  );
}
