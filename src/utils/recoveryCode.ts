/**
 * Recovery code — Sprint 18 Pack 3.
 *
 * 32 random bytes formatted as 8 groups of 4 hex chars separated by
 * hyphens. Easy enough to write down on paper or store in a password
 * manager; high enough entropy to be safe from brute force.
 *
 * Format example: "A4B2-91FC-0E37-8DEA-71BC-4F22-90A1-3C5E"
 *
 * Tolerant of casing and arbitrary whitespace on parse — every recovery
 * code is normalised to uppercase + grouped-hex before being fed into
 * the KDF.
 */

const BYTES = 16;       // 16 bytes = 32 hex chars = 8 groups of 4
const GROUP_SIZE = 4;
const NUM_GROUPS = 8;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function formatHex(hex: string): string {
  const upper = hex.toUpperCase();
  const groups: string[] = [];
  for (let i = 0; i < upper.length; i += GROUP_SIZE) {
    groups.push(upper.slice(i, i + GROUP_SIZE));
  }
  return groups.join('-');
}

/** Generate a fresh recovery code string. */
export function generateRecoveryCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(BYTES));
  return formatHex(toHex(bytes));
}

/**
 * Normalise user input (case-insensitive, whitespace and hyphen
 * tolerant) and validate. Returns the canonical formatted code on
 * success, or null on invalid input.
 */
export function parseRecoveryCode(input: string): string | null {
  const cleaned = input.replace(/[\s-]/g, '').toUpperCase();
  if (cleaned.length !== BYTES * 2) return null;
  if (!/^[0-9A-F]+$/.test(cleaned)) return null;
  return formatHex(cleaned);
}

/** Quick check whether a string looks like a complete code. */
export function looksLikeRecoveryCode(input: string): boolean {
  return parseRecoveryCode(input) !== null;
}

/** For display: split into rows of 4 groups per row (8 groups total → 2 rows). */
export function splitForDisplay(code: string): string[] {
  const groups = code.split('-');
  const rows: string[] = [];
  for (let i = 0; i < groups.length; i += 4) {
    rows.push(groups.slice(i, i + 4).join(' '));
  }
  return rows;
}

export const RECOVERY_CODE_PARAMS = Object.freeze({
  BYTES,
  GROUP_SIZE,
  NUM_GROUPS,
});
