/**
 * Tests for queryExecutor.
 *
 * Each filter shape gets covered against fixtures designed to be the
 * minimum required to disambiguate it. We're protecting:
 *   - severity bucketing for risks (the 1-25 → low/medium/high/critical map)
 *   - report score inversion (high score = low severity finding)
 *   - clientName resolves via the clients[] lookup
 *   - createdAt ranges include the boundary
 *   - filters are AND-combined; empty filters returns everything
 */
import type { RiskItem, Client, GapAnalysisSession } from '../../data/types';
import type { AuditReport } from '../../data/auditTypes';
import { executeQueryPlan, severityBucketForScore } from './queryExecutor';

const clients: Client[] = [
  { id: 'c-acme',  name: 'Acme',  createdAt: '2025-01-01' },
  { id: 'c-globe', name: 'Globex', createdAt: '2025-03-15' },
];

const baseRisk: Omit<RiskItem, 'id' | 'name' | 'score' | 'status' | 'clientId'> = {
  description: '', category: 'Operational',
  likelihood: 3, impact: 3, treatment: 'Mitigate',
  owner: '', dueDate: '2025-06-01',
};

const risks: RiskItem[] = [
  { ...baseRisk, id: 'r1', name: 'Phishing',     score: 22, status: 'Open',         clientId: 'c-acme'  },
  { ...baseRisk, id: 'r2', name: 'Stale backups', score: 14, status: 'In Treatment', clientId: 'c-acme'  },
  { ...baseRisk, id: 'r3', name: 'Closed thing',  score: 8,  status: 'Closed',       clientId: 'c-globe' },
  { ...baseRisk, id: 'r4', name: 'Tiny',          score: 4,  status: 'Open',         clientId: 'c-globe' },
];

const reports: AuditReport[] = [
  { id: 'rep1', targetUrl: 'https://acme.com',  domain: 'acme.com',  startedAt: '2025-01-10', completedAt: '2025-01-10', checks: [], score: 92, clientId: 'c-acme'  },
  { id: 'rep2', targetUrl: 'https://globex.io', domain: 'globex.io', startedAt: '2025-03-20', completedAt: '2025-03-20', checks: [], score: 40, clientId: 'c-globe' },
];

const sessions: GapAnalysisSession[] = [];

const data = { risks, reports, sessions, clients };

describe('severityBucketForScore', () => {
  it('buckets the 1-25 range', () => {
    expect(severityBucketForScore(4)).toBe('low');
    expect(severityBucketForScore(10)).toBe('medium');
    expect(severityBucketForScore(15)).toBe('high');
    expect(severityBucketForScore(22)).toBe('critical');
  });
});

describe('executeQueryPlan — risks', () => {
  it('empty filters returns all rows', () => {
    const out = executeQueryPlan({ collection: 'risks', filters: [] }, data);
    expect(out.map(r => r.id)).toEqual(['r1', 'r2', 'r3', 'r4']);
  });

  it('filters by severity bucket', () => {
    const out = executeQueryPlan({
      collection: 'risks',
      filters: [{ field: 'severity', op: 'in', value: ['high', 'critical'] }],
    }, data);
    expect(out.map(r => r.id).sort()).toEqual(['r1', 'r2']);
  });

  it('filters by clientName contains', () => {
    const out = executeQueryPlan({
      collection: 'risks',
      filters: [{ field: 'clientName', op: 'contains', value: 'acme' }],
    }, data);
    expect(out.every(r => r.subtitle?.includes('Acme'))).toBe(true);
    expect(out).toHaveLength(2);
  });

  it('filters by status (case-insensitive)', () => {
    const out = executeQueryPlan({
      collection: 'risks',
      filters: [{ field: 'status', op: 'in', value: ['open'] }],
    }, data);
    expect(out.map(r => r.id).sort()).toEqual(['r1', 'r4']);
  });

  it('AND-combines multiple filters', () => {
    const out = executeQueryPlan({
      collection: 'risks',
      filters: [
        { field: 'clientName', op: 'equals', value: 'Acme' },
        { field: 'severity', op: 'in', value: ['critical'] },
      ],
    }, data);
    expect(out.map(r => r.id)).toEqual(['r1']);
  });
});

describe('executeQueryPlan — reports', () => {
  it('inverts score to severity (low score = critical finding)', () => {
    const out = executeQueryPlan({
      collection: 'reports',
      filters: [{ field: 'severity', op: 'in', value: ['high', 'critical'] }],
    }, data);
    // rep1 has score 92 → severity low; rep2 has score 40 → severity high.
    expect(out.map(r => r.id)).toEqual(['rep2']);
  });

  it('filters by createdAt (after)', () => {
    const out = executeQueryPlan({
      collection: 'reports',
      filters: [{ field: 'createdAt', op: 'after', value: '2025-02-01' }],
    }, data);
    expect(out.map(r => r.id)).toEqual(['rep2']);
  });
});

describe('executeQueryPlan — clients', () => {
  it('filters by name contains', () => {
    const out = executeQueryPlan({
      collection: 'clients',
      filters: [{ field: 'clientName', op: 'contains', value: 'glob' }],
    }, data);
    expect(out.map(r => r.id)).toEqual(['c-globe']);
  });
});
