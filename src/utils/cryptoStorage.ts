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
  generateDek, dekFromBytes, wrapDek, unwrapDek,
} from './crypto';
import { generateRecoveryCode } from './recoveryCode';

// ─── Storage keys ──────────────────────────────────────────────────────────

const LS_PREFIX = 'clause-control:';
const ENC_PREFIX = 'clause-control:enc:';
const SALT_KEY = 'clause-control:storage-encrypted-salt';
const CANARY_KEY = 'clause-control:enc:__canary';
/** Sprint 18: wrapped DEK under the passphrase-derived KEK. */
const DEK_PASS_KEY = 'clause-control:enc:__dek-pass';
/** Sprint 18: wrapped DEK under the recovery-code-derived KEK. Optional —
 *  users can skip recovery setup and just have the passphrase wrap. */
const DEK_RECOVERY_KEY = 'clause-control:enc:__dek-recovery';
/** Constant plaintext that gets encrypted into the canary slot. Successful
 *  decryption back to this value verifies the DEK (and therefore the KEK
 *  that unwrapped it). */
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

/** Internal-use keys that should NEVER be visited during pre-warm,
 *  iteration of "user data" keys, etc. */
const INTERNAL_ENC_KEYS = new Set<string>([
  CANARY_KEY,
  DEK_PASS_KEY,
  DEK_RECOVERY_KEY,
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
 * Sprint 18: result of enable — returns the recovery code so the UI can
 * present it once and never persist it in plaintext anywhere else.
 */
export interface EnableResult {
  recoveryCode: string;
}

/**
 * One-shot enable. Generates a fresh salt, DEK, and recovery code; wraps
 * the DEK under both passphrase-derived and recovery-derived KEKs;
 * encrypts every existing plain `clause-control:*` key (except
 * passthroughs) under the DEK; deletes the originals.
 *
 * Two-phase to survive crashes mid-migration. The boot flow's
 * cleanupAfterCrash() sweeps stale plain keys on next launch.
 *
 * Returns the recovery code — caller MUST show it to the user once and
 * never persist it anywhere reachable from disk in plain form.
 */
export async function enableEncryption(passphrase: string): Promise<EnableResult> {
  if (status() !== 'disabled') {
    throw new Error('Encryption is already enabled. Disable first to change passphrase.');
  }

  const salt = generateSalt();
  const passKEK = await deriveKey(passphrase, salt);

  const recoveryCode = generateRecoveryCode();
  const recoveryKEK = await deriveKey(recoveryCode, salt);

  const dek = generateDek();
  const dekKey = await dekFromBytes(dek);

  // Phase 1: write the canary + wrapped DEK (both wraps) + every plain
  // key as encrypted-under-DEK.
  const canaryBlob = await encryptString(dekKey, CANARY_PLAINTEXT);
  localStorage.setItem(CANARY_KEY, canaryBlob);
  localStorage.setItem(DEK_PASS_KEY,     await wrapDek(passKEK, dek));
  localStorage.setItem(DEK_RECOVERY_KEY, await wrapDek(recoveryKEK, dek));

  const plainKeys = collectPlainKeys();
  const cache = new Map<string, string>();
  for (const k of plainKeys) {
    const v = localStorage.getItem(k);
    if (v === null) continue;
    const blob = await encryptString(dekKey, v);
    const encK = k.replace(LS_PREFIX, ENC_PREFIX);
    localStorage.setItem(encK, blob);
    cache.set(k, v);
  }

  // Phase 2: write the salt (commit point) then delete the plain slots.
  localStorage.setItem(SALT_KEY, saltToString(salt));
  for (const k of plainKeys) {
    localStorage.removeItem(k);
  }

  masterKey = dekKey;
  liveDekBytes = dek;
  plaintextCache = cache;
  emit();

  return { recoveryCode };
}

/**
 * Unlock with the user's passphrase. On success, derives the passKEK,
 * unwraps the DEK, verifies via the canary, pre-warms the cache.
 *
 * Migrates v1 (Sprint 15) encrypted devices on first unlock: if the
 * canary opens directly under the passKEK (legacy direct-derive), we
 * mint a fresh DEK and re-wrap everything. Idempotent.
 */
export async function unlock(passphrase: string): Promise<boolean> {
  const saltStr = localStorage.getItem(SALT_KEY);
  if (!saltStr) return false;

  let passKEK: CryptoKey;
  try {
    passKEK = await deriveKey(passphrase, saltFromString(saltStr));
  } catch {
    return false;
  }

  // ── v2: try DEK unwrap first ──
  const wrappedDek = localStorage.getItem(DEK_PASS_KEY);
  if (wrappedDek) {
    let dekBytes: Uint8Array;
    try {
      dekBytes = await unwrapDek(passKEK, wrappedDek);
    } catch {
      return false;
    }
    const dekKey = await dekFromBytes(dekBytes);
    return finishUnlock(dekKey, dekBytes);
  }

  // ── v1 → v2 migration path ──
  // Sprint 15 stored a canary encrypted directly under the passphrase-
  // derived key. If we see that shape (no __dek-pass key but a __canary),
  // mint a fresh DEK, re-encrypt everything, and write the new wrappers.
  const canary = localStorage.getItem(CANARY_KEY);
  if (!canary) return false;

  let canaryPlain: string;
  try {
    canaryPlain = await decryptString(passKEK, canary);
  } catch {
    return false;
  }
  if (canaryPlain !== CANARY_PLAINTEXT) return false;

  // Legacy passphrase confirmed — migrate.
  await migrateV1ToV2(passKEK, saltStr);
  // Re-read the freshly wrapped DEK to land in the same state as v2.
  const fresh = localStorage.getItem(DEK_PASS_KEY);
  if (!fresh) return false;
  const dekBytes = await unwrapDek(passKEK, fresh);
  const dekKey = await dekFromBytes(dekBytes);
  return finishUnlock(dekKey, dekBytes);
}

/**
 * Sprint 18: unlock via recovery code. Same shape as unlock() but uses
 * the recovery-wrapped DEK slot. On success, the caller is expected to
 * walk the user through setting a new passphrase (changePassphrase)
 * because they've clearly lost the old one.
 */
export async function unlockWithRecovery(recoveryCode: string): Promise<boolean> {
  const saltStr = localStorage.getItem(SALT_KEY);
  if (!saltStr) return false;
  const wrapped = localStorage.getItem(DEK_RECOVERY_KEY);
  if (!wrapped) return false;

  let recoveryKEK: CryptoKey;
  try {
    recoveryKEK = await deriveKey(recoveryCode, saltFromString(saltStr));
  } catch {
    return false;
  }
  let dekBytes: Uint8Array;
  try {
    dekBytes = await unwrapDek(recoveryKEK, wrapped);
  } catch {
    return false;
  }
  const dekKey = await dekFromBytes(dekBytes);
  // dekBytes must reach finishUnlock: setPassphraseFromRecovery (the
  // forced rotation that immediately follows a recovery unlock) rewraps
  // liveDekBytes, and rotateRecoveryCode/setupRecoveryCode need it too.
  return finishUnlock(dekKey, dekBytes);
}

/**
 * Sprint 18: change the passphrase. Requires the current passphrase
 * (defence in depth — the live unlock state alone isn't enough; we
 * want explicit re-auth before rewrapping). Returns true on success.
 */
export async function changePassphrase(oldPass: string, newPass: string): Promise<boolean> {
  const saltStr = localStorage.getItem(SALT_KEY);
  if (!saltStr) return false;
  const wrapped = localStorage.getItem(DEK_PASS_KEY);
  if (!wrapped) return false;

  const salt = saltFromString(saltStr);
  const oldKEK = await deriveKey(oldPass, salt);

  let dekBytes: Uint8Array;
  try {
    dekBytes = await unwrapDek(oldKEK, wrapped);
  } catch {
    return false;
  }

  // Re-derive against the SAME salt under the new passphrase. We could
  // generate a new salt here for forward secrecy, but then the recovery
  // wrap would also need to be re-derived under the new salt, breaking
  // any printed recovery code the user has stashed. Keep the salt stable
  // for the life of the installation.
  const newKEK = await deriveKey(newPass, salt);
  const fresh = await wrapDek(newKEK, dekBytes);
  localStorage.setItem(DEK_PASS_KEY, fresh);
  return true;
}

/**
 * Sprint 18: rotate the recovery code. Useful if the user fears the old
 * one has been seen. Requires the live unlocked DEK; returns the new
 * recovery code.
 */
export async function rotateRecoveryCode(): Promise<string | null> {
  if (status() !== 'unlocked' || !masterKey) return null;
  const saltStr = localStorage.getItem(SALT_KEY);
  if (!saltStr) return null;

  // To wrap the DEK under a fresh recovery KEK, we need the raw bytes.
  // The non-extractable CryptoKey doesn't expose them; we can pull them
  // back out of the existing __dek-pass wrapper by deriving the passKEK
  // again — but we don't have the passphrase in memory. Easier: just
  // ask the caller to provide a working unwrap path. For now, we
  // reconstruct via the passphrase-wrapped slot using the active
  // session's cached DEK roundtrip: encrypt the canary, decrypt with
  // a freshly imported raw DEK derived from re-importing... no.
  //
  // Cleanest answer: store the raw DEK bytes in memory alongside the
  // CryptoKey while unlocked, just for this operation. Track that below.
  if (!liveDekBytes) return null;

  const newRecovery = generateRecoveryCode();
  const recoveryKEK = await deriveKey(newRecovery, saltFromString(saltStr));
  const fresh = await wrapDek(recoveryKEK, liveDekBytes);
  localStorage.setItem(DEK_RECOVERY_KEY, fresh);
  return newRecovery;
}

/**
 * Sprint 18: disable encryption — decrypt every enc:* user key to plain,
 * delete all encryption metadata (salt, both wrapped DEKs, canary).
 * Two-phase to survive crashes (cleanupAfterCrash on next boot would
 * sweep the inverse case: enc keys without a salt).
 */
export async function disableEncryption(passphrase: string): Promise<boolean> {
  // Auth check via passphrase against the wrapped DEK.
  const saltStr = localStorage.getItem(SALT_KEY);
  if (!saltStr) return false;
  const wrapped = localStorage.getItem(DEK_PASS_KEY);
  if (!wrapped) return false;
  const passKEK = await deriveKey(passphrase, saltFromString(saltStr));
  let dekBytes: Uint8Array;
  try {
    dekBytes = await unwrapDek(passKEK, wrapped);
  } catch {
    return false;
  }
  const dekKey = await dekFromBytes(dekBytes);

  // Phase 1: write every user value back to plain.
  const encKeys = collectEncKeys();
  for (const encK of encKeys) {
    if (INTERNAL_ENC_KEYS.has(encK)) continue;
    const blob = localStorage.getItem(encK);
    if (!blob) continue;
    try {
      const plain = await decryptString(dekKey, blob);
      const logicalKey = encK.replace(ENC_PREFIX, LS_PREFIX);
      localStorage.setItem(logicalKey, plain);
    } catch (e) {
      console.warn('[cryptoStorage] disable: failed to decrypt', encK, e);
    }
  }

  // Phase 2: remove salt (encryption-off signal) and the enc:* slots.
  localStorage.removeItem(SALT_KEY);
  for (const encK of encKeys) {
    try { localStorage.removeItem(encK); } catch { /* ignore */ }
  }

  masterKey = null;
  liveDekBytes = null;
  plaintextCache = null;
  emit();
  return true;
}

// In-memory raw DEK bytes — held only while unlocked so rotation
// operations have access to the material without forcing the user to
// re-enter their passphrase. Cleared on lock alongside masterKey/cache.
let liveDekBytes: Uint8Array | null = null;

/**
 * After deriving + unwrapping the DEK in any flow above, this helper
 * pre-warms the cache and flips status. Returns true so callers can
 * `return finishUnlock(...)` for clarity.
 *
 * The raw DEK bytes are held in module scope for the duration of the
 * unlocked session — needed for rotation operations (setup-recovery,
 * change-passphrase) that would otherwise have no way to wrap the live
 * key under a freshly derived KEK without re-authing the user.
 */
async function finishUnlock(dekKey: CryptoKey, dekBytes?: Uint8Array): Promise<boolean> {
  // Pre-warm the cache. Every enc-prefixed key decrypts under this key
  // or it's tampered/corrupt; we log and skip individual corrupt entries
  // rather than refusing to unlock entirely.
  const cache = new Map<string, string>();
  const encKeys = collectEncKeys();
  for (const encK of encKeys) {
    if (INTERNAL_ENC_KEYS.has(encK)) continue;
    const blob = localStorage.getItem(encK);
    if (blob === null) continue;
    try {
      const plain = await decryptString(dekKey, blob);
      const logicalKey = encK.replace(ENC_PREFIX, LS_PREFIX);
      cache.set(logicalKey, plain);
    } catch (e) {
      console.warn('[cryptoStorage] could not decrypt', encK, e);
    }
  }

  masterKey = dekKey;
  if (dekBytes) liveDekBytes = dekBytes;
  plaintextCache = cache;
  emit();
  return true;
}

/**
 * Sprint 18 v1→v2 migration. Mints a fresh DEK, re-encrypts every
 * enc:* user key with it, and writes a __dek-pass wrap. Recovery
 * wrapper is NOT created here — the user is prompted to set one up
 * after migration via a separate flow.
 */
async function migrateV1ToV2(passKEK: CryptoKey, saltStr: string): Promise<void> {
  const newDek = generateDek();
  const newDekKey = await dekFromBytes(newDek);

  // Walk every existing enc key (except internal slots).
  const encKeys = collectEncKeys();
  for (const encK of encKeys) {
    if (INTERNAL_ENC_KEYS.has(encK)) continue;
    const blob = localStorage.getItem(encK);
    if (!blob) continue;
    let plain: string;
    try {
      plain = await decryptString(passKEK, blob);  // legacy direct-KEK
    } catch (e) {
      console.warn('[cryptoStorage] v1 migration: skipping uncryptable', encK, e);
      continue;
    }
    const reblobbed = await encryptString(newDekKey, plain);
    localStorage.setItem(encK, reblobbed);
  }

  // Re-encrypt canary under the new DEK so subsequent unlocks verify.
  const newCanary = await encryptString(newDekKey, CANARY_PLAINTEXT);
  localStorage.setItem(CANARY_KEY, newCanary);

  // Wrap the DEK under the same passKEK. Recovery slot stays empty
  // until the user goes through the setup-recovery flow.
  localStorage.setItem(DEK_PASS_KEY, await wrapDek(passKEK, newDek));
  // Suppress unused-var warning — saltStr is passed for forward
  // compatibility (future migrations may re-derive against the same
  // salt with a different KDF parameter set).
  void saltStr;
}

/**
 * Sprint 18: set up a recovery code on a v2 device that doesn't yet
 * have one (post-migration, or user opted-out at first enable). Live
 * unlocked DEK required.
 */
export async function setupRecoveryCode(): Promise<string | null> {
  if (status() !== 'unlocked' || !liveDekBytes) return null;
  const saltStr = localStorage.getItem(SALT_KEY);
  if (!saltStr) return null;
  const code = generateRecoveryCode();
  const recoveryKEK = await deriveKey(code, saltFromString(saltStr));
  localStorage.setItem(DEK_RECOVERY_KEY, await wrapDek(recoveryKEK, liveDekBytes));
  return code;
}

/**
 * Sprint 18: after a successful recovery unlock, rewrap the live DEK
 * under a freshly-derived passKEK. Replaces the old __dek-pass wrap so
 * the previous passphrase is no longer valid. Requires the unlocked
 * session (liveDekBytes available).
 */
export async function setPassphraseFromRecovery(newPass: string): Promise<boolean> {
  if (status() !== 'unlocked' || !liveDekBytes) return false;
  const saltStr = localStorage.getItem(SALT_KEY);
  if (!saltStr) return false;
  const newKEK = await deriveKey(newPass, saltFromString(saltStr));
  const fresh = await wrapDek(newKEK, liveDekBytes);
  localStorage.setItem(DEK_PASS_KEY, fresh);
  return true;
}

/** Reports whether a recovery wrap exists on this device. */
export function hasRecoveryCode(): boolean {
  try {
    return localStorage.getItem(DEK_RECOVERY_KEY) !== null;
  } catch {
    return false;
  }
}

/** Clear the master key + cache from memory. Disk is untouched. */
export function lock(): void {
  masterKey = null;
  liveDekBytes = null;
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
