/**
 * Tiny CSV parser — enough for portfolio-mode imports, no dependency.
 *
 * Handles:
 *   - Comma OR semicolon delimiters (auto-detected from first row).
 *   - Double-quoted fields with embedded commas / newlines / escaped quotes.
 *   - CRLF and LF line endings.
 *   - Trimmed header row.
 *
 * Not RFC 4180 to the letter — no support for in-field quoted-quote
 * escapes (e.g. `""`) outside of quoted fields. Acceptable for the import
 * surface (clients + gap items), neither of which carries embedded quotes
 * in normal use.
 */

export interface CsvParseResult {
  /** Header column names, trimmed. */
  headers: string[];
  /** Each row keyed by header → value. */
  rows: Record<string, string>[];
  /** Any rows we couldn't parse, with their source line number (1-based). */
  errors: { line: number; reason: string }[];
}

function detectDelimiter(line: string): ',' | ';' {
  const commas = (line.match(/,/g) ?? []).length;
  const semis  = (line.match(/;/g) ?? []).length;
  return semis > commas ? ';' : ',';
}

function splitLine(line: string, delim: ',' | ';'): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // Doubled "" inside a quoted field is an escaped quote.
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === delim && !inQuotes) {
      out.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out.map(s => s.trim());
}

export function parseCsv(raw: string): CsvParseResult {
  const lines = raw.replace(/\r\n/g, '\n').split('\n').filter(l => l.length > 0);
  if (lines.length === 0) return { headers: [], rows: [], errors: [] };

  const delim = detectDelimiter(lines[0]);
  const headers = splitLine(lines[0], delim);
  const rows: Record<string, string>[] = [];
  const errors: { line: number; reason: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i], delim);
    if (cells.length !== headers.length) {
      errors.push({
        line: i + 1,
        reason: `Expected ${headers.length} columns, got ${cells.length}`,
      });
      continue;
    }
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = cells[j];
    }
    rows.push(row);
  }

  return { headers, rows, errors };
}
