import { ProductCard } from '@/components/product-card';
import { products } from '@/config/products';

export function Overview() {
  return (
    <section className="px-[var(--gutter)] py-10 lg:py-14">
      <h1 className="text-large leading-none font-medium tracking-[-0.02em]">Products</h1>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => (
          <li key={product.slug}>
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
    </section>
  );
}
