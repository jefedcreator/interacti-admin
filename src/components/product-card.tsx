import { Link } from 'react-router';
import type { ProductConfig } from '@/config/products';
import { useManifestQuery } from '@/hooks/queries/use-manifest';
import { Dot, ProductMark } from '@/primitives';
import { cn, describeConnection } from '@/utils';

/** One product on the overview: its tile, name, status and connection. Asks its own manifest. */
export function ProductCard({ product }: { product: ProductConfig }) {
  const manifest = useManifestQuery(product.slug);
  const connection = describeConnection(product, {
    data: manifest.data,
    error: manifest.error,
    isLoading: manifest.isLoading,
  });

  const live = product.status === 'live';
  const linked = product.connection.state !== 'no-backend';
  const titleId = `card-${product.slug}`;

  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        'relative grid h-full content-between gap-8 rounded-[var(--radius-sheet-sm)] border border-ink/10 p-5 transition-colors duration-300',
        linked && 'hover:border-ink/30',
      )}
    >
      <ProductMark product={product} size={40} />

      <div className="grid gap-1">
        <h2 id={titleId} className="text-statement leading-[1.2] font-medium tracking-[-0.02em]">
          {linked ? (
            // The link's ::after covers the card, so the whole card is the target.
            <Link to={`/${product.slug}`} className="after:absolute after:inset-0">
              {product.name}
            </Link>
          ) : (
            product.name
          )}
        </h2>
        <p className="text-micro text-ink/50">
          <Dot live={live} />
          {`${live ? 'Live' : 'Coming soon'} · ${product.field}`}
        </p>
        <p className="pt-3 text-body tabular-nums">{connection}</p>
      </div>
    </article>
  );
}
