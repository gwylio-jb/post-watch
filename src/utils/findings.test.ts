/**
 * Tests for the Findings/CAPA lifecycle.
 *
 * Protecting:
 *  - transition() enforces the linear lifecycle and its preconditions:
 *    no plan without an action, no verify without a passed effectiveness
 *    check, no skipping. These rules are the audit trail's integrity.
 *  - isOverdue: due date inclusive, resolved findings never overdue.
 *  - sortForBoard: overdue first, then severity, then age.
 *  - CSV escaping.
 */
import type { Finding } from '../data/types';
import {
  newFinding, transition, setAction, setEffectivenessCheck,
  isOverdue, overdueFindings, sortForBoard, findingsToCsv, NEXT_STATUS,
} from './findings';

function base(): Finding {
  return newFinding({
    clientId: 'c1', source: 'manual', title: 'Password policy missing',
    severity: 'high', refIds: ['A.5.17'],
  });
}

describe('newFinding', () => {
  it('starts open with a raisedAt stamp', () => {
    const f = base();
    expect(f.status).toBe('open');
    expect(f.raisedAt).toBeTruthy();
    expect(f.id).toMatch(/^finding-/);
  });
});

describe('transition lifecycle', () => {
  it('blocks action-planned without an action', () => {
    const out = transition(base(), 'action-planned');
    expect(typeof out).toBe('string');
  });

  it('walks the full lifecycle in order', () => {
    let f = setAction(base(), { owner: 'Josh', dueDate: '2026-06-30', description: 'Write the policy' });
    let out = transition(f, 'action-planned');
    expect(typeof out).not.toBe('string');
    f = out as Finding;

    out = transition(f, 'implemented');
    f = out as Finding;
    expect(f.status).toBe('implemented');

    // Verify blocked until an effectiveness check exists and passed.
    expect(typeof transition(f, 'verified')).toBe('string');
    f = setEffectivenessCheck(f, { date: '2026-07-15', passed: false, notes: 'still weak' });
    expect(typeof transition(f, 'verified')).toBe('string');
    f = setEffectivenessCheck(f, { date: '2026-07-20', passed: true, notes: 'ok' });
    out = transition(f, 'verified');
    f = out as Finding;
    expect(f.status).toBe('verified');

    out = transition(f, 'closed');
    f = out as Finding;
    expect(f.status).toBe('closed');
    expect(f.closedAt).toBeTruthy();
  });

  it('blocks skipping steps', () => {
    expect(typeof transition(base(), 'implemented')).toBe('string');
    expect(typeof transition(base(), 'closed')).toBe('string');
  });

  it('closed is terminal', () => {
    expect(NEXT_STATUS['closed']).toBeNull();
  });
});

describe('isOverdue', () => {
  const now = new Date('2026-07-10T12:00:00Z');

  it('false without an action', () => {
    expect(isOverdue(base(), now)).toBe(false);
  });

  it('true the day after the due date', () => {
    const f = setAction(base(), { owner: 'J', dueDate: '2026-07-08', description: '' });
    expect(isOverdue(f, now)).toBe(true);
  });

  it('false on the due date itself (inclusive)', () => {
    const f = setAction(base(), { owner: 'J', dueDate: '2026-07-10', description: '' });
    expect(isOverdue(f, now)).toBe(false);
  });

  it('false once verified or closed', () => {
    let f = setAction(base(), { owner: 'J', dueDate: '2026-01-01', description: '' });
    f = { ...f, status: 'verified' };
    expect(isOverdue(f, now)).toBe(false);
  });
});

describe('sortForBoard', () => {
  const now = new Date('2026-07-10T12:00:00Z');

  it('overdue first, then severity', () => {
    const overdueLow: Finding = {
      ...setAction(newFinding({ clientId: 'c', source: 'manual', title: 'od', severity: 'low' }),
        { owner: 'J', dueDate: '2026-01-01', description: '' }),
      status: 'action-planned',
    };
    const critical = newFinding({ clientId: 'c', source: 'manual', title: 'crit', severity: 'critical' });
    const medium = newFinding({ clientId: 'c', source: 'manual', title: 'med', severity: 'medium' });
    const sortedTitles = sortForBoard([medium, critical, overdueLow], now).map(f => f.title);
    expect(sortedTitles).toEqual(['od', 'crit', 'med']);
  });
});

describe('overdueFindings + findingsToCsv', () => {
  it('filters and serializes', () => {
    const f = setAction(base(), { owner: 'Josh "the fixer"', dueDate: '2026-01-01', description: '' });
    const list = [f, base()];
    expect(overdueFindings(list, new Date('2026-07-10'))).toHaveLength(1);
    const csv = findingsToCsv(list, new Map([['c1', 'Acme, Ltd']]));
    expect(csv.split('\n')).toHaveLength(3);
    expect(csv).toContain('"Acme, Ltd"');
    expect(csv).toContain('"Josh ""the fixer"""');
  });
});
