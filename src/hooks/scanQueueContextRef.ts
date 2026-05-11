/**
 * Internal — the React context object + the consumer hook for the scan
 * queue.
 *
 * Lives in its own file so `scanQueueContext.tsx` can export only the
 * Provider component (satisfies react-refresh's "fast refresh only works
 * when a file only exports components" rule). Consumers import the hook
 * from this file; the Provider mounts via the .tsx file.
 */
import { createContext, useContext } from 'react';
import type { UseScanQueueResult } from './useScanQueue';

export const ScanQueueContext = createContext<UseScanQueueResult | null>(null);

export function useScanQueueContext(): UseScanQueueResult {
  const ctx = useContext(ScanQueueContext);
  if (!ctx) {
    throw new Error(
      'useScanQueueContext must be used inside <ScanQueueProvider>. ' +
      'The provider lives near the App root so the queue runner keeps ' +
      'processing across page changes.',
    );
  }
  return ctx;
}
