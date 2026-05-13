/**
 * Pure diff functions over the persisted shapes Pack 4 cares about.
 *
 * Sprint 16. Used by:
 *   - GapAnalysis snapshot diff (Sprint 16, this sprint)
 *   - Future cross-client diff once auto-snapshots land (Sprint 17+)
 *
 * Functions here never touch React, localStorage, or any side-effect.
 * Inputs in, change-list out — that's the contract.
 */
import type { GapAnalysisItem, RiskItem } from '../data/types';
import type { AuditReport } from '../data/auditTypes';

// ─── Gap items ─────────────────────────────────────────────────────────────

/** Fields we treat as material for change detection. Other fields
 *  (e.g. an id we never display) can be added later if needed. */
const GAP_DIFF_FIELDS: (keyof GapAnalysisItem)[] = [
  'status', 'priority', 'notes', 'responsible',
];

export type GapItemChange =
  | { kind: 'added';   item: GapAnalysisItem }
  | { kind: 'removed'; item: GapAnalysisItem }
  | {
      kind: 'changed';
      before: GapAnalysisItem;
      after: GapAnalysisItem;
      /** Which fields actually differ (a subset of GAP_DIFF_FIELDS). */
      fields: (keyof GapAnalysisItem)[];
    };

/**
 * Compute the change-set between two snapshots of a gap session.
 *
 * Items are keyed by `itemId` (the clause/control id). Same item id in
 * both arrays with different field values → 'changed'. Item present in
 * one but not the other → 'added' / 'removed'.
 *
 * Stable order: removed first, then changed, then added — mirrors how
 * we'll render the table (red rows up top, mint at the bottom).
 */
export function diffGapItems(
  before: GapAnalysisItem[],
  after: GapAnalysisItem[],
): GapItemChange[] {
  const beforeMap = new Map(before.map(i => [i.itemId, i] as const));
  const afterMap  = new Map(after.map(i => [i.itemId, i] as const));

  const removed: GapItemChange[] = [];
  const changed: GapItemChange[] = [];
  const added: GapItemChange[] = [];

  for (const [id, b] of beforeMap) {
    const a = afterMap.get(id);
    if (!a) {
      removed.push({ kind: 'removed', item: b });
      continue;
    }
    const fields = GAP_DIFF_FIELDS.filter(f => b[f] !== a[f]);
    if (fields.length > 0) {
      changed.push({ kind: 'changed', before: b, after: a, fields });
    }
  }
  for (const [id, a] of afterMap) {
    if (!beforeMap.has(id)) added.push({ kind: 'added', item: a });
  }

  return [...removed, ...changed, ...added];
}

// ─── Risks ─────────────────────────────────────────────────────────────────

const RISK_DIFF_FIELDS: (keyof RiskItem)[] = [
  'status', 'treatment', 'likelihood', 'impact', 'score', 'owner', 'dueDate',
];

export type RiskChange =
  | { kind: 'added';   item: RiskItem }
  | { kind: 'removed'; item: RiskItem }
  | {
      kind: 'changed';
      before: RiskItem;
      after: RiskItem;
      fields: (keyof RiskItem)[];
    };

export function diffRisks(before: RiskItem[], after: RiskItem[]): RiskChange[] {
  const beforeMap = new Map(before.map(r => [r.id, r] as const));
  const afterMap  = new Map(after.map(r => [r.id, r] as const));

  const removed: RiskChange[] = [];
  const changed: RiskChange[] = [];
  const added: RiskChange[] = [];

  for (const [id, b] of beforeMap) {
    const a = afterMap.get(id);
    if (!a) {
      removed.push({ kind: 'removed', item: b });
      continue;
    }
    const fields = RISK_DIFF_FIELDS.filter(f => b[f] !== a[f]);
    if (fields.length > 0) {
      changed.push({ kind: 'changed', before: b, after: a, fields });
    }
  }
  for (const [id, a] of afterMap) {
    if (!beforeMap.has(id)) added.push({ kind: 'added', item: a });
  }

  return [...removed, ...changed, ...added];
}

// ─── Reports (scan scores) ─────────────────────────────────────────────────

export type ScoreDelta = {
  domain: string;
  /** Most recent score in the `before` set, or null if no scan existed yet. */
  before: number | null;
  /** Most recent score in the `after` set, or null. */
  after: number | null;
  /** after − before, or null if either side is null. */
  delta: number | null;
};

/**
 * Compute per-domain score deltas between two AuditReport arrays. Each
 * domain's score is taken from its most recent report in each set.
 *
 * Useful for "what changed across the portfolio since X" without
 * needing auto-snapshots — the AuditReport history is already a
 * time-series.
 */
export function diffScansByDomain(
  before: AuditReport[],
  after: AuditReport[],
): ScoreDelta[] {
  const latest = (reports: AuditReport[]): Map<string, number> => {
    const map = new Map<string, { ts: number; score: number }>();
    for (const r of reports) {
      const ts = new Date(r.completedAt ?? r.startedAt).getTime();
      const existing = map.get(r.domain);
      if (!existing || ts > existing.ts) {
        map.set(r.domain, { ts, score: r.score });
      }
    }
    const out = new Map<string, number>();
    for (const [domain, { score }] of map) out.set(domain, score);
    return out;
  };

  const beforeScores = latest(before);
  const afterScores  = latest(after);

  const domains = new Set<string>([...beforeScores.keys(), ...afterScores.keys()]);
  const out: ScoreDelta[] = [];
  for (const domain of domains) {
    const b = beforeScores.get(domain) ?? null;
    const a = afterScores.get(domain) ?? null;
    const delta = b !== null && a !== null ? a - b : null;
    out.push({ domain, before: b, after: a, delta });
  }
  // Sort: biggest negative delta first (worst regressions surface).
  out.sort((x, y) => {
    if (x.delta === null && y.delta === null) return x.domain.localeCompare(y.domain);
    if (x.delta === null) return 1;
    if (y.delta === null) return -1;
    return x.delta - y.delta;
  });
  return out;
}
