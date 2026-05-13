/**
 * Tests for the portfolio summary aggregator.
 *
 * What we're protecting against:
 *  - Wrong client tagging: a scan / session / risk that belongs to
 *    another client must NOT count against this client's row.
 *  - Latest-scan picker: must pick the most recent completed scan,
 *    not the first.
 *  - Compliance % excludes 'Not Applicable' items.
 *  - Closed risks don't count toward openRisks / criticalRisks.
 *  - lastActivityAt picks the most-recent timestamp across scans,
 *    sessions, and risks.
 *  - Sort order: most-recently-active first.
 */
import { buildPortfolioSummary } from './portfolioSummary';
import type { AuditReport } from '../data/auditTypes';
import type { GapAnalysisSession, Client, RiskItem } from '../data/types';

function fakeClient(over: Partial<Client> = {}): Client {
  return {
    id: 'c-1', name: 'Acme', createdAt: '2026-01-01T00:00:00Z',
    ...over,
  };
}

function fakeReport(over: Partial<AuditReport> = {}): AuditReport {
  return {
    id: `r-${Math.random()}`,
    targetUrl: 'https://example.com',
    domain: 'example.com',
    startedAt: '2026-01-01T00:00:00Z',
    score: 50,
    checks: [],
    clientId: 'c-1',
    ...over,
  };
}

function fakeSession(over: Partial<GapAnalysisSession> = {}): GapAnalysisSession {
  return {
    id: 's-1',
    name: 'Acme gap',
    items: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    clientId: 'c-1',
    ...over,
  };
}

function fakeRisk(over: Partial<RiskItem> = {}): RiskItem {
  return {
    id: `risk-${Math.random()}`,
    name: 'A risk',
    description: '',
    category: 'Technical',
    likelihood: 3, impact: 3, score: 9,
    treatment: 'Mitigate',
    owner: '', dueDate: '', status: 'Open',
    clientId: 'c-1',
    ...over,
  };
}

describe('buildPortfolioSummary', () => {
  it('returns one row per client even with no data', () => {
    const rows = buildPortfolioSummary([fakeClient(), fakeClient({ id: 'c-2', name: 'Beta' })], [], [], []);
    expect(rows).toHaveLength(2);
    expect(rows.every(r => r.latestScore === null && r.compliancePct === null && r.openRisks === 0)).toBe(true);
  });

  it('only counts data tagged to this client', () => {
    const clients = [fakeClient({ id: 'c-1', name: 'Acme' }), fakeClient({ id: 'c-2', name: 'Beta' })];
    const reports = [
      fakeReport({ clientId: 'c-1', score: 80 }),
      fakeReport({ clientId: 'c-2', score: 40 }),
    ];
    const rows = buildPortfolioSummary(clients, reports, [], []);
    expect(rows.find(r => r.clientId === 'c-1')!.latestScore).toBe(80);
    expect(rows.find(r => r.clientId === 'c-2')!.latestScore).toBe(40);
  });

  it('picks the most-recent scan per client', () => {
    const reports = [
      fakeReport({ score: 30, startedAt: '2026-01-01T00:00:00Z' }),
      fakeReport({ score: 80, startedAt: '2026-04-01T00:00:00Z' }),
      fakeReport({ score: 50, startedAt: '2026-02-01T00:00:00Z' }),
    ];
    const rows = buildPortfolioSummary([fakeClient()], reports, [], []);
    expect(rows[0].latestScore).toBe(80);
  });

  it('excludes Not-Applicable items from the compliance %', () => {
    const session = fakeSession({
      items: [
        { itemId: 'A.5.1', itemType: 'control', status: 'Compliant',     priority: 'High', notes: '', responsible: '' },
        { itemId: 'A.5.2', itemType: 'control', status: 'Non-Compliant', priority: 'High', notes: '', responsible: '' },
        { itemId: 'A.5.3', itemType: 'control', status: 'Not Applicable', priority: 'Low', notes: '', responsible: '' },
      ],
    });
    const rows = buildPortfolioSummary([fakeClient()], [], [session], []);
    // 1 compliant out of 2 NA-excluded items = 50%
    expect(rows[0].compliancePct).toBe(50);
    expect(rows[0].complianceItemCount).toBe(2);
  });

  it('returns null compliance pct when no items qualify', () => {
    const session = fakeSession({
      items: [
        { itemId: 'A.5.1', itemType: 'control', status: 'Not Applicable', priority: 'Low', notes: '', responsible: '' },
      ],
    });
    const rows = buildPortfolioSummary([fakeClient()], [], [session], []);
    expect(rows[0].compliancePct).toBeNull();
  });

  it('counts open + critical risks, excludes Closed', () => {
    const risks = [
      fakeRisk({ score: 20, status: 'Open' }),
      fakeRisk({ score: 18, status: 'In Treatment' }),
      fakeRisk({ score: 4,  status: 'Open' }),
      fakeRisk({ score: 25, status: 'Closed' }),  // ignored
    ];
    const rows = buildPortfolioSummary([fakeClient()], [], [], risks);
    expect(rows[0].openRisks).toBe(3);
    expect(rows[0].criticalRisks).toBe(2);
  });

  it('sorts clients by lastActivityAt newest-first', () => {
    const clients = [
      fakeClient({ id: 'old', name: 'Old' }),
      fakeClient({ id: 'new', name: 'New' }),
    ];
    const reports = [
      fakeReport({ clientId: 'old', startedAt: '2025-01-01T00:00:00Z' }),
      fakeReport({ clientId: 'new', startedAt: '2026-04-01T00:00:00Z' }),
    ];
    const rows = buildPortfolioSummary(clients, reports, [], []);
    expect(rows[0].clientId).toBe('new');
    expect(rows[1].clientId).toBe('old');
  });
});
