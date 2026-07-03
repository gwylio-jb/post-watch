/**
 * Sprint 26 (v3.0 pillar #4): the three lightweight registers that
 * otherwise live in Excel — training (7.3), incidents (A.5.24-27),
 * assets (clause 5/8 foundation).
 *
 * One tab, sub-switcher between registers. Deliberately spreadsheet-
 * plain: inline add row at the top, table below, CSV export. Training
 * additionally imports from an HR CSV export; incidents can raise a
 * CAPA finding.
 */
import { useState, useMemo, useRef } from 'react';
import { GraduationCap, Siren, Boxes, Download, Upload, Trash2 } from 'lucide-react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import type {
  TrainingRecord, IncidentRecord, AssetRecord, Client, Finding,
  FindingSeverity, AssetType,
} from '../../data/types';
import {
  newTrainingRecord, trainingToCsv, parseTrainingCsv, trainingCompletionPct,
  newIncidentRecord, resolveIncident, incidentsToCsv,
  newAssetRecord, assetCriticality, assetsToCsv,
} from '../../utils/registers';
import { newFinding } from '../../utils/findings';
import { parseCsv } from '../../utils/csv/parseCsv';
import { exportAsCsv } from '../../utils/export';
import { UNASSIGNED_CLIENT_ID } from '../../utils/clientMigration';
import { pushToast } from '../../utils/toastBus';
import { pushUndo } from '../../utils/undoBus';

type RegisterKind = 'training' | 'incidents' | 'assets';

const inputStyle: React.CSSProperties = {
  padding: '6px 10px', borderRadius: 8,
  border: '1px solid var(--line-2)',
  background: 'var(--bg-2)', color: 'var(--ink-1)',
  fontSize: 12, outline: 'none', fontFamily: 'inherit',
  width: '100%',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '8px 10px',
  fontSize: 10, fontWeight: 600, color: 'var(--ink-3)',
  textTransform: 'uppercase', letterSpacing: '0.06em',
  fontFamily: 'var(--font-redesign-mono)',
  borderBottom: '1px solid var(--line-2)',
};

const tdStyle: React.CSSProperties = {
  padding: '8px 10px', fontSize: 12, color: 'var(--ink-1)',
  borderBottom: '1px solid var(--line-2)',
};

export default function Registers() {
  const [clients] = useLocalStorage<Client[]>('clients', []);
  const safeClients = useMemo<Client[]>(() => Array.isArray(clients) ? clients : [], [clients]);

  const [clientId, setClientId] = useState<string>(
    () => safeClients.find(c => c.id !== UNASSIGNED_CLIENT_ID)?.id ?? UNASSIGNED_CLIENT_ID
  );
  const [kind, setKind] = useState<RegisterKind>('training');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="bubble" style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <select
          value={clientId}
          onChange={e => setClientId(e.target.value)}
          aria-label="Client"
          style={{ ...inputStyle, width: 'auto' }}
        >
          {safeClients.length === 0 && <option value={UNASSIGNED_CLIENT_ID}>Unassigned</option>}
          {safeClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <div style={{ display: 'flex', gap: 4 }}>
          {([
            ['training', 'Training', GraduationCap],
            ['incidents', 'Incidents', Siren],
            ['assets', 'Assets', Boxes],
          ] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setKind(id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 999,
                fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                background: kind === id ? 'rgba(0,217,163,0.14)' : 'transparent',
                border: `1px solid ${kind === id ? 'rgba(0,217,163,0.30)' : 'var(--line-2)'}`,
                color: kind === id ? 'var(--mint)' : 'var(--ink-3)',
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {kind === 'training' && <TrainingRegister clientId={clientId} />}
      {kind === 'incidents' && <IncidentRegister clientId={clientId} />}
      {kind === 'assets' && <AssetRegister clientId={clientId} />}
    </div>
  );
}

/* ─── Training (clause 7.3) ───────────────────────────────────────────── */

function TrainingRegister({ clientId }: { clientId: string }) {
  const [records, setRecords] = useLocalStorage<TrainingRecord[]>('training', []);
  const safe = useMemo<TrainingRecord[]>(() => Array.isArray(records) ? records : [], [records]);
  const rows = useMemo(
    () => safe.filter(r => r.clientId === clientId).sort((a, b) => b.date.localeCompare(a.date)),
    [safe, clientId],
  );
  const completion = trainingCompletionPct(rows);
  const fileRef = useRef<HTMLInputElement>(null);

  const [employee, setEmployee] = useState('');
  const [topic, setTopic] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [passed, setPassed] = useState(true);

  const add = () => {
    if (!employee.trim() || !topic.trim()) return;
    setRecords(prev => [...(Array.isArray(prev) ? prev : []), newTrainingRecord({
      clientId, employee: employee.trim(), topic: topic.trim(), date, passed,
    })]);
    setEmployee('');
  };

  const remove = (id: string) => {
    const snapshot = safe.find(r => r.id === id);
    setRecords(prev => (Array.isArray(prev) ? prev : []).filter(r => r.id !== id));
    if (snapshot) {
      pushUndo({
        label: 'Training record deleted',
        revert: () => setRecords(prev => {
          const cur = Array.isArray(prev) ? prev : [];
          return cur.some(r => r.id === snapshot.id) ? cur : [...cur, snapshot];
        }),
      });
    }
  };

  const importCsv = async (file: File) => {
    try {
      const text = await file.text();
      // parseCsv returns rows already keyed by header name.
      const parsed = parseCsv(text);
      const { records: imported, skipped } = parseTrainingCsv(parsed.rows, clientId);
      if (imported.length === 0) {
        pushToast('error', `No usable rows found${skipped ? ` (${skipped} skipped — need employee + topic columns)` : ''}`);
        return;
      }
      setRecords(prev => [...(Array.isArray(prev) ? prev : []), ...imported]);
      pushToast('success', `Imported ${imported.length} training record${imported.length === 1 ? '' : 's'}${skipped ? `, ${skipped} skipped` : ''}`);
    } catch (e) {
      pushToast('error', (e as Error).message);
    }
  };

  return (
    <section className="bubble" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--ink-1)', fontFamily: 'var(--font-redesign-display)' }}>
          Training & awareness log
        </h3>
        {completion !== null && (
          <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-redesign-mono)' }}>
            {completion}% pass rate · {rows.length} record{rows.length === 1 ? '' : 's'}
          </span>
        )}
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={e => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void importCsv(f);
            }}
          />
          <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            <Upload className="w-3.5 h-3.5" />
            Import CSV
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => { exportAsCsv('training-log', trainingToCsv(rows)); pushToast('success', 'Training log exported'); }}
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
        </div>
      </div>

      {/* Inline add row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 140px 90px 80px', gap: 8, marginBottom: 12 }}>
        <input style={inputStyle} placeholder="Employee" value={employee} onChange={e => setEmployee(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }} />
        <input style={inputStyle} placeholder="Topic / course" value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }} />
        <input style={inputStyle} type="date" value={date} onChange={e => setDate(e.target.value)} aria-label="Training date" />
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-2)' }}>
          <input type="checkbox" checked={passed} onChange={e => setPassed(e.target.checked)} />
          Passed
        </label>
        <button type="button" className="btn btn-primary" onClick={add} disabled={!employee.trim() || !topic.trim()}>
          Add
        </button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={thStyle}>Employee</th>
            <th style={thStyle}>Topic</th>
            <th style={thStyle}>Date</th>
            <th style={thStyle}>Result</th>
            <th style={thStyle} aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td style={tdStyle}>{r.employee}</td>
              <td style={tdStyle}>{r.topic}</td>
              <td style={{ ...tdStyle, fontFamily: 'var(--font-redesign-mono)', fontSize: 11 }}>{r.date}</td>
              <td style={{ ...tdStyle, color: r.passed ? 'var(--mint)' : 'var(--ember)', fontSize: 11, fontWeight: 600 }}>
                {r.passed ? 'PASS' : 'FAIL'}
              </td>
              <td style={{ ...tdStyle, width: 34 }}>
                <button type="button" aria-label={`Delete record for ${r.employee}`} onClick={() => remove(r.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: 2, display: 'inline-flex' }}>
                  <Trash2 className="w-3 h-3" />
                </button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={5} style={{ ...tdStyle, color: 'var(--ink-3)', fontFamily: 'var(--font-redesign-mono)', fontSize: 11 }}>
              // No training records — add one above or import an HR CSV export
            </td></tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

/* ─── Incidents (A.5.24-27) ───────────────────────────────────────────── */

function IncidentRegister({ clientId }: { clientId: string }) {
  const [records, setRecords] = useLocalStorage<IncidentRecord[]>('incidents', []);
  const [, setFindings] = useLocalStorage<Finding[]>('findings', []);
  const safe = useMemo<IncidentRecord[]>(() => Array.isArray(records) ? records : [], [records]);
  const rows = useMemo(
    () => safe.filter(r => r.clientId === clientId).sort((a, b) => b.date.localeCompare(a.date)),
    [safe, clientId],
  );

  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<FindingSeverity>('medium');

  const add = () => {
    if (!title.trim()) return;
    setRecords(prev => [...(Array.isArray(prev) ? prev : []), newIncidentRecord({
      clientId, title: title.trim(), severity,
    })]);
    setTitle('');
  };

  const patch = (id: string, updater: (r: IncidentRecord) => IncidentRecord) => {
    setRecords(prev => (Array.isArray(prev) ? prev : []).map(r => r.id === id ? updater(r) : r));
  };

  const raiseCapa = (incident: IncidentRecord) => {
    if (incident.findingId) {
      pushToast('info', 'A finding was already raised from this incident');
      return;
    }
    const f = newFinding({
      clientId,
      source: 'incident',
      sourceRef: incident.id,
      title: `Incident follow-up: ${incident.title}`,
      description: [incident.description, incident.rootCause && `Root cause: ${incident.rootCause}`].filter(Boolean).join('\n'),
      severity: incident.severity,
    });
    setFindings(prev => [...(Array.isArray(prev) ? prev : []), f]);
    patch(incident.id, r => ({ ...r, findingId: f.id }));
    pushToast('success', 'Finding raised on the CAPA register');
  };

  return (
    <section className="bubble" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--ink-1)', fontFamily: 'var(--font-redesign-display)' }}>
          Incident log
        </h3>
        <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-redesign-mono)' }}>
          {rows.filter(r => r.status === 'open').length} open · {rows.length} total
        </span>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ marginLeft: 'auto' }}
          onClick={() => { exportAsCsv('incident-log', incidentsToCsv(rows)); pushToast('success', 'Incident log exported'); }}
        >
          <Download className="w-3.5 h-3.5" />
          CSV
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 80px', gap: 8, marginBottom: 12 }}>
        <input style={inputStyle} placeholder="What happened?" value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }} />
        <select style={inputStyle} value={severity} onChange={e => setSeverity(e.target.value as FindingSeverity)} aria-label="Severity">
          {(['critical', 'high', 'medium', 'low'] as const).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button type="button" className="btn btn-primary" onClick={add} disabled={!title.trim()}>Log</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map(r => (
          <IncidentRow key={r.id} incident={r} onPatch={u => patch(r.id, u)} onRaiseCapa={() => raiseCapa(r)} />
        ))}
        {rows.length === 0 && (
          <p style={{ margin: 0, fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-redesign-mono)' }}>
            // No incidents logged — that's either very good or very optimistic
          </p>
        )}
      </div>
    </section>
  );
}

function IncidentRow({ incident, onPatch, onRaiseCapa }: {
  incident: IncidentRecord;
  onPatch: (updater: (r: IncidentRecord) => IncidentRecord) => void;
  onRaiseCapa: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [rootCause, setRootCause] = useState(incident.rootCause ?? '');
  const [lessons, setLessons] = useState(incident.lessonsLearned ?? '');
  const open = incident.status === 'open';

  return (
    <div style={{ border: '1px solid var(--line-2)', borderRadius: 12, overflow: 'hidden' }}>
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'grid', gridTemplateColumns: '80px minmax(140px, 1fr) 80px 90px',
          gap: 10, alignItems: 'center',
          width: '100%', textAlign: 'left', padding: '10px 14px',
          background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        <span style={{ fontSize: 11, fontFamily: 'var(--font-redesign-mono)', color: 'var(--ink-3)' }}>{incident.date}</span>
        <span style={{ fontSize: 13, color: 'var(--ink-1)' }}>{incident.title}</span>
        <span style={{ fontSize: 11, color: incident.severity === 'critical' || incident.severity === 'high' ? 'var(--ember)' : 'var(--ink-3)', fontFamily: 'var(--font-redesign-mono)' }}>
          {incident.severity}
        </span>
        <span style={{ fontSize: 11, fontWeight: 600, color: open ? 'var(--ember)' : 'var(--mint)', fontFamily: 'var(--font-redesign-mono)' }}>
          {open ? 'OPEN' : `resolved ${incident.resolvedAt}`}
        </span>
      </button>
      {expanded && (
        <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--line-2)', paddingTop: 10 }}>
          <input
            style={inputStyle}
            placeholder="Root cause"
            value={rootCause}
            onChange={e => setRootCause(e.target.value)}
            disabled={!open}
          />
          <input
            style={inputStyle}
            placeholder="Lessons learned"
            value={lessons}
            onChange={e => setLessons(e.target.value)}
            disabled={!open}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onRaiseCapa}
              disabled={!!incident.findingId}
              title={incident.findingId ? 'Finding already raised' : 'Track remediation on the CAPA register'}
            >
              {incident.findingId ? 'Finding raised ✓' : 'Raise CAPA finding'}
            </button>
            {open && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onPatch(r => resolveIncident(r, rootCause, lessons))}
              >
                Mark resolved
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Assets (clause 5/8) ─────────────────────────────────────────────── */

const ASSET_TYPES: AssetType[] = ['Data', 'System', 'Infrastructure', 'People', 'Service', 'Other'];

function AssetRegister({ clientId }: { clientId: string }) {
  const [records, setRecords] = useLocalStorage<AssetRecord[]>('assets', []);
  const safe = useMemo<AssetRecord[]>(() => Array.isArray(records) ? records : [], [records]);
  const rows = useMemo(
    () => safe.filter(r => r.clientId === clientId).sort((a, b) => assetCriticality(b) - assetCriticality(a)),
    [safe, clientId],
  );

  const [name, setName] = useState('');
  const [type, setType] = useState<AssetType>('System');
  const [owner, setOwner] = useState('');

  const add = () => {
    if (!name.trim()) return;
    setRecords(prev => [...(Array.isArray(prev) ? prev : []), newAssetRecord({
      clientId, name: name.trim(), type, owner: owner.trim(),
    })]);
    setName('');
  };

  const patch = (id: string, updater: (r: AssetRecord) => AssetRecord) => {
    setRecords(prev => (Array.isArray(prev) ? prev : []).map(r => r.id === id ? updater(r) : r));
  };

  const remove = (id: string) => {
    const snapshot = safe.find(r => r.id === id);
    setRecords(prev => (Array.isArray(prev) ? prev : []).filter(r => r.id !== id));
    if (snapshot) {
      pushUndo({
        label: 'Asset deleted',
        revert: () => setRecords(prev => {
          const cur = Array.isArray(prev) ? prev : [];
          return cur.some(r => r.id === snapshot.id) ? cur : [...cur, snapshot];
        }),
      });
    }
  };

  const ciaSelect = (r: AssetRecord, prop: 'confidentiality' | 'integrity' | 'availability') => (
    <select
      value={r[prop]}
      aria-label={`${prop} rating for ${r.name}`}
      onChange={e => patch(r.id, a => ({ ...a, [prop]: parseInt(e.target.value, 10) }))}
      style={{ ...inputStyle, width: 52, padding: '3px 6px', fontSize: 11 }}
    >
      {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
    </select>
  );

  return (
    <section className="bubble" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--ink-1)', fontFamily: 'var(--font-redesign-display)' }}>
          Asset register
        </h3>
        <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-redesign-mono)' }}>
          {rows.length} asset{rows.length === 1 ? '' : 's'} · sorted by criticality
        </span>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ marginLeft: 'auto' }}
          onClick={() => { exportAsCsv('asset-register', assetsToCsv(rows)); pushToast('success', 'Asset register exported'); }}
        >
          <Download className="w-3.5 h-3.5" />
          CSV
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 1fr 80px', gap: 8, marginBottom: 12 }}>
        <input style={inputStyle} placeholder="Asset name" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }} />
        <select style={inputStyle} value={type} onChange={e => setType(e.target.value as AssetType)} aria-label="Asset type">
          {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input style={inputStyle} placeholder="Owner" value={owner} onChange={e => setOwner(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); }} />
        <button type="button" className="btn btn-primary" onClick={add} disabled={!name.trim()}>Add</button>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={thStyle}>Asset</th>
            <th style={thStyle}>Type</th>
            <th style={thStyle}>Owner</th>
            <th style={thStyle}>C</th>
            <th style={thStyle}>I</th>
            <th style={thStyle}>A</th>
            <th style={thStyle}>Crit.</th>
            <th style={thStyle} aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const crit = assetCriticality(r);
            return (
              <tr key={r.id}>
                <td style={tdStyle}>{r.name}</td>
                <td style={{ ...tdStyle, fontSize: 11, color: 'var(--ink-3)' }}>{r.type}</td>
                <td style={{ ...tdStyle, fontSize: 11 }}>{r.owner || '—'}</td>
                <td style={tdStyle}>{ciaSelect(r, 'confidentiality')}</td>
                <td style={tdStyle}>{ciaSelect(r, 'integrity')}</td>
                <td style={tdStyle}>{ciaSelect(r, 'availability')}</td>
                <td style={{
                  ...tdStyle, fontWeight: 700, fontFamily: 'var(--font-redesign-mono)',
                  color: crit >= 5 ? 'var(--ember)' : crit >= 4 ? '#F59E0B' : 'var(--ink-2)',
                }}>
                  {crit}
                </td>
                <td style={{ ...tdStyle, width: 34 }}>
                  <button type="button" aria-label={`Delete asset ${r.name}`} onClick={() => remove(r.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: 2, display: 'inline-flex' }}>
                    <Trash2 className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr><td colSpan={8} style={{ ...tdStyle, color: 'var(--ink-3)', fontFamily: 'var(--font-redesign-mono)', fontSize: 11 }}>
              // No assets yet — auditors usually start here: what are you protecting?
            </td></tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
