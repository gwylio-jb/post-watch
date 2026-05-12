/**
 * Tests for the AES-GCM + PBKDF2 primitives.
 *
 * What we're protecting against:
 *  - Plaintext round-tripping correctly across encrypt → decrypt with the
 *    same key.
 *  - Wrong passphrase rejecting cleanly (WebCrypto raises an error, not
 *    "junk plaintext").
 *  - Tampered ciphertext rejecting (GCM auth tag catches it).
 *  - IV being unique per call — reusing an IV under the same key
 *    catastrophically breaks AES-GCM. We don't expose the IV API directly
 *    but the public encryptString must never produce two blobs with the
 *    same IV prefix for the same input.
 *  - Salt roundtrip via base64.
 *
 * Suite runs in well under a second because PBKDF2's cost is paid once
 * per derived key; we reuse keys across tests where the assertion doesn't
 * depend on freshness.
 */
import {
  generateSalt, saltToString, saltFromString,
  deriveKey,
  encryptString, decryptString,
  CRYPTO_PARAMS,
} from './crypto';

describe('salt', () => {
  it('generateSalt produces the expected byte length', () => {
    const s = generateSalt();
    expect(s.length).toBe(CRYPTO_PARAMS.SALT_LENGTH_BYTES);
  });

  it('salt round-trips through base64', () => {
    const s = generateSalt();
    const enc = saltToString(s);
    const dec = saltFromString(enc);
    expect(dec).toEqual(s);
  });

  it('saltFromString rejects a bad-length string', () => {
    expect(() => saltFromString('AAAA')).toThrow(/Invalid salt length/);
  });

  it('two generated salts are not identical', () => {
    const a = generateSalt();
    const b = generateSalt();
    // Astronomically unlikely to ever fail on real randomness.
    expect(saltToString(a)).not.toBe(saltToString(b));
  });
});

describe('deriveKey', () => {
  it('rejects an empty passphrase', async () => {
    await expect(deriveKey('', generateSalt())).rejects.toThrow(/empty/i);
  });

  it('produces a usable AES-GCM key', async () => {
    const key = await deriveKey('the-correct-horse-battery', generateSalt());
    expect(key).toBeDefined();
    // WebCrypto exposes type/algorithm on the CryptoKey object.
    expect(key.algorithm.name).toBe('AES-GCM');
    expect(key.usages).toContain('encrypt');
    expect(key.usages).toContain('decrypt');
  });

  it('same passphrase + same salt → equivalent keys (verified by round-trip)', async () => {
    const salt = generateSalt();
    const a = await deriveKey('correct-horse', salt);
    const b = await deriveKey('correct-horse', salt);

    const blob = await encryptString(a, 'hello');
    const decryptedByB = await decryptString(b, blob);
    expect(decryptedByB).toBe('hello');
  });

  it('different salt → different key (cross-decrypt fails)', async () => {
    const a = await deriveKey('correct-horse', generateSalt());
    const b = await deriveKey('correct-horse', generateSalt());

    const blob = await encryptString(a, 'hello');
    await expect(decryptString(b, blob)).rejects.toThrow();
  });
});

describe('encryptString / decryptString round-trip', () => {
  let key: CryptoKey;
  beforeAll(async () => {
    key = await deriveKey('test-pass', generateSalt());
  });

  it('round-trips short strings', async () => {
    const blob = await encryptString(key, 'hello world');
    expect(await decryptString(key, blob)).toBe('hello world');
  });

  it('round-trips long strings (1KB of mixed content)', async () => {
    const big = 'x'.repeat(500) + JSON.stringify({ deep: { nested: { thing: 42 } } }) + '✓✓✓ 🎉';
    const blob = await encryptString(key, big);
    expect(await decryptString(key, blob)).toBe(big);
  });

  it('round-trips empty string', async () => {
    const blob = await encryptString(key, '');
    expect(await decryptString(key, blob)).toBe('');
  });

  it('round-trips utf-8 multibyte content correctly', async () => {
    const utf = '🔐 こんにちは — Δοκιμή';
    const blob = await encryptString(key, utf);
    expect(await decryptString(key, blob)).toBe(utf);
  });

  it('produces a different blob on every call for the same plaintext (fresh IV)', async () => {
    const a = await encryptString(key, 'same text');
    const b = await encryptString(key, 'same text');
    expect(a).not.toBe(b);
  });
});

describe('failure modes', () => {
  it('wrong passphrase fails to decrypt', async () => {
    const salt = generateSalt();
    const right = await deriveKey('correct-pass', salt);
    const wrong = await deriveKey('wrong-pass', salt);

    const blob = await encryptString(right, 'secret');
    await expect(decryptString(wrong, blob)).rejects.toThrow();
  });

  it('tampered ciphertext fails (GCM auth tag rejects)', async () => {
    const key = await deriveKey('test-pass', generateSalt());
    const blob = await encryptString(key, 'hello world');
    // Flip a byte in the base64 — anywhere in the middle will break the tag.
    const tampered = blob.slice(0, 30) + (blob.charAt(30) === 'A' ? 'B' : 'A') + blob.slice(31);
    await expect(decryptString(key, tampered)).rejects.toThrow();
  });

  it('malformed blob (too short) fails fast with a clear error', async () => {
    const key = await deriveKey('test-pass', generateSalt());
    await expect(decryptString(key, '')).rejects.toThrow(/short|malformed|empty/i);
  });

  it('non-base64 blob fails (atob throws)', async () => {
    const key = await deriveKey('test-pass', generateSalt());
    await expect(decryptString(key, 'definitely not base64 !!!')).rejects.toThrow();
  });
});
