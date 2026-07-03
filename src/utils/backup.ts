/**
 * Backup / restore all Post_Watch data stored in localStorage.
 *
 * The plain format is intentionally simple and human-readable so users
 * can inspect, diff and hand-edit backups if they need to.
 *
 * Sprint 18: optional encrypted backups. When a passphrase is supplied
 * to `exportBackup`, the JSON body is wrapped in AES-GCM using a fresh
 * PBKDF2-derived key. The output is still ASCII (JSON envelope wrapping
 * a base64 ciphertext) so it survives e-mail transport.
 *
 * Format detection on import:
 *   - Envelope object with `format === 'post-watch-encrypted-backup'`
 *     ⇒ encrypted, requires passphrase
 *   - Envelope with `app: 'Post_Watch' | 'Compliance Pal'` ⇒ plain
 *
 * Note: v1 backups were created under the "Compliance Pal" product name.
 * We still accept those as valid on import (see LEGACY_APP_NAMES).
 */
import {
  deriveKey, generateSalt, saltToString, saltFromString,
  encryptString, decryptString,
} from './crypto';

const PREFIX = 'clause-control:';
const APP_NAME = 'Post_Watch';
const LEGACY_APP_NAMES = ['Compliance Pal'];
const SCHEMA_VERSION = 1;
const ENCRYPTED_FORMAT = 'post-watch-encrypted-backup';
const ENCRYPTED_FORMAT_VERSION = 1;

export interface BackupPayload {
  app: string;
  schemaVersion: number;
  exportedAt: string;
  data: Record<string, unknown>;
}

/** On-disk shape for encrypted backups. JSON wrapper keeps it ASCII-safe. */
export interface EncryptedBackupEnvelope {
  format: typeof ENCRYPTED_FORMAT;
  formatVersion: number;
  exportedAt: string;
  salt: string;       // base64
  ciphertext: string; // base64 iv||ct of the inner BackupPayload JSON
}

export interface ImportResult {
  imported: number;
  replaced: number;
}

/** Build the in-memory payload from current localStorage. */
function collectPayload(): BackupPayload {
  const data: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const fullKey = localStorage.key(i);
    if (!fullKey || !fullKey.startsWith(PREFIX)) continue;
    const shortKey = fullKey.slice(PREFIX.length);
    const raw = localStorage.getItem(fullKey);
    if (raw === null) continue;
    try {
      data[shortKey] = JSON.parse(raw);
    } catch {
      data[shortKey] = raw;
    }
  }
  return {
    app: APP_NAME,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

function triggerDownload(text: string, name: string, mime = 'application/json'): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Serialise all Post_Watch localStorage entries and trigger a download.
 * Pass a passphrase to produce an AES-GCM-wrapped backup; omit for the
 * plain JSON format. The passphrase here is independent of any
 * cryptoStorage passphrase — backups can travel between devices.
 */
export async function exportBackup(opts: { passphrase?: string } = {}): Promise<void> {
  const payload = collectPayload();
  const date = new Date().toISOString().slice(0, 10);

  if (!opts.passphrase) {
    triggerDownload(JSON.stringify(payload, null, 2), `post-watch-backup-${date}.json`);
    return;
  }

  const salt = generateSalt();
  const key = await deriveKey(opts.passphrase, salt);
  const ciphertext = await encryptString(key, JSON.stringify(payload));
  const envelope: EncryptedBackupEnvelope = {
    format: ENCRYPTED_FORMAT,
    formatVersion: ENCRYPTED_FORMAT_VERSION,
    exportedAt: payload.exportedAt,
    salt: saltToString(salt),
    ciphertext,
  };
  triggerDownload(JSON.stringify(envelope, null, 2), `post-watch-backup-${date}.pwbk.json`);
}

/** True when the parsed JSON looks like an encrypted envelope. */
function isEncryptedEnvelope(obj: unknown): obj is EncryptedBackupEnvelope {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  return o.format === ENCRYPTED_FORMAT
    && typeof o.salt === 'string'
    && typeof o.ciphertext === 'string';
}

/**
 * Parse a backup file and write every key into localStorage. For
 * encrypted backups the caller must supply the passphrase; the function
 * throws a friendly error if it's missing or wrong.
 */
export async function importBackup(file: File, passphrase?: string): Promise<ImportResult> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('File is not valid JSON');
  }

  let payload: BackupPayload;
  if (isEncryptedEnvelope(parsed)) {
    if (!passphrase) {
      throw new Error('This backup is encrypted. Enter the passphrase to import.');
    }
    if (parsed.formatVersion > ENCRYPTED_FORMAT_VERSION) {
      throw new Error(
        `Encrypted backup uses a newer format (v${parsed.formatVersion}). Please update Post_Watch.`
      );
    }
    const key = await deriveKey(passphrase, saltFromString(parsed.salt));
    let plain: string;
    try {
      plain = await decryptString(key, parsed.ciphertext);
    } catch {
      throw new Error('Could not decrypt — wrong passphrase or corrupt file.');
    }
    try {
      payload = JSON.parse(plain) as BackupPayload;
    } catch {
      throw new Error('Decrypted payload is not valid JSON.');
    }
  } else {
    payload = parsed as BackupPayload;
  }

  const knownAppNames = [APP_NAME, ...LEGACY_APP_NAMES];
  if (!knownAppNames.includes(payload?.app) || typeof payload.data !== 'object' || payload.data === null) {
    throw new Error('Not a valid Post_Watch backup file');
  }

  if (payload.schemaVersion > SCHEMA_VERSION) {
    throw new Error(
      `Backup was created by a newer version (schema v${payload.schemaVersion}). Please update Post_Watch.`
    );
  }

  let imported = 0;
  let replaced = 0;
  let failed = 0;
  for (const [shortKey, value] of Object.entries(payload.data)) {
    const fullKey = PREFIX + shortKey;
    const existed = localStorage.getItem(fullKey) !== null;
    // Count only writes that actually landed — setItem throws on quota
    // exhaustion, and reporting those as "imported" would tell the user
    // the restore succeeded when part of it didn't.
    try {
      localStorage.setItem(fullKey, JSON.stringify(value));
      imported++;
      if (existed) replaced++;
    } catch (e) {
      failed++;
      console.warn('[backup] failed to write key during import', fullKey, e);
    }
  }
  if (failed > 0) {
    throw new Error(
      `Import incomplete: ${imported} item${imported === 1 ? '' : 's'} restored, ${failed} failed (storage quota?). Your data may be partially updated.`
    );
  }

  return { imported, replaced };
}

/** Tell the UI whether a file is an encrypted backup, so it can prompt. */
export async function detectBackupFormat(file: File): Promise<'plain' | 'encrypted' | 'unknown'> {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (isEncryptedEnvelope(parsed)) return 'encrypted';
    const knownAppNames = [APP_NAME, ...LEGACY_APP_NAMES];
    const p = parsed as Partial<BackupPayload>;
    if (p && typeof p === 'object' && knownAppNames.includes(p.app ?? '')) return 'plain';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/** For troubleshooting — returns a summary of what's currently stored. */
export function summariseStorage(): { keys: number; bytes: number } {
  let keys = 0;
  let bytes = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const fullKey = localStorage.key(i);
    if (!fullKey || !fullKey.startsWith(PREFIX)) continue;
    keys++;
    const raw = localStorage.getItem(fullKey) ?? '';
    bytes += fullKey.length + raw.length;
  }
  return { keys, bytes };
}
