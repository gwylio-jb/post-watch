/**
 * ScanQueueProvider — single-instance broker for the batch scan queue.
 *
 * Pure provider component (no other exports — satisfies
 * react-refresh/only-export-components). The context object + consumer
 * hook live in `scanQueueContextRef.ts` so importing the hook doesn't
 * pull in the provider.
 *
 * Why a context: useScanQueue holds the source-of-truth queue + the
 * effectful runner. We mount it once at the App root so the runner keeps
 * processing across page changes; WpAuditHub (and any other consumer)
 * reads via this context so we don't accidentally instantiate two
 * runners both writing to the same localStorage.
 */
import type { ReactNode } from 'react';
import { useScanQueue } from './useScanQueue';
import { ScanQueueContext } from './scanQueueContextRef';

export function ScanQueueProvider({ children }: { children: ReactNode }) {
  const value = useScanQueue();
  return (
    <ScanQueueContext.Provider value={value}>
      {children}
    </ScanQueueContext.Provider>
  );
}
