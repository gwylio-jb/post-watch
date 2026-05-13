/**
 * AttachmentList — drop-in evidence-vault widget.
 *
 * Sprint 17 Pack 4. Renders the list of attachments for a given owner
 * (gap item or scan finding) + an Attach button. Compact enough to slot
 * inside an existing card without a separate modal.
 *
 * When the vault is unavailable (not running in Tauri — e.g. dev preview
 * in plain browser, tests), renders an inline banner explaining that
 * file attachments require the desktop app. Doesn't crash; doesn't hide.
 */
import { Paperclip, Trash2, FileText, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useVault } from '../../hooks/useVault';
import type { OwnerKind } from '../../utils/vault';

export interface AttachmentListProps {
  ownerKind: OwnerKind;
  ownerId: string;
  /** Compact mode strips the heading + spacing — for use inside dense rows. */
  compact?: boolean;
}

export default function AttachmentList({ ownerKind, ownerId, compact }: AttachmentListProps) {
  const { attachments, available, attach, remove } = useVault(ownerKind, ownerId);
  const [busy, setBusy] = useState(false);

  const handleAttach = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await attach();
    } catch (e) {
      console.error('[AttachmentList] attach failed', e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 6 : 8 }}>
      {!compact && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{
            fontSize: 11, fontWeight: 600,
            color: 'var(--ink-3, var(--color-text-muted))',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            fontFamily: 'var(--font-redesign-mono, "JetBrains Mono", monospace)',
          }}>
            Evidence ({attachments.length})
          </span>
          <button
            type="button"
            onClick={handleAttach}
            disabled={busy || !available}
            title={available ? 'Attach a file (PDF, screenshot, etc.)' : 'Vault is only available in the desktop app'}
            className="btn btn-ghost"
            style={{ padding: '4px 10px', fontSize: 11 }}
          >
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Paperclip className="w-3 h-3" />}
            {busy ? 'Attaching…' : 'Attach'}
          </button>
        </div>
      )}

      {!available && (
        <div style={{
          fontSize: 11,
          color: 'var(--ink-3, var(--color-text-muted))',
          padding: '6px 10px',
          background: 'rgba(217,119,6,0.08)',
          border: '1px solid rgba(217,119,6,0.20)',
          borderRadius: 8,
        }}>
          Evidence attachments require the desktop app.
        </div>
      )}

      {attachments.length === 0 && available && (
        <div style={{
          fontSize: 11,
          color: 'var(--ink-3, var(--color-text-muted))',
          fontFamily: 'var(--font-redesign-mono, "JetBrains Mono", monospace)',
          padding: compact ? '2px 0' : '6px 0',
        }}>
          // No attachments yet
        </div>
      )}

      {attachments.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {attachments.map(att => (
            <li
              key={att.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 10px',
                background: 'var(--bg-2, var(--color-surface))',
                border: '1px solid var(--line-2, var(--color-border))',
                borderRadius: 8,
                fontSize: 12,
              }}
            >
              <FileText className="w-3.5 h-3.5" style={{ color: 'var(--mint, #00D9A3)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: 'var(--ink-1, var(--color-text-primary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {att.name}
                </div>
                <div style={{ fontSize: 10, color: 'var(--ink-3, var(--color-text-muted))', fontFamily: 'var(--font-redesign-mono, "JetBrains Mono", monospace)' }}>
                  {formatBytes(att.size)} · {new Date(att.addedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </div>
              </div>
              <button
                type="button"
                onClick={() => { void remove(att); }}
                title="Remove attachment"
                className="icon-btn"
                style={{ width: 24, height: 24, borderRadius: 6 }}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Compact-mode attach button rendered after the list */}
      {compact && (
        <button
          type="button"
          onClick={handleAttach}
          disabled={busy || !available}
          title={available ? 'Attach a file' : 'Vault is only available in the desktop app'}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 8px',
            background: 'transparent',
            border: '1px dashed var(--line-2, var(--color-border))',
            borderRadius: 6,
            color: 'var(--ink-3, var(--color-text-muted))',
            fontSize: 11, fontFamily: 'inherit',
            alignSelf: 'flex-start',
            cursor: busy || !available ? 'not-allowed' : 'pointer',
            opacity: busy || !available ? 0.5 : 1,
          }}
        >
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Paperclip className="w-3 h-3" />}
          Attach evidence
        </button>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
