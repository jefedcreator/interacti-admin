import { useParams } from 'react-router';
import { AnalyticsSection } from '@/components/analytics-section';
import { StateMessage } from '@/components/state-message';
import { productBySlug, type ProductConfig } from '@/config/products';
import { ProductMark } from '@/primitives';
import { describeConnection, fixFor } from '@/utils';
import { NotFoundPage } from './not-found';

function ProductScreen({ product }: { product: ProductConfig }) {
  const live = product.status === 'live';
  const ready = product.connection.state === 'ready';

  const notReady = !ready;

  return (
    <section className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden px-[var(--gutter)] py-6 lg:py-8">
      <header className="flex items-center justify-between gap-3 border-b border-ink/10 pb-4">
        <div className="flex min-w-0 items-center gap-3">
          <ProductMark product={product} size={32} />
          <div className="min-w-0">
            <h1 className="truncate text-body font-medium tracking-[-0.02em] sm:text-title">
              {product.name}
            </h1>
            <p className="truncate text-micro text-ink/50">{product.field}</p>
          </div>
        </div>
        <span className="whitespace-nowrap rounded-full border border-ink/10 px-2.5 py-0.5 text-micro text-ink/50">
          {live ? 'Live' : 'Coming soon'}
        </span>
      </header>

      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        {notReady ? (
          <StateMessage
            title={describeConnection(product, {
              data: undefined,
              error: null,
              isLoading: false,
            })}
            detail={fixFor(product, null) ?? undefined}
          />
        ) : (
          <AnalyticsSection product={product} />
        )}
      </div>
    </section>
  );
}

/** `/:product`. A slug that is no product is the not-found page, not an empty one. */
export function ProductPage() {
  const { product: slug = '' } = useParams();
  const product = productBySlug(slug);

  if (!product) return <NotFoundPage />;
  return <ProductScreen product={product} />;
}
