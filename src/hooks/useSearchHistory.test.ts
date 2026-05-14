/**
 * Tests for the per-scope search history.
 *
 * Protecting:
 *   - empty input is ignored (no junk entries)
 *   - newest-first ordering
 *   - case-insensitive dedup
 *   - hard cap on entries per scope
 *   - clear wipes only the named scope
 */
import {
  pushSearchHistory, clearSearchHistory, getSearchHistory, __testing__,
} from './useSearchHistory';

beforeEach(() => {
  __testing__.resetAll();
});

describe('useSearchHistory', () => {
  it('starts empty for a fresh scope', () => {
    expect(getSearchHistory('risks')).toEqual([]);
  });

  it('push adds entries newest-first', () => {
    pushSearchHistory('risks', 'first');
    pushSearchHistory('risks', 'second');
    expect(getSearchHistory('risks')).toEqual(['second', 'first']);
  });

  it('ignores empty / whitespace queries', () => {
    pushSearchHistory('risks', '');
    pushSearchHistory('risks', '   ');
    expect(getSearchHistory('risks')).toEqual([]);
  });

  it('trims and dedups case-insensitively, bumping to top', () => {
    pushSearchHistory('risks', 'Auth');
    pushSearchHistory('risks', 'iso');
    pushSearchHistory('risks', '  auth  ');
    // 'auth' should appear once, at the top, with the latest casing.
    expect(getSearchHistory('risks')).toEqual(['auth', 'iso']);
  });

  it('respects the per-scope limit', () => {
    for (let i = 0; i < 12; i++) pushSearchHistory('risks', `q${i}`, 5);
    const h = getSearchHistory('risks');
    expect(h).toHaveLength(5);
    expect(h[0]).toBe('q11');
  });

  it('scopes are isolated', () => {
    pushSearchHistory('risks', 'A');
    pushSearchHistory('clients', 'B');
    expect(getSearchHistory('risks')).toEqual(['A']);
    expect(getSearchHistory('clients')).toEqual(['B']);
  });

  it('clear wipes only the named scope', () => {
    pushSearchHistory('risks', 'A');
    pushSearchHistory('clients', 'B');
    clearSearchHistory('risks');
    expect(getSearchHistory('risks')).toEqual([]);
    expect(getSearchHistory('clients')).toEqual(['B']);
  });
});
