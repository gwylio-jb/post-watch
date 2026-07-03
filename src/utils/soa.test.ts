/**
 * Tests for Statement of Applicability helpers.
 *
 * Protecting:
 *  - ensureSeeded creates one row per Annex A control, preserves edits,
 *    tops up missing controls, and reports `changed` accurately
 *  - updateEntry touches only the target row and bumps updatedAt
 *  - setThemeApplicability hits exactly the theme's controls
 *  - computeStats maths (the completeness meter drives a UI promise)
 *  - seedFromGapSession never clobbers user-curated rows
 *  - soaToCsv escapes quotes (justifications are free text)
 */
import type { GapAnalysisSession, SoaStore } from '../data/types';
import { allControls } from '../data/controls';
import {
  ensureSeeded, updateEntry, setThemeApplicability, computeStats,
  seedFromGapSession, soaToCsv, blankEntry,
} from './soa';

const CLIENT = 'c-test';

describe('ensureSeeded', () => {
  it('seeds one entry per control on first visit', () => {
    const { entries, changed } = ensureSeeded({}, CLIENT);
    expect(changed).toBe(true);
    expect(entries).toHaveLength(allControls.length);
    expect(entries.every(e => e.applicable)).toBe(true);
  });

  it('is a no-op when already fully seeded', () => {
    const first = ensureSeeded({}, CLIENT);
    const store: SoaStore = { [CLIENT]: first.entries };
    const second = ensureSeeded(store, CLIENT);
    expect(second.changed).toBe(false);
    expect(second.entries).toEqual(first.entries);
  });

  it('preserves existing rows and tops up missing controls', () => {
    const edited = { ...blankEntry('A.5.1'), justification: 'Core policy control', applicable: true };
    const store: SoaStore = { [CLIENT]: [edited] };
    const { entries, changed } = ensureSeeded(store, CLIENT);
    expect(changed).toBe(true);
    expect(entries).toHaveLength(allControls.length);
    expect(entries.find(e => e.controlId === 'A.5.1')?.justification).toBe('Core policy control');
  });
});

describe('updateEntry', () => {
  it('patches only the target row', () => {
    const { entries } = ensureSeeded({}, CLIENT);
    const next = updateEntry(entries, 'A.5.1', { justification: 'Required by policy' });
    expect(next.find(e => e.controlId === 'A.5.1')?.justification).toBe('Required by policy');
    expect(next.find(e => e.controlId === 'A.5.2')?.justification).toBe('');
  });
});

describe('setThemeApplicability', () => {
  it('flips exactly the theme controls', () => {
    const { entries } = ensureSeeded({}, CLIENT);
    const next = setThemeApplicability(entries, 'People', false);
    const peopleIds = new Set(allControls.filter(c => c.category === 'People').map(c => c.id));
    for (const e of next) {
      expect(e.applicable).toBe(!peopleIds.has(e.controlId));
    }
  });
});

describe('computeStats', () => {
  it('counts applicability, justification and implementation', () => {
    let { entries } = ensureSeeded({}, CLIENT);
    entries = updateEntry(entries, 'A.5.1', { justification: 'yes', implementationStatus: 'Implemented' });
    entries = updateEntry(entries, 'A.5.2', { applicable: false, justification: 'outsourced' });
    const stats = computeStats(entries);
    expect(stats.total).toBe(allControls.length);
    expect(stats.excluded).toBe(1);
    expect(stats.applicable).toBe(allControls.length - 1);
    expect(stats.justified).toBe(2);
    expect(stats.implemented).toBe(1);
    expect(stats.completeness).toBe(Math.round((2 / allControls.length) * 100));
  });
});

describe('seedFromGapSession', () => {
  function session(items: GapAnalysisSession['items']): GapAnalysisSession {
    return {
      id: 's1', name: 'Test', createdAt: '2026-01-01', updatedAt: '2026-01-01', items,
    };
  }

  it('maps compliant → Implemented and partial → In Progress', () => {
    const { entries } = ensureSeeded({}, CLIENT);
    const next = seedFromGapSession(entries, session([
      { itemId: 'A.5.1', itemType: 'control', status: 'Compliant', notes: '', priority: 'Low', responsible: '' },
      { itemId: 'A.5.2', itemType: 'control', status: 'Partially Compliant', notes: '', priority: 'Low', responsible: '' },
    ]));
    expect(next.find(e => e.controlId === 'A.5.1')?.implementationStatus).toBe('Implemented');
    expect(next.find(e => e.controlId === 'A.5.2')?.implementationStatus).toBe('In Progress');
  });

  it('maps Not Applicable → applicable=false', () => {
    const { entries } = ensureSeeded({}, CLIENT);
    const next = seedFromGapSession(entries, session([
      { itemId: 'A.5.3', itemType: 'control', status: 'Not Applicable', notes: '', priority: 'Low', responsible: '' },
    ]));
    expect(next.find(e => e.controlId === 'A.5.3')?.applicable).toBe(false);
  });

  it('never clobbers a row the user already worked on', () => {
    let { entries } = ensureSeeded({}, CLIENT);
    entries = updateEntry(entries, 'A.5.1', { justification: 'Curated by hand', implementationStatus: 'Verified' });
    const next = seedFromGapSession(entries, session([
      { itemId: 'A.5.1', itemType: 'control', status: 'Non-Compliant', notes: '', priority: 'High', responsible: '' },
    ]));
    const row = next.find(e => e.controlId === 'A.5.1');
    expect(row?.implementationStatus).toBe('Verified');
    expect(row?.justification).toBe('Curated by hand');
  });

  it('ignores clause items', () => {
    const { entries } = ensureSeeded({}, CLIENT);
    const next = seedFromGapSession(entries, session([
      { itemId: 'A.5.1', itemType: 'clause', status: 'Compliant', notes: '', priority: 'Low', responsible: '' },
    ]));
    expect(next.find(e => e.controlId === 'A.5.1')?.implementationStatus).toBe('Not Started');
  });
});

describe('soaToCsv', () => {
  it('produces a header + one row per entry, escaping quotes', () => {
    let { entries } = ensureSeeded({}, CLIENT);
    entries = updateEntry(entries, 'A.5.1', { justification: 'Policy "must" exist' });
    const csv = soaToCsv(entries);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(allControls.length + 1);
    expect(lines[0]).toContain('Control,');
    expect(csv).toContain('"Policy ""must"" exist"');
  });
});
