/**
 * AES-GCM + PBKDF2 primitives — Sprint 14 Pack 3.
 *
 * Foundation for the opt-in encrypted-storage feature in the next commit.
 * Lives in its own module with no React, no localStorage I/O — pure async
 * functions over Web Crypto SubtleCrypto. Designed so a future native-code
 * backend (e.g. Tauri Rust crypto) could drop in behind the same interface.
 *
 * Threat model: protects localStorage at rest against:
 *   - Someone copying the user's app-data folder.
 *   - Malware/inspector reading raw localStorage when the app isn't unlocked.
 *
 * NOT protected against:
 *   - A keylogger capturing the passphrase as the user types it.
 *   - Memory inspection while the app is running unlocked.
 *   - Side-channel attacks on AES-GCM (which is timing-safe in WebCrypto
 *     but not against a determined nation-state).
 *
 * For the threat model we care about (consultant laptop, casual access,
 * post-incident forensics), AES-GCM with a strong passphrase is sufficient.
 */

// PBKDF2 parameters. 250 000 iterations is well above OWASP's 2023
// recommendation (210k for SHA-256) and still completes in well under a
// second on a modest laptop. The salt is per-installation, stored in
// plain text (the iteration count + salt being public is the whole point
// of PBKDF2).
const PBKDF2_ITERATIONS = 250_000;
const PBKDF2_HASH = 'SHA-256';
const KEY_LENGTH_BITS = 256;
const SALT_LENGTH_BYTES = 16;
const IV_LENGTH_BYTES = 12;  // 96 bits is the GCM recommended length

// ─── Helpers ───────────────────────────────────────────────────────────────

function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

function toBase64(bytes: Uint8Array): string {
  // btoa wants a binary string; spread is fine for our small buffers
  // (salt/iv are tiny; ciphertext is bounded by storage values which are
  // ~MB at the absolute extreme — well within stack limits).
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

// ─── Salt ──────────────────────────────────────────────────────────────────

/** Generate a fresh random salt for first-time setup. */
export function generateSalt(): Uint8Array {
  return randomBytes(SALT_LENGTH_BYTES);
}

/** Serialise a salt for storage. */
export function saltToString(salt: Uint8Array): string {
  return toBase64(salt);
}

/** Parse a stored salt back to bytes. */
export function saltFromString(s: string): Uint8Array {
  const bytes = fromBase64(s);
  if (bytes.length !== SALT_LENGTH_BYTES) {
    throw new Error(`Invalid salt length: expected ${SALT_LENGTH_BYTES} bytes, got ${bytes.length}`);
  }
  return bytes;
}

// ─── Key derivation ────────────────────────────────────────────────────────

/**
 * Derive a 256-bit AES-GCM key from a passphrase + salt via PBKDF2.
 * Returns a non-extractable CryptoKey — the raw bytes never leave WebCrypto.
 */
export async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  if (!passphrase) throw new Error('Passphrase cannot be empty');

  const pwBytes = new TextEncoder().encode(passphrase);
  const baseKey = await crypto.subtle.importKey(
    'raw',
    pwBytes,
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: PBKDF2_HASH,
    },
    baseKey,
    { name: 'AES-GCM', length: KEY_LENGTH_BITS },
    /* extractable: */ false,
    ['encrypt', 'decrypt'],
  );
}

// ─── Encrypt / decrypt ─────────────────────────────────────────────────────

/**
 * Encrypt UTF-8 text under the given key. Returns a single base64 string
 * containing `iv || ciphertext` (the GCM auth tag is appended to the
 * ciphertext by WebCrypto).
 *
 * The IV is freshly generated per call. AES-GCM REQUIRES a unique IV per
 * key — reusing one catastrophically breaks the cipher. WebCrypto never
 * lets us forget; the random IV is non-negotiable.
 */
export async function encryptString(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const ptBytes = new TextEncoder().encode(plaintext);

  const ctBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    ptBytes.buffer as ArrayBuffer,
  );

  // Pack iv + ciphertext together so the consumer only stores one blob.
  const ct = new Uint8Array(ctBuf);
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return toBase64(out);
}

/**
 * Decrypt a blob produced by encryptString. Throws on:
 *   - Bad key (wrong passphrase): InvalidAccessError from WebCrypto.
 *   - Tampered ciphertext: OperationError from the GCM tag check.
 *   - Malformed blob: explicit Error from this function.
 */
export async function decryptString(key: CryptoKey, blob: string): Promise<string> {
  const bytes = fromBase64(blob);
  if (bytes.length < IV_LENGTH_BYTES + 1) {
    throw new Error('Ciphertext too short — blob is malformed or empty');
  }
  const iv = bytes.slice(0, IV_LENGTH_BYTES);
  const ct = bytes.slice(IV_LENGTH_BYTES);

  const ptBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    ct.buffer as ArrayBuffer,
  );
  return new TextDecoder().decode(ptBuf);
}

// ─── Constants for the storage facade ──────────────────────────────────────

export const CRYPTO_PARAMS = Object.freeze({
  PBKDF2_ITERATIONS,
  PBKDF2_HASH,
  KEY_LENGTH_BITS,
  SALT_LENGTH_BYTES,
  IV_LENGTH_BYTES,
});

// ─── DEK / KEK primitives (Sprint 18) ──────────────────────────────────────
//
// Sprint 15 derived the encryption key directly from the passphrase. That
// works until you want to rotate the passphrase or offer a recovery
// option — both require re-encrypting every blob. Sprint 18 introduces a
// per-installation Data Encryption Key (DEK) that's wrapped by one or
// more Key Encryption Keys (KEKs, themselves passphrase-derived). The
// DEK encrypts all user data. Rotating a KEK only re-wraps the DEK.

/**
 * Generate a fresh DEK as 32 raw bytes. We expose the raw bytes (not a
 * CryptoKey) so the same DEK can be wrapped under multiple KEKs.
 * Re-import via deriveDekKey() when we need to actually
 * encrypt/decrypt with it.
 */
export function generateDek(): Uint8Array {
  return randomBytes(KEY_LENGTH_BITS / 8);
}

/**
 * Promote a raw DEK byte buffer into a non-extractable AES-GCM CryptoKey
 * suitable for encrypt/decrypt operations. After this call, the raw
 * bytes can be zeroed; the live key never leaves WebCrypto.
 */
export async function dekFromBytes(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    raw.buffer as ArrayBuffer,
    { name: 'AES-GCM', length: KEY_LENGTH_BITS },
    /* extractable: */ false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Wrap a DEK byte buffer under a KEK. Returns a base64 blob of
 * iv || ciphertext (same shape as encryptString, just over raw bytes).
 */
export async function wrapDek(kek: CryptoKey, dek: Uint8Array): Promise<string> {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    kek,
    dek.buffer as ArrayBuffer,
  );
  const ctBytes = new Uint8Array(ct);
  const out = new Uint8Array(iv.length + ctBytes.length);
  out.set(iv, 0);
  out.set(ctBytes, iv.length);
  return toBase64(out);
}

/**
 * Unwrap a DEK from a base64 blob. Throws on wrong KEK (GCM auth tag
 * rejects) or malformed input.
 */
export async function unwrapDek(kek: CryptoKey, blob: string): Promise<Uint8Array> {
  const bytes = fromBase64(blob);
  if (bytes.length < IV_LENGTH_BYTES + 1) {
    throw new Error('Wrapped DEK too short — blob is malformed');
  }
  const iv = bytes.slice(0, IV_LENGTH_BYTES);
  const ct = bytes.slice(IV_LENGTH_BYTES);
  const ptBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    kek,
    ct.buffer as ArrayBuffer,
  );
  return new Uint8Array(ptBuf);
}
