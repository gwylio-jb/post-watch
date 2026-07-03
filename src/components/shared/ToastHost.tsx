/**
 * Sprint 22: renders the toastBus queue. Mounted once in App.tsx next
 * to UndoHost. Sits slightly higher than the undo toast so both can be
 * visible at once without overlap.
 */
import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { subscribeToasts, getToasts, dismissToast, type ToastKind } from '../../utils/toastBus';

const KIND_STYLE: Record<ToastKind, { icon: typeof CheckCircle2; color: string; bg: string; border: string }> = {
  success: { icon: CheckCircle2, color: 'var(--mint)',  bg: 'rgba(0,217,163,0.10)',  border: 'rgba(0,217,163,0.30)' },
  error:   { icon: AlertCircle,  color: 'var(--ember)', bg: 'rgba(255,74,28,0.10)',  border: 'rgba(255,74,28,0.30)' },
  info:    { icon: Info,         color: 'var(--violet)', bg: 'rgba(123,107,237,0.10)', border: 'rgba(123,107,237,0.30)' },
};

export default function ToastHost() {
  const [, force] = useState(0);

  useEffect(() => {
    return subscribeToasts(() => force(n => n + 1));
  }, []);

  const toasts = getToasts();
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 84,           // above UndoHost's slot at bottom: 24
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1050,
        display: 'flex', flexDirection: 'column', gap: 8,
        alignItems: 'center',
        pointerEvents: 'none',
      }}
    >
      {toasts.map(t => {
        const s = KIND_STYLE[t.kind];
        const Icon = s.icon;
        return (
          <div
            key={t.id}
            role="status"
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'var(--bg-1)',
              border: `1px solid ${s.border}`,
              borderRadius: 12,
              padding: '9px 14px',
              boxShadow: '0 12px 32px rgba(0,0,0,0.25)',
              fontSize: 13, color: 'var(--ink-1)',
              maxWidth: 480,
              pointerEvents: 'auto',
            }}
          >
            <span style={{ color: s.color, display: 'inline-flex', flexShrink: 0 }}>
              <Icon className="w-4 h-4" />
            </span>
            <span style={{ flex: 1 }}>{t.message}</span>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismissToast(t.id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--ink-3)', padding: 2, display: 'inline-flex',
              }}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
