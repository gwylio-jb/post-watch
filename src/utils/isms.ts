/**
 * Sprint 25 (v3.0 pillar #3): internal audit + management review helpers.
 *
 * Pure functions; storage binds in the components. Coverage maths and
 * the MR snapshot builder live here so they're unit-testable.
 */
import type {
  InternalAudit, AuditChecklistItem, ManagementReview,
  GapAnalysisSession, Finding, SoaStore,
} from '../data/types';
import type { AuditReport } from '../data/auditTypes';
import { allControls } from '../data/controls';
import { managementClauses } from '../data/clauses';
import { openFindings, overdueFindings } from './findings';
import { computeStats as computeSoaStats } from './soa';

/* ─── Internal audits ─────────────────────────────────────────────────── */

export function newInternalAudit(args: {
  clientId: string;
  title: string;
  auditor: string;
  plannedDate: string;
  refIds: string[];
}): InternalAudit {
  return {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    clientId: args.clientId,
    title: args.title,
    auditor: args.auditor,
    plannedDate: args.plannedDate,
    status: 'planned',
    checklist: args.refIds.map(refId => ({ refId, covered: false, notes: '' })),
    findingIds: [],
  };
}

export function checklistProgress(audit: InternalAudit): { covered: number; total: number; pct: number } {
  const total = audit.checklist.length;
  const covered = audit.checklist.filter(i => i.covered).length;
  return { total, covered, pct: total === 0 ? 0 : Math.round((covered / total) * 100) };
}

export function updateChecklistItem(
  audit: InternalAudit,
  refId: string,
  patch: Partial<Pick<AuditChecklistItem, 'covered' | 'notes'>>,
): InternalAudit {
  return {
    ...audit,
    // First touch moves a planned audit into in-progress automatically.
    status: audit.status === 'planned' ? 'in-progress' : audit.status,
    checklist: audit.checklist.map(i => i.refId === refId ? { ...i, ...patch } : i),
  };
}

export function completeAudit(audit: InternalAudit): InternalAudit {
  return { ...audit, status: 'complete', completedDate: new Date().toISOString().slice(0, 10) };
}

/**
 * Rolling-12-month ISMS coverage for one client: which clause/control
 * ids appeared (covered=true) in audits completed within the window,
 * as a fraction of the whole standard. This is the number an auditor
 * checks against your audit programme ("did you audit everything?").
 */
export function ismsCoverage(
  audits: InternalAudit[],
  clientId: string,
  now = new Date(),
): { covered: number; total: number; pct: number } {
  const windowStart = new Date(now);
  windowStart.setFullYear(windowStart.getFullYear() - 1);

  const coveredIds = new Set<string>();
  for (const a of audits) {
    if (a.clientId !== clientId || a.status !== 'complete' || !a.completedDate) continue;
    const done = Date.parse(a.completedDate);
    if (Number.isNaN(done) || done < windowStart.getTime() || done > now.getTime()) continue;
    for (const item of a.checklist) {
      if (item.covered) coveredIds.add(item.refId);
    }
  }

  const total = allControls.length + managementClauses.length;
  const covered = coveredIds.size;
  return { covered, total, pct: total === 0 ? 0 : Math.round((covered / total) * 100) };
}

/* ─── Management review ───────────────────────────────────────────────── */

/**
 * Fixed agenda mirroring clause 9.3.2's required inputs. Auditors check
 * that reviews covered these topics — so the record structure enforces it.
 */
export const MR_AGENDA_TOPICS = [
  'Status of actions from previous reviews',
  'Changes in external and internal issues',
  'Nonconformities and corrective actions',
  'Monitoring and measurement results',
  'Audit results',
  'Fulfilment of information security objectives',
  'Feedback from interested parties',
  'Results of risk assessment and treatment plan status',
  'Opportunities for continual improvement',
] as const;

export function buildMrSnapshot(args: {
  clientId: string;
  findings: Finding[];
  gapSessions: GapAnalysisSession[];
  reports: AuditReport[];
  soaStore: SoaStore;
}): ManagementReview['snapshot'] {
  const clientFindings = args.findings.filter(f => f.clientId === args.clientId);

  // Compliance % from the latest gap session for this client.
  const latestSession = args.gapSessions
    .filter(s => (s.clientId ?? 'unassigned') === args.clientId)
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))[0];
  let compliancePct: number | null = null;
  if (latestSession && latestSession.items.length > 0) {
    const compliant = latestSession.items.filter(i => i.status === 'Compliant').length;
    compliancePct = Math.round((compliant / latestSession.items.length) * 100);
  }

  // Latest WP score across this client's reports.
  const latestReport = args.reports
    .filter(r => (r.clientId ?? 'unassigned') === args.clientId)
    .sort((a, b) => (b.completedAt ?? b.startedAt).localeCompare(a.completedAt ?? a.startedAt))[0];

  const soaEntries = args.soaStore[args.clientId];
  const soaCompleteness = soaEntries && soaEntries.length > 0
    ? computeSoaStats(soaEntries).completeness
    : null;

  return {
    openFindings: openFindings(clientFindings).length,
    overdueFindings: overdueFindings(clientFindings).length,
    compliancePct,
    latestWpScore: latestReport?.score ?? null,
    soaCompleteness,
  };
}

export function newManagementReview(args: {
  clientId: string;
  date: string;
  attendees: string[];
  snapshot: ManagementReview['snapshot'];
}): ManagementReview {
  return {
    id: `mr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    clientId: args.clientId,
    date: args.date,
    attendees: args.attendees,
    minutes: Object.fromEntries(MR_AGENDA_TOPICS.map(t => [t, ''])),
    decisions: [],
    snapshot: args.snapshot,
  };
}

/** Topics with recorded minutes / total — the MR completeness meter. */
export function mrCompleteness(review: ManagementReview): { done: number; total: number } {
  const done = MR_AGENDA_TOPICS.filter(t => (review.minutes[t] ?? '').trim() !== '').length;
  return { done, total: MR_AGENDA_TOPICS.length };
}
