/**
 * Sprint 26 (v3.0 pillar #4): training / incident / asset register helpers.
 *
 * Deliberately thin — these are the spreadsheets consultants already
 * keep, moved in-app. Create + CSV in both directions; the incident →
 * CAPA hook lives in the UI layer (it needs the findings store).
 */
import type {
  TrainingRecord, IncidentRecord, AssetRecord, FindingSeverity, AssetType,
} from '../data/types';

function id(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;

/* ─── Training (clause 7.3) ───────────────────────────────────────────── */

export function newTrainingRecord(args: Omit<TrainingRecord, 'id'>): TrainingRecord {
  return { id: id('training'), ...args };
}

export function trainingCompletionPct(records: TrainingRecord[]): number | null {
  if (records.length === 0) return null;
  return Math.round((records.filter(r => r.passed).length / records.length) * 100);
}

export function trainingToCsv(records: TrainingRecord[]): string {
  return [
    ['Employee', 'Topic', 'Date', 'Passed', 'Notes'].join(','),
    ...records.map(r => [esc(r.employee), esc(r.topic), r.date, r.passed ? 'Yes' : 'No', esc(r.notes ?? '')].join(',')),
  ].join('\n');
}

/**
 * Parse rows from a generic CSV (header-mapped) into training records.
 * Column matching is case-insensitive on common HR-export names.
 * Rows without an employee + topic are skipped and counted.
 */
export function parseTrainingCsv(
  rows: Record<string, string>[],
  clientId: string,
): { records: TrainingRecord[]; skipped: number } {
  const records: TrainingRecord[] = [];
  let skipped = 0;
  const pick = (row: Record<string, string>, ...names: string[]): string => {
    for (const key of Object.keys(row)) {
      if (names.includes(key.trim().toLowerCase())) return row[key]?.trim() ?? '';
    }
    return '';
  };
  for (const row of rows) {
    const employee = pick(row, 'employee', 'name', 'staff', 'person');
    const topic = pick(row, 'topic', 'course', 'training', 'module');
    if (!employee || !topic) { skipped++; continue; }
    const passedRaw = pick(row, 'passed', 'result', 'status').toLowerCase();
    records.push(newTrainingRecord({
      clientId,
      employee,
      topic,
      date: pick(row, 'date', 'completed', 'completion date') || new Date().toISOString().slice(0, 10),
      passed: passedRaw === '' ? true : ['yes', 'y', 'true', 'pass', 'passed', 'complete', 'completed'].includes(passedRaw),
      notes: pick(row, 'notes', 'comment', 'comments') || undefined,
    }));
  }
  return { records, skipped };
}

/* ─── Incidents (A.5.24-27) ───────────────────────────────────────────── */

export function newIncidentRecord(args: {
  clientId: string;
  title: string;
  description?: string;
  severity?: FindingSeverity;
  date?: string;
}): IncidentRecord {
  return {
    id: id('incident'),
    clientId: args.clientId,
    date: args.date ?? new Date().toISOString().slice(0, 10),
    title: args.title,
    description: args.description ?? '',
    severity: args.severity ?? 'medium',
    status: 'open',
  };
}

export function resolveIncident(i: IncidentRecord, rootCause: string, lessonsLearned: string): IncidentRecord {
  return {
    ...i,
    status: 'resolved',
    resolvedAt: new Date().toISOString().slice(0, 10),
    rootCause: rootCause.trim() || i.rootCause,
    lessonsLearned: lessonsLearned.trim() || i.lessonsLearned,
  };
}

export function incidentsToCsv(records: IncidentRecord[]): string {
  return [
    ['Date', 'Title', 'Severity', 'Status', 'Resolved', 'Root cause', 'Lessons learned'].join(','),
    ...records.map(r => [
      r.date, esc(r.title), r.severity, r.status, r.resolvedAt ?? '',
      esc(r.rootCause ?? ''), esc(r.lessonsLearned ?? ''),
    ].join(',')),
  ].join('\n');
}

/* ─── Assets (clause 5 / 8 foundation) ────────────────────────────────── */

const clamp15 = (n: number) => Math.min(5, Math.max(1, Math.round(n)));

export function newAssetRecord(args: {
  clientId: string;
  name: string;
  type?: AssetType;
  owner?: string;
  confidentiality?: number;
  integrity?: number;
  availability?: number;
}): AssetRecord {
  return {
    id: id('asset'),
    clientId: args.clientId,
    name: args.name,
    type: args.type ?? 'System',
    owner: args.owner ?? '',
    confidentiality: clamp15(args.confidentiality ?? 3),
    integrity: clamp15(args.integrity ?? 3),
    availability: clamp15(args.availability ?? 3),
    controlIds: [],
  };
}

/** Max of C/I/A — the usual single-number criticality shorthand. */
export function assetCriticality(a: AssetRecord): number {
  return Math.max(a.confidentiality, a.integrity, a.availability);
}

export function assetsToCsv(records: AssetRecord[]): string {
  return [
    ['Name', 'Type', 'Owner', 'C', 'I', 'A', 'Criticality', 'Controls', 'Notes'].join(','),
    ...records.map(r => [
      esc(r.name), r.type, esc(r.owner),
      r.confidentiality, r.integrity, r.availability, assetCriticality(r),
      esc(r.controlIds.join(' ')), esc(r.notes ?? ''),
    ].join(',')),
  ].join('\n');
}
