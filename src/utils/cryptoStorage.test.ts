/**
 * Tests for the cryptoStorage state machine.
 *
 * What we're protecting against:
 *  - Lifecycle: disabled → unlocked (via enable) → locked (via lock) →
 *    unlocked (via unlock with the right passphrase).
 *  - Wrong passphrase on unlock rejects without leaving partial state.
 *  - Enable atomically: every plain key ends up encrypted; canary set;
 *    plain originals removed. No half-migration visible after.
 *  - get/set work transparently during the disabled and unlocked paths.
 *  - Passthrough keys never get encrypted (theme, active-section, etc.
 *    must be readable BEFORE unlock to avoid flash-of-wrong-theme).
 *  - wipeEverything cleans up properly.
 *  - cleanupAfterCrash sweeps stale plain keys when a salt exists.
 */
import * as cs from './cryptoStorage';

const LS = 'clause-control:';
const ENC = 'clause-control:enc:';
const SALT = 'clause-control:storage-encrypted-salt';
const CANARY = 'clause-control:enc:__canary';

// Each test starts from a fully-locked-out, zeroed state. We can't rely
// on the setup file's cleanup because it doesn't touch module-scope
// state in cryptoStorage; explicitly lock at the top of each test.
beforeEach(() => {
  cs.lock();
});

// ─── Status lifecycle ──────────────────────────────────────────────────────

describe('status()', () => {
  it("starts 'disabled' on a fresh device", () => {
    expect(cs.status()).toBe('disabled');
  });

  it("becomes 'locked' when a salt exists but key isn't in memory", () => {
    localStorage.setItem(SALT, 'AAAAAAAAAAAAAAAAAAAAAA==');
    cs.lock();
    expect(cs.status()).toBe('locked');
  });

  it("becomes 'unlocked' after a successful enable", async () => {
    await cs.enableEncryption('test-pass');
    expect(cs.status()).toBe('unlocked');
  });
});

// ─── enableEncryption ──────────────────────────────────────────────────────

describe('enableEncryption', () => {
  it('refuses when encryption is already enabled', async () => {
    await cs.enableEncryption('first');
    await expect(cs.enableEncryption('second')).rejects.toThrow(/already enabled/i);
  });

  it('moves every plain key to its enc-prefixed slot and removes the plain', async () => {
    localStorage.setItem(`${LS}wp-audit-reports`, '[]');
    localStorage.setItem(`${LS}clients`, '[{"id":"c1","name":"A"}]');
    await cs.enableEncryption('test-pass');
    expect(localStorage.getItem(`${LS}wp-audit-reports`)).toBeNull();
    expect(localStorage.getItem(`${LS}clients`)).toBeNull();
    expect(localStorage.getItem(`${ENC}wp-audit-reports`)).toBeTruthy();
    expect(localStorage.getItem(`${ENC}clients`)).toBeTruthy();
  });

  it('writes the salt + canary as commit points', async () => {
    await cs.enableEncryption('test-pass');
    expect(localStorage.getItem(SALT)).toBeTruthy();
    expect(localStorage.getItem(CANARY)).toBeTruthy();
  });

  it('populates the in-memory cache so subsequent get() returns the live value', async () => {
    localStorage.setItem(`${LS}wp-audit-reports`, '[{"id":"r1"}]');
    await cs.enableEncryption('test-pass');
    expect(cs.get(`${LS}wp-audit-reports`)).toBe('[{"id":"r1"}]');
  });

  it('does not encrypt passthrough keys (theme stays plain)', async () => {
    localStorage.setItem(`${LS}theme`, '"dark"');
    await cs.enableEncryption('test-pass');
    expect(localStorage.getItem(`${LS}theme`)).toBe('"dark"');
    expect(localStorage.getItem(`${ENC}theme`)).toBeNull();
  });
});

// ─── unlock ────────────────────────────────────────────────────────────────

describe('unlock', () => {
  it("returns false when there's no salt (encryption not enabled)", async () => {
    expect(await cs.unlock('anything')).toBe(false);
  });

  it('returns true with the correct passphrase', async () => {
    await cs.enableEncryption('right-pass');
    cs.lock();
    expect(await cs.unlock('right-pass')).toBe(true);
    expect(cs.status()).toBe('unlocked');
  });

  it('returns false with the wrong passphrase, without setting state', async () => {
    await cs.enableEncryption('right-pass');
    cs.lock();
    const ok = await cs.unlock('wrong-pass');
    expect(ok).toBe(false);
    expect(cs.status()).toBe('locked');
  });

  it('pre-warms the cache so all encrypted keys are readable after unlock', async () => {
    localStorage.setItem(`${LS}wp-audit-reports`, '[{"id":"r1"}]');
    localStorage.setItem(`${LS}clients`, '[{"id":"c1"}]');
    await cs.enableEncryption('test-pass');
    cs.lock();
    expect(await cs.unlock('test-pass')).toBe(true);
    expect(cs.get(`${LS}wp-audit-reports`)).toBe('[{"id":"r1"}]');
    expect(cs.get(`${LS}clients`)).toBe('[{"id":"c1"}]');
  });
});

// ─── get / set ─────────────────────────────────────────────────────────────

describe('get / set when disabled (legacy plain path)', () => {
  it('round-trips plain values through localStorage', () => {
    cs.set(`${LS}foo`, '"bar"');
    expect(cs.get(`${LS}foo`)).toBe('"bar"');
    expect(localStorage.getItem(`${LS}foo`)).toBe('"bar"');
  });

  it('returns null for missing keys', () => {
    expect(cs.get(`${LS}missing`)).toBeNull();
  });

  it('remove deletes the plain key', () => {
    cs.set(`${LS}foo`, 'x');
    cs.remove(`${LS}foo`);
    expect(cs.get(`${LS}foo`)).toBeNull();
  });
});

describe('get / set when unlocked', () => {
  it('updates cache synchronously', async () => {
    await cs.enableEncryption('test-pass');
    cs.set(`${LS}new-key`, '"value"');
    // Immediately readable from cache.
    expect(cs.get(`${LS}new-key`)).toBe('"value"');
  });

  it('writes persist as encrypted blobs eventually', async () => {
    await cs.enableEncryption('test-pass');
    cs.set(`${LS}persisted`, '"hello"');
    // The persist is fire-and-forget via WebCrypto.subtle which is
    // genuinely async (not microtask-bounded). Use vi.waitFor to poll
    // until the encrypted blob lands.
    await vi.waitFor(() => {
      expect(localStorage.getItem(`${ENC}persisted`)).toBeTruthy();
    });
    expect(localStorage.getItem(`${LS}persisted`)).toBeNull();
  });

  it("returns null for keys we haven't written even when unlocked", async () => {
    await cs.enableEncryption('test-pass');
    expect(cs.get(`${LS}never-written`)).toBeNull();
  });
});

describe('get when locked', () => {
  it('returns null even when an encrypted value exists on disk', async () => {
    await cs.enableEncryption('test-pass');
    cs.set(`${LS}thing`, 'value');
    cs.lock();
    expect(cs.get(`${LS}thing`)).toBeNull();
  });
});

// ─── Passthrough keys ──────────────────────────────────────────────────────

describe('passthrough keys', () => {
  it('always reads plain from localStorage regardless of state', async () => {
    localStorage.setItem(`${LS}theme`, '"light"');
    expect(cs.get(`${LS}theme`)).toBe('"light"');

    await cs.enableEncryption('test-pass');
    expect(cs.get(`${LS}theme`)).toBe('"light"');

    cs.lock();
    expect(cs.get(`${LS}theme`)).toBe('"light"');
  });

  it('always writes plain regardless of state', async () => {
    await cs.enableEncryption('test-pass');
    cs.set(`${LS}theme`, '"dark"');
    expect(localStorage.getItem(`${LS}theme`)).toBe('"dark"');
    expect(localStorage.getItem(`${ENC}theme`)).toBeNull();
  });
});

// ─── wipeEverything ────────────────────────────────────────────────────────

describe('wipeEverything', () => {
  it('removes every clause-control:* key + locks the module', async () => {
    localStorage.setItem(`${LS}wp-audit-reports`, '[]');
    await cs.enableEncryption('test-pass');
    cs.wipeEverything();
    expect(cs.status()).toBe('disabled');
    expect(localStorage.getItem(SALT)).toBeNull();
    expect(localStorage.getItem(`${ENC}wp-audit-reports`)).toBeNull();
  });
});

// ─── cleanupAfterCrash ─────────────────────────────────────────────────────

describe('cleanupAfterCrash', () => {
  it('is a no-op when no salt is set', () => {
    localStorage.setItem(`${LS}leftover`, 'whatever');
    cs.cleanupAfterCrash();
    expect(localStorage.getItem(`${LS}leftover`)).toBe('whatever');
  });

  it('deletes stale plain keys when a salt + enc keys coexist (interrupted enable)', () => {
    localStorage.setItem(SALT, 'AAAAAAAAAAAAAAAAAAAAAA==');
    localStorage.setItem(`${LS}stale-plain`, 'old data');
    localStorage.setItem(`${ENC}fresh-enc`, 'ciphertext');

    cs.cleanupAfterCrash();

    expect(localStorage.getItem(`${LS}stale-plain`)).toBeNull();
    // Enc key untouched.
    expect(localStorage.getItem(`${ENC}fresh-enc`)).toBe('ciphertext');
  });

  it('does not touch passthrough keys', () => {
    localStorage.setItem(SALT, 'AAAAAAAAAAAAAAAAAAAAAA==');
    localStorage.setItem(`${LS}theme`, '"dark"');
    cs.cleanupAfterCrash();
    expect(localStorage.getItem(`${LS}theme`)).toBe('"dark"');
  });
});

// ─── subscribe ─────────────────────────────────────────────────────────────

describe('subscribe', () => {
  it('fires listeners on status transitions', async () => {
    const events: string[] = [];
    const unsubscribe = cs.subscribe(() => events.push(cs.status()));

    await cs.enableEncryption('test-pass');
    cs.lock();
    await cs.unlock('test-pass');

    unsubscribe();
    expect(events).toEqual(['unlocked', 'locked', 'unlocked']);
  });

  it('the unsubscribe function stops further notifications', async () => {
    let count = 0;
    const off = cs.subscribe(() => { count++; });
    off();
    await cs.enableEncryption('test-pass');
    expect(count).toBe(0);
  });
});
