import { useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';

export interface ApiDataResult<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/**
 * Fetches `fetcher(token)` whenever the token or `depsKey` changes, and reloads on demand.
 * A single string key (rather than a variable-length deps array) keeps the underlying
 * useEffect dependency array a fixed length across renders.
 */
export function useApiData<T>(
  fetcher: (token: string) => Promise<T>,
  depsKey: string,
): ApiDataResult<T> {
  const { token, setToken } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetcher(token)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          setToken(null);
          return;
        }
        setError(err instanceof Error ? err.message : 'Something went wrong');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // fetcher is intentionally excluded: callers pass a fresh closure each render, and
    // depsKey is the actual identity of "what to fetch".
  }, [token, reloadCount, depsKey]);

  return { data, error, loading, reload: () => setReloadCount((c) => c + 1) };
}
