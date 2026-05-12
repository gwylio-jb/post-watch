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

/**
 * Key for the "backup is overdue" flag. The SettingsPanel reads this to
 * surface a banner; clicking 'Export now' clears it.
 */
const BACKUP_PENDING_KEY = 'clause-control:post-watch:backup-pending';

export function ScanQueueProvider({ children }: { children: ReactNode }) {
  const queue = useScanQueue();
  const scheduler = useScanScheduler({
    onFire: schedule => {
      if (schedule.kind === 'wp-scan') {
        queue.enqueue([{ targetUrl: `https://${schedule.domain}`, clientId: schedule.clientId }]);
        return;
      }
      if (schedule.kind === 'backup') {
        // Set the pending flag — Settings panel reacts to this via
        // useLocalStorage. We deliberately DON'T auto-trigger the
        // download: silent file writes on a schedule are hostile UX.
        // The user sees a banner next time they open Settings.
        try { localStorage.setItem(BACKUP_PENDING_KEY, new Date().toISOString()); }
        catch { /* ignore */ }
        return;
      }
    },
  });
  return (
    <ScanQueueContext.Provider value={{ queue, scheduler }}>
      {children}
    </ScanQueueContext.Provider>
  );
}
