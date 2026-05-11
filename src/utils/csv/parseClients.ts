/**
 * Map a parsed CSV → `Client[]` for bulk import.
 *
 * Accepts column name variants (case-insensitive, hyphen/space-insensitive) so
 * users can drop in a spreadsheet from anywhere without a strict template:
 *
 *   name        | required
 *   industry    | optional
 *   contact     | optional, also "primary contact"
 *   notes       | optional
 *
 * Rows with no recognisable name are skipped and reported as errors. Dedup
 * against existing clients is by case-insensitive name; the importer's UI
 * shows the diff so the user can decide what to do.
 */
import type { Client } from '../../data/types';
import type { CsvParseResult } from './parseCsv';

export interface ClientImportRow {
  /** The candidate Client (no id yet — assigned on save). */
  client: Omit<Client, 'id'>;
  /** Source CSV row number (1-based, header excluded). */
  sourceLine: number;
  /** True if a client with this name already exists in the target. */
  isDuplicate: boolean;
}

export interface ClientImportPreview {
  rows: ClientImportRow[];
  errors: { line: number; reason: string }[];
  warnings: string[];
}

/** Normalise a header for tolerant lookups. */
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

export function parseClientsFromCsv(
  parsed: CsvParseResult,
  existing: Client[],
): ClientImportPreview {
  const errors = [...parsed.errors];
  const warnings: string[] = [];

  if (parsed.rows.length === 0 && parsed.errors.length === 0) {
    warnings.push('No data rows found.');
  }

  // Build a lowercase-name index of existing clients for fast dedup checks.
  const existingByName = new Map<string, Client>();
  for (const c of existing) existingByName.set(c.name.trim().toLowerCase(), c);

  const rows: ClientImportRow[] = [];
  // Sprint 13 v1 cap: 1000 rows max per import. Larger imports get a warning.
  const ROW_CAP = 1000;
  if (parsed.rows.length > ROW_CAP) {
    warnings.push(`Only the first ${ROW_CAP} rows will be imported.`);
  }

  const now = new Date().toISOString();
  for (let i = 0; i < Math.min(parsed.rows.length, ROW_CAP); i++) {
    const row = parsed.rows[i];
    const sourceLine = i + 2;  // +1 for 0-index, +1 for header.

    const name = pick(row, ['name', 'client', 'client name', 'company']);
    if (!name) {
      errors.push({ line: sourceLine, reason: 'No recognisable name column' });
      continue;
    }

    const industry = pick(row, ['industry', 'sector']);
    const primaryContact = pick(row, ['contact', 'primary contact', 'primarycontact', 'email']);
    const notes = pick(row, ['notes', 'comments', 'description']);

    const isDuplicate = existingByName.has(name.toLowerCase());

    rows.push({
      client: { name, industry, primaryContact, notes, createdAt: now },
      sourceLine,
      isDuplicate,
    });
  }

  return { rows, errors, warnings };
}
