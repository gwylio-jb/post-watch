/**
 * Clients hub — the central directory of billable engagements.
 *
 * V2.1 introduces a client-centric data model: risks, audits and scans all
 * attach to a `clientId`. This hub is where clients are created, edited and
 * deleted, and it's also the foundation Sprint 2 builds on.
 *
 * Storage: localStorage key `clients` (prefixed to `clause-control:clients`
 * by useLocalStorage).
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
        className="rounded-2xl overflow-hidden w-full max-w-lg"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={e => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="flex items-start justify-between p-6" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <h2 className="font-display font-bold text-xl" style={{ color: 'var(--color-text-primary)' }}>
            {initial ? 'Edit client' : 'Add client'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Logo */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
              Logo (optional, max 512 KB)
            </label>
            <div className="flex items-center gap-3">
              <div
                className="w-16 h-16 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0"
                style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)' }}
              >
                {logo ? (
                  <img src={logo} alt="" className="w-full h-full object-contain" />
                ) : (
                  <ImageIcon className="w-5 h-5" style={{ color: 'var(--color-text-muted)' }} />
                )}
              </div>
              <div className="flex-1">
                <label
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                  style={{
                    background: 'var(--color-surface-alt)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  {logo ? 'Replace logo' : 'Upload logo'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml"
                    onChange={handleLogoChange}
                    className="hidden"
                  />
                </label>
                {logo && (
                  <button
                    type="button"
                    onClick={() => setLogo(undefined)}
                    className="ml-2 text-xs"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    Remove
                  </button>
                )}
                {logoError && (
                  <div className="text-xs mt-1" style={{ color: 'var(--color-status-red)' }}>
                    {logoError}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Name */}
          <Field label="Client name" required>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Acme Corp"
              required
              autoFocus
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={inputStyle}
            />
          </Field>

          <Field label="Industry">
            <input
              type="text"
              value={industry}
              onChange={e => setIndustry(e.target.value)}
              placeholder="e.g. E-commerce, SaaS, Legal"
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={inputStyle}
            />
          </Field>

          <Field label="Primary contact">
            <input
              type="text"
              value={primaryContact}
              onChange={e => setPrimaryContact(e.target.value)}
              placeholder="Name + email or phone"
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={inputStyle}
            />
          </Field>

          <Field label="Notes">
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Engagement scope, access details, anything worth remembering."
              rows={3}
              className="w-full px-3 py-2 rounded-lg text-sm resize-y"
              style={inputStyle}
            />
          </Field>
        </div>

        <div
          className="flex items-center justify-end gap-2 px-6 py-4"
          style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-surface-alt)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-secondary)',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            style={{ background: 'var(--color-accent)', color: '#1A2332', border: 'none' }}
          >
            {initial ? 'Save changes' : 'Add client'}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: 'var(--color-surface-alt)',
  border: '1px solid var(--color-border)',
  color: 'var(--color-text-primary)',
  outline: 'none',
  fontFamily: 'var(--font-body)',
};

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
        {required && <span style={{ color: 'var(--color-status-red)', marginLeft: 4 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

// ─── Main hub ────────────────────────────────────────────────────────────────

export default function ClientsHub() {
  const [clients, setClients] = useLocalStorage<Client[]>('clients', []);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Client | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const list: Client[] = Array.isArray(clients) ? clients : [];

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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header row */}
      <div className="px-8 pt-6 pb-4 flex items-center gap-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="flex-1 relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: 'var(--color-text-muted)' }}
          />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search clients…"
            className="w-full pl-10 pr-3 py-2 rounded-xl text-sm"
            style={{
              background: 'var(--color-surface-alt)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              outline: 'none',
            }}
          />
        </div>
        <button
          onClick={() => { setEditing(null); setFormOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
          style={{ background: 'var(--color-accent)', color: '#1A2332', border: 'none' }}
        >
          <Plus className="w-4 h-4" /> Add client
        </button>
      </div>

      {/* List / empty state */}
      <div className="flex-1 overflow-y-auto p-8">
        {list.length === 0 ? (
          <EmptyState onAdd={() => { setEditing(null); setFormOpen(true); }} />
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            No clients match "{query}".
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
      </div>

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
    <div className="card-tile p-5 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0"
          style={{ background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)' }}
        >
          {client.logo ? (
            <img src={client.logo} alt="" className="w-full h-full object-contain" />
          ) : (
            <Building2 className="w-5 h-5" style={{ color: 'var(--color-text-accent)' }} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>
            {client.name}
          </h3>
          {client.industry && (
            <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
              {client.industry}
            </p>
          )}
        </div>
      </div>

      {client.primaryContact && (
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          <span style={{ color: 'var(--color-text-muted)' }}>Contact: </span>
          {client.primaryContact}
        </p>
      )}

      {client.notes && (
        <p
          className="text-xs line-clamp-2"
          style={{ color: 'var(--color-text-muted)', lineHeight: 1.5 }}
        >
          {client.notes}
        </p>
      )}

      <div className="flex items-center gap-2 pt-2 mt-auto" style={{ borderTop: '1px solid var(--color-border)' }}>
        <button
          onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition-colors"
          style={{
            background: 'var(--color-surface-alt)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <Pencil className="w-3 h-3" /> Edit
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg transition-colors"
          style={{
            background: 'var(--color-surface-alt)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-status-red)',
          }}
          aria-label="Delete client"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-20">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'var(--color-accent-soft)', border: '1px solid var(--color-border)' }}
      >
        <Building2 className="w-7 h-7" style={{ color: 'var(--color-text-accent)' }} />
      </div>
      <h3 className="font-display font-bold text-lg mb-1" style={{ color: 'var(--color-text-primary)' }}>
        No clients yet
      </h3>
      <p className="text-sm max-w-md mb-6" style={{ color: 'var(--color-text-muted)' }}>
        Add your first client to start grouping scans, risks and audits by engagement. You can add a logo
        that will appear on their branded reports.
      </p>
      <button
        onClick={onAdd}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
        style={{ background: 'var(--color-accent)', color: '#1A2332', border: 'none' }}
      >
        <Plus className="w-4 h-4" /> Add your first client
      </button>
    </div>
  );
}
