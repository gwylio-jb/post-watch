/**
 * Tests for KPI helpers + register helpers.
 *
 * Protecting:
 *  - period keys (monthly / quarterly)
 *  - recordKpiValue upserts + keeps entries sorted
 *  - onTarget tri-state
 *  - computeAutoKpis client scoping + null-when-no-data
 *  - training CSV import header tolerance + skip counting
 *  - incident resolution + asset criticality
 */
import type { Finding, GapAnalysisSession } from '../data/types';
import type { AuditReport } from '../data/auditTypes';
import {
  newKpi, currentPeriod, recordKpiValue, latestEntry, onTarget, computeAutoKpis, kpisToCsv,
} from './kpis';
import {
  parseTrainingCsv, trainingCompletionPct, newIncidentRecord, resolveIncident,
  newAssetRecord, assetCriticality,
} from './registers';

describe('currentPeriod', () => {
  it('formats monthly and quarterly keys', () => {
    const d = new Date('2026-08-15T00:00:00Z');
    expect(currentPeriod('monthly', d)).toBe('2026-08');
    expect(currentPeriod('quarterly', d)).toBe('2026-Q3');
  });
});

describe('recordKpiValue', () => {
  it('upserts a period and keeps entries sorted', () => {
    let k = newKpi({ clientId: 'c1', name: 'Patch SLA', unit: '%', cadence: 'monthly' });
    k = recordKpiValue(k, '2026-03', 80);
    k = recordKpiValue(k, '2026-01', 60);
    k = recordKpiValue(k, '2026-03', 85); // overwrite
    expect(k.entries).toEqual([
      { period: '2026-01', value: 60 },
      { period: '2026-03', value: 85 },
    ]);
    expect(latestEntry(k)?.value).toBe(85);
  });
});

describe('onTarget', () => {
  it('null without target or entries; boolean otherwise', () => {
    let k = newKpi({ clientId: 'c1', name: 'x', unit: '%', cadence: 'monthly' });
    expect(onTarget(k)).toBeNull();
    k = { ...k, target: 90 };
    expect(onTarget(k)).toBeNull();
    k = recordKpiValue(k, '2026-01', 95);
    expect(onTarget(k)).toBe(true);
    k = recordKpiValue(k, '2026-02', 70);
    expect(onTarget(k)).toBe(false);
  });
});

describe('computeAutoKpis', () => {
  const findings: Finding[] = [
    { id: 'f1', clientId: 'c1', source: 'manual', title: 'a', description: '', severity: 'low', refIds: [], status: 'open', raisedAt: '2026-01-01' },
    { id: 'f2', clientId: 'c2', source: 'manual', title: 'b', description: '', severity: 'low', refIds: [], status: 'open', raisedAt: '2026-01-01' },
  ];
  const sessions: GapAnalysisSession[] = [{
    id: 's1', name: 's', createdAt: '2026-01-01', updatedAt: '2026-01-02', clientId: 'c1',
    items: [
      { itemId: 'A.5.1', itemType: 'control', status: 'Compliant', notes: '', priority: 'Low', responsible: '' },
      { itemId: 'A.5.2', itemType: 'control', status: 'Non-Compliant', notes: '', priority: 'Low', responsible: '' },
    ],
  }];
  const reports: AuditReport[] = [
    { id: 'r1', targetUrl: 'https://x', domain: 'x', startedAt: '2026-01-01', checks: [], score: 90, clientId: 'c1' },
    { id: 'r2', targetUrl: 'https://x', domain: 'x', startedAt: '2026-02-01', checks: [], score: 70, clientId: 'c1' },
  ];

  it('scopes to the client and averages WP scores', () => {
    const auto = computeAutoKpis({ clientId: 'c1', findings, gapSessions: sessions, reports });
    const byId = new Map(auto.map(a => [a.id, a.value]));
    expect(byId.get('auto-compliance')).toBe(50);
    expect(byId.get('auto-wp-mean')).toBe(80);
    expect(byId.get('auto-open-capa')).toBe(1); // only c1's finding
  });

  it('nulls when no data', () => {
    const auto = computeAutoKpis({ clientId: 'empty', findings: [], gapSessions: [], reports: [] });
    const byId = new Map(auto.map(a => [a.id, a.value]));
    expect(byId.get('auto-compliance')).toBeNull();
    expect(byId.get('auto-wp-mean')).toBeNull();
  });
});

describe('kpisToCsv', () => {
  it('one row per entry, plus a placeholder row for empty KPIs', () => {
    let k = newKpi({ clientId: 'c1', name: 'Patch "SLA"', unit: '%', cadence: 'monthly' });
    k = recordKpiValue(k, '2026-01', 60);
    const empty = newKpi({ clientId: 'c1', name: 'Empty', unit: 'n', cadence: 'quarterly' });
    const csv = kpisToCsv([k, empty]);
    expect(csv.split('\n')).toHaveLength(3);
    expect(csv).toContain('"Patch ""SLA"""');
  });
});

describe('parseTrainingCsv', () => {
  it('maps common HR headers case-insensitively and counts skips', () => {
    const { records, skipped } = parseTrainingCsv([
      { Employee: 'Ann', Course: 'Phishing 101', 'Completion Date': '2026-03-01', Result: 'Pass' },
      { Employee: 'Bob', Course: 'Phishing 101', 'Completion Date': '2026-03-01', Result: 'Fail' },
      { Employee: '', Course: 'Orphan row' },
    ], 'c1');
    expect(records).toHaveLength(2);
    expect(skipped).toBe(1);
    expect(records[0].passed).toBe(true);
    expect(records[1].passed).toBe(false);
    expect(trainingCompletionPct(records)).toBe(50);
  });
});

describe('incidents + assets', () => {
  it('resolveIncident stamps resolvedAt and captures root cause', () => {
    const i = resolveIncident(
      newIncidentRecord({ clientId: 'c1', title: 'Phishing email clicked' }),
      'No awareness training', 'Schedule quarterly training',
    );
    expect(i.status).toBe('resolved');
    expect(i.resolvedAt).toBeTruthy();
    expect(i.rootCause).toBe('No awareness training');
  });

  it('assetCriticality is max(C,I,A) and inputs clamp to 1-5', () => {
    const a = newAssetRecord({ clientId: 'c1', name: 'CRM', confidentiality: 9, integrity: 2, availability: 0 });
    expect(a.confidentiality).toBe(5);
    expect(a.availability).toBe(1);
    expect(assetCriticality(a)).toBe(5);
  });
});
