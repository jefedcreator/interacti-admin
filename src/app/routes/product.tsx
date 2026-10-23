import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { StateMessage } from '@/components/state-message';
import { productBySlug, type ProductConfig } from '@/config/products';
import { useManifestQuery } from '@/hooks/queries/use-manifest';
import { Button, ProductMark, Skeleton } from '@/primitives';
import { describeConnection, fixFor, formatCount, groupResources } from '@/utils';
import type { AdminApiError } from '@/utils';
import { NotFoundPage } from './not-found';

/** A sentence after the title when the fix isn't an env var: who didn't answer, who said no. */
function causeOf(product: ProductConfig, error: AdminApiError | null): string | undefined {
  switch (error?.kind) {
    case 'unreachable':
    case 'server':
      return `${product.name} didn't answer.`;
    case 'unauthorized':
      return `${product.name} didn't accept this token.`;
    default:
      return undefined;
  }
}

function ResourceSkeletons() {
  return (
    <div aria-hidden="true" className="grid gap-8">
      {[0, 1, 2].map((n) => (
        <div key={n} className="grid gap-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-12 w-full" />
        </div>
      ))}
    </div>
  );
}

function ProductScreen({ product }: { product: ProductConfig }) {
  const manifest = useManifestQuery(product.slug);
  const live = product.status === 'live';
  const ready = product.connection.state === 'ready';

  let body: ReactNode;
  if (manifest.data) {
    body = (
      <div className="grid gap-10">
        {groupResources(manifest.data.resources).map(({ group, resources }) => (
          <section key={group} className="grid gap-3">
            <h2 className="text-micro font-normal text-ink/50">{group}</h2>
            <ul className="border-t border-ink/10">
              {resources.map((resource) => (
                <li key={resource.key} className="border-b border-ink/10">
                  <Link
                    to={`/${product.slug}/${resource.key}`}
                    className="flex min-h-14 items-center justify-between gap-4 py-3 text-body transition-colors duration-300 hover:bg-ink/10 sm:px-3"
                  >
                    <span className="min-w-0 truncate">{resource.label}</span>{' '}
                    <span className="text-ink/50 tabular-nums">{formatCount(resource.count)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    );
  } else if (ready && manifest.isLoading) {
    body = <ResourceSkeletons />;
  } else {
    const detail = fixFor(product, manifest.error) ?? causeOf(product, manifest.error);
    const retry = manifest.error?.kind === 'unreachable' || manifest.error?.kind === 'server';
    body = (
      <StateMessage
        title={describeConnection(product, {
          data: manifest.data,
          error: manifest.error,
          isLoading: manifest.isLoading,
        })}
        detail={detail}
        action={
          retry ? (
            <Button variant="secondary" onClick={() => void manifest.refetch()}>
              Try again
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <section className="px-[var(--gutter)] py-10 lg:py-14">
      <header className="grid justify-items-start gap-4">
        <ProductMark product={product} size={40} />
        <p className="text-micro text-ink/50">{`${product.field} · ${live ? 'Live' : 'Coming soon'}`}</p>
        <h1 className="text-large leading-none font-medium tracking-[-0.02em] break-words">
          {product.name}
        </h1>
      </header>
      <div className="mt-10" aria-busy={ready && manifest.isLoading}>
        {body}
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
