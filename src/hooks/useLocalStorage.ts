import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_VERSION = 1;
const VERSION_KEY = 'clause-control-version';

function getStorageVersion(): number {
  try {
    return Number(localStorage.getItem(VERSION_KEY)) || 0;
  } catch {
    return 0;
  }
}

function ensureVersion() {
  const v = getStorageVersion();
  if (v < STORAGE_VERSION) {
    localStorage.setItem(VERSION_KEY, String(STORAGE_VERSION));
  }
}

// ─── Same-tab cross-component sync ────────────────────────────────────────────
// `window.storage` events only fire on OTHER tabs, so two components in the
// same tab reading the same key would otherwise diverge. We emit a custom
// event on every write and every instance of the hook listens for it.

const SYNC_EVENT = 'clause-control:ls-sync';

interface SyncDetail {
  key: string; // prefixed key, e.g. "clause-control:post-watch:risks"
  source: symbol; // identity of the originating hook instance (to skip self-loops)
}

function emitSync(key: string, source: symbol) {
  window.dispatchEvent(new CustomEvent<SyncDetail>(SYNC_EVENT, { detail: { key, source } }));
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  ensureVersion();

  const prefixedKey = `clause-control:${key}`;
  // Stable per-instance identity so this hook can ignore its own broadcasts.
  const instanceId = useRef<symbol>(Symbol(prefixedKey));

  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(prefixedKey);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  // Wrap setter so writes persist + broadcast to sibling hook instances.
  const setValue = useCallback<(value: T | ((prev: T) => T)) => void>((value) => {
    setStoredValue(prev => {
      const next = typeof value === 'function' ? (value as (p: T) => T)(prev) : value;
      try {
        localStorage.setItem(prefixedKey, JSON.stringify(next));
      } catch (e) {
        console.warn('Failed to save to localStorage:', e);
      }
      emitSync(prefixedKey, instanceId.current);
      return next;
    });
  }, [prefixedKey]);

  // Listen for writes from OTHER hook instances on the same key (same tab)
  // and from other tabs via the native `storage` event.
  useEffect(() => {
    function refreshFromStorage() {
      try {
        const raw = localStorage.getItem(prefixedKey);
        const parsed = raw ? (JSON.parse(raw) as T) : initialValue;
        setStoredValue(parsed);
      } catch {
        /* ignore */
      }
    }

    function onSync(e: Event) {
      const ce = e as CustomEvent<SyncDetail>;
      if (!ce.detail) return;
      if (ce.detail.key !== prefixedKey) return;
      if (ce.detail.source === instanceId.current) return; // self-emitted
      refreshFromStorage();
    }

    function onStorage(e: StorageEvent) {
      if (e.key !== prefixedKey) return;
      refreshFromStorage();
    }

    window.addEventListener(SYNC_EVENT, onSync);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(SYNC_EVENT, onSync);
      window.removeEventListener('storage', onStorage);
    };
    // initialValue intentionally excluded: identity-changing default objects
    // would otherwise reinstall the listener on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefixedKey]);

  const remove = useCallback(() => {
    localStorage.removeItem(prefixedKey);
    setStoredValue(initialValue);
    emitSync(prefixedKey, instanceId.current);
  }, [prefixedKey, initialValue]);

  return [storedValue, setValue, remove];
}
