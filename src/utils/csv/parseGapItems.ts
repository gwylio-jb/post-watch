/**
 * Map a parsed CSV → updates for an existing GapAnalysisSession.
 *
 * Sprint 13.5 (deferred from Sprint 13 Pack 2). Lets a consultant
 * port over an existing gap-analysis spreadsheet rather than re-keying
 * statuses one at a time. The importer validates each row against
 * the 27001 catalogue (clauses + Annex A controls) so typos and
 * stale references are surfaced rather than silently dropped.
 *
 * Accepted columns (case- / hyphen-insensitive aliases):
 *   id        — required, matches a clause id (e.g. "6.1") or
 *               control id (e.g. "A.5.1")
 *   status    — required, one of: Compliant / Partially Compliant /
 *               Non-Compliant / Not Assessed / Not Applicable
 *               Accepts aliases ("partial" → "Partially Compliant").
 *   priority  — optional, High / Medium / Low (default: Medium)
 *   notes     — optional free text
 *   responsible — optional owner name
 *
 * Behaviour:
 *  - Rows matching an existing GapAnalysisItem (by itemId) UPDATE that item.
 *  - Rows referencing a real clause/control not yet in the session ADD a
 *    new GapAnalysisItem.
 *  - Rows referencing an unknown id are reported as errors and skipped.
 */
import type {
  GapAnalysisItem, ManagementClause, AnnexAControl, ComplianceStatus, Priority,
} from '../../data/types';
import type { CsvParseResult } from './parseCsv';

export interface GapItemImportRow {
  /** The candidate item, ready to merge into the session. */
  item: GapAnalysisItem;
  /** Source CSV row number (1-based, header excluded). */
  sourceLine: number;
  /** True if an item with this id already exists in the session — will UPDATE. */
  isUpdate: boolean;
}

export interface GapItemImportPreview {
  rows: GapItemImportRow[];
  errors: { line: number; reason: string }[];
  warnings: string[];
}

function key(s: string): string {
  return s.toLowerCase().replace(/[\s_-]+/g, '');
}

function pick(row: Record<string, string>, aliases: string[]): string | undefined {
  const lookup: Record<string, string> = {};
  for (const k of Object.keys(row)) lookup[key(k)] = row[k];
  for (const a of aliases) {
    const v = lookup[key(a)];
    if (v != null && v.trim().length > 0) return v.trim();
  }
  return undefined;
}

const STATUS_ALIASES: Record<string, ComplianceStatus> = {
  // canonical
  'compliant':           'Compliant',
  'partiallycompliant':  'Partially Compliant',
  'noncompliant':        'Non-Compliant',
  'notassessed':         'Not Assessed',
  'notapplicable':       'Not Applicable',
  // common variants
  'partial':             'Partially Compliant',
  'partially':           'Partially Compliant',
  'noncompl':            'Non-Compliant',
  'non':                 'Non-Compliant',
  'na':                  'Not Applicable',
  'n/a':                 'Not Applicable',
  'pending':             'Not Assessed',
  'unassessed':          'Not Assessed',
  'unknown':             'Not Assessed',
};

const PRIORITY_ALIASES: Record<string, Priority> = {
  high: 'High', med: 'Medium', medium: 'Medium', low: 'Low',
  h: 'High', m: 'Medium', l: 'Low',
  critical: 'High',  // commonly used in client spreadsheets
};

function normaliseStatus(raw: string): ComplianceStatus | null {
  return STATUS_ALIASES[key(raw)] ?? null;
}

function normalisePriority(raw: string | undefined): Priority {
  if (!raw) return 'Medium';
  return PRIORITY_ALIASES[key(raw)] ?? 'Medium';
}

export function parseGapItemsFromCsv(
  parsed: CsvParseResult,
  existingItems: GapAnalysisItem[],
  clauses: ManagementClause[],
  controls: AnnexAControl[],
): GapItemImportPreview {
  const errors = [...parsed.errors];
  const warnings: string[] = [];

  if (parsed.rows.length === 0 && parsed.errors.length === 0) {
    warnings.push('No data rows found.');
  }

  // Build fast id → kind lookup so we can validate every row in O(1).
  const clauseIds = new Set(clauses.map(c => c.id));
  const controlIds = new Set(controls.map(c => c.id));
  const existingById = new Map(existingItems.map(i => [i.itemId, i]));

  const rows: GapItemImportRow[] = [];
  const ROW_CAP = 1000;
  if (parsed.rows.length > ROW_CAP) {
    warnings.push(`Only the first ${ROW_CAP} rows will be imported.`);
  }

  for (let i = 0; i < Math.min(parsed.rows.length, ROW_CAP); i++) {
    const row = parsed.rows[i];
    const sourceLine = i + 2;

    const rawId = pick(row, ['id', 'clause', 'control', 'clause id', 'control id', 'item', 'reference']);
    if (!rawId) {
      errors.push({ line: sourceLine, reason: 'No id column (id / clause / control)' });
      continue;
    }
    const id = rawId.trim();
    const isClause = clauseIds.has(id);
    const isControl = controlIds.has(id);
    if (!isClause && !isControl) {
      errors.push({ line: sourceLine, reason: `Unknown clause/control id: ${id}` });
      continue;
    }

    const rawStatus = pick(row, ['status', 'compliance', 'state']);
    if (!rawStatus) {
      errors.push({ line: sourceLine, reason: 'No status column' });
      continue;
    }
    const status = normaliseStatus(rawStatus);
    if (!status) {
      errors.push({ line: sourceLine, reason: `Unrecognised status: ${rawStatus}` });
      continue;
    }

    const priority = normalisePriority(pick(row, ['priority', 'pri']));
    const notes = pick(row, ['notes', 'comments', 'description']) ?? '';
    const responsible = pick(row, ['responsible', 'owner', 'assignee']) ?? '';

    const existing = existingById.get(id);
    const item: GapAnalysisItem = {
      itemId: id,
      itemType: isClause ? 'clause' : 'control',
      status,
      priority,
      notes,
      responsible,
    };

    rows.push({ item, sourceLine, isUpdate: !!existing });
  }

  return { rows, errors, warnings };
}

/**
 * Apply a confirmed import batch onto a session's items array. Returns
 * the merged item list — pure, no storage I/O.
 */
export function mergeGapItems(
  existing: GapAnalysisItem[],
  importing: GapAnalysisItem[],
): GapAnalysisItem[] {
  const byId = new Map(existing.map(i => [i.itemId, i] as const));
  for (const next of importing) {
    byId.set(next.itemId, next);
  }
  return Array.from(byId.values());
}
