/**
 * Sprint 22: shared modal shell.
 *
 * Every dialog in the app previously reinvented its own backdrop, close
 * button and footer placement (CsvImportDialog, ClientsHub form,
 * ScheduleDialog, ...). This wrapper standardizes:
 *   - darker 0.85 backdrop (modals read as modal, not as another card)
 *   - header: title left, close button top-right
 *   - Esc / backdrop-click to close
 *   - focus trapped via useFocusTrap, restored on close
 *   - footer slot for action buttons (right-aligned)
 *
 * New v3.0 surfaces (SoA, CAPA, MR) build on this; existing dialogs
 * migrate opportunistically when touched.
 */
import { type ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Optional smaller line under the title. */
  subtitle?: string;
  children: ReactNode;
  /** Right-aligned action row. Caller provides its own buttons. */
  footer?: ReactNode;
  /** Max width in px. Defaults to 560. */
  size?: number;
  /** Set false for flows that must not dismiss on backdrop/Esc (wizards). */
  dismissable?: boolean;
}

export default function Modal({
  open, onClose, title, subtitle, children, footer,
  size = 560, dismissable = true,
}: ModalProps) {
  const trapRef = useFocusTrap<HTMLDivElement>(open);

  useEffect(() => {
    if (!open || !dismissable) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, dismissable, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={dismissable ? onClose : undefined}
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(6,9,14,0.85)',
        display: 'grid', placeItems: 'center',
        padding: 24,
      }}
    >
      <div
        ref={trapRef}
        className="bubble"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: size,
          maxHeight: '85vh',
          display: 'flex', flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
        }}
      >
        <header style={{
          display: 'flex', alignItems: 'flex-start', gap: 12,
          padding: '20px 24px 14px',
          borderBottom: '1px solid var(--line-2)',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{
              margin: 0,
              fontFamily: 'var(--font-redesign-display)',
              fontSize: 18, fontWeight: 700, color: 'var(--ink-1)',
            }}>
              {title}
            </h2>
            {subtitle && (
              <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--ink-3)' }}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--ink-3)', padding: 4, display: 'inline-flex',
              borderRadius: 8,
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div style={{ padding: '18px 24px', overflowY: 'auto', flex: 1 }}>
          {children}
        </div>

        {footer && (
          <footer style={{
            display: 'flex', gap: 8, justifyContent: 'flex-end',
            padding: '14px 24px 20px',
            borderTop: '1px solid var(--line-2)',
          }}>
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
