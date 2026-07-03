/**
 * Sprint 23 (v3.0 pillar #1): Statement of Applicability helpers.
 *
 * Pure functions over the SoaStore shape — the React layer binds the
 * store via useLocalStorage('soa', {}) and calls these to derive and
 * mutate. Keeping the logic here makes it unit-testable without DOM.
 *
 * Design notes:
 *  - Entries are seeded lazily per client on first visit to the SoA tab
 *    (not by migration v6, which only guarantees the key exists). Seeding
 *    at visit time means new controls added in a future standard revision
 *    appear for existing clients via ensureSeeded's top-up path.
 *  - Default state: applicable=true, empty justification, 'Not Started'.
 *    ISO 27001 treats exclusion as the thing needing justification, but
 *    auditors expect inclusion justifications too — the completeness
 *    meter counts both.
 */
import type {
  SoaEntry, SoaStore, ImplementationStatus, GapAnalysisSession, ComplianceStatus,
} from '../data/types';
import { allControls } from '../data/controls';

export function blankEntry(controlId: string): SoaEntry {
  return {
    controlId,
    applicable: true,
    justification: '',
    implementationStatus: 'Not Started',
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Return the client's entries, creating any that are missing (first
 * visit, or new controls after a standard revision). Preserves existing
 * rows untouched. Pure — returns a new array; caller decides whether to
 * persist (`changed` says if anything was added).
 */
export function ensureSeeded(store: SoaStore, clientId: string): { entries: SoaEntry[]; changed: boolean } {
  const existing = store[clientId] ?? [];
  const byId = new Map(existing.map(e => [e.controlId, e]));
  let changed = false;
  const entries = allControls.map(c => {
    const found = byId.get(c.id);
    if (found) return found;
    changed = true;
    return blankEntry(c.id);
  });
  if (existing.length !== entries.length) changed = true;
  return { entries, changed };
}

export function updateEntry(
  entries: SoaEntry[],
  controlId: string,
  patch: Partial<Pick<SoaEntry, 'applicable' | 'justification' | 'implementationStatus'>>,
): SoaEntry[] {
  return entries.map(e =>
    e.controlId === controlId
      ? { ...e, ...patch, updatedAt: new Date().toISOString() }
      : e
  );
}

/** Bulk-set applicability for every control in a theme (category). */
export function setThemeApplicability(
  entries: SoaEntry[],
  category: string,
  applicable: boolean,
): SoaEntry[] {
  const themeIds = new Set(allControls.filter(c => c.category === category).map(c => c.id));
  const now = new Date().toISOString();
  return entries.map(e =>
    themeIds.has(e.controlId) && e.applicable !== applicable
      ? { ...e, applicable, updatedAt: now }
      : e
  );
}

export interface SoaStats {
  total: number;
  applicable: number;
  excluded: number;
  /** Rows (applicable or not) with a non-empty justification. */
  justified: number;
  /** Applicable rows at Implemented or Verified. */
  implemented: number;
  /** 0-100: justification coverage across all rows. */
  completeness: number;
}

export function computeStats(entries: SoaEntry[]): SoaStats {
  const total = entries.length;
  const applicable = entries.filter(e => e.applicable).length;
  const justified = entries.filter(e => e.justification.trim().length > 0).length;
  const implemented = entries.filter(
    e => e.applicable && (e.implementationStatus === 'Implemented' || e.implementationStatus === 'Verified')
  ).length;
  return {
    total,
    applicable,
    excluded: total - applicable,
    justified,
    implemented,
    completeness: total === 0 ? 0 : Math.round((justified / total) * 100),
  };
}

/**
 * Map a gap-analysis compliance status onto an implementation status.
 * Used by "seed from gap session" so a fresh SoA doesn't start at
 * all-Not-Started when an assessment already exists.
 */
export function implementationFromCompliance(status: ComplianceStatus): ImplementationStatus | null {
  switch (status) {
    case 'Compliant':            return 'Implemented';
    case 'Partially Compliant':  return 'In Progress';
    case 'Non-Compliant':        return 'Not Started';
    case 'Not Applicable':       return null;  // handled as applicability, not status
    case 'Not Assessed':         return null;
    default:                     return null;
  }
}

/**
 * Overlay a gap session's control assessments onto SoA entries.
 * - Compliant / Partial / Non-Compliant → implementation status
 * - Not Applicable → applicable=false (justification left for the user)
 * - Not Assessed / clause items → untouched
 * Only fills rows whose justification is empty and status is Not Started,
 * so a curated SoA is never clobbered by a re-seed.
 */
export function seedFromGapSession(entries: SoaEntry[], session: GapAnalysisSession): SoaEntry[] {
  const controlItems = new Map(
    session.items.filter(i => i.itemType === 'control').map(i => [i.itemId, i])
  );
  const now = new Date().toISOString();
  return entries.map(e => {
    // Don't overwrite rows the user has already worked on.
    const untouched = e.justification.trim() === '' && e.implementationStatus === 'Not Started' && e.applicable;
    if (!untouched) return e;
    const item = controlItems.get(e.controlId);
    if (!item) return e;
    if (item.status === 'Not Applicable') {
      return { ...e, applicable: false, updatedAt: now };
    }
    const impl = implementationFromCompliance(item.status);
    if (!impl || impl === 'Not Started') return e;
    return { ...e, implementationStatus: impl, updatedAt: now };
  });
}

/** CSV export — the spreadsheet consultants currently hand-build. */
export function soaToCsv(entries: SoaEntry[]): string {
  const titleById = new Map(allControls.map(c => [c.id, c.title]));
  const categoryById = new Map(allControls.map(c => [c.id, c.category]));
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = [
    ['Control', 'Title', 'Theme', 'Applicable', 'Justification', 'Implementation status', 'Last updated'].join(','),
    ...entries.map(e => [
      e.controlId,
      esc(titleById.get(e.controlId) ?? ''),
      categoryById.get(e.controlId) ?? '',
      e.applicable ? 'Yes' : 'No',
      esc(e.justification),
      e.implementationStatus,
      e.updatedAt.slice(0, 10),
    ].join(',')),
  ];
  return rows.join('\n');
}
