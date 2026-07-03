/**
 * Sprint 24 (v3.0 pillar #2): Findings & CAPA helpers.
 *
 * Pure functions over Finding[] — the CAPA board binds storage via
 * useLocalStorage('findings', []) and calls these. Lifecycle rules live
 * here so they're testable and the UI can't invent illegal transitions.
 *
 * Lifecycle: open → action-planned → implemented → verified → closed.
 * Each step has a precondition (can't plan without an action, can't
 * verify without an effectiveness check, can't close unverified) —
 * that ordering is exactly what a certification auditor traces.
 */
import type {
  Finding, FindingStatus, FindingSeverity, FindingSource,
  CorrectiveAction, EffectivenessCheck,
} from '../data/types';

export function newFinding(args: {
  clientId: string;
  source: FindingSource;
  sourceRef?: string;
  title: string;
  description?: string;
  severity?: FindingSeverity;
  refIds?: string[];
}): Finding {
  return {
    id: `finding-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    clientId: args.clientId,
    source: args.source,
    sourceRef: args.sourceRef,
    title: args.title,
    description: args.description ?? '',
    severity: args.severity ?? 'medium',
    refIds: args.refIds ?? [],
    status: 'open',
    raisedAt: new Date().toISOString(),
  };
}

/** The single legal next step per status, for UI affordances. */
export const NEXT_STATUS: Record<FindingStatus, FindingStatus | null> = {
  'open': 'action-planned',
  'action-planned': 'implemented',
  'implemented': 'verified',
  'verified': 'closed',
  'closed': null,
};

export const STATUS_LABEL: Record<FindingStatus, string> = {
  'open': 'Open',
  'action-planned': 'Action planned',
  'implemented': 'Implemented',
  'verified': 'Verified',
  'closed': 'Closed',
};

/**
 * Attempt a status transition, enforcing lifecycle preconditions.
 * Returns the updated finding, or an error string explaining what's
 * missing. Skipping steps is not allowed.
 */
export function transition(f: Finding, to: FindingStatus): Finding | string {
  if (NEXT_STATUS[f.status] !== to) {
    return `Cannot move from ${STATUS_LABEL[f.status]} to ${STATUS_LABEL[to]} — steps can't be skipped.`;
  }
  switch (to) {
    case 'action-planned':
      if (!f.action || !f.action.owner.trim() || !f.action.dueDate) {
        return 'Set a corrective action with an owner and due date first.';
      }
      return { ...f, status: to };
    case 'implemented':
      return { ...f, status: to };
    case 'verified':
      if (!f.effectivenessCheck) {
        return 'Record an effectiveness check before marking verified.';
      }
      if (!f.effectivenessCheck.passed) {
        return 'The effectiveness check failed — revise the action and re-check before verifying.';
      }
      return { ...f, status: to };
    case 'closed':
      return { ...f, status: to, closedAt: new Date().toISOString() };
    default:
      return `Unknown status ${to}`;
  }
}

export function setAction(f: Finding, action: CorrectiveAction): Finding {
  return { ...f, action };
}

export function setEffectivenessCheck(f: Finding, check: EffectivenessCheck): Finding {
  return { ...f, effectivenessCheck: check };
}

/** A finding is overdue when its action due date has passed and it isn't done. */
export function isOverdue(f: Finding, now = new Date()): boolean {
  if (!f.action?.dueDate) return false;
  if (f.status === 'verified' || f.status === 'closed') return false;
  const due = Date.parse(f.action.dueDate);
  if (Number.isNaN(due)) return false;
  // Due date is inclusive — overdue starts the day after.
  return now.getTime() > due + 24 * 60 * 60 * 1000;
}

export function openFindings(findings: Finding[]): Finding[] {
  return findings.filter(f => f.status !== 'closed');
}

export function overdueFindings(findings: Finding[], now = new Date()): Finding[] {
  return findings.filter(f => isOverdue(f, now));
}

export const SEVERITY_ORDER: Record<FindingSeverity, number> = {
  critical: 0, high: 1, medium: 2, low: 3,
};

/** Board ordering: overdue first, then severity, then oldest raised. */
export function sortForBoard(findings: Finding[], now = new Date()): Finding[] {
  return [...findings].sort((a, b) => {
    const od = Number(isOverdue(b, now)) - Number(isOverdue(a, now));
    if (od !== 0) return od;
    const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sev !== 0) return sev;
    return a.raisedAt.localeCompare(b.raisedAt);
  });
}

/** CSV export for the CAPA register. */
export function findingsToCsv(findings: Finding[], clientNameById: Map<string, string>): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = [
    ['ID', 'Client', 'Source', 'Severity', 'Status', 'Title', 'Root cause', 'Action owner', 'Due date', 'Effectiveness', 'Raised', 'Closed'].join(','),
    ...findings.map(f => [
      f.id,
      esc(clientNameById.get(f.clientId) ?? f.clientId),
      f.source,
      f.severity,
      f.status,
      esc(f.title),
      esc(f.rootCause ?? ''),
      esc(f.action?.owner ?? ''),
      f.action?.dueDate ?? '',
      f.effectivenessCheck ? (f.effectivenessCheck.passed ? 'passed' : 'failed') : '',
      f.raisedAt.slice(0, 10),
      f.closedAt?.slice(0, 10) ?? '',
    ].join(',')),
  ];
  return rows.join('\n');
}
