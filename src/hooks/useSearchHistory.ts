/**
 * Sprint 19: per-scope recent-search history.
 *
 * Each filter input on the app (clients, risks, audit reports, etc.)
 * passes a scope string and gets back a tiny API:
 *   - `history`     — the recent queries, newest first
 *   - `push(query)` — record a query (trimmed; dedups; bumps to top)
 *   - `clear()`     — wipe just this scope
 *
 * Storage shape (one key for all scopes — fewer localStorage writes,
 * easy to wipe with one delete):
 *   clause-control:search-history → { [scope]: string[] }
 *
 * Lives outside `useLocalStorage` because the cross-scope shape would
 * force every consumer to re-fetch the whole map. A small custom hook
 * with a module-level subscription gives us scope-scoped updates.
 */
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'clause-control:search-history';
const DEFAULT_LIMIT = 8;

type Store = Record<string, string[]>;
const listeners = new Set<() => void>();

function readStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as Store : {};
  } catch {
    return {};
  }
}

function writeStore(store: Store): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    console.warn('[useSearchHistory] localStorage write failed', e);
  }
  for (const l of listeners) l();
}

/**
 * Module-level mutators so tests and other modules can drive the
 * history without needing the React hook.
 */
export function pushSearchHistory(scope: string, query: string, limit = DEFAULT_LIMIT): void {
  const q = query.trim();
  if (!q) return;
  const store = readStore();
  const existing = store[scope] ?? [];
  // Case-insensitive dedup but preserve the user's most recent casing.
  const filtered = existing.filter(e => e.toLowerCase() !== q.toLowerCase());
  store[scope] = [q, ...filtered].slice(0, limit);
  writeStore(store);
}

export function clearSearchHistory(scope: string): void {
  const store = readStore();
  if (!(scope in store)) return;
  delete store[scope];
  writeStore(store);
}

export function getSearchHistory(scope: string): string[] {
  return readStore()[scope] ?? [];
}

export function useSearchHistory(scope: string, limit = DEFAULT_LIMIT): {
  history: string[];
  push: (query: string) => void;
  clear: () => void;
} {
  const [history, setHistory] = useState<string[]>(() => getSearchHistory(scope));

  useEffect(() => {
    const listener = () => setHistory(getSearchHistory(scope));
    listeners.add(listener);
    // Re-sync on mount in case the scope changed.
    listener();
    return () => { listeners.delete(listener); };
  }, [scope]);

  const push = useCallback((query: string) => {
    pushSearchHistory(scope, query, limit);
  }, [scope, limit]);

  const clear = useCallback(() => {
    clearSearchHistory(scope);
  }, [scope]);

  return { history, push, clear };
}

/** Test hook — wipe everything between specs. */
export const __testing__ = {
  resetAll(): void {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    for (const l of listeners) l();
  },
};
