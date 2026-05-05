import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Edit2, Trash2, X, Users, Target, ChevronDown } from 'lucide-react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { managementClauses } from '../../data/clauses';
import { allControls } from '../../data/controls';
import type {
  RiskItem,
  RiskCategory,
  RiskTreatment,
  RiskStatus,
  Client,
  ApplicableControlRef,
  CiaProperty,
} from '../../data/types';
import { UNASSIGNED_CLIENT_ID } from '../../utils/clientMigration';

// ─── Risk score colour ────────────────────────────────────────────────────────

function riskColor(score: number): string {
  if (score <= 4)  return '#059669';
  if (score <= 9)  return '#00D9A3';
  if (score <= 15) return '#D97706';
  return '#FF4A1C';
}

function riskLabel(score: number): string {
  if (score <= 4)  return 'Low';
  if (score <= 9)  return 'Medium';
  if (score <= 15) return 'High';
  return 'Critical';
}

// ─── 5×5 Risk Matrix ──────────────────────────────────────────────────────────

function RiskMatrix({ risks }: { risks: RiskItem[] }) {
  const CELL_SIZE = 44;
  const LABEL_SIZE = 32;
  const W = LABEL_SIZE + CELL_SIZE * 5;
  const H = LABEL_SIZE + CELL_SIZE * 5;

  const cellColor = (l: number, i: number): string => {
    const score = l * i;
    if (score >= 20) return 'rgba(255,74,28,0.65)';
    if (score >= 12) return 'rgba(255,74,28,0.35)';
    if (score >= 8)  return 'rgba(217,119,6,0.45)';
    if (score >= 4)  return 'rgba(0,217,163,0.25)';
    return 'rgba(5,150,105,0.18)';
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: 'block' }}>
        <text
          x={-H / 2 + LABEL_SIZE} y={11}
          textAnchor="middle" fontSize={9}
          fill="var(--color-text-muted)"
          fontFamily='"JetBrains Mono", monospace'
          transform="rotate(-90)" letterSpacing="0.05em"
        >IMPACT →</text>
        <text
          x={LABEL_SIZE + CELL_SIZE * 5 / 2} y={H - 2}
          textAnchor="middle" fontSize={9}
          fill="var(--color-text-muted)"
          fontFamily='"JetBrains Mono", monospace' letterSpacing="0.05em"
        >LIKELIHOOD →</text>

        {[5, 4, 3, 2, 1].map((impact, row) =>
          [1, 2, 3, 4, 5].map((likelihood, col) => {
            const x = LABEL_SIZE + col * CELL_SIZE;
            const y = row * CELL_SIZE;
            const score = likelihood * impact;
            return (
              <g key={`${impact}-${likelihood}`}>
                <rect
                  x={x} y={y}
                  width={CELL_SIZE - 1} height={CELL_SIZE - 1}
                  rx={4} fill={cellColor(likelihood, impact)}
                />
                <text
                  x={x + CELL_SIZE / 2} y={y + CELL_SIZE / 2 + 4}
                  textAnchor="middle" fontSize={9}
                  fill="rgba(26,35,50,0.55)"
                  fontFamily='"JetBrains Mono", monospace' fontWeight={600}
                >{score}</text>
                {risks
                  .filter(r => r.likelihood === likelihood && r.impact === impact)
                  .map((risk, i) => (
                    <circle
                      key={risk.id}
                      cx={x + CELL_SIZE / 2 + (i % 3 - 1) * 10}
                      cy={y + 10 + Math.floor(i / 3) * 10}
                      r={5}
                      fill={riskColor(risk.score)}
                      stroke="white" strokeWidth={1.5}
                      style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.2))' }}
                    >
                      <title>{risk.name} (score: {risk.score})</title>
                    </circle>
                  ))
                }
              </g>
            );
          })
        )}

        {[1, 2, 3, 4, 5].map((v, i) => (
          <g key={v}>
            <text
              x={LABEL_SIZE + i * CELL_SIZE + CELL_SIZE / 2}
              y={CELL_SIZE * 5 + 18}
              textAnchor="middle" fontSize={8}
              fill="var(--color-text-muted)"
              fontFamily='"JetBrains Mono", monospace'
            >{v}</text>
            <text
              x={LABEL_SIZE - 6}
              y={(4 - i) * CELL_SIZE + CELL_SIZE / 2 + 4}
              textAnchor="end" fontSize={8}
              fill="var(--color-text-muted)"
              fontFamily='"JetBrains Mono", monospace'
            >{v + 1 === 6 ? 5 : v}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ─── Risk score pill ──────────────────────────────────────────────────────────

function ScorePill({ score }: { score: number }) {
  const color = riskColor(score);
  const label = riskLabel(score);
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
      style={{
        background: `${color}18`,
        border: `1px solid ${color}40`,
        color,
        fontFamily: '"JetBrains Mono", monospace',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
      {score} · {label}
    </span>
  );
}

// ─── Applicable controls multi-picker ─────────────────────────────────────────
// Lightweight: searchable combobox that appends `ApplicableControlRef` chips.
// Custom free-text goes through the "+ Add custom" button at the bottom.

function ApplicableControlsPicker({
  selected,
  onChange,
}: {
  selected: ApplicableControlRef[];
  onChange: (next: ApplicableControlRef[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedKey = (r: ApplicableControlRef) => `${r.type}:${r.value}`;
  const selectedSet = useMemo(() => new Set(selected.map(selectedKey)), [selected]);

  // Build a flat searchable option list from clauses + controls.
  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    const clauseOpts = managementClauses.map(c => ({
      type: 'clause' as const,
      value: c.id,
      label: `Clause ${c.id} — ${c.title}`,
    }));
    const controlOpts = allControls.map(c => ({
      type: 'control' as const,
      value: c.id,
      label: `${c.id} ${c.title}`,
    }));
    const all = [...clauseOpts, ...controlOpts];
    if (!q) return all.slice(0, 20);
    return all
      .filter(o => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q))
      .slice(0, 20);
  }, [query]);

  const add = (ref: ApplicableControlRef) => {
    if (selectedSet.has(selectedKey(ref))) return;
    onChange([...selected, ref]);
  };
  const remove = (ref: ApplicableControlRef) => {
    onChange(selected.filter(r => selectedKey(r) !== selectedKey(ref)));
  };

  const addCustom = () => {
    const v = query.trim();
    if (!v) return;
    if (selectedSet.has(`custom:${v}`)) return;
    onChange([...selected, { type: 'custom', value: v }]);
    setQuery('');
  };

  const chipColor = (t: ApplicableControlRef['type']) =>
    t === 'clause' ? '#00D9A3' : t === 'control' ? '#8B5CF6' : '#D97706';

  return (
    <div>
      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map(ref => {
            const c = chipColor(ref.type);
            return (
              <span
                key={selectedKey(ref)}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs"
                style={{
                  background: `${c}18`,
                  border: `1px solid ${c}40`,
                  color: c,
                  fontFamily: '"JetBrains Mono", monospace',
                }}
              >
                <span style={{ opacity: 0.7 }}>{ref.type}</span>
                <span style={{ color: 'var(--color-text-primary)' }}>{ref.value}</span>
                <button
                  type="button"
                  onClick={() => remove(ref)}
                  aria-label={`Remove ${ref.value}`}
                  style={{ background: 'transparent', border: 'none', color: c, cursor: 'pointer', padding: 0 }}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search clauses or Annex A controls, or type a custom entry…"
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface-alt)',
            color: 'var(--color-text-primary)',
            fontSize: '13px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {open && (options.length > 0 || query.trim()) && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0, right: 0,
              zIndex: 10,
              maxHeight: 220,
              overflowY: 'auto',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
            }}
          >
            {options.map(opt => (
              <button
                key={`${opt.type}:${opt.value}`}
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => add({ type: opt.type, value: opt.value })}
                disabled={selectedSet.has(`${opt.type}:${opt.value}`)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 12px',
                  fontSize: '12px',
                  color: selectedSet.has(`${opt.type}:${opt.value}`)
                    ? 'var(--color-text-muted)'
                    : 'var(--color-text-primary)',
                  background: 'transparent',
                  border: 'none',
                  cursor: selectedSet.has(`${opt.type}:${opt.value}`) ? 'default' : 'pointer',
                  opacity: selectedSet.has(`${opt.type}:${opt.value}`) ? 0.5 : 1,
                }}
              >
                <span style={{ color: chipColor(opt.type), fontWeight: 600, marginRight: 8, fontFamily: '"JetBrains Mono", monospace', fontSize: 10 }}>
                  {opt.type.toUpperCase()}
                </span>
                {opt.label}
              </button>
            ))}
            {query.trim() && (
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={addCustom}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '8px 12px', fontSize: '12px',
                  color: '#D97706', fontWeight: 600,
                  background: 'transparent', border: 'none',
                  borderTop: options.length > 0 ? '1px solid var(--color-border)' : 'none',
                  cursor: 'pointer',
                }}
              >
                + Add custom: "{query.trim()}"
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Add/Edit Modal ───────────────────────────────────────────────────────────

type RiskFormData = Omit<RiskItem, 'id' | 'score'>;

const blankRisk = (clientId: string): RiskFormData => ({
  name: '',
  description: '',
  category: 'Technical',
  likelihood: 3,
  impact: 3,
  treatment: 'Mitigate',
  owner: '',
  dueDate: '',
  status: 'Open',
  clientId,
  treatmentDescription: '',
  applicableControls: [],
  cia: [],
});

interface RiskFormProps {
  initial?: RiskItem;
  defaultClientId: string;
  clients: Client[];
  appetiteThreshold: number | null;
  onSave: (risk: Omit<RiskItem, 'id'>) => void;
  onClose: () => void;
}

function RiskForm({ initial, defaultClientId, clients, appetiteThreshold, onSave, onClose }: RiskFormProps) {
  const [form, setForm] = useState<RiskFormData>(
    initial
      ? {
          name: initial.name, description: initial.description, category: initial.category,
          likelihood: initial.likelihood, impact: initial.impact, treatment: initial.treatment,
          owner: initial.owner, dueDate: initial.dueDate, status: initial.status,
          clientId: initial.clientId ?? defaultClientId,
          treatmentDescription: initial.treatmentDescription ?? '',
          applicableControls: initial.applicableControls ?? [],
          cia: initial.cia ?? [],
        }
      : blankRisk(defaultClientId)
  );

  const score = form.likelihood * form.impact;
  const autoAccept = appetiteThreshold !== null && score <= appetiteThreshold;

  // When appetite triggers and the user hasn't manually chosen a different
  // treatment, pre-fill "Accept". They can still override — we only nudge.
  useEffect(() => {
    if (autoAccept && form.treatment === 'Mitigate') {
      setForm(prev => ({ ...prev, treatment: 'Accept' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAccept]);

  function field<K extends keyof RiskFormData>(key: K, value: RiskFormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  const toggleCia = (v: CiaProperty) => {
    const cur = form.cia ?? [];
    field('cia', cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v]);
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '11px', fontWeight: 600,
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.08em',
    fontFamily: '"JetBrains Mono", monospace',
    marginBottom: '4px', display: 'block',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: '8px',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface-alt)',
    color: 'var(--color-text-primary)',
    fontSize: '13px', outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(26,35,50,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        className="card-elevated w-full max-w-xl mx-4"
        style={{ maxHeight: '90vh', overflowY: 'auto', padding: '28px' }}
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2 }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>
            {initial ? 'Edit risk' : 'Add risk'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: 'var(--color-text-muted)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Client picker */}
          <div>
            <label style={labelStyle}>Client *</label>
            <select
              style={inputStyle}
              value={form.clientId ?? UNASSIGNED_CLIENT_ID}
              onChange={e => field('clientId', e.target.value)}
            >
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Risk name *</label>
            <input
              style={inputStyle}
              placeholder="e.g. Unpatched WordPress core"
              value={form.name}
              onChange={e => field('name', e.target.value)}
            />
          </div>

          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }}
              placeholder="Describe the risk, its source, and potential impact..."
              value={form.description}
              onChange={e => field('description', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label style={labelStyle}>Category</label>
              <select style={inputStyle} value={form.category} onChange={e => field('category', e.target.value as RiskCategory)}>
                {(['Operational', 'Technical', 'Legal', 'People', 'Third Party'] as RiskCategory[]).map(c => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Treatment</label>
              <select style={inputStyle} value={form.treatment} onChange={e => field('treatment', e.target.value as RiskTreatment)}>
                {(['Mitigate', 'Accept', 'Transfer', 'Avoid'] as RiskTreatment[]).map(t => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              {autoAccept && form.treatment === 'Accept' && (
                <div
                  className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs"
                  style={{ background: 'rgba(0,217,163,0.12)', color: '#00B589', fontFamily: '"JetBrains Mono", monospace' }}
                >
                  auto-set per appetite threshold
                </div>
              )}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Treatment description</label>
            <textarea
              style={{ ...inputStyle, minHeight: 52, resize: 'vertical' }}
              placeholder="How will the treatment be executed? Who owns which step?"
              value={form.treatmentDescription ?? ''}
              onChange={e => field('treatmentDescription', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label style={labelStyle}>Likelihood (1–5)</label>
              <input
                type="range" min={1} max={5} step={1}
                value={form.likelihood}
                onChange={e => field('likelihood', Number(e.target.value) as 1|2|3|4|5)}
                style={{ width: '100%', accentColor: '#00D9A3' }}
              />
              <div className="flex justify-between mt-1">
                {[1,2,3,4,5].map(v => (
                  <span key={v} style={{ fontSize: '10px', color: v === form.likelihood ? 'var(--color-mint)' : 'var(--color-text-muted)', fontWeight: v === form.likelihood ? 700 : 400, fontFamily: '"JetBrains Mono", monospace' }}>{v}</span>
                ))}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Impact (1–5)</label>
              <input
                type="range" min={1} max={5} step={1}
                value={form.impact}
                onChange={e => field('impact', Number(e.target.value) as 1|2|3|4|5)}
                style={{ width: '100%', accentColor: '#00D9A3' }}
              />
              <div className="flex justify-between mt-1">
                {[1,2,3,4,5].map(v => (
                  <span key={v} style={{ fontSize: '10px', color: v === form.impact ? 'var(--color-mint)' : 'var(--color-text-muted)', fontWeight: v === form.impact ? 700 : 400, fontFamily: '"JetBrains Mono", monospace' }}>{v}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 py-2 px-4 rounded-xl" style={{ background: `${riskColor(score)}12`, border: `1px solid ${riskColor(score)}30` }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Risk score:</span>
            <ScorePill score={score} />
            {appetiteThreshold !== null && (
              <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--color-text-muted)', fontFamily: '"JetBrains Mono", monospace' }}>
                appetite ≤ {appetiteThreshold}
              </span>
            )}
          </div>

          {/* CIA chips */}
          <div>
            <label style={labelStyle}>CIA properties affected</label>
            <div className="flex gap-2">
              {(['C', 'I', 'A'] as CiaProperty[]).map(v => {
                const selected = (form.cia ?? []).includes(v);
                const full = v === 'C' ? 'Confidentiality' : v === 'I' ? 'Integrity' : 'Availability';
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => toggleCia(v)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: selected ? 'rgba(0,217,163,0.15)' : 'var(--color-surface-alt)',
                      border: `1px solid ${selected ? '#00D9A3' : 'var(--color-border)'}`,
                      color: selected ? '#00B589' : 'var(--color-text-muted)',
                      fontFamily: '"JetBrains Mono", monospace',
                    }}
                    aria-pressed={selected}
                  >
                    {v} · {full}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Applicable controls */}
          <div>
            <label style={labelStyle}>Applicable clauses / controls</label>
            <ApplicableControlsPicker
              selected={form.applicableControls ?? []}
              onChange={next => field('applicableControls', next)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label style={labelStyle}>Owner</label>
              <input
                style={inputStyle}
                placeholder="e.g. CISO, IT Manager"
                value={form.owner}
                onChange={e => field('owner', e.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>Due date</label>
              <input
                type="date"
                style={inputStyle}
                value={form.dueDate}
                onChange={e => field('dueDate', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Status</label>
            <select style={inputStyle} value={form.status} onChange={e => field('status', e.target.value as RiskStatus)}>
              {(['Open', 'In Treatment', 'Closed'] as RiskStatus[]).map(s => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium"
            style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!form.name.trim()) return;
              onSave({ ...form, score });
            }}
            disabled={!form.name.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold"
            style={{
              background: form.name.trim() ? '#00D9A3' : 'var(--color-border)',
              color: form.name.trim() ? '#1A2332' : 'var(--color-text-muted)',
              border: 'none',
              cursor: form.name.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            {initial ? 'Save changes' : 'Add risk'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Appetite panel ───────────────────────────────────────────────────────────

function AppetitePanel({
  clientName,
  threshold,
  onChange,
}: {
  clientName: string;
  threshold: number | null;
  onChange: (next: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(threshold?.toString() ?? '');

  useEffect(() => { setDraft(threshold?.toString() ?? ''); }, [threshold]);

  return (
    <div className="card-elevated p-4 flex items-center gap-4">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(0,217,163,0.12)' }}
      >
        <Target className="w-4 h-4" style={{ color: '#00B589' }} />
      </div>
      <div className="flex-1 min-w-0">
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          Risk appetite — {clientName}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
          Risks scoring at or below this threshold auto-pre-fill as <span style={{ color: '#00B589', fontWeight: 600 }}>Accept</span>.
        </div>
      </div>
      {editing ? (
        <>
          <input
            type="number" min={1} max={25}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="e.g. 6"
            style={{
              width: 80, padding: '6px 10px',
              borderRadius: 8, border: '1px solid var(--color-border)',
              background: 'var(--color-surface-alt)', color: 'var(--color-text-primary)',
              fontSize: 13, outline: 'none', fontFamily: '"JetBrains Mono", monospace',
            }}
          />
          <button
            onClick={() => {
              const n = Number(draft);
              onChange(draft.trim() === '' || Number.isNaN(n) ? null : Math.max(1, Math.min(25, n)));
              setEditing(false);
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: '#00D9A3', color: '#1A2332', border: 'none' }}
          >Save</button>
          <button
            onClick={() => { setDraft(threshold?.toString() ?? ''); setEditing(false); }}
            className="px-3 py-1.5 rounded-lg text-xs"
            style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
          >Cancel</button>
        </>
      ) : (
        <>
          <div style={{ fontSize: '13px', fontFamily: '"JetBrains Mono", monospace', color: threshold === null ? 'var(--color-text-muted)' : 'var(--color-text-primary)' }}>
            {threshold === null ? 'not set' : `≤ ${threshold}`}
          </div>
          <button
            onClick={() => setEditing(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}
          >Edit</button>
        </>
      )}
    </div>
  );
}

// ─── Cross-client dashboard (All clients view) ────────────────────────────────

function CrossClientDashboard({ risks, clients }: { risks: RiskItem[]; clients: Client[] }) {
  const byClient = useMemo(() => {
    const m = new Map<string, RiskItem[]>();
    for (const r of risks) {
      const cid = r.clientId ?? UNASSIGNED_CLIENT_ID;
      if (!m.has(cid)) m.set(cid, []);
      m.get(cid)!.push(r);
    }
    return m;
  }, [risks]);

  const topOpen = useMemo(
    () => [...risks].filter(r => r.status !== 'Closed').sort((a, b) => b.score - a.score).slice(0, 10),
    [risks]
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="card-elevated p-5">
          <h3 className="font-semibold text-sm mb-4" style={{ color: 'var(--color-text-primary)' }}>
            Risk matrix — all clients
          </h3>
          <RiskMatrix risks={risks} />
        </div>
        <div className="card-elevated p-5">
          <h3 className="font-semibold text-sm mb-3" style={{ color: 'var(--color-text-primary)' }}>
            Per-client breakdown
          </h3>
          {clients.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>// No clients</div>
          ) : (
            <div className="space-y-2">
              {clients.map(c => {
                const list = byClient.get(c.id) ?? [];
                const open = list.filter(r => r.status !== 'Closed').length;
                const crit = list.filter(r => r.score > 15).length;
                return (
                  <div key={c.id} className="flex items-center gap-3 py-1.5" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.name}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: '"JetBrains Mono", monospace' }}>
                      {list.length} total
                    </span>
                    <span style={{ fontSize: 11, color: '#D97706', fontFamily: '"JetBrains Mono", monospace', minWidth: 50, textAlign: 'right' }}>
                      {open} open
                    </span>
                    <span style={{ fontSize: 11, color: '#FF4A1C', fontFamily: '"JetBrains Mono", monospace', minWidth: 50, textAlign: 'right' }}>
                      {crit} crit
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="card-elevated p-5">
        <h3 className="font-semibold text-sm mb-3" style={{ color: 'var(--color-text-primary)' }}>
          Top 10 open risks (all clients)
        </h3>
        {topOpen.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', fontFamily: '"JetBrains Mono", monospace' }}>
            // No open risks
          </div>
        ) : (
          <div className="space-y-1.5">
            {topOpen.map(r => {
              const client = clients.find(c => c.id === r.clientId);
              return (
                <div key={r.id} className="flex items-center gap-3 py-1.5" style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <ScorePill score={r.score} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.name}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    {client?.name ?? 'Unassigned'}
                  </span>
                  <span
                    className="px-2 py-0.5 rounded-full text-xs"
                    style={{
                      background: r.status === 'In Treatment' ? 'rgba(0,217,163,0.1)' : 'rgba(217,119,6,0.1)',
                      color: r.status === 'In Treatment' ? '#00B589' : '#D97706',
                      fontWeight: 600,
                    }}
                  >
                    {r.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Risk Hub ────────────────────────────────────────────────────────────
// Scope picker at top: "All clients" → CrossClientDashboard, or pick a client
// → per-client matrix + table + appetite panel.

export default function RiskRegister() {
  const [risks, setRisks] = useLocalStorage<RiskItem[]>('post-watch:risks', []);
  const [clients] = useLocalStorage<Client[]>('clients', []);
  const [scope, setScope] = useState<'all' | string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingRisk, setEditingRisk] = useState<RiskItem | null>(null);
  const [sortBy, setSortBy] = useState<'score' | 'name' | 'status'>('score');
  const [filterStatus, setFilterStatus] = useState<RiskStatus | 'All'>('All');

  // Per-client appetite threshold. Stored as one JSON map under a single key
  // so we only mount one hook regardless of client count.
  const [appetiteMap, setAppetiteMap] = useLocalStorage<Record<string, number>>(
    'post-watch:risk-appetite',
    {}
  );

  const safeRisks: RiskItem[] = Array.isArray(risks) ? risks : [];
  const safeClients: Client[] = Array.isArray(clients) ? clients : [];

  // The scope selector always includes "Unassigned" so pre-V2.1 data stays
  // reachable even if the user deleted every other client.
  const pickerClients = useMemo<Client[]>(() => {
    if (safeClients.some(c => c.id === UNASSIGNED_CLIENT_ID)) return safeClients;
    return [
      { id: UNASSIGNED_CLIENT_ID, name: 'Unassigned', createdAt: new Date(0).toISOString() },
      ...safeClients,
    ];
  }, [safeClients]);

  const scopedRisks = useMemo(() => {
    if (scope === 'all') return safeRisks;
    return safeRisks.filter(r => (r.clientId ?? UNASSIGNED_CLIENT_ID) === scope);
  }, [safeRisks, scope]);

  const sorted = useMemo(() => {
    let r = scopedRisks.filter(risk => filterStatus === 'All' || risk.status === filterStatus);
    if (sortBy === 'score') r = [...r].sort((a, b) => b.score - a.score);
    else if (sortBy === 'name') r = [...r].sort((a, b) => a.name.localeCompare(b.name));
    else r = [...r].sort((a, b) => a.status.localeCompare(b.status));
    return r;
  }, [scopedRisks, sortBy, filterStatus]);

  const currentClient = useMemo(
    () => pickerClients.find(c => c.id === scope) ?? null,
    [pickerClients, scope]
  );

  const currentThreshold: number | null =
    scope === 'all' || !appetiteMap || typeof appetiteMap[scope] !== 'number'
      ? null
      : appetiteMap[scope];

  const defaultClientIdForNew =
    scope === 'all'
      ? (pickerClients[0]?.id ?? UNASSIGNED_CLIENT_ID)
      : scope;

  function addRisk(data: Omit<RiskItem, 'id'>) {
    setRisks(prev => [
      ...(Array.isArray(prev) ? prev : []),
      { ...data, id: crypto.randomUUID() },
    ]);
    setShowForm(false);
  }

  function updateRisk(data: Omit<RiskItem, 'id'>) {
    if (!editingRisk) return;
    setRisks(prev =>
      (Array.isArray(prev) ? prev : []).map(r =>
        r.id === editingRisk.id ? { ...data, id: r.id } : r
      )
    );
    setEditingRisk(null);
  }

  function deleteRisk(id: string) {
    setRisks(prev => (Array.isArray(prev) ? prev : []).filter(r => r.id !== id));
  }

  function setThreshold(next: number | null) {
    if (scope === 'all') return;
    setAppetiteMap(prev => {
      const map = { ...(prev ?? {}) };
      if (next === null) delete map[scope];
      else map[scope] = next;
      return map;
    });
  }

  const stats = useMemo(() => ({
    total: scopedRisks.length,
    critical: scopedRisks.filter(r => r.score > 15).length,
    high: scopedRisks.filter(r => r.score > 9 && r.score <= 15).length,
    open: scopedRisks.filter(r => r.status === 'Open').length,
  }), [scopedRisks]);

  return (
    <div className="flex flex-col h-full overflow-auto">
      <div className="p-8 space-y-6">

        {/* Brand kicker — matches the PDF cover and other modules */}
        <span className="mono-tag">risk hub</span>

        {/* Scope selector + Add */}
        <div className="flex items-center gap-3 flex-wrap">
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)' }}
          >
            <Users className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.05em' }}>
              SCOPE
            </span>
            <div style={{ position: 'relative' }}>
              <select
                value={scope}
                onChange={e => setScope(e.target.value)}
                style={{
                  appearance: 'none',
                  padding: '4px 28px 4px 10px',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  color: 'var(--color-text-primary)',
                  fontSize: 13, fontWeight: 600,
                  outline: 'none', cursor: 'pointer',
                }}
              >
                <option value="all">All clients</option>
                {pickerClients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <ChevronDown
                className="w-3.5 h-3.5"
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--color-text-muted)' }}
              />
            </div>
          </div>

          {/* Stats pills */}
          <div className="flex items-center gap-4 ml-2">
            {[
              { label: 'Total', value: stats.total, color: 'var(--color-text-muted)' },
              { label: 'Critical', value: stats.critical, color: '#FF4A1C' },
              { label: 'High', value: stats.high, color: '#D97706' },
              { label: 'Open', value: stats.open, color: '#00D9A3' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-1.5">
                <span style={{ fontSize: '22px', fontWeight: 800, color: s.color, fontFamily: 'var(--font-display)', lineHeight: 1 }}>{s.value}</span>
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: '"JetBrains Mono", monospace' }}>{s.label.toLowerCase()}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => setShowForm(true)}
            className="ml-auto flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: '#00D9A3', color: '#1A2332', border: 'none' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#00B589'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#00D9A3'; }}
          >
            <Plus className="w-4 h-4" />
            Add risk
          </button>
        </div>

        {/* Per-client appetite panel */}
        {scope !== 'all' && currentClient && (
          <AppetitePanel
            clientName={currentClient.name}
            threshold={currentThreshold}
            onChange={setThreshold}
          />
        )}

        {scope === 'all' ? (
          <CrossClientDashboard risks={safeRisks} clients={pickerClients} />
        ) : (
          <>
            {/* Matrix + distribution */}
            <div className="grid grid-cols-2 gap-6">
              <div className="card-elevated p-5">
                <h3 className="font-semibold text-sm mb-4" style={{ color: 'var(--color-text-primary)' }}>
                  Risk matrix
                </h3>
                <RiskMatrix risks={scopedRisks} />
                <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: 8, fontFamily: '"JetBrains Mono", monospace' }}>
                  // Dots represent individual risks at their Likelihood × Impact position
                </p>
              </div>

              <div className="card-elevated p-5 flex flex-col gap-3">
                <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--color-text-primary)' }}>
                  Risk distribution
                </h3>
                {scopedRisks.length === 0 ? (
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontFamily: '"JetBrains Mono", monospace', paddingTop: 16 }}>
                    // No risks for this client yet
                  </div>
                ) : (
                  <>
                    {[
                      { label: 'Critical (16–25)', count: scopedRisks.filter(r => r.score > 15).length, color: '#FF4A1C' },
                      { label: 'High (10–15)',     count: scopedRisks.filter(r => r.score > 9 && r.score <= 15).length, color: '#D97706' },
                      { label: 'Medium (5–9)',     count: scopedRisks.filter(r => r.score >= 5 && r.score <= 9).length, color: '#00D9A3' },
                      { label: 'Low (1–4)',        count: scopedRisks.filter(r => r.score < 5).length, color: '#059669' },
                    ].map(row => (
                      <div key={row.label} className="flex items-center gap-3">
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: row.color, flexShrink: 0 }} />
                        <span style={{ fontSize: '12px', flex: 1, color: 'var(--color-text-secondary)' }}>{row.label}</span>
                        <span style={{ fontWeight: 700, color: row.count > 0 ? row.color : 'var(--color-text-muted)', fontFamily: '"JetBrains Mono", monospace', fontSize: '13px' }}>{row.count}</span>
                        {scopedRisks.length > 0 && (
                          <div style={{ width: 80, height: 6, borderRadius: 3, background: 'var(--color-border)' }}>
                            <div style={{ width: `${(row.count / scopedRisks.length) * 100}%`, height: '100%', borderRadius: 3, background: row.color, transition: 'width 0.4s ease' }} />
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)' }}>
                {(['All', 'Open', 'In Treatment', 'Closed'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                    style={{
                      background: filterStatus === s ? 'var(--color-surface)' : 'transparent',
                      color: filterStatus === s ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                      boxShadow: filterStatus === s ? 'var(--shadow-card)' : 'none',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Sort:</span>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as typeof sortBy)}
                  style={{
                    padding: '4px 8px', borderRadius: '6px',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    color: 'var(--color-text-primary)',
                    fontSize: '12px', outline: 'none',
                  }}
                >
                  <option value="score">Risk score</option>
                  <option value="name">Name</option>
                  <option value="status">Status</option>
                </select>
              </div>
            </div>

            {/* Table */}
            {sorted.length === 0 ? (
              <div
                className="card-elevated flex flex-col items-center justify-center py-16 gap-3"
                style={{ color: 'var(--color-text-muted)' }}
              >
                <span style={{ fontSize: '32px', opacity: 0.4 }}>⚠</span>
                <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '12px' }}>
                  {scopedRisks.length === 0 ? '// No risks for this client yet' : '// No risks match this filter'}
                </span>
                {scopedRisks.length === 0 && (
                  <button
                    onClick={() => setShowForm(true)}
                    style={{ color: 'var(--color-mint)', fontSize: '13px', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    + Add the first risk
                  </button>
                )}
              </div>
            ) : (
              <div className="card-elevated overflow-hidden">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      {['Risk', 'Category', 'Score', 'Treatment', 'CIA', 'Owner', 'Due', 'Status', ''].map(h => (
                        <th
                          key={h}
                          style={{
                            padding: '10px 16px', textAlign: 'left',
                            fontSize: '10px', fontWeight: 600,
                            textTransform: 'uppercase', letterSpacing: '0.08em',
                            color: 'var(--color-text-muted)',
                            fontFamily: '"JetBrains Mono", monospace',
                            background: 'var(--color-surface)', whiteSpace: 'nowrap',
                          }}
                        >{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {sorted.map((risk, i) => (
                        <motion.tr
                          key={risk.id}
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ delay: i * 0.02 }}
                          style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
                        >
                          <td style={{ padding: '12px 16px', maxWidth: 220 }}>
                            <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {risk.name}
                            </div>
                            {risk.description && (
                              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                                {risk.description}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: '"JetBrains Mono", monospace' }}>
                              {risk.category}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <ScorePill score={risk.score} />
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{risk.treatment}</span>
                          </td>
                          <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: '"JetBrains Mono", monospace', letterSpacing: '0.05em' }}>
                              {(risk.cia && risk.cia.length > 0) ? risk.cia.join('/') : '—'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{risk.owner || '—'}</span>
                          </td>
                          <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontFamily: '"JetBrains Mono", monospace' }}>
                              {risk.dueDate ? new Date(risk.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span
                              className="px-2 py-0.5 rounded-full text-xs"
                              style={{
                                background: risk.status === 'Closed' ? 'rgba(5,150,105,0.1)' : risk.status === 'In Treatment' ? 'rgba(0,217,163,0.1)' : 'rgba(217,119,6,0.1)',
                                color: risk.status === 'Closed' ? '#059669' : risk.status === 'In Treatment' ? '#00B589' : '#D97706',
                                fontWeight: 600,
                              }}
                            >
                              {risk.status}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => setEditingRisk(risk)}
                                className="p-1.5 rounded-lg transition-colors"
                                style={{ color: 'var(--color-text-muted)' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-primary)'; (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-alt)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => deleteRisk(risk.id)}
                                className="p-1.5 rounded-lg transition-colors"
                                style={{ color: 'var(--color-text-muted)' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#FF4A1C'; (e.currentTarget as HTMLElement).style.background = '#FFF1EE'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--color-text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showForm && (
          <RiskForm
            defaultClientId={defaultClientIdForNew}
            clients={pickerClients}
            appetiteThreshold={
              scope === 'all' ? null : currentThreshold
            }
            onSave={addRisk}
            onClose={() => setShowForm(false)}
          />
        )}
        {editingRisk && (
          <RiskForm
            initial={editingRisk}
            defaultClientId={editingRisk.clientId ?? defaultClientIdForNew}
            clients={pickerClients}
            appetiteThreshold={
              (() => {
                const cid = editingRisk.clientId ?? UNASSIGNED_CLIENT_ID;
                const v = appetiteMap?.[cid];
                return typeof v === 'number' ? v : null;
              })()
            }
            onSave={updateRisk}
            onClose={() => setEditingRisk(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
