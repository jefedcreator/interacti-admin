import { Link } from 'react-router';
import { Button } from '@/primitives';

export function NotFoundPage() {
  return (
    <section className="grid justify-items-start gap-6 px-[var(--gutter)] py-16">
      <h1 className="text-large leading-none font-medium tracking-[-0.02em]">
        This page doesn't exist.
      </h1>
      <Button asChild variant="secondary">
        <Link to="/">Back to products</Link>
      </Button>
    </section>
  );
}
