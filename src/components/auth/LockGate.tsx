/**
 * LockGate — boot-flow wrapper that gates AppContent behind an unlock
 * screen when encryption is enabled but the master key isn't in memory.
 *
 * Three states:
 *   - 'disabled' (default for users who haven't enabled encryption):
 *     transparently renders children — AppContent mounts immediately,
 *     same as the pre-Sprint-15 behaviour.
 *   - 'unlocked' (master key in memory, cache pre-warmed): renders
 *     children. AppContent's useLocalStorage hooks read from the cache.
 *   - 'locked' (encryption enabled, no key in memory): renders
 *     UnlockScreen, hiding AppContent entirely so no caller ever sees
 *     a transient null-value flash from useLocalStorage.
 *
 * Subscribes to cryptoStorage status transitions so it re-renders the
 * moment the user successfully unlocks (passphrase verified → cache
 * populated → status flips → AppContent mounts with real data).
 */
import { useSyncExternalStore, type ReactNode } from 'react';
import * as cryptoStorage from '../../utils/cryptoStorage';
import UnlockScreen from './UnlockScreen';

export default function LockGate({ children }: { children: ReactNode }) {
  // useSyncExternalStore — the canonical React 18+ pattern for
  // subscribing to a module-scope event source without writing the
  // useState+useEffect dance manually.
  const status = useSyncExternalStore(
    cryptoStorage.subscribe,
    cryptoStorage.status,
    cryptoStorage.status,  // server snapshot — same as client; we don't SSR.
  );

  if (status === 'locked') {
    return <UnlockScreen />;
  }
  return <>{children}</>;
}
