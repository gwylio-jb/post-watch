/**
 * Tests for useLocalStorage — the persistence layer the entire app sits on.
 *
 * What we're protecting against:
 *  - Silent data loss on bad JSON in storage (must fall back to initialValue,
 *    not throw and crash the tree).
 *  - Two components reading the same key drifting out of sync after one
 *    writes (the in-tab CustomEvent broadcast).
 *  - The version-stamp side effect skipping when storage is unavailable.
 *
 * These tests exercise the hook through @testing-library's `renderHook`
 * because that's the contract real components have with it.
 */
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from './useLocalStorage';

describe('useLocalStorage', () => {
  it('returns the initial value when storage is empty', () => {
    const { result } = renderHook(() => useLocalStorage('counter', 0));
    expect(result.current[0]).toBe(0);
  });

  it('hydrates from existing prefixed storage on mount', () => {
    // The hook prefixes keys with "clause-control:" — write at that level
    // to simulate what a real reload would see.
    window.localStorage.setItem('clause-control:counter', '42');
    const { result } = renderHook(() => useLocalStorage('counter', 0));
    expect(result.current[0]).toBe(42);
  });

  it('persists writes and exposes the new value synchronously', () => {
    const { result } = renderHook(() => useLocalStorage('counter', 0));

    act(() => result.current[1](7));

    expect(result.current[0]).toBe(7);
    expect(window.localStorage.getItem('clause-control:counter')).toBe('7');
  });

  it('supports functional setters that read the previous value', () => {
    const { result } = renderHook(() => useLocalStorage('counter', 10));
    act(() => result.current[1](prev => prev + 5));
    expect(result.current[0]).toBe(15);
  });

  it('falls back to initialValue when stored JSON is malformed', () => {
    // Pre-poison the slot with non-JSON. Hook should NOT throw — that would
    // brick the whole app on a corrupted localStorage.
    window.localStorage.setItem('clause-control:bad', '{not valid json');
    const { result } = renderHook(() => useLocalStorage('bad', { ok: true }));
    expect(result.current[0]).toEqual({ ok: true });
  });

  it('synchronises two same-tab instances of the same key', () => {
    // Two hooks on the same key — write through one, the other should see it.
    const a = renderHook(() => useLocalStorage<string>('shared', 'a'));
    const b = renderHook(() => useLocalStorage<string>('shared', 'a'));

    act(() => a.result.current[1]('updated'));

    expect(a.result.current[0]).toBe('updated');
    expect(b.result.current[0]).toBe('updated');
  });

  it('remove() clears the slot and resets to initialValue', () => {
    const { result } = renderHook(() => useLocalStorage('counter', 0));
    act(() => result.current[1](99));
    expect(window.localStorage.getItem('clause-control:counter')).toBe('99');

    act(() => result.current[2]());

    expect(result.current[0]).toBe(0);
    expect(window.localStorage.getItem('clause-control:counter')).toBeNull();
  });

  it('serialises objects and arrays losslessly', () => {
    const original = { domains: ['a.com', 'b.com'], score: 91, nested: { ok: true } };
    const { result } = renderHook(() => useLocalStorage<typeof original>('obj', { domains: [], score: 0, nested: { ok: false } }));

    act(() => result.current[1](original));

    expect(result.current[0]).toEqual(original);
    // Round-trip via the storage backend to confirm no reference sharing.
    const parsed = JSON.parse(window.localStorage.getItem('clause-control:obj')!);
    expect(parsed).toEqual(original);
  });

  it('writes the storage version stamp on first use', () => {
    renderHook(() => useLocalStorage('any', 0));
    expect(window.localStorage.getItem('clause-control-version')).toBe('1');
  });
});
