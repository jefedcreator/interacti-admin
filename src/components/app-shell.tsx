import { Dialog } from 'radix-ui';
import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { productBySlug } from '@/config/products';
import { Button, Logo } from '@/primitives';
import { useAuth } from '@/provider';
import { ProductNav } from './product-nav';

/*
 * The frame around every signed-in page. From 1024px a fixed left rail holds the logo, the six
 * products, the open product's resources and "Sign out". Below that a top bar holds the logo and
 * "Menu", which opens a full-screen black Radix Dialog with the same contents, as on the landing.
 */
export function AppShell() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // The first path segment, when it names a product: `/strive/clubs` is open on Strive.
  const activeSlug = productBySlug(pathname.split('/')[1] ?? '')?.slug;

  // Leave first and clear the token second, so RequireAuth never sees "signed out, still on a
  // page" and adds `?next=` to a sign-in the visitor chose.
  async function leave() {
    await navigate('/signin', { replace: true, flushSync: true });
    signOut();
  }

  return (
    <div className="min-h-dvh bg-ground text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-ground"
      >
        Skip to content
      </a>

      <aside className="hidden border-r border-ink/10 bg-ground lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-72 lg:flex-col">
        <div className="px-6 pt-7 pb-5">
          <Link to="/" className="inline-block">
            <Logo />
          </Link>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          <ProductNav activeSlug={activeSlug} />
        </div>
        <div className="border-t border-ink/10 px-3 py-3">
          <Button variant="ghost" size="sm" onClick={() => void leave()}>
            Sign out
          </Button>
        </div>
      </aside>

      <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-ink/10 bg-ground px-[var(--gutter)] py-3 lg:hidden">
          <Link to="/" className="inline-block">
            <Logo />
          </Link>
          <Dialog.Trigger asChild>
            <Button variant="secondary" size="sm">
              Menu
            </Button>
          </Dialog.Trigger>
        </header>

        <Dialog.Portal>
          <Dialog.Content
            aria-describedby={undefined}
            // Following any link in the menu closes it, even one to the page already open.
            onClick={(event) => {
              if (event.target instanceof Element && event.target.closest('a')) setMenuOpen(false);
            }}
            className="surface-dark fixed inset-0 z-50 flex flex-col overflow-y-auto bg-ground text-ink focus-visible:outline-none data-[state=closed]:animate-fade-out data-[state=open]:animate-fade-in"
          >
            <Dialog.Title className="sr-only">Menu</Dialog.Title>
            <div className="flex items-center justify-between px-[var(--gutter)] py-3">
              <Link to="/" className="inline-block">
                <Logo />
              </Link>
              <Dialog.Close asChild>
                <Button variant="secondary" size="sm">
                  Close ×
                </Button>
              </Dialog.Close>
            </div>
            <div className="flex-1 px-[max(4px,calc(var(--gutter)-0.75rem))] py-4">
              <ProductNav activeSlug={activeSlug} />
            </div>
            <div className="border-t border-ink/10 px-[max(4px,calc(var(--gutter)-0.75rem))] py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <Button variant="ghost" size="sm" onClick={() => void leave()}>
                Sign out
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <main id="main" className="min-w-0 lg:pl-72">
        <Outlet />
      </main>
    </div>
  );
}
