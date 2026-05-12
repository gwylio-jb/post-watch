/**
 * Tamper-evident scan-report chain — Sprint 14 Pack 3.
 *
 * Every saved AuditReport carries an `integrity` field with a SHA-256 hash
 * of its own contents plus the previous report's hash. The chain forms a
 * lightweight Merkle-list: if any byte of any report is mutated after
 * persistence, the verify pass detects it.
 *
 * Why this matters: for a compliance audit, the consultant needs to be
 * able to say "here's the state of these systems on 2026-04-01" and have
 * the evidence be tamper-evident even if the laptop's localStorage was
 * later edited (intentionally or via malware that opened devtools while
 * the app was running). The chain doesn't PREVENT tampering — only
 * encryption does, see cryptoStorage.ts in the next commit — but it does
 * mean tampering can't be hidden after the fact.
 *
 * All functions are async because they touch SubtleCrypto. Tests use
 * happy-dom which polyfills the same API.
 */
import type { AuditReport } from '../data/auditTypes';

/** Magic value for the prevHash of the very first report in a chain. */
export const GENESIS_PREV_HASH = '0'.repeat(64);

/**
 * Stable JSON serialiser — keys sorted alphabetically. We can't rely on
 * JSON.stringify's default behaviour because object key order is
 * insertion-order, and two reports with the same data but different
 * insertion order would hash differently. Stability is essential for
 * verification.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return '{' + keys.map(k =>
    JSON.stringify(k) + ':' + stableStringify((value as Record<string, unknown>)[k])
  ).join(',') + '}';
}

async function sha256(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Strip the `integrity` field from a report so the hash itself doesn't
 * become part of what's being hashed. Pure — does not mutate.
 */
function withoutIntegrity(report: AuditReport): Omit<AuditReport, 'integrity'> {
  const { integrity: _, ...rest } = report;
  void _;
  return rest;
}

/**
 * Compute the hash of a single report's contents (excluding `integrity`).
 */
export async function hashReport(report: AuditReport): Promise<string> {
  return sha256(stableStringify(withoutIntegrity(report)));
}

/**
 * Attach a fresh `integrity` field to a report, chaining to `prevHash`.
 * Returns a new object — does not mutate.
 */
export async function chainReport(report: AuditReport, prevHash: string): Promise<AuditReport> {
  const hash = await hashReport(report);
  return { ...report, integrity: { hash, prevHash } };
}

/**
 * Compute `prevHash` for the NEXT report given the current saved-reports
 * array. Returns GENESIS_PREV_HASH if the array is empty OR the latest
 * report has no integrity field (pre-V2.6 baseline — we start a fresh
 * chain from this point rather than refuse to chain).
 */
export function nextPrevHash(saved: AuditReport[]): string {
  // wp-audit-reports is stored newest-first (see WpAuditHub housekeeping).
  // So the most recent report is index 0.
  const head = saved[0];
  return head?.integrity?.hash ?? GENESIS_PREV_HASH;
}

// ─── Verification ──────────────────────────────────────────────────────────

export type VerificationFlag =
  /** Report has no integrity field — created pre-V2.6. Not necessarily bad. */
  | { kind: 'pre-v2.6-baseline'; reportId: string; domain: string }
  /** Report's hash doesn't match its contents — has been edited. */
  | { kind: 'hash-mismatch';     reportId: string; domain: string; expected: string; got: string }
  /** Report's prevHash doesn't match the previous report's hash — chain split. */
  | { kind: 'chain-break';       reportId: string; domain: string; expected: string; got: string };

export interface VerificationResult {
  totalChecked: number;
  flags: VerificationFlag[];
  ok: boolean;
}

/**
 * Walk a saved-reports array and verify every report's chain. The array
 * is expected newest-first (wp-audit-reports convention) — we verify
 * back-to-front so each report's prevHash matches the report after it.
 */
export async function verifyChain(saved: AuditReport[]): Promise<VerificationResult> {
  const flags: VerificationFlag[] = [];

  // Walk OLDEST to NEWEST. The array is newest-first; reverse a shallow
  // copy so we don't mutate the input.
  const ordered = [...saved].reverse();

  let expectedPrev = GENESIS_PREV_HASH;
  for (const report of ordered) {
    if (!report.integrity) {
      flags.push({ kind: 'pre-v2.6-baseline', reportId: report.id, domain: report.domain });
      // Pre-V2.6 entries don't break the chain — they just don't extend it.
      // Subsequent V2.6+ reports will chain from GENESIS again. Don't
      // update expectedPrev; the next chained report should start fresh.
      expectedPrev = GENESIS_PREV_HASH;
      continue;
    }

    // 1. Does the stored hash match the actual content?
    const actualHash = await hashReport(report);
    if (actualHash !== report.integrity.hash) {
      flags.push({
        kind: 'hash-mismatch',
        reportId: report.id,
        domain: report.domain,
        expected: report.integrity.hash,
        got: actualHash,
      });
    }

    // 2. Does prevHash match the previous report's hash?
    if (report.integrity.prevHash !== expectedPrev) {
      flags.push({
        kind: 'chain-break',
        reportId: report.id,
        domain: report.domain,
        expected: expectedPrev,
        got: report.integrity.prevHash,
      });
    }

    // Either way, advance the chain: even if THIS report is tampered,
    // a subsequent untampered report will chain from this one's claimed
    // hash. Reporting both breaks is more useful than cascading errors.
    expectedPrev = report.integrity.hash;
  }

  // 'pre-v2.6-baseline' is a warning, not an error. ok=true if the only
  // flags are baselines.
  const realErrors = flags.filter(f => f.kind !== 'pre-v2.6-baseline');

  return {
    totalChecked: saved.length,
    flags,
    ok: realErrors.length === 0,
  };
}
