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

// ─── Sprint 18: DEK refactor + recovery + change-pass + disable ────────────

describe('enableEncryption returns a recovery code', () => {
  it('the code is a parseable 8-group-of-4 hex string', async () => {
    const r = await cs.enableEncryption('test-pass');
    expect(r.recoveryCode).toMatch(/^[0-9A-F]{4}(-[0-9A-F]{4}){7}$/);
  });

  it('writes both wrapped-DEK slots (passphrase + recovery)', async () => {
    await cs.enableEncryption('test-pass');
    expect(localStorage.getItem('clause-control:enc:__dek-pass')).toBeTruthy();
    expect(localStorage.getItem('clause-control:enc:__dek-recovery')).toBeTruthy();
  });
});

describe('unlockWithRecovery', () => {
  it('opens with the printed recovery code', async () => {
    const { recoveryCode } = await cs.enableEncryption('original-pass');
    cs.lock();
    expect(await cs.unlockWithRecovery(recoveryCode)).toBe(true);
    expect(cs.status()).toBe('unlocked');
  });

  it('rejects a wrong recovery code', async () => {
    await cs.enableEncryption('test-pass');
    cs.lock();
    expect(await cs.unlockWithRecovery('AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-AAAA-BBBB')).toBe(false);
  });

  it('returns false when no recovery slot is set', async () => {
    // Simulate a v1-migrated device that hasn't set a recovery code yet.
    await cs.enableEncryption('test-pass');
    localStorage.removeItem('clause-control:enc:__dek-recovery');
    cs.lock();
    expect(await cs.unlockWithRecovery('AAAA-BBBB-CCCC-DDDD-EEEE-FFFF-AAAA-BBBB')).toBe(false);
  });

  // Regression (Sprint 21): unlockWithRecovery must populate liveDekBytes,
  // otherwise the forced passphrase rotation that immediately follows a
  // recovery unlock fails and the user is stuck on the lock screen.
  it('recovery unlock supports the forced passphrase rotation', async () => {
    const { recoveryCode } = await cs.enableEncryption('forgotten-pass');
    cs.lock();
    expect(await cs.unlockWithRecovery(recoveryCode)).toBe(true);
    // The PostRecoveryRotate flow calls this next:
    expect(await cs.setPassphraseFromRecovery('brand-new-pass')).toBe(true);
    cs.lock();
    expect(await cs.unlock('forgotten-pass')).toBe(false);  // old pass dead
    expect(await cs.unlock('brand-new-pass')).toBe(true);   // new pass works
  });

  it('recovery unlock supports rotating the recovery code afterwards', async () => {
    const { recoveryCode } = await cs.enableEncryption('forgotten-pass');
    cs.lock();
    expect(await cs.unlockWithRecovery(recoveryCode)).toBe(true);
    const fresh = await cs.rotateRecoveryCode();
    expect(fresh).not.toBeNull();
  });
});

describe('changePassphrase', () => {
  it('rotates the passphrase; new one unlocks, old one fails', async () => {
    await cs.enableEncryption('old-pass');
    expect(await cs.changePassphrase('old-pass', 'new-pass')).toBe(true);
    cs.lock();
    expect(await cs.unlock('old-pass')).toBe(false);
    expect(await cs.unlock('new-pass')).toBe(true);
  });

  it('rejects a wrong old passphrase', async () => {
    await cs.enableEncryption('right-pass');
    expect(await cs.changePassphrase('wrong-pass', 'new-pass')).toBe(false);
  });

  it('leaves the recovery code unchanged', async () => {
    const { recoveryCode } = await cs.enableEncryption('old-pass');
    await cs.changePassphrase('old-pass', 'new-pass');
    cs.lock();
    expect(await cs.unlockWithRecovery(recoveryCode)).toBe(true);
  });
});

describe('rotateRecoveryCode', () => {
  it('mints a new recovery code that unlocks; old one stops working', async () => {
    const { recoveryCode: original } = await cs.enableEncryption('test-pass');
    const fresh = await cs.rotateRecoveryCode();
    expect(fresh).not.toBeNull();
    expect(fresh).not.toBe(original);
    cs.lock();
    expect(await cs.unlockWithRecovery(original)).toBe(false);
    expect(await cs.unlockWithRecovery(fresh!)).toBe(true);
  });

  it('returns null when locked', async () => {
    await cs.enableEncryption('test-pass');
    cs.lock();
    expect(await cs.rotateRecoveryCode()).toBeNull();
  });
});

describe('disableEncryption', () => {
  it('moves enc-prefixed user data back to plain keys', async () => {
    localStorage.setItem('clause-control:wp-audit-reports', '[{"id":"r1"}]');
    await cs.enableEncryption('test-pass');
    expect(await cs.disableEncryption('test-pass')).toBe(true);
    expect(localStorage.getItem('clause-control:wp-audit-reports')).toBe('[{"id":"r1"}]');
  });

  it('removes the salt, both wrapped DEKs, and the canary', async () => {
    await cs.enableEncryption('test-pass');
    await cs.disableEncryption('test-pass');
    expect(localStorage.getItem('clause-control:storage-encrypted-salt')).toBeNull();
    expect(localStorage.getItem('clause-control:enc:__dek-pass')).toBeNull();
    expect(localStorage.getItem('clause-control:enc:__dek-recovery')).toBeNull();
    expect(localStorage.getItem('clause-control:enc:__canary')).toBeNull();
  });

  it('rejects a wrong passphrase', async () => {
    await cs.enableEncryption('right-pass');
    expect(await cs.disableEncryption('wrong-pass')).toBe(false);
    expect(cs.status()).toBe('unlocked');
  });

  it('flips status back to disabled', async () => {
    await cs.enableEncryption('test-pass');
    await cs.disableEncryption('test-pass');
    expect(cs.status()).toBe('disabled');
  });
});

describe('v1 → v2 migration on first unlock', () => {
  it('a device that only has __canary (no __dek-pass) still unlocks; gets a fresh DEK wrapping', async () => {
    // Hand-build a v1 device state: salt + canary + one enc value, all
    // encrypted directly under the passphrase-derived key.
    const { generateSalt, deriveKey, encryptString, saltToString } = await import('./crypto');
    const salt = generateSalt();
    const oldKey = await deriveKey('test-pass', salt);
    localStorage.setItem('clause-control:storage-encrypted-salt', saltToString(salt));
    localStorage.setItem('clause-control:enc:__canary', await encryptString(oldKey, 'post-watch:canary-v1'));
    localStorage.setItem('clause-control:enc:wp-audit-reports', await encryptString(oldKey, '[{"id":"legacy"}]'));

    expect(await cs.unlock('test-pass')).toBe(true);

    // After migration, __dek-pass should exist + the value should still be readable.
    expect(localStorage.getItem('clause-control:enc:__dek-pass')).toBeTruthy();
    expect(cs.get('clause-control:wp-audit-reports')).toBe('[{"id":"legacy"}]');
  });
});

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
