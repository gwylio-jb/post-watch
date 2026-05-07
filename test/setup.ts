/**
 * Vitest setup — runs once per test file before the suite executes.
 *
 *  - Loads the @testing-library/jest-dom matchers (.toBeInTheDocument etc.)
 *  - Wipes localStorage between tests so suites can't leak state into each
 *    other. We use localStorage as our primary persistence layer — without
 *    this, a test that writes to a key and a later test that reads the same
 *    key will pass or fail depending on order.
 *  - Pins the redesign theme classes onto <html> so component tests of
 *    redesigned pages (which depend on .theme-dark for token resolution)
 *    render with the same surface tokens production does.
 */
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';

// ─── localStorage polyfill ────────────────────────────────────────────────
// Node 25 ships a built-in `globalThis.localStorage` that stays as a stub
// until you pass `--localstorage-file <path>`, and happy-dom / jsdom both
// see the existing global and skip installing their own Storage. The result
// is that `localStorage.setItem`/`getItem`/`clear` are all undefined inside
// tests. We force-replace it with a real in-memory implementation so the
// app's `useLocalStorage` hook (and anything else that touches storage)
// works in tests without Node's experimental flag.
function makeMemoryStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    get length() { return Object.keys(store).length; },
    clear() { store = {}; },
    getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
    setItem(k, v) { store[k] = String(v); },
    removeItem(k) { delete store[k]; },
    key(i) { return Object.keys(store)[i] ?? null; },
  };
}

const memoryLocalStorage = makeMemoryStorage();
const memorySessionStorage = makeMemoryStorage();

// Reassign on both `globalThis` (Node-side) and `window` (browser shim) so
// every code path resolves to the same Storage instance.
Object.defineProperty(globalThis, 'localStorage',  { configurable: true, value: memoryLocalStorage });
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: memorySessionStorage });
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage',  { configurable: true, value: memoryLocalStorage });
  Object.defineProperty(window, 'sessionStorage', { configurable: true, value: memorySessionStorage });
}

beforeAll(() => {
  // Mirrors the boot script in index.html — see <head> for the runtime
  // equivalent. Without this, var(--ink-1) etc. resolve to nothing in tests.
  document.documentElement.classList.add('dark', 'theme-dark');
});

afterEach(() => {
  cleanup();
  // Belt-and-braces — RTL's cleanup() handles unmounting, but localStorage is
  // global state that survives even if the React tree is torn down.
  memoryLocalStorage.clear();
  memorySessionStorage.clear();
});
