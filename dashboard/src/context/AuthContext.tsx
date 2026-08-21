import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

const TOKEN_STORAGE_KEY = 'flaky-test-detector.token';
const REPO_STORAGE_KEY = 'flaky-test-detector.repo';
const DEFAULT_REPO = 'typeorm/typeorm';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

interface AuthContextValue {
  token: string | null;
  repo: string;
  setToken: (token: string | null) => void;
  setRepo: (repo: string) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // localStorage unavailable (private browsing, etc.) -- state still works for this session
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => readStorage(TOKEN_STORAGE_KEY));
  const [repo, setRepoState] = useState<string>(
    () => readStorage(REPO_STORAGE_KEY) ?? DEFAULT_REPO,
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      repo,
      setToken: (next) => {
        writeStorage(TOKEN_STORAGE_KEY, next);
        setTokenState(next);
      },
      setRepo: (next) => {
        writeStorage(REPO_STORAGE_KEY, next);
        setRepoState(next);
      },
    }),
    [token, repo],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
