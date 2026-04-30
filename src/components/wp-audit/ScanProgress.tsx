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
    <div className="max-w-3xl mx-auto py-8 px-6 space-y-6">
      {/* Header */}
      <div className="card-elevated p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display font-bold text-xl text-text-primary">
              Scanning {domain}
            </h2>
            <p className="text-sm text-text-muted mt-1">
              {completedCount} of {totalCount} checks complete
            </p>
          </div>
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary transition-colors flex-shrink-0"
            style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)' }}
          >
            Cancel
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'var(--gradient-accent)' }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>

        <p className="text-xs text-text-muted mt-2">
          SSL Labs analysis may take up to 2 minutes for first-time scans
        </p>
      </div>

      {/* Live results by category */}
      <div className="space-y-4">
        {grouped.map(({ category, checks: catChecks }) => {
          const completedInCat = catChecks.filter(c => c.result != null).length;
          const hasFails = catChecks.some(c => c.result?.status === 'fail');
          const hasWarnings = catChecks.some(c => c.result?.status === 'warning');

          return (
            <div key={category} className="card-elevated p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-text-primary">{category}</h3>
                <span className="text-xs text-text-muted font-mono">
                  {completedInCat}/{catChecks.length}
                  {hasFails && <span style={{ color: 'var(--color-status-red)' }}> · issues found</span>}
                  {!hasFails && hasWarnings && <span style={{ color: 'var(--color-status-amber)' }}> · warnings</span>}
                </span>
              </div>
              <div className="space-y-1">
                <AnimatePresence>
                  {catChecks.map(check => (
                    <CheckRow key={check.id} check={check} />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
