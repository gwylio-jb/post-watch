/**
 * Tests for the CSV parser and the clients importer.
 *
 * What we're protecting against:
 *  - Embedded commas in quoted fields not splitting cells.
 *  - CRLF line endings producing phantom empty rows.
 *  - Header alias mismatches silently dropping data (clients importer).
 *  - Row-count mismatches crashing the parser (must report, not throw).
 *  - The 1000-row cap silently truncating without a warning.
 */
import { parseCsv } from './parseCsv';
import { parseClientsFromCsv } from './parseClients';
import type { Client } from '../../data/types';

// ─── parseCsv ──────────────────────────────────────────────────────────────

describe('parseCsv', () => {
  it('parses headers + rows from a simple comma CSV', () => {
    const result = parseCsv('name,industry\nAcme,Manufacturing\nBeta,Retail');
    expect(result.headers).toEqual(['name', 'industry']);
    expect(result.rows).toEqual([
      { name: 'Acme', industry: 'Manufacturing' },
      { name: 'Beta', industry: 'Retail' },
    ]);
  });

  it('auto-detects semicolon delimiter when commas are absent in the header', () => {
    const result = parseCsv('name;industry\nAcme;Manufacturing');
    expect(result.headers).toEqual(['name', 'industry']);
    expect(result.rows[0].industry).toBe('Manufacturing');
  });

  it('respects double-quoted fields with embedded commas', () => {
    const result = parseCsv('name,notes\nAcme,"This, has, commas"');
    expect(result.rows[0].notes).toBe('This, has, commas');
  });

  it('handles escaped quotes (doubled "" inside a quoted field)', () => {
    const result = parseCsv('name,notes\nAcme,"They said ""hi"""');
    expect(result.rows[0].notes).toBe('They said "hi"');
  });

  it('handles CRLF line endings without producing phantom empty rows', () => {
    const result = parseCsv('name\r\nAcme\r\nBeta\r\n');
    expect(result.rows).toHaveLength(2);
  });

  it('reports row-length mismatches as errors rather than throwing', () => {
    const result = parseCsv('name,industry\nAcme\nBeta,Retail');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].line).toBe(2);
    expect(result.rows).toHaveLength(1);
  });

  it('returns empty result on empty input', () => {
    const result = parseCsv('');
    expect(result.headers).toEqual([]);
    expect(result.rows).toEqual([]);
  });
});

// ─── parseClientsFromCsv ───────────────────────────────────────────────────

function existing(): Client[] {
  return [{
    id: 'c-1', name: 'Acme Corp', industry: 'Manufacturing',
    createdAt: '2026-01-01T00:00:00Z',
  }];
}

describe('parseClientsFromCsv', () => {
  it('maps a simple CSV to ClientImportRow entries', () => {
    const csv = parseCsv('name,industry,contact\nBeta Inc,Retail,jane@beta.co');
    const result = parseClientsFromCsv(csv, []);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].client.name).toBe('Beta Inc');
    expect(result.rows[0].client.industry).toBe('Retail');
    expect(result.rows[0].client.primaryContact).toBe('jane@beta.co');
  });

  it('accepts header aliases (case-insensitive, hyphen-insensitive)', () => {
    const csv = parseCsv('Company,Primary Contact,Comments\nBeta,jane,short note');
    const result = parseClientsFromCsv(csv, []);
    expect(result.rows[0].client.name).toBe('Beta');
    expect(result.rows[0].client.primaryContact).toBe('jane');
    expect(result.rows[0].client.notes).toBe('short note');
  });

  it('flags rows without a recognisable name as errors', () => {
    const csv = parseCsv('industry\nManufacturing');
    const result = parseClientsFromCsv(csv, []);
    expect(result.errors).toHaveLength(1);
    expect(result.rows).toHaveLength(0);
  });

  it('marks duplicates (case-insensitive) without dropping them', () => {
    const csv = parseCsv('name\nacme corp');
    const result = parseClientsFromCsv(csv, existing());
    expect(result.rows[0].isDuplicate).toBe(true);
  });

  it('emits a warning when input exceeds the 1000-row cap', () => {
    const rows = ['name', ...Array(1500).fill('Client')].join('\n');
    const csv = parseCsv(rows);
    const result = parseClientsFromCsv(csv, []);
    expect(result.warnings.some(w => w.includes('first 1000'))).toBe(true);
    expect(result.rows.length).toBeLessThanOrEqual(1000);
  });

  it('warns when there are no data rows', () => {
    const result = parseClientsFromCsv({ headers: ['name'], rows: [], errors: [] }, []);
    expect(result.warnings.some(w => w.toLowerCase().includes('no data'))).toBe(true);
  });
});
