import type {
  Client,
  RiskItem,
  SavedCheatsheet,
  GapAnalysisSession,
  ImplementationSession,
} from '../data/types';
import type { AuditReport } from '../data/auditTypes';

// ─── V2.1 Client-centric migration ───────────────────────────────────────────
// V2.1 introduces a client primitive. Every record that represents billable
// work (risks, cheatsheets, gap sessions, WP scans) now carries a clientId.
// For pre-V2.1 data we seed a default "Unassigned" client and back-fill it
// onto every existing record so filters, dashboards and reports always have
// a valid client to group by.
//
// Uses a localStorage flag so the migration runs exactly once per device.

// Bumped from v2.1 → v2.1.1 in Sprint 7 so the backfill re-runs and picks up
// ImplementationSession (newly client-aware). The migration body is idempotent
// — re-running on already-migrated data is a no-op for risks, cheatsheets,
// gap sessions and reports. Only impl-sessions actually get touched.
export const MIGRATION_FLAG_KEY = 'clause-control:post-watch:migrated-v2.1.1';
export const UNASSIGNED_CLIENT_ID = 'unassigned';
const LS_PREFIX = 'clause-control:';

interface MigrationResult {
  ran: boolean;
  counts: {
    clients: number;
    risks: number;
    cheatsheets: number;
    gapSessions: number;
    implementations: number;
    reports: number;
  };
}

function readJson<T>(rawKey: string): T | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + rawKey);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(rawKey: string, value: unknown): void {
  localStorage.setItem(LS_PREFIX + rawKey, JSON.stringify(value));
}

function ensureUnassignedClient(): boolean {
  const clients = readJson<Client[]>('clients') ?? [];
  if (clients.some(c => c.id === UNASSIGNED_CLIENT_ID)) return false;
  const unassigned: Client = {
    id: UNASSIGNED_CLIENT_ID,
    name: 'Unassigned',
    notes: 'Auto-created for records that existed before client-centric data was introduced. Move them to the right client when you can.',
    createdAt: new Date().toISOString(),
  };
  writeJson('clients', [unassigned, ...clients]);
  return true;
}

function backfillArray<T extends { clientId?: string }>(
  key: string,
): number {
  const items = readJson<T[]>(key);
  if (!Array.isArray(items) || items.length === 0) return 0;
  let touched = 0;
  const next = items.map(item => {
    if (item.clientId) return item;
    touched++;
    return { ...item, clientId: UNASSIGNED_CLIENT_ID };
  });
  if (touched > 0) writeJson(key, next);
  return touched;
}

/**
 * Run the V2.1 client-centric migration if it hasn't already run on this
 * device. Idempotent — safe to call on every mount.
 */
export function runClientMigration(): MigrationResult {
  const result: MigrationResult = {
    ran: false,
    counts: { clients: 0, risks: 0, cheatsheets: 0, gapSessions: 0, implementations: 0, reports: 0 },
  };

  if (typeof window === 'undefined') return result;
  if (localStorage.getItem(MIGRATION_FLAG_KEY) === 'done') return result;

  const clientCreated = ensureUnassignedClient();
  result.counts.clients = clientCreated ? 1 : 0;
  result.counts.risks = backfillArray<RiskItem>('post-watch:risks');
  result.counts.cheatsheets = backfillArray<SavedCheatsheet>('cheatsheets');
  result.counts.gapSessions = backfillArray<GapAnalysisSession>('gap-sessions');
  result.counts.implementations = backfillArray<ImplementationSession>('impl-sessions');
  result.counts.reports = backfillArray<AuditReport>('wp-audit-reports');

  localStorage.setItem(MIGRATION_FLAG_KEY, 'done');
  result.ran = true;
  return result;
}
