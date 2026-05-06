import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Info, Loader, SkipForward } from 'lucide-react';
import type { AuditCheck, CheckStatus } from '../../data/auditTypes';
import { CATEGORY_ORDER } from '../../utils/audit/scanEngine';

interface ScanProgressProps {
  checks: AuditCheck[];
  onCancel: () => void;
  targetUrl: string;
}

const statusIcon: Record<CheckStatus, React.ElementType> = {
  pass:    CheckCircle,
  fail:    XCircle,
  warning: AlertTriangle,
  info:    Info,
  skipped: SkipForward,
  error:   AlertTriangle,
};

const statusColor: Record<CheckStatus, string> = {
  pass:    'var(--color-status-green)',
  fail:    'var(--color-status-red)',
  warning: 'var(--color-status-amber)',
  info:    'var(--color-status-blue)',
  skipped: 'var(--color-text-muted)',
  error:   'var(--color-accent-danger)',
};

function CheckRow({ check }: { check: AuditCheck }) {
  const result = check.result;
  const pending = !result;

  const Icon = pending ? Loader : statusIcon[result.status];
  const color = pending ? 'var(--color-text-muted)' : statusColor[result.status];

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-start gap-3 py-2 px-3 rounded-lg"
      style={{ background: pending ? 'transparent' : 'var(--color-surface-alt)' }}
    >
      <div className="mt-0.5 flex-shrink-0" style={{ color }}>
        <Icon className={`w-4 h-4 ${pending ? 'animate-spin' : ''}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-medium truncate ${pending ? 'text-text-muted' : 'text-text-primary'}`}
          >
            {check.name}
          </span>
          {result && result.status !== 'pass' && (
            <span
              className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-sm font-mono flex-shrink-0"
              style={{ background: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
            >
              {result.status}
            </span>
          )}
        </div>
        {result && (
          <p className="text-xs text-text-muted mt-0.5 leading-snug truncate">{result.detail}</p>
        )}
        {pending && (
          <p className="text-xs text-text-muted mt-0.5">Checking…</p>
        )}
      </div>
    </motion.div>
  );
}

export default function ScanProgress({ checks, onCancel, targetUrl }: ScanProgressProps) {
  const completedCount = checks.filter(c => c.result != null).length;
  const totalCount = checks.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Group checks by category in CATEGORY_ORDER
  const grouped = CATEGORY_ORDER.map(cat => ({
    category: cat,
    checks: checks.filter(c => c.category === cat),
  })).filter(g => g.checks.length > 0);

  const domain = (() => {
    try { return new URL(targetUrl).hostname; } catch { return targetUrl; }
  })();

  return (
    <div className="page">
      {/* Hero with live progress */}
      <section className="hero" style={{ padding: '24px 28px' }}>
        <div className="hero-l">
          <span className="kicker">post_scan · in progress</span>
          <h1 className="h-condensed" style={{ fontSize: 42, marginTop: 6, wordBreak: 'break-word' }}>
            Scanning {domain}<span className="u">_</span>
          </h1>
          <p className="sub">
            {completedCount} of {totalCount} checks complete · SSL Labs analysis may take up to 2 minutes for first-time scans.
          </p>

          {/* Progress bar */}
          <div style={{ height: 8, borderRadius: 999, overflow: 'hidden', background: 'var(--line-2)', marginTop: 6 }}>
            <motion.div
              style={{ height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, var(--mint), var(--violet))' }}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={onCancel}>
              Cancel scan
            </button>
          </div>
        </div>
        <div className="gauge-wrap">
          <div
            style={{
              padding: '20px 22px',
              borderRadius: 22,
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-bd)',
              backdropFilter: 'blur(20px)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              minWidth: 220,
              gap: 6,
            }}
          >
            <span className="kicker">progress</span>
            <div style={{ fontFamily: 'var(--font-redesign-condensed)', fontWeight: 800, fontSize: 84, lineHeight: 1, letterSpacing: '-0.04em', color: 'var(--ink-1)' }}>
              {Math.round(progress)}
              <small style={{ fontFamily: 'var(--font-redesign-mono)', fontSize: 14, color: 'var(--ink-3)', fontWeight: 500, marginLeft: 4 }}>%</small>
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-redesign-mono)' }}>
              {completedCount} / {totalCount} checks
            </div>
          </div>
        </div>
      </section>

      {/* Live results by category */}
      {grouped.map(({ category, checks: catChecks }) => {
        const completedInCat = catChecks.filter(c => c.result != null).length;
        const hasFails = catChecks.some(c => c.result?.status === 'fail');
        const hasWarnings = catChecks.some(c => c.result?.status === 'warning');

        return (
          <section className="bubble" key={category}>
            <div className="card-head">
              <div>
                <span className="kicker">{category}</span>
                <h3>{category}</h3>
              </div>
              <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-redesign-mono)' }}>
                {completedInCat}/{catChecks.length}
                {hasFails && <span style={{ color: 'var(--ember)' }}> · issues found</span>}
                {!hasFails && hasWarnings && <span style={{ color: 'var(--violet)' }}> · warnings</span>}
              </span>
            </div>
            <div style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <AnimatePresence>
                {catChecks.map(check => (
                  <CheckRow key={check.id} check={check} />
                ))}
              </AnimatePresence>
            </div>
          </section>
        );
      })}
    </div>
  );
}
