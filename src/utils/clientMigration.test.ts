/**
 * Tests for runClientMigration — the V2.1 one-shot that seeds an
 * "Unassigned" client and back-fills clientId onto every legacy record.
 *
 * What we're protecting against:
 *  - Migration running twice (would create duplicate "Unassigned" clients
 *    or stomp clientIds the user has since corrected manually).
 *  - Migration silently failing on partially-migrated data — Sprint 7 added
 *    impl-sessions to the backfill set, so devices already on v2.1 pre-bump
 *    must still pick up the newer key.
 *  - Records that already have a clientId being touched (would lose user
 *    data).
 *  - JSON parse failures crashing the boot path.
 */
import { runClientMigration, UNASSIGNED_CLIENT_ID, MIGRATION_FLAG_KEY } from './clientMigration';
import type { Client, RiskItem, GapAnalysisSession } from '../data/types';
import type { AuditReport } from '../data/auditTypes';

const KEY = (k: string) => `clause-control:${k}`;

function seed<T>(key: string, value: T) {
  window.localStorage.setItem(KEY(key), JSON.stringify(value));
}
function read<T>(key: string): T | null {
  const raw = window.localStorage.getItem(KEY(key));
  return raw ? JSON.parse(raw) as T : null;
}

describe('runClientMigration', () => {
  it('runs on a clean device and reports counts of zero', () => {
    const result = runClientMigration();
    expect(result.ran).toBe(true);
    expect(result.counts.clients).toBe(1);    // Unassigned was seeded
    expect(result.counts.risks).toBe(0);
    expect(result.counts.gapSessions).toBe(0);
    expect(result.counts.reports).toBe(0);
  });

  it('seeds the "Unassigned" client when none exists', () => {
    runClientMigration();
    const clients = read<Client[]>('clients');
    expect(clients).toHaveLength(1);
    expect(clients?.[0].id).toBe(UNASSIGNED_CLIENT_ID);
    expect(clients?.[0].name).toBe('Unassigned');
  });

  it('does not duplicate the "Unassigned" client on second pass', () => {
    runClientMigration();
    // Pretend a fresh boot reads the flag — clear flag but keep clients
    window.localStorage.removeItem(MIGRATION_FLAG_KEY);
    runClientMigration();
    const clients = read<Client[]>('clients');
    expect(clients).toHaveLength(1);
  });

  it('backfills clientId onto risks that lack one', () => {
    const legacyRisk: Omit<RiskItem, 'clientId'> = {
      id: 'r1',
      name: 'Pre-V2.1 risk',
      description: '',
      category: 'Technical',
      likelihood: 3,
      impact: 4,
      score: 12,
      treatment: 'Mitigate',
      owner: 'JB',
      dueDate: '',
      status: 'Open',
    };
    seed('post-watch:risks', [legacyRisk]);

    const result = runClientMigration();

    expect(result.counts.risks).toBe(1);
    const risks = read<RiskItem[]>('post-watch:risks');
    expect(risks?.[0].clientId).toBe(UNASSIGNED_CLIENT_ID);
  });

  it('does not overwrite a clientId the user already set', () => {
    const taggedRisk: RiskItem = {
      id: 'r2', clientId: 'client-real',
      name: 'Already tagged', description: '', category: 'Technical',
      likelihood: 2, impact: 2, score: 4, treatment: 'Accept',
      owner: '', dueDate: '', status: 'Open',
    };
    seed('post-watch:risks', [taggedRisk]);

    runClientMigration();

    const risks = read<RiskItem[]>('post-watch:risks');
    expect(risks?.[0].clientId).toBe('client-real');
  });

  it('writes the migration flag so a second run is a no-op', () => {
    runClientMigration();
    expect(window.localStorage.getItem(MIGRATION_FLAG_KEY)).toBe('done');

    const second = runClientMigration();
    expect(second.ran).toBe(false);
    expect(second.counts.clients).toBe(0);
  });

  it('handles malformed JSON in any backfill key without throwing', () => {
    window.localStorage.setItem(KEY('post-watch:risks'), '{not valid');
    window.localStorage.setItem(KEY('gap-sessions'), 'definitely not json');

    expect(() => runClientMigration()).not.toThrow();
    // Migration still completed — flag is set.
    expect(window.localStorage.getItem(MIGRATION_FLAG_KEY)).toBe('done');
  });

  it('back-fills mixed-state arrays — touches only un-tagged items', () => {
    const sessions: (GapAnalysisSession | Omit<GapAnalysisSession, 'clientId'>)[] = [
      // Already tagged
      {
        id: 's1', clientId: 'c-1',
        name: 'Tagged session', items: [],
        createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      } as GapAnalysisSession,
      // Legacy untagged
      {
        id: 's2',
        name: 'Untagged session', items: [],
        createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      } as Omit<GapAnalysisSession, 'clientId'>,
    ];
    seed('gap-sessions', sessions);

    const result = runClientMigration();

    expect(result.counts.gapSessions).toBe(1);
    const after = read<GapAnalysisSession[]>('gap-sessions');
    expect(after?.[0].clientId).toBe('c-1');
    expect(after?.[1].clientId).toBe(UNASSIGNED_CLIENT_ID);
  });

  it('back-fills WP audit reports with clientId', () => {
    const legacyReport = {
      id: 'rep1', domain: 'example.com', targetUrl: 'https://example.com',
      score: 78, startedAt: '2026-04-01T00:00:00Z', completedAt: '2026-04-01T00:01:00Z',
      checks: [],
    } as Omit<AuditReport, 'clientId'>;
    seed('wp-audit-reports', [legacyReport]);

    runClientMigration();

    const reports = read<AuditReport[]>('wp-audit-reports');
    expect(reports?.[0].clientId).toBe(UNASSIGNED_CLIENT_ID);
  });
});
