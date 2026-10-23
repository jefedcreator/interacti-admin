import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { canSendToken } from '@/config/products';
import { Button, Field, Input, Logo, Notice } from '@/primitives';
import { useAuth } from '@/provider';
import { verifyToken } from '@/utils';

type Problem = 'empty' | 'rejected' | 'unreachable';

/** Only a path on this app: it starts with one slash, never `//` or `/\`, which browsers read as another host. */
function safeNext(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/';
  return next;
}

export function SignInPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [value, setValue] = useState('');
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);

  // The token is only ever typed on a page that may send it on: https, or loopback in development.
  const secure = canSendToken(new URL(window.location.href));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!secure || pending) return;

    const token = value.trim();
    if (!token) {
      setProblem('empty');
      return;
    }

    setPending(true);
    setProblem(null);
    const verdict = await verifyToken(token);
    setPending(false);

    if (verdict.accepted.length > 0) {
      signIn(token);
      navigate(safeNext(params.get('next')), { replace: true });
    } else if (verdict.rejected.length > 0) {
      setProblem('rejected');
    } else {
      setProblem('unreachable');
    }
  }

  return (
    <main
      id="main"
      className="grid min-h-dvh place-items-center bg-ground px-[var(--gutter)] py-12 text-ink"
    >
      <div className="grid w-full max-w-sm gap-8">
        <Logo />
        <h1 className="text-micro font-medium text-ink/50">Admin</h1>

        <form noValidate autoComplete="off" onSubmit={submit} className="grid gap-5">
          <Field
            id="admin-token"
            label="Admin token"
            error={problem === 'empty' ? 'Enter the admin token.' : undefined}
          >
            <Input
              type="password"
              name="admin-token"
              autoComplete="current-password"
              spellCheck={false}
              autoCapitalize="none"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              {...(problem === 'rejected' ? { 'aria-invalid': true } : {})}
              disabled={!secure}
            />
          </Field>

          {!secure ? <Notice role="alert">Sign-in needs HTTPS.</Notice> : null}
          {problem === 'rejected' ? (
            <Notice role="alert">That token wasn't accepted.</Notice>
          ) : null}
          {problem === 'unreachable' ? (
            <Notice role="alert">
              Couldn't reach any product. Check that their admin is switched on.
            </Notice>
          ) : null}

          <Button type="submit" disabled={!secure || pending}>
            {pending ? 'Checking…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </main>
  );
}
