/**
 * Tests for the gap-analysis CSV importer.
 *
 * What we're protecting against:
 *  - A typo or stale id silently creating a phantom GapAnalysisItem.
 *  - Status alias ("partial", "n/a") not normalising — auditors don't write
 *    these consistently across engagements.
 *  - Missing priority defaulting silently to High (it should default to
 *    Medium so a casual import doesn't flood the priority queue).
 *  - mergeGapItems losing existing items that aren't in the CSV (must NOT
 *    drop — the CSV is a partial update, not a replacement).
 */
import { parseCsv } from './parseCsv';
import { parseGapItemsFromCsv, mergeGapItems } from './parseGapItems';
import type { GapAnalysisItem, ManagementClause, AnnexAControl } from '../../data/types';

const clauses: ManagementClause[] = [
  { id: '6.1', title: 'Actions to address risks', category: 'Planning', summary: '',
    requirements: [], auditQuestions: [], typicalEvidence: [], commonGaps: [], tips: [],
    relatedClauses: [], relatedControls: [] },
  { id: '7.5', title: 'Documented information', category: 'Support', summary: '',
    requirements: [], auditQuestions: [], typicalEvidence: [], commonGaps: [], tips: [],
    relatedClauses: [], relatedControls: [] },
];
const controls: AnnexAControl[] = [
  { id: 'A.5.1', title: 'Information security policies', category: 'Organisational',
    summary: '', controlType: ['Preventive'], securityProperties: ['Confidentiality'],
    cybersecurityConcepts: ['Identify'], operationalCapabilities: [],
    securityDomains: ['Governance and Ecosystem'],
    implementationGuidance: '', auditQuestions: [], typicalEvidence: [],
    commonGaps: [], tips: [], relatedControls: [], relatedClauses: [], isNew2022: false },
];

const empty: GapAnalysisItem[] = [];

describe('parseGapItemsFromCsv', () => {
  it('imports a clean row mapping all fields', () => {
    const csv = parseCsv('id,status,priority,notes,responsible\n6.1,Compliant,High,Doc reviewed,JB');
    const result = parseGapItemsFromCsv(csv, empty, clauses, controls);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].item).toEqual({
      itemId: '6.1',
      itemType: 'clause',
      status: 'Compliant',
      priority: 'High',
      notes: 'Doc reviewed',
      responsible: 'JB',
    });
    expect(result.rows[0].isUpdate).toBe(false);
  });

  it('flags an unknown id as an error and skips the row', () => {
    const csv = parseCsv('id,status\n9.9,Compliant');
    const result = parseGapItemsFromCsv(csv, empty, clauses, controls);
    expect(result.rows).toHaveLength(0);
    expect(result.errors.some(e => /Unknown/.test(e.reason))).toBe(true);
  });

  it('flags rows without a status', () => {
    const csv = parseCsv('id,notes\n6.1,no status here');
    const result = parseGapItemsFromCsv(csv, empty, clauses, controls);
    expect(result.errors.some(e => /No status/.test(e.reason))).toBe(true);
  });

  it('normalises status aliases (partial, n/a, pending)', () => {
    const csv = parseCsv('id,status\n6.1,partial\n7.5,n/a\nA.5.1,pending');
    const result = parseGapItemsFromCsv(csv, empty, clauses, controls);
    const byId = new Map(result.rows.map(r => [r.item.itemId, r.item.status]));
    expect(byId.get('6.1')).toBe('Partially Compliant');
    expect(byId.get('7.5')).toBe('Not Applicable');
    expect(byId.get('A.5.1')).toBe('Not Assessed');
  });

  it('defaults missing priority to Medium', () => {
    const csv = parseCsv('id,status\n6.1,Compliant');
    const result = parseGapItemsFromCsv(csv, empty, clauses, controls);
    expect(result.rows[0].item.priority).toBe('Medium');
  });

  it('maps "critical" priority to High', () => {
    const csv = parseCsv('id,status,priority\n6.1,Non-Compliant,critical');
    const result = parseGapItemsFromCsv(csv, empty, clauses, controls);
    expect(result.rows[0].item.priority).toBe('High');
  });

  it('marks rows whose id matches an existing item as updates', () => {
    const existing: GapAnalysisItem[] = [
      { itemId: '6.1', itemType: 'clause', status: 'Not Assessed', priority: 'Medium', notes: '', responsible: '' },
    ];
    const csv = parseCsv('id,status\n6.1,Compliant\nA.5.1,Compliant');
    const result = parseGapItemsFromCsv(csv, existing, clauses, controls);
    const byId = new Map(result.rows.map(r => [r.item.itemId, r.isUpdate]));
    expect(byId.get('6.1')).toBe(true);
    expect(byId.get('A.5.1')).toBe(false);
  });

  it('classifies clause vs control id correctly', () => {
    const csv = parseCsv('id,status\n6.1,Compliant\nA.5.1,Compliant');
    const result = parseGapItemsFromCsv(csv, empty, clauses, controls);
    const byId = new Map(result.rows.map(r => [r.item.itemId, r.item.itemType]));
    expect(byId.get('6.1')).toBe('clause');
    expect(byId.get('A.5.1')).toBe('control');
  });

  it('accepts header aliases (Reference / Compliance)', () => {
    const csv = parseCsv('Reference,Compliance,Owner\n6.1,partial,JB');
    const result = parseGapItemsFromCsv(csv, empty, clauses, controls);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].item.responsible).toBe('JB');
    expect(result.rows[0].item.status).toBe('Partially Compliant');
  });
});

describe('mergeGapItems', () => {
  const existing: GapAnalysisItem[] = [
    { itemId: '6.1', itemType: 'clause', status: 'Not Assessed', priority: 'Medium', notes: '', responsible: '' },
    { itemId: '7.5', itemType: 'clause', status: 'Compliant',    priority: 'Low',    notes: '', responsible: '' },
  ];

  it('updates an existing item when the import touches it', () => {
    const importing: GapAnalysisItem[] = [
      { itemId: '6.1', itemType: 'clause', status: 'Compliant', priority: 'High', notes: 'now done', responsible: 'JB' },
    ];
    const merged = mergeGapItems(existing, importing);
    expect(merged.find(i => i.itemId === '6.1')?.status).toBe('Compliant');
    expect(merged.find(i => i.itemId === '6.1')?.notes).toBe('now done');
  });

  it('preserves existing items that the import does not touch', () => {
    const importing: GapAnalysisItem[] = [
      { itemId: '6.1', itemType: 'clause', status: 'Compliant', priority: 'High', notes: '', responsible: '' },
    ];
    const merged = mergeGapItems(existing, importing);
    // 7.5 must still be there.
    expect(merged.find(i => i.itemId === '7.5')).toBeDefined();
  });

  it('adds brand-new items', () => {
    const importing: GapAnalysisItem[] = [
      { itemId: 'A.5.1', itemType: 'control', status: 'Compliant', priority: 'Medium', notes: '', responsible: '' },
    ];
    const merged = mergeGapItems(existing, importing);
    expect(merged.find(i => i.itemId === 'A.5.1')).toBeDefined();
    expect(merged).toHaveLength(3);
  });
});
