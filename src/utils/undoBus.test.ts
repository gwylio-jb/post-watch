/**
 * Tests for the undo bus. We're protecting:
 *   - push replaces (single-slot mental model)
 *   - performUndo runs the revert exactly once and clears the slot
 *   - dismissUndo clears without running the revert
 *   - expiry: entries vanish after their TTL
 *   - subscribe fires on every state change
 */
import { pushUndo, performUndo, dismissUndo, getUndo, subscribe, __testing__ } from './undoBus';

beforeEach(() => {
  __testing__.reset();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('undoBus', () => {
  it('starts empty', () => {
    expect(getUndo()).toBeNull();
  });

  it('push then performUndo runs revert and clears', () => {
    const revert = vi.fn();
    pushUndo({ label: 'Deleted X', revert });
    expect(getUndo()?.label).toBe('Deleted X');
    performUndo();
    expect(revert).toHaveBeenCalledTimes(1);
    expect(getUndo()).toBeNull();
  });

  it('push replaces previous entry without firing the old revert', () => {
    const oldRevert = vi.fn();
    const newRevert = vi.fn();
    pushUndo({ label: 'A', revert: oldRevert });
    pushUndo({ label: 'B', revert: newRevert });
    expect(getUndo()?.label).toBe('B');
    performUndo();
    expect(oldRevert).not.toHaveBeenCalled();
    expect(newRevert).toHaveBeenCalledTimes(1);
  });

  it('dismissUndo drops the entry without running it', () => {
    const revert = vi.fn();
    pushUndo({ label: 'X', revert });
    dismissUndo();
    expect(revert).not.toHaveBeenCalled();
    expect(getUndo()).toBeNull();
  });

  it('expires after ttl', () => {
    const revert = vi.fn();
    pushUndo({ label: 'X', revert, ttlMs: 100 });
    expect(getUndo()).not.toBeNull();
    vi.advanceTimersByTime(150);
    expect(getUndo()).toBeNull();
    expect(revert).not.toHaveBeenCalled();
  });

  it('subscribe fires on push/perform/dismiss/expiry', () => {
    const listener = vi.fn();
    subscribe(listener);
    pushUndo({ label: 'X', revert: () => {}, ttlMs: 50 });
    expect(listener).toHaveBeenCalled();
    listener.mockClear();
    vi.advanceTimersByTime(60); // expiry
    expect(listener).toHaveBeenCalled();
  });

  it('performUndo on empty slot is a no-op', () => {
    expect(() => performUndo()).not.toThrow();
  });

  it('revert that throws is swallowed (doesn\'t crash callers)', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    pushUndo({
      label: 'boom',
      revert: () => { throw new Error('nope'); },
    });
    expect(() => performUndo()).not.toThrow();
    errSpy.mockRestore();
  });
});
