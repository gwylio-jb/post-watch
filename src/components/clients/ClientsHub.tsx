/**
 * Clients hub — the central directory of billable engagements.
 *
 * V2.1 introduces a client-centric data model: risks, audits and scans all
 * attach to a `clientId`. This hub is where clients are created, edited and
 * deleted, and it's also the foundation Sprint 2 builds on.
 *
 * Storage: localStorage key `clients` (prefixed to `clause-control:clients`
 * by useLocalStorage).
 *
 * Sprint 10 redesign: page wrapped in .page > .hero + .bubble shell.
 * Card grid keeps client cards but on the new glass surface; modal form
 * uses redesign tokens. Existing CRUD logic is unchanged.
 */

import { useState, useMemo } from 'react';
import { Plus, Search, Building2, Pencil, Trash2, Image as ImageIcon, X } from 'lucide-react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import type { Client } from '../../data/types';

// ─── Utilities ────────────────────────────────────────────────────────────────

function newId(): string {
  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Compress + encode an image File to a base64 data URL, max ~512 KB. */
async function fileToDataUrl(file: File): Promise<string> {
  if (file.size > 512 * 1024) {
    throw new Error(`Logo is ${(file.size / 1024).toFixed(0)} KB — max 512 KB.`);
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

// ─── Form modal ───────────────────────────────────────────────────────────────

interface ClientFormProps {
  initial?: Client;
  onSave: (client: Client) => void;
  onClose: () => void;
}

const formInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: 10,
  border: '1px solid var(--line-2)',
  background: 'var(--bg-2)',
  color: 'var(--ink-1)',
  fontSize: 13,
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

const formLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--ink-3)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontFamily: 'var(--font-redesign-mono)',
  marginBottom: 6,
};

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label style={formLabelStyle}>
        {label}
        {required && <span style={{ color: 'var(--ember)', marginLeft: 4 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function ClientForm({ initial, onSave, onClose }: ClientFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [logo, setLogo] = useState<string | undefined>(initial?.logo);
  const [industry, setIndustry] = useState(initial?.industry ?? '');
  const [primaryContact, setPrimaryContact] = useState(initial?.primaryContact ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [logoError, setLogoError] = useState<string | null>(null);

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLogoError(null);
    try {
      const url = await fileToDataUrl(file);
      setLogo(url);
    } catch (err) {
      setLogoError((err as Error).message);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave({
      id: initial?.id ?? newId(),
      name: trimmed,
      logo,
      industry: industry.trim() || undefined,
      primaryContact: primaryContact.trim() || undefined,
      notes: notes.trim() || undefined,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(10,14,21,0.78)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <form
        className="bubble"
        style={{
          width: '100%', maxWidth: 520,
          maxHeight: '85vh',
          display: 'flex', flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="card-head">
          <div>
            <span className="kicker">{initial ? 'edit client' : 'new client'}</span>
            <h3>{initial ? 'Edit client' : 'Add client'}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ padding: 6, borderRadius: 8, color: 'var(--ink-3)', background: 'transparent', border: 0, cursor: 'pointer' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 22px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Logo */}
          <div>
            <label style={formLabelStyle}>Logo (optional, max 512 KB)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 64, height: 64, borderRadius: 14,
                  display: 'grid', placeItems: 'center',
                  overflow: 'hidden', flexShrink: 0,
                  background: 'var(--bg-2)', border: '1px solid var(--line-2)',
                }}
              >
                {logo ? (
                  <img src={logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <ImageIcon className="w-5 h-5" style={{ color: 'var(--ink-3)' }} />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '6px 12px', borderRadius: 10,
                    fontSize: 12, fontWeight: 500,
                    cursor: 'pointer',
                    background: 'var(--bg-2)',
                    border: '1px solid var(--line-2)',
                    color: 'var(--ink-2)',
                  }}
                >
                  {logo ? 'Replace logo' : 'Upload logo'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml"
                    onChange={handleLogoChange}
                    style={{ display: 'none' }}
                  />
                </label>
                {logo && (
                  <button
                    type="button"
                    onClick={() => setLogo(undefined)}
                    style={{ marginLeft: 8, fontSize: 11, color: 'var(--ink-3)', background: 'transparent', border: 0, cursor: 'pointer' }}
                  >
                    Remove
                  </button>
                )}
                {logoError && (
                  <div style={{ fontSize: 11, marginTop: 4, color: 'var(--ember)', fontFamily: 'var(--font-redesign-mono)' }}>
                    {logoError}
                  </div>
                )}
              </div>
            </div>
          </div>

          <Field label="Client name" required>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Acme Corp"
              required
              autoFocus
              style={formInputStyle}
            />
          </Field>

          <Field label="Industry">
            <input
              type="text"
              value={industry}
              onChange={e => setIndustry(e.target.value)}
              placeholder="e.g. E-commerce, SaaS, Legal"
              style={formInputStyle}
            />
          </Field>

          <Field label="Primary contact">
            <input
              type="text"
              value={primaryContact}
              onChange={e => setPrimaryContact(e.target.value)}
              placeholder="Name + email or phone"
              style={formInputStyle}
            />
          </Field>

          <Field label="Notes">
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Engagement scope, access details, anything worth remembering."
              rows={3}
              style={{ ...formInputStyle, resize: 'vertical', minHeight: 72 }}
            />
          </Field>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 22px', borderTop: '1px dashed var(--line-2)' }}>
          <button type="button" onClick={onClose} className="btn btn-ghost" style={{ padding: '8px 16px' }}>
            Cancel
          </button>
          <button type="submit" disabled={!name.trim()} className="btn btn-primary" style={{ padding: '8px 16px' }}>
            {initial ? 'Save changes' : 'Add client'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Main hub ────────────────────────────────────────────────────────────────

export default function ClientsHub() {
  const [clients, setClients] = useLocalStorage<Client[]>('clients', []);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Client | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  // useMemo for stable identity — the consuming useMemos depend on `list`.
  const list = useMemo<Client[]>(() => Array.isArray(clients) ? clients : [], [clients]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        c.industry?.toLowerCase().includes(q) ||
        c.primaryContact?.toLowerCase().includes(q) ||
        c.notes?.toLowerCase().includes(q)
    );
  }, [list, query]);

  const handleSave = (client: Client) => {
    const next = editing
      ? list.map(c => (c.id === client.id ? client : c))
      : [...list, client];
    setClients(next);
    setEditing(null);
    setFormOpen(false);
  };

  const handleDelete = (id: string) => {
    const client = list.find(c => c.id === id);
    if (!client) return;
    if (!confirm(`Delete client "${client.name}"? Existing records tagged to this client will become unassigned.`)) return;
    setClients(list.filter(c => c.id !== id));
  };

  const stats = useMemo(() => {
    const monthStart = new Date();
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const newThisMonth = list.filter(c => new Date(c.createdAt) >= monthStart).length;
    const withLogo = list.filter(c => !!c.logo).length;
    return { total: list.length, newThisMonth, withLogo };
  }, [list]);

  return (
    <div className="page">
      {/* Hero */}
      <section className="hero">
        <div className="hero-l">
          <span className="kicker">post_clients · directory</span>
          <h1 className="h-condensed title">
            Your clients<span className="u">_</span><br />in one place.
          </h1>
          <p className="sub">
            Every scan, audit and risk file links back to the client engagement here. Logos uploaded once flow through to every branded report.
          </p>
          <div className="hero-stats">
            <div className="hero-stat">
              <div className="l">Total</div>
              <div className="v">{stats.total}</div>
            </div>
            <div className="hero-stat">
              <div className="l">New this month</div>
              <div className="v">{stats.newThisMonth}</div>
            </div>
            <div className="hero-stat">
              <div className="l">With logo</div>
              <div className="v">{stats.withLogo}<small> / {stats.total || 0}</small></div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button type="button" className="btn btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="w-4 h-4" /> Add client
            </button>
          </div>
        </div>

        {/* Right pane — quick search */}
        <div className="gauge-wrap" style={{ alignItems: 'stretch' }}>
          <div
            style={{
              padding: '20px 22px',
              borderRadius: 22,
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-bd)',
              backdropFilter: 'blur(20px)',
              display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'center',
              minWidth: 260,
            }}
          >
            <span className="kicker violet">find</span>
            <h3 style={{ margin: 0, fontFamily: 'var(--font-redesign-display)', fontSize: 18, fontWeight: 700, color: 'var(--ink-1)', letterSpacing: '-0.01em' }}>
              Search the roster
            </h3>
            <div style={{ position: 'relative' }}>
              <Search className="w-4 h-4" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' }} />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Name, industry, contact, notes…"
                style={{
                  width: '100%', padding: '10px 14px 10px 36px',
                  borderRadius: 12,
                  border: '1px solid var(--line-2)',
                  background: 'var(--bg-2)',
                  color: 'var(--ink-1)',
                  fontSize: 13,
                  outline: 'none',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-redesign-mono)' }}>
              {query.trim()
                ? `${filtered.length} match${filtered.length === 1 ? '' : 'es'}`
                : `${stats.total} client${stats.total === 1 ? '' : 's'} on file`}
            </div>
          </div>
        </div>
      </section>

      {/* Card grid */}
      {list.length === 0 ? (
        <EmptyState onAdd={() => { setEditing(null); setFormOpen(true); }} />
      ) : filtered.length === 0 ? (
        <div className="bubble" style={{ padding: 36, textAlign: 'center', color: 'var(--ink-3)', fontFamily: 'var(--font-redesign-mono)', fontSize: 12 }}>
          // No clients match "{query}".
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(client => (
            <ClientCard
              key={client.id}
              client={client}
              onEdit={() => { setEditing(client); setFormOpen(true); }}
              onDelete={() => handleDelete(client.id)}
            />
          ))}
        </div>
      )}

      {formOpen && (
        <ClientForm
          initial={editing ?? undefined}
          onSave={handleSave}
          onClose={() => { setEditing(null); setFormOpen(false); }}
        />
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ClientCard({ client, onEdit, onDelete }: { client: Client; onEdit: () => void; onDelete: () => void }) {
  return (
    <div
      className="bubble"
      style={{
        padding: 18,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div
          style={{
            width: 48, height: 48, borderRadius: 12,
            display: 'grid', placeItems: 'center', overflow: 'hidden',
            flexShrink: 0,
            background: 'var(--bg-2)',
            border: '1px solid var(--line-2)',
          }}
        >
          {client.logo ? (
            <img src={client.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : (
            <Building2 className="w-5 h-5" style={{ color: 'var(--mint)' }} />
          )}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3 style={{ margin: 0, fontWeight: 600, fontSize: 14, color: 'var(--ink-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {client.name}
          </h3>
          {client.industry && (
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--font-redesign-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {client.industry}
            </p>
          )}
        </div>
      </div>

      {client.primaryContact && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-2)' }}>
          <span style={{ color: 'var(--ink-3)', fontFamily: 'var(--font-redesign-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginRight: 6 }}>contact</span>
          {client.primaryContact}
        </p>
      )}

      {client.notes && (
        <p
          style={{
            margin: 0, fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}
        >
          {client.notes}
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 10, marginTop: 'auto', borderTop: '1px dashed var(--line-2)' }}>
        <button
          type="button"
          onClick={onEdit}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            padding: '6px 10px',
            borderRadius: 10,
            fontSize: 12, fontWeight: 500,
            background: 'var(--bg-2)',
            border: '1px solid var(--line-2)',
            color: 'var(--ink-2)',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <Pencil className="w-3 h-3" /> Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${client.name}`}
          style={{
            padding: 6, borderRadius: 10,
            background: 'var(--bg-2)',
            border: '1px solid var(--line-2)',
            color: 'var(--ember)',
            cursor: 'pointer',
            display: 'grid', placeItems: 'center',
          }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="bubble" style={{ padding: '48px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div
        style={{
          width: 64, height: 64, borderRadius: 16,
          display: 'grid', placeItems: 'center',
          background: 'color-mix(in oklab, var(--mint) 15%, transparent)',
          border: '1px solid color-mix(in oklab, var(--mint) 30%, transparent)',
        }}
      >
        <Building2 className="w-7 h-7" style={{ color: 'var(--mint)' }} />
      </div>
      <h3 style={{ margin: 0, fontFamily: 'var(--font-redesign-display)', fontSize: 18, fontWeight: 700, color: 'var(--ink-1)', letterSpacing: '-0.01em' }}>
        No clients yet
      </h3>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)', maxWidth: 420, lineHeight: 1.5 }}>
        Add your first client to start grouping scans, risks and audits by engagement. Logos uploaded here flow into every branded report.
      </p>
      <button type="button" onClick={onAdd} className="btn btn-primary" style={{ marginTop: 4 }}>
        <Plus className="w-4 h-4" /> Add your first client
      </button>
    </div>
  );
}
