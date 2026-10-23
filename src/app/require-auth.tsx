import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '@/provider';

/** Sends a visitor without a token to sign-in, remembering where they were going. */
export function RequireAuth() {
  const { token } = useAuth();
  const location = useLocation();

  if (!token) {
    const next = `${location.pathname}${location.search}`;
    const to = next === '/' ? '/sign-in' : `/sign-in?next=${encodeURIComponent(next)}`;
    return <Navigate to={to} replace />;
  }

  return <Outlet />;
}
