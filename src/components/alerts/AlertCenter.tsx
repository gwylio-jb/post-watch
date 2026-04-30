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

const severityColors: Record<AlertSeverity, { bg: string; text: string; border: string }> = {
  Critical: { bg: '#FFF1EE', text: '#FF4A1C', border: 'rgba(255,74,28,0.35)' },
  High:     { bg: '#FFF7ED', text: '#D97706', border: 'rgba(217,119,6,0.35)' },
  Medium:   { bg: '#F3F0FF', text: '#8B5CF6', border: 'rgba(139,92,246,0.35)' },
  Low:      { bg: '#E6FAF5', text: '#00B589', border: 'rgba(0,181,137,0.35)' },
};

const sourceLabels: Record<AlertSource, { label: string; icon: React.ElementType; color: string }> = {
  post_scan:   { label: 'WordPress security', icon: ScanSearch,   color: '#00D9A3' },
  post_comply: { label: 'Compliance',          icon: ShieldCheck,  color: '#8B5CF6' },
  post_risk:   { label: 'Risk hub',             icon: AlertTriangle, color: '#D97706' },
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
      className="card-elevated p-4"
      style={{ borderLeft: `3px solid ${sc.text}` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          {/* Source + timestamp */}
          <div className="flex items-center gap-2 mb-1.5">
            <div className="flex items-center gap-1.5">
              <SrcIcon className="w-3 h-3" style={{ color: src.color }} />
              <span
                style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '9px',
                  color: src.color,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontWeight: 600,
                }}
              >
                {src.label}
              </span>
            </div>
            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontFamily: '"JetBrains Mono", monospace' }}>
              {new Date(alert.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </span>
            <span
              style={{
                fontSize: '9px',
                fontWeight: 700,
                background: sc.bg,
                color: sc.text,
                border: `1px solid ${sc.border}`,
                borderRadius: '3px',
                padding: '0 5px',
                fontFamily: '"JetBrains Mono", monospace',
              }}
            >
              {alert.severity}
            </span>
          </div>

          {/* Title */}
          <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 4, lineHeight: 1.4 }}>
            {alert.title}
          </h4>

          {/* Detail */}
          <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
            {alert.detail}
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={() => onNavigate(alert.source)}
            className="text-xs px-2.5 py-1.5 rounded-lg font-medium"
            style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-secondary)'; }}
          >
            View →
          </button>
          <button
            onClick={() => onDismiss(alert.id)}
            className="p-1.5 rounded-lg"
            style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)'; (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-alt)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)'; (e.currentTarget as HTMLElement).style.background = ''; }}
            title="Dismiss"
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

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="p-8 space-y-6">

        {/* Header stats */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-5">
            {(Object.entries(counts) as [AlertSeverity, number][]).map(([sev, count]) => {
              const sc = severityColors[sev];
              return (
                <div key={sev} className="flex items-center gap-1.5">
                  <span style={{ fontSize: '22px', fontWeight: 800, color: count > 0 ? sc.text : 'var(--color-text-muted)', fontFamily: 'var(--font-display)', lineHeight: 1 }}>{count}</span>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: '"JetBrains Mono", monospace' }}>{sev.toLowerCase()}</span>
                </div>
              );
            })}
          </div>
          {visible.length > 0 && (
            <button
              onClick={dismissAll}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
              style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Dismiss all
            </button>
          )}
        </div>

        {/* Severity filters */}
        <div className="flex items-center gap-1 p-1 rounded-lg w-fit" style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)' }}>
          {(['All', 'Critical', 'High', 'Medium', 'Low'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterSev(s)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{
                background: filterSev === s ? 'var(--color-surface)' : 'transparent',
                color: filterSev === s
                  ? (s === 'All' ? 'var(--color-text-primary)' : severityColors[s as AlertSeverity]?.text ?? 'var(--color-text-primary)')
                  : 'var(--color-text-muted)',
                boxShadow: filterSev === s ? 'var(--shadow-card)' : 'none',
              }}
            >
              {s}
              {s !== 'All' && counts[s as AlertSeverity] > 0 && (
                <span className="ml-1.5" style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '10px' }}>
                  ({counts[s as AlertSeverity]})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Alert list */}
        {visible.length === 0 ? (
          <motion.div
            className="card-elevated flex flex-col items-center justify-center py-16 gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <CheckCircle className="w-12 h-12" style={{ color: '#00D9A3', opacity: 0.6 }} />
            <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>All clear</span>
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontFamily: '"JetBrains Mono", monospace' }}>
              // {allAlerts.length === 0 ? 'Run a scan or gap analysis to generate alerts' : 'All alerts dismissed'}
            </span>
          </motion.div>
        ) : (
          <div className="space-y-3">
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

        {/* Data source note */}
        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: '"JetBrains Mono", monospace', paddingTop: 4 }}>
          // Alerts derived from WP scan findings, compliance gap analysis, and TLS certificate data.
        </div>

      </div>
    </div>
  );
}
