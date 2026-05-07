import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, ScanSearch, ShieldCheck, AlertTriangle } from 'lucide-react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import type { AuditReport } from '../../data/auditTypes';
import type { GapAnalysisSession } from '../../data/types';
import {
  deriveAlerts,
  filterDismissed,
  pruneDismissed,
  type Alert,
  type AlertSeverity,
} from '../../utils/deriveAlerts';

type AlertSource = Alert['source'];

// Severity → redesign-token colours. `text` is the foreground accent, `pill`
// matches the .pill class variant used for the badge. Theme-aware via tokens.
const severityColors: Record<AlertSeverity, { text: string; pill: 'ember' | 'violet' | 'mint' }> = {
  Critical: { text: 'var(--ember)',  pill: 'ember'  },
  High:     { text: 'var(--ember-2, var(--ember))', pill: 'ember' },
  Medium:   { text: 'var(--violet)', pill: 'violet' },
  Low:      { text: 'var(--mint)',   pill: 'mint'   },
};

const sourceLabels: Record<AlertSource, { label: string; icon: React.ElementType; color: string }> = {
  post_scan:   { label: 'WordPress security', icon: ScanSearch,    color: 'var(--mint)'   },
  post_comply: { label: 'Compliance',         icon: ShieldCheck,   color: 'var(--violet)' },
  post_risk:   { label: 'Risk hub',           icon: AlertTriangle, color: 'var(--ember)'  },
};

// ─── Alert card ───────────────────────────────────────────────────────────────

function AlertCard({
  alert,
  onDismiss,
  onNavigate,
}: {
  alert: Alert;
  onDismiss: (id: string) => void;
  onNavigate: (section: import('../../data/types').AppSection) => void;
}) {
  const sc = severityColors[alert.severity];
  const src = sourceLabels[alert.source];
  const SrcIcon = src.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8, height: 0, marginBottom: 0 }}
      className="bubble"
      style={{ padding: 16, borderLeft: `3px solid ${sc.text}` }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Source + timestamp + severity pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <SrcIcon className="w-3 h-3" style={{ color: src.color }} />
              <span
                style={{
                  fontFamily: 'var(--font-redesign-mono)',
                  fontSize: 10,
                  color: src.color,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontWeight: 600,
                }}
              >
                {src.label}
              </span>
            </div>
            <span style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--font-redesign-mono)' }}>
              {new Date(alert.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </span>
            <span className={`pill ${sc.pill}`} style={{ fontSize: 10, padding: '2px 8px' }}>
              <span className="dot" style={{ background: sc.text }} />{alert.severity}
            </span>
          </div>

          {/* Title */}
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--ink-1)', marginBottom: 4, lineHeight: 1.4 }}>
            {alert.title}
          </h4>

          {/* Detail */}
          <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>
            {alert.detail}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => onNavigate(alert.source)}
            className="btn btn-ghost"
            style={{ fontSize: 11, padding: '6px 10px' }}
          >
            View →
          </button>
          <button
            type="button"
            onClick={() => onDismiss(alert.id)}
            aria-label={`Dismiss ${alert.title}`}
            style={{
              padding: 6, borderRadius: 8,
              background: 'transparent', border: 0,
              color: 'var(--ink-3)',
              cursor: 'pointer',
              display: 'grid', placeItems: 'center',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--ember)'; (e.currentTarget as HTMLElement).style.background = 'color-mix(in oklab, var(--ember) 12%, transparent)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--ink-3)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Alert Center ────────────────────────────────────────────────────────

interface AlertCenterProps {
  onNavigate: (section: import('../../data/types').AppSection) => void;
}

export default function AlertCenter({ onNavigate }: AlertCenterProps) {
  const [savedReports] = useLocalStorage<AuditReport[]>('wp-audit-reports', []);
  const [gapSessions] = useLocalStorage<GapAnalysisSession[]>('gap-sessions', []);
  const [dismissedIds, setDismissedIds] = useLocalStorage<string[]>('post-watch:dismissed-alerts', []);
  const [filterSev, setFilterSev] = useState<AlertSeverity | 'All'>('All');

  const allAlerts = useMemo(() =>
    deriveAlerts(
      Array.isArray(savedReports) ? savedReports : [],
      Array.isArray(gapSessions) ? gapSessions : [],
    ),
    [savedReports, gapSessions]
  );

  const safeDismissed: string[] = Array.isArray(dismissedIds) ? dismissedIds : [];

  // Prune orphaned dismissed ids once per alert-set change. Without this,
  // ids accumulate indefinitely in localStorage and can shadow later alerts.
  useEffect(() => {
    const pruned = pruneDismissed(allAlerts, safeDismissed);
    if (pruned.length !== safeDismissed.length) setDismissedIds(pruned);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allAlerts]);

  const visible = filterDismissed(allAlerts, safeDismissed).filter(
    a => filterSev === 'All' || a.severity === filterSev
  );

  function dismiss(id: string) {
    setDismissedIds(prev => [...(Array.isArray(prev) ? prev : []), id]);
  }

  function dismissAll() {
    setDismissedIds(prev => [...(Array.isArray(prev) ? prev : []), ...visible.map(a => a.id)]);
  }

  const counts = {
    Critical: visible.filter(a => a.severity === 'Critical').length,
    High:     visible.filter(a => a.severity === 'High').length,
    Medium:   visible.filter(a => a.severity === 'Medium').length,
    Low:      visible.filter(a => a.severity === 'Low').length,
  };

  const totalOpen = visible.length;
  const totalRaw = allAlerts.length;
  const dismissedCount = totalRaw - filterDismissed(allAlerts, safeDismissed).length;

  return (
    <div className="page">
      {/* Hero — compressed (Sprint 12 user QA: was overflowing the viewport
          on smaller windows). Single column, smaller title, severity
          breakdown collapsed to a horizontal pill row inside hero-l so it
          doesn't push the whole hero past the fold. */}
      <section className="hero" style={{ gridTemplateColumns: '1fr', padding: '24px 28px' }}>
        <div className="hero-l">
          <span className="kicker ember">post_alert · live alerts</span>
          <h1 className="h-condensed title" style={{ fontSize: 40 }}>
            What needs attention<span className="u">_</span> right now.
          </h1>
          <p className="sub">
            Derived from WP scan findings, compliance gap analysis, and TLS certificate data. Dismiss what's actioned — the badge mirrors what's open.
          </p>
          <div className="hero-stats" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
            <div className="hero-stat">
              <div className="l">Open</div>
              <div className="v" style={{ color: totalOpen > 0 ? 'var(--ember)' : 'var(--mint)' }}>{totalOpen}</div>
            </div>
            <div className="hero-stat">
              <div className="l">Critical</div>
              <div className="v" style={{ color: counts.Critical > 0 ? 'var(--ember)' : undefined }}>{counts.Critical}</div>
            </div>
            <div className="hero-stat">
              <div className="l">High</div>
              <div className="v" style={{ color: counts.High > 0 ? 'var(--ember)' : undefined }}>{counts.High}</div>
            </div>
            <div className="hero-stat">
              <div className="l">Medium</div>
              <div className="v" style={{ color: counts.Medium > 0 ? 'var(--violet)' : undefined }}>{counts.Medium}</div>
            </div>
            <div className="hero-stat">
              <div className="l">Dismissed</div>
              <div className="v">{dismissedCount}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            {visible.length > 0 && (
              <button type="button" onClick={dismissAll} className="btn btn-ghost">
                <CheckCircle className="w-4 h-4" /> Dismiss all
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Severity filter strip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 4, background: 'var(--glass-bg)', border: '1px solid var(--glass-bd)', borderRadius: 14, width: 'fit-content' }}>
        {(['All', 'Critical', 'High', 'Medium', 'Low'] as const).map(s => {
          const active = filterSev === s;
          const sevColor = s !== 'All' ? severityColors[s as AlertSeverity]?.text : 'var(--ink-1)';
          return (
            <button
              key={s}
              type="button"
              onClick={() => setFilterSev(s)}
              style={{
                padding: '6px 12px',
                borderRadius: 10,
                fontSize: 12, fontWeight: 500,
                background: active ? 'var(--bg-2)' : 'transparent',
                color: active ? sevColor : 'var(--ink-3)',
                border: 0,
                cursor: 'pointer',
                fontFamily: 'inherit',
                boxShadow: active ? 'var(--tile-shadow)' : 'none',
              }}
              aria-pressed={active}
            >
              {s}
              {s !== 'All' && counts[s as AlertSeverity] > 0 && (
                <span style={{ marginLeft: 6, fontFamily: 'var(--font-redesign-mono)', fontSize: 10 }}>
                  {counts[s as AlertSeverity]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Alert list */}
      {visible.length === 0 ? (
        <motion.div
          className="bubble"
          style={{ padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <CheckCircle className="w-12 h-12" style={{ color: 'var(--mint)', opacity: 0.7 }} />
          <span style={{ fontFamily: 'var(--font-redesign-display)', fontSize: 18, fontWeight: 700, color: 'var(--ink-1)' }}>
            All clear
          </span>
          <span style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--font-redesign-mono)' }}>
            // {allAlerts.length === 0 ? 'Run a scan or gap analysis to generate alerts' : 'All alerts dismissed'}
          </span>
        </motion.div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <AnimatePresence mode="popLayout">
            {visible.map(alert => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onDismiss={dismiss}
                onNavigate={onNavigate}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
