/**
 * Crypto storage facade — Sprint 15 Pack 3 #4.
 *
 * Owns the encryption-at-rest state machine for localStorage. The crypto
 * primitives (AES-GCM + PBKDF2) live in `crypto.ts`; this module is the
 * application-facing layer that:
 *
 *   1. Holds the master key in module-scope memory (never persisted,
 *      cleared on lock or app close).
 *   2. Maintains an in-memory plaintext cache so the existing
 *      synchronous useLocalStorage callers keep working unchanged.
 *      `useLocalStorage` consults `cryptoStorage.get(key)` first; when
 *      encryption is off (no salt key in localStorage) it falls back to
 *      reading plain localStorage as before.
 *   3. Drives one-shot migrations between plain ↔ encrypted on
 *      enable/disable.
 *
 * Storage layout when encryption is enabled:
 *   `clause-control:storage-encrypted-salt`   plaintext base64 PBKDF2 salt
 *   `clause-control:enc:__canary`             enc-prefixed canary blob
 *   `clause-control:enc:<key>`                enc-prefixed user values
 *
 * When encryption is OFF, only the legacy `clause-control:<key>` slots
 * exist — no salt, no canary, no enc-prefixed keys.
 *
 * Behaviour around the lifecycle:
 *
 *   - On app launch, if a salt exists, `cryptoStorage.status()` is
 *     `'locked'`. The boot flow renders the lock gate instead of the
 *     app body. `useLocalStorage` returns its initialValue (since the
 *     cache is empty until unlock).
 *   - `unlock(passphrase)` derives the key, decrypts the canary; on
 *     success, pre-warms the in-memory cache by decrypting every
 *     enc-prefixed key. After this, status is `'unlocked'`.
 *   - `useLocalStorage` reads from the cache; writes update the cache
 *     synchronously and schedule an async encrypt-and-persist.
 *   - `lock()` clears the key + cache in memory but keeps everything on
 *     disk. Next read returns initialValue until the next unlock.
 *
 * NOT a long-lived ticking process. The module exposes plain functions
 * + a tiny event emitter so React contexts can subscribe.
 */
import {
  generateSalt, saltToString, saltFromString,
  deriveKey,
  encryptString, decryptString,
} from './crypto';

// ─── Storage keys ──────────────────────────────────────────────────────────

const LS_PREFIX = 'clause-control:';
const ENC_PREFIX = 'clause-control:enc:';
const SALT_KEY = 'clause-control:storage-encrypted-salt';
const CANARY_KEY = 'clause-control:enc:__canary';
/** Constant plaintext that gets encrypted into the canary slot. Successful
 *  decryption back to this value verifies the passphrase. */
const CANARY_PLAINTEXT = 'post-watch:canary-v1';

// Keys we never encrypt — they're consulted before unlock (theme,
// active-section, sidebar-collapsed) so encrypting them would mean
// flashing the wrong theme / wrong page during boot. Pure UX state.
const PASSTHROUGH_KEYS = new Set<string>([
  `${LS_PREFIX}theme`,
  `${LS_PREFIX}active-section`,
  `${LS_PREFIX}sidebar-collapsed`,
  // The version key + the salt key MUST be plaintext for boot flow.
  `${LS_PREFIX}storage-version`,
  SALT_KEY,
]);

// ─── State ─────────────────────────────────────────────────────────────────

export type CryptoStatus =
  /** No salt found in localStorage. Encryption disabled; plain reads/writes. */
  | 'disabled'
  /** Salt exists but no master key in memory. App must show unlock screen. */
  | 'locked'
  /** Master key + decrypted cache loaded. App can render normally. */
  | 'unlocked';

let masterKey: CryptoKey | null = null;
let plaintextCache: Map<string, string> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) {
    try { l(); } catch { /* listener error must not break the others */ }
  }
}

/** Subscribe to status changes. Returns an unsubscribe function. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

// ─── Status ────────────────────────────────────────────────────────────────

function hasSalt(): boolean {
  try { return localStorage.getItem(SALT_KEY) !== null; }
  catch { return false; }
}

export function status(): CryptoStatus {
  if (!hasSalt()) return 'disabled';
  return masterKey !== null && plaintextCache !== null ? 'unlocked' : 'locked';
}

// ─── Get / set facade ──────────────────────────────────────────────────────

/**
 * Synchronous read. The contract:
 *   - status === 'disabled': read plain localStorage at `key` (legacy).
 *   - status === 'unlocked': read the in-memory cache.
 *   - status === 'locked'  : return null (caller uses initialValue).
 *   - Passthrough keys (theme, etc): always read plain.
 */
export function get(key: string): string | null {
  if (PASSTHROUGH_KEYS.has(key)) {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  const st = status();
  if (st === 'disabled') {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  if (st === 'locked') return null;
  // unlocked — read from cache. `key` is the LS-prefixed name; we
  // store cache entries keyed by the same prefixed name so callers
  // don't have to know about the enc:/no-enc distinction.
  return plaintextCache!.get(key) ?? null;
}

/**
 * Synchronous write to cache + async-fire-and-forget persist to disk.
 *
 *   - status === 'disabled': just plain localStorage.setItem.
 *   - status === 'unlocked': update cache; schedule encrypt-and-persist.
 *   - status === 'locked'  : noop (caller should never write while locked
 *                             — boot flow gates the app behind unlock).
 *   - Passthrough keys: plain localStorage.setItem regardless of status.
 *
 * The async persist uses a microtask to keep ordering consistent with
 * the caller's expectations (write → immediate read sees the new value).
 */
export function set(key: string, value: string): void {
  if (PASSTHROUGH_KEYS.has(key)) {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
    return;
  }
  const st = status();
  if (st === 'disabled') {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
    return;
  }
  if (st === 'locked') {
    // Refuse the write quietly — if anything tries to persist while
    // locked, the safest thing is to drop the write. The boot flow
    // gates the app behind unlock, so this should be unreachable.
    return;
  }
  // unlocked
  plaintextCache!.set(key, value);
  // Schedule encrypt + write. Errors are logged, not thrown — a single
  // persist failure shouldn't crash the app. The cache stays consistent.
  void persistOne(key, value);
}

/** Remove a key — clears cache + persists deletion. */
export function remove(key: string): void {
  if (PASSTHROUGH_KEYS.has(key)) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    return;
  }
  const st = status();
  if (st === 'disabled') {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    return;
  }
  if (st === 'locked') return;
  plaintextCache!.delete(key);
  try {
    const encKey = key.replace(LS_PREFIX, ENC_PREFIX);
    localStorage.removeItem(encKey);
  } catch { /* ignore */ }
}

async function persistOne(key: string, value: string): Promise<void> {
  if (!masterKey) return;
  try {
    const blob = await encryptString(masterKey, value);
    const encKey = key.replace(LS_PREFIX, ENC_PREFIX);
    localStorage.setItem(encKey, blob);
  } catch (e) {
    console.warn('[cryptoStorage] persist failed for', key, e);
  }
}

// ─── Enable / unlock / lock ────────────────────────────────────────────────

/**
 * One-shot enable. Generates a fresh salt, derives a key, encrypts every
 * existing plain `clause-control:*` key (except passthroughs) into its
 * enc-prefixed slot, then deletes the originals.
 *
 * Two-phase to survive crashes mid-migration:
 *   Phase 1: write every enc-prefixed value + the canary.
 *   Phase 2: only after phase 1 succeeds, delete the plain originals.
 *
 * If a crash interrupts between phases, the next launch will see BOTH a
 * salt AND plain keys → the boot flow's `cleanupAfterCrash()` (called
 * from the migration runner v3 step) sweeps the plain slots away.
 */
export async function enableEncryption(passphrase: string): Promise<void> {
  if (status() !== 'disabled') {
    throw new Error('Encryption is already enabled. Disable first to change passphrase.');
  }

  const salt = generateSalt();
  const key = await deriveKey(passphrase, salt);

  // Phase 1: write the canary + every plain key as encrypted.
  const canaryBlob = await encryptString(key, CANARY_PLAINTEXT);
  localStorage.setItem(CANARY_KEY, canaryBlob);

  const plainKeys = collectPlainKeys();
  const cache = new Map<string, string>();
  for (const k of plainKeys) {
    const v = localStorage.getItem(k);
    if (v === null) continue;
    const blob = await encryptString(key, v);
    const encK = k.replace(LS_PREFIX, ENC_PREFIX);
    localStorage.setItem(encK, blob);
    cache.set(k, v);
  }

  // Phase 2: write the salt (commit point) then delete the plain slots.
  localStorage.setItem(SALT_KEY, saltToString(salt));
  for (const k of plainKeys) {
    localStorage.removeItem(k);
  }

  // Activate the cache live so the running app keeps reading.
  masterKey = key;
  plaintextCache = cache;
  emit();
}

/**
 * Try to unlock with the given passphrase. On success, derives the key,
 * verifies via the canary, then pre-warms the in-memory cache by
 * decrypting every enc-prefixed key. Returns `true` on success.
 *
 * On failure (wrong passphrase, missing/corrupt canary), returns `false`
 * — caller surfaces the error to the user.
 */
export async function unlock(passphrase: string): Promise<boolean> {
  const saltStr = localStorage.getItem(SALT_KEY);
  if (!saltStr) return false;

  const canary = localStorage.getItem(CANARY_KEY);
  if (!canary) return false;

  let key: CryptoKey;
  try {
    key = await deriveKey(passphrase, saltFromString(saltStr));
  } catch {
    return false;
  }

  let decryptedCanary: string;
  try {
    decryptedCanary = await decryptString(key, canary);
  } catch {
    return false;
  }
  if (decryptedCanary !== CANARY_PLAINTEXT) return false;

  // Pre-warm the cache. Every enc-prefixed key decrypts under this key
  // or it's tampered/corrupt; we log and skip individual corrupt entries
  // rather than refusing to unlock entirely.
  const cache = new Map<string, string>();
  const encKeys = collectEncKeys();
  for (const encK of encKeys) {
    if (encK === CANARY_KEY) continue;
    const blob = localStorage.getItem(encK);
    if (blob === null) continue;
    try {
      const plain = await decryptString(key, blob);
      const logicalKey = encK.replace(ENC_PREFIX, LS_PREFIX);
      cache.set(logicalKey, plain);
    } catch (e) {
      console.warn('[cryptoStorage] could not decrypt', encK, e);
    }
  }

  masterKey = key;
  plaintextCache = cache;
  emit();
  return true;
}

/** Clear the master key + cache from memory. Disk is untouched. */
export function lock(): void {
  masterKey = null;
  plaintextCache = null;
  emit();
}

/**
 * Reset: wipe every `clause-control:*` key + the salt + the canary.
 * Used by the unlock screen when the user has forgotten their
 * passphrase and chooses "start over". Destructive — caller MUST
 * confirm with the user before calling.
 */
export function wipeEverything(): void {
  const all: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(LS_PREFIX)) all.push(k);
    }
    for (const k of all) localStorage.removeItem(k);
  } catch { /* ignore */ }
  masterKey = null;
  plaintextCache = null;
  emit();
}

/**
 * Crash-recovery sweep — called once on boot by the migration runner.
 * If a salt exists but plain keys ALSO exist (interrupted enable
 * migration), delete the plain keys. The encrypted copies are
 * authoritative. Passthrough keys are left alone.
 */
export function cleanupAfterCrash(): void {
  if (!hasSalt()) return;
  const plainKeys = collectPlainKeys();
  for (const k of plainKeys) {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function collectPlainKeys(): string[] {
  const out: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (!k.startsWith(LS_PREFIX)) continue;
      if (k.startsWith(ENC_PREFIX)) continue;
      if (PASSTHROUGH_KEYS.has(k)) continue;
      out.push(k);
    }
  } catch { /* ignore */ }
  return out;
}

function collectEncKeys(): string[] {
  const out: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(ENC_PREFIX)) out.push(k);
    }
  } catch { /* ignore */ }
  return out;
}

// Re-exports for tests + clarity in calling code.
export const __testing__ = {
  LS_PREFIX, ENC_PREFIX, SALT_KEY, CANARY_KEY, CANARY_PLAINTEXT, PASSTHROUGH_KEYS,
};
