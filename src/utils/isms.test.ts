/**
 * Tests for internal-audit + management-review helpers.
 *
 * Protecting:
 *  - checklist progress + first-touch status transition
 *  - ismsCoverage: rolling window, only completed audits, only covered
 *    items count, cross-client isolation
 *  - MR snapshot maths (open/overdue findings, latest-session compliance)
 *  - mrCompleteness counts non-empty topics
 */
import type { Finding, GapAnalysisSession } from '../data/types';
import type { AuditReport } from '../data/auditTypes';
import { allControls } from '../data/controls';
import { managementClauses } from '../data/clauses';
import {
  newInternalAudit, checklistProgress, updateChecklistItem, completeAudit,
  ismsCoverage, buildMrSnapshot, newManagementReview, mrCompleteness,
  MR_AGENDA_TOPICS,
} from './isms';

const NOW = new Date('2026-07-01T00:00:00Z');

describe('internal audit checklist', () => {
  it('new audit is planned with an unchecked checklist', () => {
    const a = newInternalAudit({
      clientId: 'c1', title: 'H1 audit', auditor: 'Josh',
      plannedDate: '2026-08-01', refIds: ['A.5.1', 'A.5.2'],
    });
    expect(a.status).toBe('planned');
    expect(checklistProgress(a)).toEqual({ covered: 0, total: 2, pct: 0 });
  });

  it('first checklist touch moves planned → in-progress', () => {
    let a = newInternalAudit({
      clientId: 'c1', title: 'a', auditor: 'J', plannedDate: '2026-08-01', refIds: ['A.5.1'],
    });
    a = updateChecklistItem(a, 'A.5.1', { covered: true });
    expect(a.status).toBe('in-progress');
    expect(checklistProgress(a).pct).toBe(100);
  });

  it('completeAudit stamps completedDate', () => {
    const a = completeAudit(newInternalAudit({
      clientId: 'c1', title: 'a', auditor: 'J', plannedDate: '2026-08-01', refIds: [],
    }));
    expect(a.status).toBe('complete');
    expect(a.completedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('ismsCoverage', () => {
  function completedAudit(clientId: string, completedDate: string, refIds: string[], covered = true) {
    let a = newInternalAudit({ clientId, title: 't', auditor: 'J', plannedDate: completedDate, refIds });
    for (const id of refIds) a = updateChecklistItem(a, id, { covered });
    return { ...completeAudit(a), completedDate };
  }

  it('counts covered refs from completed audits inside the window', () => {
    const audits = [completedAudit('c1', '2026-01-15', ['A.5.1', 'A.5.2'])];
    const cov = ismsCoverage(audits, 'c1', NOW);
    expect(cov.covered).toBe(2);
    expect(cov.total).toBe(allControls.length + managementClauses.length);
  });

  it('ignores audits older than 12 months, other clients, and planned audits', () => {
    const stale = completedAudit('c1', '2024-01-15', ['A.5.1']);
    const otherClient = completedAudit('c2', '2026-01-15', ['A.5.2']);
    const planned = newInternalAudit({ clientId: 'c1', title: 'x', auditor: 'J', plannedDate: '2026-08-01', refIds: ['A.5.3'] });
    expect(ismsCoverage([stale, otherClient, planned], 'c1', NOW).covered).toBe(0);
  });

  it('does not count unchecked items from a completed audit', () => {
    const half = completedAudit('c1', '2026-02-01', ['A.5.1'], false);
    expect(ismsCoverage([half], 'c1', NOW).covered).toBe(0);
  });
});

describe('management review', () => {
  const findings: Finding[] = [
    { id: 'f1', clientId: 'c1', source: 'manual', title: 'x', description: '', severity: 'high', refIds: [], status: 'open', raisedAt: '2026-01-01' },
    { id: 'f2', clientId: 'c1', source: 'manual', title: 'y', description: '', severity: 'low', refIds: [], status: 'action-planned', action: { owner: 'J', dueDate: '2020-01-01', description: '' }, raisedAt: '2026-01-01' },
    { id: 'f3', clientId: 'c1', source: 'manual', title: 'z', description: '', severity: 'low', refIds: [], status: 'closed', raisedAt: '2026-01-01', closedAt: '2026-02-01' },
    { id: 'f4', clientId: 'other', source: 'manual', title: 'w', description: '', severity: 'low', refIds: [], status: 'open', raisedAt: '2026-01-01' },
  ];
  const sessions: GapAnalysisSession[] = [{
    id: 's1', name: 'S', createdAt: '2026-01-01', updatedAt: '2026-05-01', clientId: 'c1',
    items: [
      { itemId: 'A.5.1', itemType: 'control', status: 'Compliant', notes: '', priority: 'Low', responsible: '' },
      { itemId: 'A.5.2', itemType: 'control', status: 'Non-Compliant', notes: '', priority: 'Low', responsible: '' },
    ],
  }];
  const reports: AuditReport[] = [
    { id: 'r1', targetUrl: 'https://a.com', domain: 'a.com', startedAt: '2026-04-01', completedAt: '2026-04-01', checks: [], score: 88, clientId: 'c1' },
  ];

  it('builds an honest snapshot scoped to the client', () => {
    const snap = buildMrSnapshot({ clientId: 'c1', findings, gapSessions: sessions, reports, soaStore: {} });
    expect(snap.openFindings).toBe(2);      // f1 + f2 (f3 closed, f4 other client)
    expect(snap.overdueFindings).toBe(1);   // f2
    expect(snap.compliancePct).toBe(50);
    expect(snap.latestWpScore).toBe(88);
    expect(snap.soaCompleteness).toBeNull(); // no SoA entries for c1
  });

  it('new review carries every agenda topic and counts completeness', () => {
    const snap = buildMrSnapshot({ clientId: 'c1', findings: [], gapSessions: [], reports: [], soaStore: {} });
    const mr = newManagementReview({ clientId: 'c1', date: '2026-07-01', attendees: ['Josh'], snapshot: snap });
    expect(Object.keys(mr.minutes)).toHaveLength(MR_AGENDA_TOPICS.length);
    expect(mrCompleteness(mr).done).toBe(0);
    mr.minutes[MR_AGENDA_TOPICS[0]] = 'All previous actions closed.';
    expect(mrCompleteness(mr).done).toBe(1);
  });
});
