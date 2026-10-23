import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from '@/primitives';
import { AuthProvider } from './auth-provider';
import { createQueryClient } from './query-client';

export { AuthProvider, TOKEN_STORAGE_KEY, useAuth, type Auth } from './auth-provider';
export { createQueryClient } from './query-client';

interface ProviderProps {
  children: ReactNode;
  /** Tests pass their own; the app lets the provider make one, once. */
  client?: QueryClient;
}

export function Provider({ children, client }: ProviderProps) {
  const [made] = useState(() => client ?? createQueryClient());
  const queryClient = client ?? made;

  return (
    <QueryClientProvider client={queryClient}>
      {/* Signing out drops everything the last token fetched. */}
      <AuthProvider onSignOut={() => queryClient.clear()}>
        {children}
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
