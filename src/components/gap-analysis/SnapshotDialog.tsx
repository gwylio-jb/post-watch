/**
 * SnapshotDialog — name + save a frozen copy of the current gap session.
 *
 * Sprint 16. Owned by GapAnalysis. Pure presentation; the caller wires
 * the actual persist (localStorage write to `gap-session-snapshots`).
 */
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Camera, CheckCircle2 } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export interface SnapshotDialogProps {
  sessionName: string;
  /** Default suggestion for the snapshot name. */
  defaultName?: string;
  onSave: (name: string, notes: string) => void;
  onClose: () => void;
}

export default function SnapshotDialog({
  sessionName, defaultName = '', onSave, onClose,
}: SnapshotDialogProps) {
  const [name, setName] = useState(defaultName);
  const [notes, setNotes] = useState('');
  const trapRef = useFocusTrap<HTMLDivElement>(true);

  // Escape closes.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  const canSave = name.trim().length > 0;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(10,14,21,0.78)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="snapshot-dialog-title"
        className="bubble"
        style={{ width: '100%', maxWidth: 480, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Camera className="w-4 h-4" style={{ color: 'var(--mint)' }} />
            <h3 id="snapshot-dialog-title" style={{ margin: 0, fontFamily: 'var(--font-redesign-display)', fontSize: 18, fontWeight: 700 }}>
              Save snapshot
            </h3>
          </div>
          <button onClick={onClose} className="icon-btn" aria-label="Close" style={{ width: 28, height: 28, borderRadius: 8 }}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
          Freezes the current state of <strong style={{ color: 'var(--ink-1)' }}>{sessionName}</strong> as a comparison point. You can diff against it later from the same view.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{
            fontSize: 11, fontWeight: 600,
            color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em',
            fontFamily: 'var(--font-redesign-mono)',
          }}>
            Snapshot name
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Pre-audit baseline"
            autoFocus
            style={{
              padding: '8px 12px', borderRadius: 10,
              border: '1px solid var(--line-2)', background: 'var(--bg-2)',
              color: 'var(--ink-1)', fontSize: 13, outline: 'none', fontFamily: 'inherit',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{
            fontSize: 11, fontWeight: 600,
            color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em',
            fontFamily: 'var(--font-redesign-mono)',
          }}>
            Notes (optional)
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="What was the engagement state at this point?"
            style={{
              padding: '8px 12px', borderRadius: 10,
              border: '1px solid var(--line-2)', background: 'var(--bg-2)',
              color: 'var(--ink-1)', fontSize: 13, outline: 'none', fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={{ flex: 1 }}
            disabled={!canSave}
            onClick={() => { onSave(name.trim(), notes.trim()); }}
          >
            <CheckCircle2 className="w-4 h-4" />
            Save snapshot
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
