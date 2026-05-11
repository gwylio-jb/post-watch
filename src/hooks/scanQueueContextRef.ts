/**
 * Internal — React context for portfolio-mode infrastructure (batch scan
 * queue + recurring schedules).
 *
 * Lives in its own file so `scanQueueContext.tsx` can export only the
 * Provider component (satisfies react-refresh's only-export-components
 * rule). Consumers import the hooks from this file; the Provider mounts
 * via the .tsx file.
 *
 * Why both queue AND scheduler share a single context: each hook instance
 * owns its own ticker / runner. Mounting twice means two tickers writing
 * to the same localStorage, racing each other. The context guarantees one
 * instance per app — every consumer sees the same source of truth.
 */
import { createContext, useContext } from 'react';
import type { UseScanQueueResult } from './useScanQueue';
import type { UseScanSchedulerResult } from './useScanScheduler';

export interface PortfolioContextValue {
  queue: UseScanQueueResult;
  scheduler: UseScanSchedulerResult;
}

export const ScanQueueContext = createContext<PortfolioContextValue | null>(null);

export function useScanQueueContext(): UseScanQueueResult {
  return usePortfolioContext().queue;
}

export function useSchedulerContext(): UseScanSchedulerResult {
  return usePortfolioContext().scheduler;
}

function usePortfolioContext(): PortfolioContextValue {
  const ctx = useContext(ScanQueueContext);
  if (!ctx) {
    throw new Error(
      'usePortfolioContext / useScanQueueContext / useSchedulerContext must ' +
      'be used inside <ScanQueueProvider>. The provider lives near the App ' +
      'root so the queue runner + scheduler tick across page changes.',
    );
  }
  return ctx;
}
