/**
 * ScanQueueProvider — single-instance broker for portfolio-mode
 * infrastructure (batch scan queue + recurring schedules).
 *
 * Pure provider component (no other exports — satisfies
 * react-refresh/only-export-components). The context + consumer hooks
 * live in `scanQueueContextRef.ts`.
 *
 * Wiring: when a schedule fires, the provider enqueues a scan against
 * the queue from the same instance. Mounted once at the App root so
 * neither the runner nor the scheduler races itself.
 */
import type { ReactNode } from 'react';
import { useScanQueue } from './useScanQueue';
import { useScanScheduler } from './useScanScheduler';
import { ScanQueueContext } from './scanQueueContextRef';

export function ScanQueueProvider({ children }: { children: ReactNode }) {
  const queue = useScanQueue();
  const scheduler = useScanScheduler({
    onFire: schedule => {
      if (schedule.kind === 'wp-scan') {
        queue.enqueue([{ targetUrl: `https://${schedule.domain}`, clientId: schedule.clientId }]);
      }
    },
  });
  return (
    <ScanQueueContext.Provider value={{ queue, scheduler }}>
      {children}
    </ScanQueueContext.Provider>
  );
}
