import { useState } from 'react';
import { X, Plus, Trash2, FileText, Users } from 'lucide-react';
import type { Project } from '../../data/projects';
import type { Deliverable, Milestone } from '../../data/implementationData';

interface CustomDeliverablesEditorProps {
  project: Project;
  onUpdate: (updater: (p: Project) => Project) => void;
  onClose: () => void;
}

export default function CustomDeliverablesEditor({ project, onUpdate, onClose }: CustomDeliverablesEditorProps) {
  const [tab, setTab] = useState<'deliverables' | 'milestones'>('deliverables');

  const deliverables = project.customDeliverables ?? [];
  const milestones = project.customMilestones ?? [];

  // Group deliverables by section
  const sections: Record<string, Deliverable[]> = {};
  for (const d of deliverables) {
    (sections[d.section] ??= []).push(d);
  }

  // ── Deliverable ops ──
  const addDeliverable = (section: string) => {
    const d: Deliverable = {
      id: crypto.randomUUID(),
      ref: '',
      name: 'New Deliverable',
      section,
      type: 'document',
    };
    onUpdate(p => ({ ...p, customDeliverables: [...(p.customDeliverables ?? []), d], updatedAt: new Date().toISOString() }));
  };

  const updateDeliverable = (id: string, patch: Partial<Deliverable>) => {
    onUpdate(p => ({
      ...p,
      customDeliverables: (p.customDeliverables ?? []).map(d => d.id === id ? { ...d, ...patch } : d),
      updatedAt: new Date().toISOString(),
    }));
  };

  const removeDeliverable = (id: string) => {
    onUpdate(p => ({
      ...p,
      customDeliverables: (p.customDeliverables ?? []).filter(d => d.id !== id),
      updatedAt: new Date().toISOString(),
    }));
  };

  const [newSectionName, setNewSectionName] = useState('');
  const addSection = () => {
    const name = newSectionName.trim();
    if (!name) return;
    const d: Deliverable = {
      id: crypto.randomUUID(),
      ref: '',
      name: 'New Deliverable',
      section: name,
      type: 'document',
    };
    onUpdate(p => ({ ...p, customDeliverables: [...(p.customDeliverables ?? []), d], updatedAt: new Date().toISOString() }));
    setNewSectionName('');
  };

  // ── Milestone ops ──
  const addMilestone = () => {
    const m: Milestone = { id: crypto.randomUUID(), name: 'New Milestone' };
    onUpdate(p => ({ ...p, customMilestones: [...(p.customMilestones ?? []), m], updatedAt: new Date().toISOString() }));
  };

  const updateMilestone = (id: string, name: string) => {
    onUpdate(p => ({
      ...p,
      customMilestones: (p.customMilestones ?? []).map(m => m.id === id ? { ...m, name } : m),
      updatedAt: new Date().toISOString(),
    }));
  };

  const removeMilestone = (id: string) => {
    onUpdate(p => ({
      ...p,
      customMilestones: (p.customMilestones ?? []).filter(m => m.id !== id),
      updatedAt: new Date().toISOString(),
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-6 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="card-elevated w-full max-w-4xl my-8">
        {/* Header */}
        <div
          className="flex items-center justify-between p-5 rounded-t-2xl text-white"
          style={{ background: 'var(--gradient-accent)' }}
        >
          <div>
            <h2 className="font-display font-bold text-lg">Edit Custom Build</h2>
            <p className="text-xs text-white/80">{project.client.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-4 border-b border-border">
          {(['deliverables', 'milestones'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors capitalize ${
                tab === t ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-text-primary'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
          {tab === 'deliverables' && (
            <>
              {Object.keys(sections).length === 0 && (
                <div className="text-center text-sm text-text-muted py-6">
                  No deliverables yet. Add a section below to get started.
                </div>
              )}

              {Object.entries(sections).map(([sectionName, items]) => (
                <div key={sectionName} className="border border-border rounded-xl overflow-hidden">
                  <div
                    className="px-4 py-2.5 font-display font-bold text-xs uppercase tracking-wider text-accent"
                    style={{ background: 'var(--gradient-accent-soft)' }}
                  >
                    {sectionName}
                  </div>
                  <div className="divide-y divide-border">
                    {items.map(d => (
                      <div key={d.id} className="p-3 flex items-start gap-2">
                        <input
                          type="text"
                          value={d.ref}
                          onChange={e => updateDeliverable(d.id, { ref: e.target.value })}
                          placeholder="Ref"
                          className="w-24 bg-surface-alt border border-border rounded-lg px-2 py-1.5 text-[11px] font-mono text-text-secondary outline-none focus:border-accent"
                        />
                        <input
                          type="text"
                          value={d.name}
                          onChange={e => updateDeliverable(d.id, { name: e.target.value })}
                          placeholder="Deliverable name"
                          className="flex-1 bg-surface-alt border border-border rounded-lg px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent"
                        />
                        <select
                          value={d.type}
                          onChange={e => updateDeliverable(d.id, { type: e.target.value as 'document' | 'workshop' })}
                          className="bg-surface-alt border border-border rounded-lg px-2 py-1.5 text-[11px] text-text-secondary outline-none focus:border-accent"
                        >
                          <option value="document">Document</option>
                          <option value="workshop">Workshop</option>
                        </select>
                        <button
                          onClick={() => removeDeliverable(d.id)}
                          className="p-1.5 text-text-muted hover:text-status-red transition-colors rounded"
                          aria-label="Remove"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => addDeliverable(sectionName)}
                      className="w-full px-4 py-2 text-xs font-semibold text-accent hover:bg-accent/5 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add row
                    </button>
                  </div>
                </div>
              ))}

              {/* Add section */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="text"
                  value={newSectionName}
                  onChange={e => setNewSectionName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addSection(); }}
                  placeholder="New section name…"
                  className="flex-1 bg-surface-alt border border-border rounded-lg px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
                />
                <button
                  onClick={addSection}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white shadow-accent flex items-center gap-1.5"
                  style={{ background: 'var(--gradient-accent)' }}
                >
                  <Plus className="w-3.5 h-3.5" /> Add Section
                </button>
              </div>

              <div className="text-[11px] text-text-muted flex items-center gap-3 pt-1">
                <span className="inline-flex items-center gap-1"><FileText className="w-3 h-3" /> Documents track via the 6-status workflow</span>
                <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> Workshops track Not Scheduled / Scheduled / Completed</span>
              </div>
            </>
          )}

          {tab === 'milestones' && (
            <>
              {milestones.length === 0 && (
                <div className="text-center text-sm text-text-muted py-6">
                  No milestones yet.
                </div>
              )}

              <div className="space-y-2">
                {milestones.map((m, i) => (
                  <div key={m.id} className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-text-muted w-5 text-right">{i + 1}</span>
                    <input
                      type="text"
                      value={m.name}
                      onChange={e => updateMilestone(m.id, e.target.value)}
                      className="flex-1 bg-surface-alt border border-border rounded-lg px-3 py-2 text-xs text-text-primary outline-none focus:border-accent"
                    />
                    <button
                      onClick={() => removeMilestone(m.id)}
                      className="p-1.5 text-text-muted hover:text-status-red transition-colors rounded"
                      aria-label="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={addMilestone}
                className="w-full px-4 py-2 rounded-lg text-xs font-semibold text-white shadow-accent flex items-center justify-center gap-1.5"
                style={{ background: 'var(--gradient-accent)' }}
              >
                <Plus className="w-3.5 h-3.5" /> Add Milestone
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg text-xs font-semibold text-white shadow-accent"
            style={{ background: 'var(--gradient-accent)' }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
