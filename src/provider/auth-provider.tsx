import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/** The only place the token lives: sessionStorage, for this tab, under this key. */
export const TOKEN_STORAGE_KEY = 'ix-admin-token';

export type Auth = {
  token: string | null;
  signIn(token: string): void;
  signOut(): void;
};

const AuthContext = createContext<Auth | null>(null);

/** Storage can be missing or throw (blocked site data), so every touch is guarded. */
function defaultStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function readToken(storage: Storage | null): string | null {
  try {
    return storage?.getItem(TOKEN_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

interface AuthProviderProps {
  children: ReactNode;
  storage?: Storage;
  /** Called once after the token has been removed. */
  onSignOut?: () => void;
}

export function AuthProvider({ children, storage, onSignOut }: AuthProviderProps) {
  const [store] = useState<Storage | null>(() => storage ?? defaultStorage());
  const [token, setToken] = useState<string | null>(() => readToken(store));

  // Kept in a ref so the context value stays stable when the caller passes a new function.
  const onSignOutRef = useRef(onSignOut);
  onSignOutRef.current = onSignOut;

  const signIn = useCallback(
    (next: string) => {
      try {
        store?.setItem(TOKEN_STORAGE_KEY, next);
      } catch {
        // The token still lives in memory for this page.
      }
      setToken(next);
    },
    [store],
  );

  const signOut = useCallback(() => {
    try {
      store?.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // Nothing more to remove.
    }
    setToken(null);
    onSignOutRef.current?.();
  }, [store]);

  const value = useMemo<Auth>(() => ({ token, signIn, signOut }), [token, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Auth {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth needs an AuthProvider above it.');
  return auth;
}
