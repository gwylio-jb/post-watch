import { useState, useEffect, useRef } from 'react';
import { X, Upload } from 'lucide-react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import {
  type Project,
  type TemplateType,
  createProject,
  migrateLegacyTracker,
} from '../../data/projects';
import type { Client } from '../../data/types';
import { UNASSIGNED_CLIENT_ID } from '../../utils/clientMigration';
import ProjectDashboard from './ProjectDashboard';
import ProjectDetail from './ProjectDetail';
import CustomDeliverablesEditor from './CustomDeliverablesEditor';

export default function ImplementationTracker() {
  const [projects, setProjects] = useLocalStorage<Project[]>('projects', []);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showCustomEditor, setShowCustomEditor] = useState(false);
  const migratedRef = useRef(false);

  // One-time migration of legacy single-tracker data
  useEffect(() => {
    if (migratedRef.current) return;
    migratedRef.current = true;
    if (projects.length === 0) {
      const legacy = migrateLegacyTracker();
      if (legacy) setProjects([legacy]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeProject = projects.find(p => p.id === activeProjectId) ?? null;

  const updateActive = (updater: (p: Project) => Project) => {
    if (!activeProjectId) return;
    setProjects(prev => prev.map(p => p.id === activeProjectId ? updater(p) : p));
  };

  const handleCreate = (
    clientName: string,
    clientLogo: string | undefined,
    templateType: TemplateType,
    clientId: string | undefined,
  ) => {
    const project = createProject({ clientName, clientLogo, templateType, clientId });
    setProjects(prev => [...prev, project]);
    setShowNewProject(false);
    setActiveProjectId(project.id);
    if (templateType === 'custom') setShowCustomEditor(true);
  };

  const handleDelete = (id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    if (activeProjectId === id) setActiveProjectId(null);
  };

  return (
    <>
      {activeProject ? (
        <ProjectDetail
          project={activeProject}
          onUpdate={updateActive}
          onBack={() => setActiveProjectId(null)}
          onEditCustom={() => setShowCustomEditor(true)}
        />
      ) : (
        <ProjectDashboard
          projects={projects}
          onOpenProject={setActiveProjectId}
          onNewProject={() => setShowNewProject(true)}
          onDeleteProject={handleDelete}
        />
      )}

      {showNewProject && (
        <NewProjectModal
          onCancel={() => setShowNewProject(false)}
          onCreate={handleCreate}
        />
      )}

      {showCustomEditor && activeProject && activeProject.templateType === 'custom' && (
        <CustomDeliverablesEditor
          project={activeProject}
          onUpdate={updateActive}
          onClose={() => setShowCustomEditor(false)}
        />
      )}
    </>
  );
}

// ── New Project Modal ────────────────────────────────────────────────────────

function NewProjectModal({ onCancel, onCreate }: { onCancel: () => void; onCreate: (name: string, logo: string | undefined, type: TemplateType, clientId: string | undefined) => void }) {
  const [clients] = useLocalStorage<Client[]>('clients', []);
  // Picker state — `mode: 'pick'` selects from central directory, `mode: 'new'`
  // lets the consultant type a name freeform (kept for backwards-compat with
  // the original UX, though picking from Clients is the recommended path).
  const [mode, setMode] = useState<'pick' | 'new'>('pick');
  const [pickedClientId, setPickedClientId] = useState<string>(
    clients.find(c => c.id !== UNASSIGNED_CLIENT_ID)?.id ?? UNASSIGNED_CLIENT_ID,
  );
  const [name, setName] = useState('');
  const [logo, setLogo] = useState<string | undefined>(undefined);
  const [templateType, setTemplateType] = useState<TemplateType>('standard');

  const realClients = clients.filter(c => c.id !== UNASSIGNED_CLIENT_ID);
  const pickedClient = clients.find(c => c.id === pickedClientId);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500_000) {
      alert('Logo too large. Please use an image under 500KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogo(reader.result as string);
    reader.readAsDataURL(file);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'pick') {
      if (!pickedClient) return;
      // Inherit the picked client's logo (consistent branding across modules).
      onCreate(pickedClient.name, pickedClient.logo, templateType, pickedClient.id);
      return;
    }
    if (!name.trim()) return;
    onCreate(name.trim(), logo, templateType, undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
      <form onSubmit={submit} className="card-elevated w-full max-w-lg">
        {/* Header */}
        <div
          className="flex items-center justify-between p-5 rounded-t-2xl text-white"
          style={{ background: 'var(--gradient-accent)' }}
        >
          <h2 className="font-display font-bold text-lg">New Project</h2>
          <button type="button" onClick={onCancel} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Mode toggle: existing client vs freeform */}
          <div className="inline-flex rounded-lg border border-border p-0.5 bg-surface-alt text-xs">
            <button
              type="button"
              onClick={() => setMode('pick')}
              disabled={realClients.length === 0}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${mode === 'pick' ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text-primary'} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              From Clients
            </button>
            <button
              type="button"
              onClick={() => setMode('new')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${mode === 'new' ? 'bg-accent/15 text-accent' : 'text-text-muted hover:text-text-primary'}`}
            >
              Ad-hoc
            </button>
          </div>

          {mode === 'pick' && (
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                Client
              </label>
              {realClients.length === 0 ? (
                <p className="text-xs text-text-muted bg-surface-alt border border-border rounded-xl p-3">
                  No clients yet. Add one in the Clients hub, or switch to <span className="text-accent">Ad-hoc</span> to create a project without linking to a client.
                </p>
              ) : (
                <select
                  value={pickedClientId}
                  onChange={e => setPickedClientId(e.target.value)}
                  className="w-full bg-surface-alt border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent transition-colors"
                >
                  {realClients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
              {pickedClient?.logo && (
                <div className="mt-2 flex items-center gap-2 text-xs text-text-muted">
                  <img src={pickedClient.logo} alt="" className="w-8 h-8 rounded-lg object-cover border border-border" />
                  <span>Logo will be inherited from this client.</span>
                </div>
              )}
            </div>
          )}

          {mode === 'new' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                  Client Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Acme Corporation"
                  autoFocus
                  className="w-full bg-surface-alt border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary outline-none focus:border-accent transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                  Client Logo (optional)
                </label>
                <div className="flex items-center gap-3">
                  {logo ? (
                    <img src={logo} alt="" className="w-14 h-14 rounded-xl object-cover border border-border" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl border-2 border-dashed border-border flex items-center justify-center text-text-muted">
                      <Upload className="w-4 h-4" />
                    </div>
                  )}
                  <label className="cursor-pointer px-3 py-2 bg-surface-alt border border-border rounded-xl text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors">
                    {logo ? 'Replace logo' : 'Upload logo'}
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                  </label>
                  {logo && (
                    <button
                      type="button"
                      onClick={() => setLogo(undefined)}
                      className="text-xs text-text-muted hover:text-status-red transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Template type */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
              Template
            </label>
            <div className="grid grid-cols-2 gap-3">
              <TemplateOption
                selected={templateType === 'standard'}
                onSelect={() => setTemplateType('standard')}
                title="Standard"
                description="Use the full 98-deliverable Post_Watch template"
              />
              <TemplateOption
                selected={templateType === 'custom'}
                onSelect={() => setTemplateType('custom')}
                title="Custom Build"
                description="Define your own deliverables and milestones"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mode === 'pick' ? !pickedClient || pickedClient.id === UNASSIGNED_CLIENT_ID : !name.trim()}
            className="px-5 py-2 rounded-lg text-xs font-semibold text-white shadow-accent disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'var(--gradient-accent)' }}
          >
            Create Project
          </button>
        </div>
      </form>
    </div>
  );
}

function TemplateOption({ selected, onSelect, title, description }: { selected: boolean; onSelect: () => void; title: string; description: string }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left p-4 rounded-xl border-2 transition-all ${
        selected
          ? 'border-accent shadow-accent'
          : 'border-border hover:border-accent/40'
      }`}
      style={selected ? { background: 'var(--gradient-accent-soft)' } : undefined}
    >
      <div className="font-display font-bold text-sm text-text-primary mb-0.5">{title}</div>
      <div className="text-[11px] text-text-muted leading-snug">{description}</div>
    </button>
  );
}
