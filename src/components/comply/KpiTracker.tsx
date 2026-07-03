/**
 * Sprint 26 (v3.0 pillar #4): KPI tracker (clause 9.1).
 *
 * Two sections per client:
 *  - Auto-computed metrics derived live from app data (compliance %,
 *    mean WP score, open/overdue CAPAs). Zero data entry.
 *  - User-defined KPIs with per-period values and a Trend sparkline.
 *    Current-period entry is a single number input — the whole point
 *    is that recording a month's value takes five seconds.
 */
import { useState, useMemo } from 'react';
import { Plus, TrendingUp, Download, Trash2 } from 'lucide-react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import type { Kpi, Client, Finding, GapAnalysisSession } from '../../data/types';
import type { AuditReport } from '../../data/auditTypes';
import {
  newKpi, currentPeriod, recordKpiValue, latestEntry, onTarget, computeAutoKpis, kpisToCsv,
} from '../../utils/kpis';
import { exportAsCsv } from '../../utils/export';
import { UNASSIGNED_CLIENT_ID } from '../../utils/clientMigration';
import { pushToast } from '../../utils/toastBus';
import { pushUndo } from '../../utils/undoBus';
import Trend from '../charts/Trend';
import Modal from '../shared/Modal';
import EmptyState from '../shared/EmptyState';
import FormField from '../shared/FormField';

const inputStyle: React.CSSProperties = {
  padding: '8px 12px', borderRadius: 10,
  border: '1px solid var(--line-2)',
  background: 'var(--bg-2)', color: 'var(--ink-1)',
  fontSize: 13, outline: 'none', fontFamily: 'inherit',
  width: '100%',
};

export default function KpiTracker() {
  const [kpis, setKpis] = useLocalStorage<Kpi[]>('kpis', []);
  const [clients] = useLocalStorage<Client[]>('clients', []);
  const [findings] = useLocalStorage<Finding[]>('findings', []);
  const [gapSessions] = useLocalStorage<GapAnalysisSession[]>('gap-sessions', []);
  const [reports] = useLocalStorage<AuditReport[]>('wp-audit-reports', []);

  const safeKpis = useMemo<Kpi[]>(() => Array.isArray(kpis) ? kpis : [], [kpis]);
  const safeClients = useMemo<Client[]>(() => Array.isArray(clients) ? clients : [], [clients]);

  const [clientId, setClientId] = useState<string>(
    () => safeClients.find(c => c.id !== UNASSIGNED_CLIENT_ID)?.id ?? UNASSIGNED_CLIENT_ID
  );
  const [showNew, setShowNew] = useState(false);

  const clientKpis = useMemo(() => safeKpis.filter(k => k.clientId === clientId), [safeKpis, clientId]);

  const autoKpis = useMemo(() => computeAutoKpis({
    clientId,
    findings: Array.isArray(findings) ? findings : [],
    gapSessions: Array.isArray(gapSessions) ? gapSessions : [],
    reports: Array.isArray(reports) ? reports : [],
  }), [clientId, findings, gapSessions, reports]);

  const patchKpi = (id: string, updater: (k: Kpi) => Kpi) => {
    setKpis(prev => (Array.isArray(prev) ? prev : []).map(k => k.id === id ? updater(k) : k));
  };

  const deleteKpi = (id: string) => {
    const snapshot = safeKpis.find(k => k.id === id);
    setKpis(prev => (Array.isArray(prev) ? prev : []).filter(k => k.id !== id));
    if (snapshot) {
      pushUndo({
        label: 'KPI deleted',
        revert: () => setKpis(prev => {
          const cur = Array.isArray(prev) ? prev : [];
          return cur.some(k => k.id === snapshot.id) ? cur : [...cur, snapshot];
        }),
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="bubble" style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <select
          value={clientId}
          onChange={e => setClientId(e.target.value)}
          aria-label="Client"
          style={{ ...inputStyle, width: 'auto', padding: '6px 10px' }}
        >
          {safeClients.length === 0 && <option value={UNASSIGNED_CLIENT_ID}>Unassigned</option>}
          {safeClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => { exportAsCsv('kpis', kpisToCsv(clientKpis)); pushToast('success', 'KPIs exported as CSV'); }}
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setShowNew(true)}>
            <Plus className="w-3.5 h-3.5" />
            Define KPI
          </button>
        </div>
      </div>

      {/* Auto-computed metrics */}
      <section className="bubble" style={{ padding: 18 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: 'var(--ink-1)', fontFamily: 'var(--font-redesign-display)' }}>
          Live metrics
          <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 500, color: 'var(--ink-3)', fontFamily: 'var(--font-redesign-mono)' }}>
            derived from app data — nothing to type in
          </span>
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {autoKpis.map(a => (
            <div key={a.id} style={{ padding: 12, borderRadius: 12, border: '1px solid var(--line-2)', background: 'var(--bg-2)' }}>
              <div style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-redesign-mono)' }}>
                {a.name}
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink-1)', fontFamily: 'var(--font-redesign-display)' }}>
                {a.value !== null ? a.value : '—'}
                <small style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 4 }}>{a.value !== null ? a.unit : 'no data'}</small>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Manual KPIs */}
      {clientKpis.length === 0 ? (
        <div className="bubble">
          <EmptyState
            icon={TrendingUp}
            title="No custom KPIs defined"
            detail='Clause 9.1 expects the ISMS to be measured. Define metrics like "% of vulnerabilities patched within 30 days" or "training completion rate" and record a value each period.'
            cta={{ label: 'Define the first KPI', onClick: () => setShowNew(true) }}
          />
        </div>
      ) : (
        clientKpis.map(k => (
          <KpiCard key={k.id} kpi={k} onPatch={u => patchKpi(k.id, u)} onDelete={() => deleteKpi(k.id)} />
        ))
      )}

      {showNew && (
        <NewKpiModal
          clientId={clientId}
          onCreate={k => {
            setKpis(prev => [...(Array.isArray(prev) ? prev : []), k]);
            setShowNew(false);
          }}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}

/* ─── One KPI card: trend + current-period entry ──────────────────────── */

function KpiCard({ kpi, onPatch, onDelete }: {
  kpi: Kpi;
  onPatch: (updater: (k: Kpi) => Kpi) => void;
  onDelete: () => void;
}) {
  const period = currentPeriod(kpi.cadence);
  const existing = kpi.entries.find(e => e.period === period);
  const [draft, setDraft] = useState(existing !== undefined ? String(existing.value) : '');
  const latest = latestEntry(kpi);
  const target = onTarget(kpi);

  // Trend expects {date, score}; scale max to fit the data + target.
  const trendData = kpi.entries.map(e => ({ date: e.period, score: e.value }));
  const maxY = Math.max(
    kpi.target ?? 0,
    ...kpi.entries.map(e => e.value),
    1,
  ) * 1.1;

  const commit = () => {
    const v = parseFloat(draft);
    if (Number.isNaN(v)) return;
    onPatch(k => recordKpiValue(k, period, v));
    pushToast('success', `${kpi.name}: ${v}${kpi.unit} recorded for ${period}`);
  };

  return (
    <section className="bubble" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--ink-1)', fontFamily: 'var(--font-redesign-display)' }}>
            {kpi.name}
          </h3>
          <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-redesign-mono)' }}>
            {kpi.cadence}
            {kpi.target !== undefined && ` · target ${kpi.target}${kpi.unit}`}
            {latest && ` · latest ${latest.value}${kpi.unit} (${latest.period})`}
          </span>
        </div>
        {target !== null && (
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
            fontFamily: 'var(--font-redesign-mono)',
            background: target ? 'rgba(0,217,163,0.12)' : 'rgba(255,74,28,0.12)',
            border: `1px solid ${target ? 'rgba(0,217,163,0.30)' : 'rgba(255,74,28,0.30)'}`,
            color: target ? 'var(--mint)' : 'var(--ember)',
          }}>
            {target ? 'on target' : 'below target'}
          </span>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="number"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commit(); }}
            placeholder={period}
            aria-label={`Value for ${period}`}
            style={{ ...inputStyle, width: 110, padding: '6px 10px' }}
          />
          <button type="button" className="btn btn-ghost" onClick={commit}>
            Record {period}
          </button>
          <button
            type="button"
            aria-label={`Delete KPI ${kpi.name}`}
            onClick={onDelete}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: 4, display: 'inline-flex' }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {kpi.entries.length > 0 && (
        <Trend data={trendData} max={maxY} />
      )}
    </section>
  );
}

/* ─── Create modal ────────────────────────────────────────────────────── */

function NewKpiModal({ clientId, onCreate, onClose }: {
  clientId: string;
  onCreate: (k: Kpi) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('%');
  const [target, setTarget] = useState('');
  const [cadence, setCadence] = useState<'monthly' | 'quarterly'>('monthly');
  const [touched, setTouched] = useState(false);

  const submit = () => {
    if (!name.trim()) { setTouched(true); return; }
    const t = parseFloat(target);
    onCreate(newKpi({
      clientId,
      name: name.trim(),
      unit: unit.trim() || 'count',
      target: Number.isNaN(t) ? undefined : t,
      cadence,
    }));
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Define a KPI"
      subtitle="Targets are treated as a minimum — phrase the metric so higher is better"
      size={480}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={submit}>Create</button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <FormField label="Name" required error={touched && !name.trim() ? 'A name is required' : null}>
          <input
            style={inputStyle}
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="e.g. Vulnerabilities patched within 30 days"
          />
        </FormField>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <FormField label="Unit">
            <input style={inputStyle} value={unit} onChange={e => setUnit(e.target.value)} placeholder="%" />
          </FormField>
          <FormField label="Target" hint="optional">
            <input style={inputStyle} type="number" value={target} onChange={e => setTarget(e.target.value)} />
          </FormField>
          <FormField label="Cadence">
            <select style={inputStyle} value={cadence} onChange={e => setCadence(e.target.value as 'monthly' | 'quarterly')}>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
            </select>
          </FormField>
        </div>
      </div>
    </Modal>
  );
}
