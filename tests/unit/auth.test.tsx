import { renderHook, act, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider, TOKEN_STORAGE_KEY, useAuth } from '@/provider';
import { renderApp } from './render';

function mountAuth(props: { onSignOut?: () => void } = {}) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthProvider {...props}>{children}</AuthProvider>
  );
  return renderHook(() => useAuth(), { wrapper });
}

describe('AuthProvider', () => {
  it('stores the token in sessionStorage on sign-in, and nowhere else', () => {
    const { result } = mountAuth();
    expect(result.current.token).toBeNull();

    act(() => result.current.signIn('t'));

    expect(TOKEN_STORAGE_KEY).toBe('ix-admin-token');
    expect(sessionStorage.getItem('ix-admin-token')).toBe('t');
    expect(localStorage.getItem('ix-admin-token')).toBeNull();
    expect(result.current.token).toBe('t');
  });

  it('removes the token on sign-out and calls onSignOut once', () => {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, 't');
    const onSignOut = vi.fn();
    const { result } = mountAuth({ onSignOut });

    act(() => result.current.signOut());

    expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    expect(result.current.token).toBeNull();
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('starts from a stored token', () => {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, 'kept');
    const { result } = mountAuth();
    expect(result.current.token).toBe('kept');
  });
});

describe('RequireAuth', () => {
  it('sends a visitor without a token to sign-in, remembering the page', async () => {
    const { router } = renderApp('/strive', { token: null });

    await waitFor(() => expect(router.state.location.pathname).toBe('/sign-in'));
    expect(router.state.location.search).toBe('?next=%2Fstrive');
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('lets a visitor with a token through', async () => {
    const { router } = renderApp('/strive');

    expect(await screen.findByRole('heading', { name: "This page doesn't exist." })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/strive');
  });
});
