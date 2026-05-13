/**
 * useVault — React hook for evidence-vault file attachments.
 *
 * Sprint 17 Pack 4. Persists `AttachmentMeta[]` to localStorage via
 * useLocalStorage (so the metadata is encrypted at rest if Sprint 15's
 * encryption is enabled); the bytes themselves live in the OS AppData
 * vault dir managed by `src/utils/vault.ts`.
 *
 * Filters attachments by owner so consumers (gap-item row, scan finding
 * row) get the small relevant list, not the whole vault.
 */
import { useCallback, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';
import {
  pickAndAttach,
  removeAttachment as fsRemove,
  isAvailable,
  type OwnerKind,
} from '../utils/vault';
import type { AttachmentMeta } from '../data/types';

export interface UseVaultResult {
  /** All attachments for the given owner. Empty array if none / unavailable. */
  attachments: AttachmentMeta[];
  /** True when running inside the Tauri runtime (vault enabled). */
  available: boolean;
  /** Open the file picker and attach the result. Returns the new record or null on cancel. */
  attach: () => Promise<AttachmentMeta | null>;
  /** Delete a vault file + its metadata. */
  remove: (meta: AttachmentMeta) => Promise<void>;
}

export function useVault(ownerKind: OwnerKind, ownerId: string): UseVaultResult {
  const [allAttachments, setAllAttachments] = useLocalStorage<AttachmentMeta[]>('attachments', []);

  const attachments = useMemo(() => {
    const safe = Array.isArray(allAttachments) ? allAttachments : [];
    return safe
      .filter(a => a.ownerKind === ownerKind && a.ownerId === ownerId)
      .sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  }, [allAttachments, ownerKind, ownerId]);

  const attach = useCallback(async (): Promise<AttachmentMeta | null> => {
    if (!isAvailable()) return null;
    const meta = await pickAndAttach(ownerKind, ownerId);
    if (!meta) return null;
    setAllAttachments(prev => {
      const safe = Array.isArray(prev) ? prev : [];
      return [...safe, meta];
    });
    return meta;
  }, [ownerKind, ownerId, setAllAttachments]);

  const remove = useCallback(async (meta: AttachmentMeta): Promise<void> => {
    // Optimistically remove the metadata first so the UI reflects the
    // change immediately; then delete the file on disk. If the disk
    // delete fails we log it but don't roll back the metadata — the user
    // has signalled they don't want this attachment anymore. A future
    // cleanup pass could sweep orphaned files.
    setAllAttachments(prev => (Array.isArray(prev) ? prev : []).filter(a => a.id !== meta.id));
    try {
      await fsRemove(meta);
    } catch (e) {
      console.warn('[useVault] file removal failed', meta.path, e);
    }
  }, [setAllAttachments]);

  return { attachments, available: isAvailable(), attach, remove };
}
