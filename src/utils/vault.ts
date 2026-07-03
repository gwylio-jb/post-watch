/**
 * Evidence vault file API — Sprint 17 Pack 4 #4.
 *
 * Thin async wrapper around `@tauri-apps/plugin-fs` for the two consumers
 * the app needs:
 *   - Attach a user-picked file to a gap item or scan finding.
 *   - List + read + remove attachments.
 *
 * Storage layout under the OS-managed AppData dir:
 *   <appdata>/post-watch/vault/<ownerKind>/<ownerId>/<attachmentId>-<safename>
 *
 *     ownerKind: 'gap' | 'scan'  — the "parent" record this file belongs to
 *     ownerId:   the GapAnalysisItem.itemId or AuditReport.id
 *     attachmentId: a UUID we generate; lets us delete one specific file
 *                   without colliding when two attachments share a name
 *     safename:  the user's original filename, sanitised for FS safety
 *
 * Side-effects are isolated here. Components consume the `useVault` hook
 * in `src/hooks/useVault.ts`. Outside Tauri (e.g. tests under happy-dom),
 * `isAvailable()` returns false and every other call throws cleanly — the
 * UI guards on isAvailable() and degrades to a "vault unavailable" banner.
 */
import {
  exists,
  mkdir,
  readFile,
  writeFile,
  remove,
  readDir,
  BaseDirectory,
} from '@tauri-apps/plugin-fs';
import { open as openFileDialog } from '@tauri-apps/plugin-dialog';
import { isTauri } from './audit/fetchUtil';

const VAULT_ROOT = 'post-watch/vault';
const SAFE_NAME_RE = /[^a-zA-Z0-9._-]+/g;

export type OwnerKind = 'gap' | 'scan' | 'soa';

export interface AttachmentMeta {
  /** Internal UUID — unique across the vault. */
  id: string;
  ownerKind: OwnerKind;
  ownerId: string;
  /** Original filename the user picked (display label). */
  name: string;
  /** Bytes on disk. */
  size: number;
  /** ISO timestamp of save. */
  addedAt: string;
  /** Path relative to BaseDirectory.AppData — what the FS API needs to read it back. */
  path: string;
}

/** True when the Tauri runtime is present and the fs plugin can be called. */
export function isAvailable(): boolean {
  return isTauri();
}

function sanitise(name: string): string {
  const trimmed = name.replace(SAFE_NAME_RE, '_').replace(/^_+|_+$/g, '');
  // Cap length — some filesystems are strict about path lengths.
  return trimmed.slice(0, 80) || 'untitled';
}

function ownerDir(ownerKind: OwnerKind, ownerId: string): string {
  return `${VAULT_ROOT}/${ownerKind}/${sanitise(ownerId)}`;
}

async function ensureDir(path: string): Promise<void> {
  const there = await exists(path, { baseDir: BaseDirectory.AppData });
  if (!there) {
    await mkdir(path, { baseDir: BaseDirectory.AppData, recursive: true });
  }
}

/**
 * Open the OS file picker and copy the chosen file into the vault. Returns
 * the new attachment record. Returns `null` if the user cancelled the picker.
 *
 * The file is COPIED, not referenced — moving/deleting the source doesn't
 * affect the vault entry. This matches user expectations for "attach
 * evidence" and avoids dangling-reference problems.
 */
export async function pickAndAttach(
  ownerKind: OwnerKind,
  ownerId: string,
): Promise<AttachmentMeta | null> {
  if (!isAvailable()) {
    throw new Error('Evidence vault is only available in the desktop app.');
  }

  const selected = await openFileDialog({
    multiple: false,
    directory: false,
    title: 'Attach evidence',
  });
  if (!selected || Array.isArray(selected)) return null;

  // selected is now a file path string. Read it from disk into memory.
  // We use readFile (binary) so we can handle any file type — PDFs,
  // images, ZIPs, all the same path.
  const sourcePath = typeof selected === 'string' ? selected : (selected as { path: string }).path;
  // The dialog returns an absolute path; readFile here doesn't use a
  // BaseDirectory so the absolute path is interpreted directly.
  const bytes = await readFile(sourcePath);

  // Derive a display name from the source path's last segment.
  const sourceName = sourcePath.split(/[/\\]/).pop() || 'attachment';

  const id = crypto.randomUUID();
  const filename = `${id}-${sanitise(sourceName)}`;
  const dir = ownerDir(ownerKind, ownerId);
  const path = `${dir}/${filename}`;

  await ensureDir(dir);
  await writeFile(path, bytes, { baseDir: BaseDirectory.AppData });

  return {
    id,
    ownerKind,
    ownerId,
    name: sourceName,
    size: bytes.byteLength,
    addedAt: new Date().toISOString(),
    path,
  };
}

/**
 * Remove a file from the vault. Tolerates "already gone" — the caller's
 * in-memory list of attachments may briefly be the source of truth.
 */
export async function removeAttachment(meta: AttachmentMeta): Promise<void> {
  if (!isAvailable()) return;
  try {
    await remove(meta.path, { baseDir: BaseDirectory.AppData });
  } catch (e) {
    // Best-effort: if the file's already gone, that's a successful no-op
    // from the caller's perspective.
    if (!(e instanceof Error) || !/no such file|not found/i.test(e.message)) {
      throw e;
    }
  }
}

/**
 * Read an attachment's bytes back. Used by 'preview' / 'open externally'
 * actions and by the encrypted-export flow in Sprint 18.
 */
export async function readAttachment(meta: AttachmentMeta): Promise<Uint8Array> {
  if (!isAvailable()) {
    throw new Error('Evidence vault is only available in the desktop app.');
  }
  return readFile(meta.path, { baseDir: BaseDirectory.AppData });
}

/**
 * Re-scan the vault directory for an owner and rebuild the attachment
 * list. Useful after a manual import / restore. Not used in the happy
 * path — the persisted AttachmentMeta[] in localStorage is the source of
 * truth at runtime — but a recovery tool worth having.
 */
export async function listForOwner(
  ownerKind: OwnerKind,
  ownerId: string,
): Promise<string[]> {
  if (!isAvailable()) return [];
  const dir = ownerDir(ownerKind, ownerId);
  const dirExists = await exists(dir, { baseDir: BaseDirectory.AppData });
  if (!dirExists) return [];
  const entries = await readDir(dir, { baseDir: BaseDirectory.AppData });
  return entries.filter(e => e.isFile).map(e => e.name);
}
