/**
 * Backup / restore all Post_Watch data stored in localStorage.
 *
 * The format is intentionally simple and human-readable so users can
 * inspect, diff and hand-edit backups if they need to.
 *
 * Note: v1 backups were created under the "Compliance Pal" product name.
 * We still accept those as valid on import (see LEGACY_APP_NAMES).
 */

const PREFIX = 'clause-control:';
const APP_NAME = 'Post_Watch';
const LEGACY_APP_NAMES = ['Compliance Pal'];
const SCHEMA_VERSION = 1;

export interface BackupPayload {
  app: string;
  schemaVersion: number;
  exportedAt: string;
  data: Record<string, unknown>;
}

export interface ImportResult {
  imported: number;
  replaced: number;
}

/** Serialise all Post_Watch localStorage entries and trigger a download. */
export function exportBackup(): void {
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
      // Fall back to raw string if it wasn't JSON
      data[shortKey] = raw;
    }
  }

  const payload: BackupPayload = {
    app: APP_NAME,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `post-watch-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Parse a backup file and write every key into localStorage. */
export async function importBackup(file: File): Promise<ImportResult> {
  const text = await file.text();
  let parsed: BackupPayload;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('File is not valid JSON');
  }

  const knownAppNames = [APP_NAME, ...LEGACY_APP_NAMES];
  if (!knownAppNames.includes(parsed?.app) || typeof parsed.data !== 'object' || parsed.data === null) {
    throw new Error('Not a valid Post_Watch backup file');
  }

  if (parsed.schemaVersion > SCHEMA_VERSION) {
    throw new Error(
      `Backup was created by a newer version (schema v${parsed.schemaVersion}). Please update Post_Watch.`
    );
  }

  let imported = 0;
  let replaced = 0;
  for (const [shortKey, value] of Object.entries(parsed.data)) {
    const fullKey = PREFIX + shortKey;
    if (localStorage.getItem(fullKey) !== null) replaced++;
    localStorage.setItem(fullKey, JSON.stringify(value));
    imported++;
  }

  return { imported, replaced };
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
