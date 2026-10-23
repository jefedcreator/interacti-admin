import { Link, NavLink } from 'react-router';
import { products, type ProductConfig, type ProductSlug } from '@/config/products';
import { useManifestQuery } from '@/hooks/queries/use-manifest';
import { ProductMark, Skeleton } from '@/primitives';
import { cn, formatCount, groupResources } from '@/utils';

const rowClasses =
  'flex min-h-11 items-center gap-3 rounded-[var(--radius-control)] px-3 text-body transition-colors duration-300 lg:min-h-9';

function ProductRow({ product, active }: { product: ProductConfig; active: boolean }) {
  const soon = product.status === 'coming-soon';
  const content = (
    <>
      <ProductMark product={product} />
      <span className="min-w-0 truncate">{product.name}</span>
      {soon ? <span className="ml-auto text-micro text-ink/50">Coming soon</span> : null}
    </>
  );

  // No backend, no page: Harv3st is a name, not a link.
  if (product.connection.state === 'no-backend') {
    return <span className={cn(rowClasses, 'text-ink/50')}>{content}</span>;
  }

  return (
    <Link
      to={`/${product.slug}`}
      className={cn(rowClasses, active ? 'bg-ink/10 font-medium' : 'text-ink/80 hover:bg-ink/10')}
    >
      {content}
    </Link>
  );
}

/** The open product's resources under their group headings, each linked, with its count at 50%. */
function ActiveResources({ slug }: { slug: ProductSlug }) {
  const manifest = useManifestQuery(slug);

  if (manifest.isLoading) {
    return (
      <div aria-hidden="true" className="grid gap-2 py-3 pl-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-28" />
      </div>
    );
  }
  if (!manifest.data) return null;

  return (
    <div className="grid gap-4 py-3 pl-3">
      {groupResources(manifest.data.resources).map(({ group, resources }) => (
        <div key={group} className="grid gap-1">
          <h2 className="px-3 text-micro font-normal text-ink/50">{group}</h2>
          <ul className="grid gap-px">
            {resources.map((resource) => (
              <li key={resource.key}>
                <NavLink
                  to={`/${slug}/${resource.key}`}
                  className={({ isActive }) =>
                    cn(
                      rowClasses,
                      'justify-between',
                      isActive ? 'bg-ink/10 font-medium' : 'text-ink/80 hover:bg-ink/10',
                    )
                  }
                >
                  <span className="min-w-0 truncate">{resource.label}</span>{' '}
                  <span className="text-micro text-ink/50 tabular-nums">
                    {formatCount(resource.count)}
                  </span>
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Every product, and under the open one its resources. Shared by the rail and the phone menu. */
export function ProductNav({ activeSlug }: { activeSlug?: ProductSlug }) {
  return (
    <nav aria-label="Products">
      <ul className="grid gap-px">
        {products.map((product) => {
          const active = product.slug === activeSlug;
          return (
            <li key={product.slug}>
              <ProductRow product={product} active={active} />
              {active ? <ActiveResources slug={product.slug} /> : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
