/**
 * Sprint 22: shared empty-state panel.
 *
 * Every list view renders this when it has nothing to show, instead of
 * a bare "no items" line. The CTA navigates the user to wherever the
 * data comes from — an empty risk register should point at scans and
 * manual entry, not just state the obvious.
 */
import type { LucideIcon } from 'lucide-react';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  /** One or two sentences of guidance — where does this data come from? */
  detail?: string;
  cta?: { label: string; onClick: () => void };
  /** Secondary, quieter action (e.g. "Learn more"). */
  secondaryCta?: { label: string; onClick: () => void };
}

export default function EmptyState({ icon: Icon, title, detail, cta, secondaryCta }: EmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 12,
        padding: '48px 24px',
        textAlign: 'center',
      }}
    >
      <div
        aria-hidden
        style={{
          width: 48, height: 48, borderRadius: 14,
          display: 'grid', placeItems: 'center',
          background: 'rgba(123,107,237,0.10)',
          border: '1px solid rgba(123,107,237,0.25)',
          color: 'var(--violet)',
        }}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h3 style={{
          margin: 0,
          fontFamily: 'var(--font-redesign-display)',
          fontSize: 16, fontWeight: 700, color: 'var(--ink-1)',
        }}>
          {title}
        </h3>
        {detail && (
          <p style={{ margin: '6px auto 0', fontSize: 13, color: 'var(--ink-3)', maxWidth: 420 }}>
            {detail}
          </p>
        )}
      </div>
      {(cta || secondaryCta) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          {cta && (
            <button type="button" className="btn btn-primary" onClick={cta.onClick}>
              {cta.label}
            </button>
          )}
          {secondaryCta && (
            <button type="button" className="btn btn-ghost" onClick={secondaryCta.onClick}>
              {secondaryCta.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
