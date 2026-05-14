/**
 * Tests for the QueryPlan parser. We're protecting against the messy
 * output shapes small local models actually produce:
 *   - markdown fences (```json … ```)
 *   - leading or trailing prose
 *   - unknown collections / fields (must be rejected, not crash)
 *   - malformed filter shapes (dropped silently, plan still returns)
 */
import { extractJson, parseQueryPlan } from './queryPlan';

describe('extractJson', () => {
  it('parses bare JSON', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('strips a ```json fence', () => {
    const raw = '```json\n{"collection":"risks","filters":[]}\n```';
    expect(extractJson(raw)).toEqual({ collection: 'risks', filters: [] });
  });

  it('strips an unlabelled fence', () => {
    const raw = 'Sure! Here you go:\n```\n{"x":2}\n```\nLet me know.';
    expect(extractJson(raw)).toEqual({ x: 2 });
  });

  it('extracts a balanced object from surrounding prose', () => {
    const raw = 'The plan is: {"collection":"risks","filters":[]} — hope that helps!';
    expect(extractJson(raw)).toEqual({ collection: 'risks', filters: [] });
  });

  it('returns null for garbage', () => {
    expect(extractJson('not even close')).toBeNull();
    expect(extractJson('')).toBeNull();
  });
});

describe('parseQueryPlan', () => {
  it('parses a minimal plan', () => {
    const plan = parseQueryPlan('{"collection":"risks","filters":[]}');
    expect(plan).toEqual({ collection: 'risks', filters: [], summary: undefined });
  });

  it('rejects an unknown collection', () => {
    expect(parseQueryPlan('{"collection":"unicorns","filters":[]}')).toBeNull();
  });

  it('drops malformed filters but keeps valid ones', () => {
    const raw = JSON.stringify({
      collection: 'risks',
      filters: [
        { field: 'severity', op: 'in', value: ['high', 'critical'] },
        { field: 'unknown', op: 'eq', value: 'x' },                  // dropped
        { field: 'clientName', op: 'contains', value: 'Acme' },
        { field: 'severity', op: 'in', value: ['bogus'] },           // dropped
      ],
    });
    const plan = parseQueryPlan(raw);
    expect(plan?.filters).toEqual([
      { field: 'severity', op: 'in', value: ['high', 'critical'] },
      { field: 'clientName', op: 'contains', value: 'Acme' },
    ]);
  });

  it('accepts a createdAt date filter', () => {
    const raw = '{"collection":"reports","filters":[{"field":"createdAt","op":"after","value":"2025-01-01"}]}';
    expect(parseQueryPlan(raw)?.filters[0]).toEqual({
      field: 'createdAt', op: 'after', value: '2025-01-01',
    });
  });

  it('rejects an invalid date', () => {
    const raw = '{"collection":"reports","filters":[{"field":"createdAt","op":"after","value":"yesterday"}]}';
    expect(parseQueryPlan(raw)?.filters).toEqual([]);
  });

  it('passes through a summary string', () => {
    const raw = '{"collection":"risks","filters":[],"summary":"All open risks"}';
    expect(parseQueryPlan(raw)?.summary).toBe('All open risks');
  });

  it('tolerates fenced output with prose', () => {
    const raw = 'Here is the plan:\n```json\n{"collection":"risks","filters":[]}\n```\nHope this helps.';
    expect(parseQueryPlan(raw)?.collection).toBe('risks');
  });
});
