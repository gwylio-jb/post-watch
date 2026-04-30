import { useState, useMemo } from 'react';
import { Plus, X, Save, FileText, Printer, Trash2, ChevronRight, Check, Users } from 'lucide-react';
import type { AnnexAControl, ManagementClause, SavedCheatsheet, CheatsheetItem, Client } from '../../data/types';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { exportAsMarkdown, exportAsPrintHTML } from '../../utils/export';
import { UNASSIGNED_CLIENT_ID } from '../../utils/clientMigration';
import Badge from '../shared/Badge';
import CheatsheetPreview from './CheatsheetPreview';

// "Audit" is the V2.1 user-facing name for what was previously called a
// Cheatsheet. The underlying type (`SavedCheatsheet`) and localStorage key
// (`cheatsheets`) are preserved so existing saved items stay loadable.

interface CheatsheetBuilderProps {
  controls: AnnexAControl[];
  clauses: ManagementClause[];
}

export default function CheatsheetBuilder({ controls, clauses }: CheatsheetBuilderProps) {
  const [savedSheets, setSavedSheets] = useLocalStorage<SavedCheatsheet[]>('cheatsheets', []);
  const [clients] = useLocalStorage<Client[]>('clients', []);
  const [currentItems, setCurrentItems] = useState<CheatsheetItem[]>([]);
  const [sheetName, setSheetName] = useState('');
  const [currentClientId, setCurrentClientId] = useState<string>(UNASSIGNED_CLIENT_ID);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState<'build' | 'saved'>('build');
  const [savedFilter, setSavedFilter] = useState<'all' | string>('all');

  const pickerClients = useMemo<Client[]>(() => {
    const arr = Array.isArray(clients) ? clients : [];
    if (arr.some(c => c.id === UNASSIGNED_CLIENT_ID)) return arr;
    return [
      { id: UNASSIGNED_CLIENT_ID, name: 'Unassigned', createdAt: new Date(0).toISOString() },
      ...arr,
    ];
  }, [clients]);

  const clientName = (id?: string) =>
    pickerClients.find(c => c.id === (id ?? UNASSIGNED_CLIENT_ID))?.name ?? 'Unassigned';

  const allItems = useMemo(() => {
    const items: { id: string; title: string; type: 'clause' | 'control'; category: string }[] = [];
    for (const c of clauses) items.push({ id: c.id, title: c.title, type: 'clause', category: c.category });
    for (const c of controls) items.push({ id: c.id, title: c.title, type: 'control', category: c.category });
    return items;
  }, [clauses, controls]);

  const filteredItems = useMemo(() => {
    if (!searchQuery) return allItems;
    const q = searchQuery.toLowerCase();
    return allItems.filter(i => `${i.id} ${i.title}`.toLowerCase().includes(q));
  }, [allItems, searchQuery]);

  const selectedIds = new Set(currentItems.map(i => i.itemId));

  const addItem = (id: string, type: 'clause' | 'control') => {
    if (selectedIds.has(id)) return;
    setCurrentItems(prev => [...prev, { itemId: id, itemType: type, focus: 'full', notes: '', checkedEvidence: [] }]);
  };

  const removeItem = (id: string) => {
    setCurrentItems(prev => prev.filter(i => i.itemId !== id));
  };

  const updateItemFocus = (id: string, focus: CheatsheetItem['focus']) => {
    setCurrentItems(prev => prev.map(i => i.itemId === id ? { ...i, focus } : i));
  };

  const saveSheet = () => {
    const name = sheetName || `Audit — ${new Date().toLocaleDateString('en-GB')}`;
    const now = new Date().toISOString();
    if (editingId) {
      setSavedSheets(prev => prev.map(s => s.id === editingId ? { ...s, name, items: currentItems, updatedAt: now, clientId: currentClientId } : s));
      setEditingId(null);
    } else {
      const sheet: SavedCheatsheet = {
        id: crypto.randomUUID(),
        name, createdAt: now, updatedAt: now,
        items: currentItems,
        clientId: currentClientId,
      };
      setSavedSheets(prev => [...prev, sheet]);
    }
    setSheetName('');
    setCurrentItems([]);
    setCurrentClientId(UNASSIGNED_CLIENT_ID);
  };

  const loadSheet = (sheet: SavedCheatsheet) => {
    setCurrentItems(sheet.items);
    setSheetName(sheet.name);
    setCurrentClientId(sheet.clientId ?? UNASSIGNED_CLIENT_ID);
    setEditingId(sheet.id);
    setActiveTab('build');
  };

  const deleteSheet = (id: string) => {
    setSavedSheets(prev => prev.filter(s => s.id !== id));
  };

  const generateMarkdown = (): string => {
    let md = '';
    for (const item of currentItems) {
      const source = item.itemType === 'control'
        ? controls.find(c => c.id === item.itemId)
        : clauses.find(c => c.id === item.itemId);
      if (!source) continue;
      md += `## ${source.id} — ${source.title}\n\n`;
      md += `**Focus:** ${item.focus}\n\n`;
      md += `### Audit Questions\n`;
      for (const q of source.auditQuestions) md += `- ${q}\n`;
      md += `\n### Expected Evidence\n`;
      for (const e of source.typicalEvidence) md += `- [ ] ${e}\n`;
      md += `\n### Common Gaps\n`;
      for (const g of source.commonGaps) md += `- ${g}\n`;
      if (item.notes) md += `\n### Notes\n${item.notes}\n`;
      md += '\n---\n\n';
    }
    return md;
  };

  const generateHTML = (): string => {
    let html = '';
    for (const item of currentItems) {
      const source = item.itemType === 'control'
        ? controls.find(c => c.id === item.itemId)
        : clauses.find(c => c.id === item.itemId);
      if (!source) continue;
      html += `<h2><span class="control-id">${source.id}</span> — ${source.title}</h2>`;
      html += `<p><strong>Focus:</strong> ${item.focus}</p>`;
      html += `<h3>Audit Questions</h3><ul>`;
      for (const q of source.auditQuestions) html += `<li>${q}</li>`;
      html += `</ul><h3>Expected Evidence</h3><ul>`;
      for (const e of source.typicalEvidence) html += `<li><input type="checkbox" class="checkbox"/>${e}</li>`;
      html += `</ul><h3>Common Gaps to Watch For</h3><ul>`;
      for (const g of source.commonGaps) html += `<li>${g}</li>`;
      html += `</ul>`;
      if (item.notes) html += `<h3>Notes</h3><div class="notes">${item.notes}</div>`;
      html += '<hr/>';
    }
    return html;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          onClick={() => setActiveTab('build')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${activeTab === 'build' ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:text-text-primary'}`}
        >
          Build Audit
        </button>
        <button
          onClick={() => setActiveTab('saved')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${activeTab === 'saved' ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:text-text-primary'}`}
        >
          Saved audits ({savedSheets.length})
        </button>
      </div>

      {activeTab === 'build' && (
        <div className="flex gap-4">
          <div className="w-72 flex-shrink-0 space-y-3">
            <input
              type="text"
              placeholder="Search clauses & controls..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-surface-alt border border-border rounded-md px-3 py-2 text-xs text-text-primary placeholder-text-muted outline-none focus:border-accent/50"
            />
            <div className="max-h-[60vh] overflow-y-auto space-y-0.5 border border-border rounded-lg bg-surface">
              {filteredItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => addItem(item.id, item.type)}
                  disabled={selectedIds.has(item.id)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
                    selectedIds.has(item.id)
                      ? 'bg-accent/5 text-text-muted'
                      : 'hover:bg-surface-alt text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <span className="font-mono text-accent">{item.id}</span>
                  <span className="truncate flex-1">{item.title}</span>
                  {selectedIds.has(item.id) ? (
                    <Check className="w-3 h-3 text-status-green" />
                  ) : (
                    <Plus className="w-3 h-3 text-text-muted" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-3 flex-wrap">
              <input
                type="text"
                placeholder="Audit name (e.g. Stage 1 readiness)"
                value={sheetName}
                onChange={e => setSheetName(e.target.value)}
                className="flex-1 min-w-[200px] bg-surface-alt border border-border rounded-md px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent/50"
              />
              <div className="relative">
                <Users className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
                <select
                  value={currentClientId}
                  onChange={e => setCurrentClientId(e.target.value)}
                  className="pl-8 pr-7 py-2 text-xs bg-surface-alt border border-border rounded-md text-text-primary outline-none focus:border-accent/50 appearance-none"
                  title="Client"
                >
                  {pickerClients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={saveSheet}
                disabled={currentItems.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-accent text-base rounded-md hover:bg-accent-dim disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                Save
              </button>
              {currentItems.length > 0 && (
                <>
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-surface border border-border rounded-md text-text-secondary hover:text-accent hover:border-accent/50 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Preview
                  </button>
                  <button
                    onClick={() => exportAsMarkdown(sheetName || 'Cheatsheet', generateMarkdown())}
                    className="p-2 text-text-muted hover:text-text-primary transition-colors"
                    title="Export Markdown"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => exportAsPrintHTML(sheetName || 'Cheatsheet', generateHTML())}
                    className="p-2 text-text-muted hover:text-text-primary transition-colors"
                    title="Export Print HTML"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>

            {showPreview && currentItems.length > 0 ? (
              <CheatsheetPreview items={currentItems} controls={controls} clauses={clauses} />
            ) : (
              <div className="space-y-2">
                {currentItems.length === 0 ? (
                  <div className="text-center py-12 text-text-muted text-sm border border-dashed border-border rounded-lg">
                    Select clauses and controls from the left panel to build this audit.
                  </div>
                ) : (
                  currentItems.map(item => {
                    const source = item.itemType === 'control'
                      ? controls.find(c => c.id === item.itemId)
                      : clauses.find(c => c.id === item.itemId);
                    if (!source) return null;
                    return (
                      <div key={item.itemId} className="flex items-start gap-3 p-3 bg-surface border border-border rounded-lg">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-accent text-sm">{source.id}</span>
                            <span className="text-sm text-text-primary">{source.title}</span>
                            <Badge small>{item.itemType}</Badge>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] text-text-muted uppercase">Focus:</span>
                            {(['full', 'surveillance', 'specific'] as const).map(f => (
                              <button
                                key={f}
                                onClick={() => updateItemFocus(item.itemId, f)}
                                className={`px-2 py-0.5 text-[10px] rounded transition-colors ${
                                  item.focus === f ? 'bg-accent/20 text-accent' : 'bg-surface-alt text-text-muted hover:text-text-secondary'
                                }`}
                              >
                                {f}
                              </button>
                            ))}
                          </div>
                        </div>
                        <button onClick={() => removeItem(item.itemId)} className="p-1 text-text-muted hover:text-status-red transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'saved' && (
        <div className="space-y-4">
          {savedSheets.length === 0 ? (
            <div className="text-center py-12 text-text-muted text-sm">
              No saved audits yet. Build one and save it!
            </div>
          ) : (() => {
            const filtered = savedFilter === 'all'
              ? savedSheets
              : savedSheets.filter(s => (s.clientId ?? UNASSIGNED_CLIENT_ID) === savedFilter);
            // Group by client for a predictable audit stack per engagement
            const byClient = new Map<string, SavedCheatsheet[]>();
            for (const s of filtered) {
              const cid = s.clientId ?? UNASSIGNED_CLIENT_ID;
              if (!byClient.has(cid)) byClient.set(cid, []);
              byClient.get(cid)!.push(s);
            }
            return (
              <>
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-text-muted" />
                  <span className="text-[10px] uppercase tracking-wider text-text-muted">Client</span>
                  <select
                    value={savedFilter}
                    onChange={e => setSavedFilter(e.target.value)}
                    className="text-xs bg-surface-alt border border-border rounded-md px-2 py-1 text-text-primary outline-none focus:border-accent/50"
                  >
                    <option value="all">All clients</option>
                    {pickerClients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                {filtered.length === 0 ? (
                  <div className="text-center py-12 text-text-muted text-sm">
                    No audits for this client yet.
                  </div>
                ) : (
                  [...byClient.entries()].map(([cid, sheets]) => (
                    <div key={cid} className="space-y-2">
                      <h4 className="text-xs font-semibold text-text-secondary flex items-center gap-2">
                        {clientName(cid)}
                        <span className="text-text-muted font-normal">({sheets.length})</span>
                      </h4>
                      {sheets.map(sheet => (
                        // Whole-row click resumes the audit (matches GapAnalysis UX).
                        // Outer is a div+role=button so the inner trash can stay a real <button>.
                        <div
                          key={sheet.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => loadSheet(sheet)}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); loadSheet(sheet); } }}
                          className="group w-full flex items-center gap-3 p-3 bg-surface border border-border rounded-lg cursor-pointer hover:border-accent/50 hover:bg-surface-alt transition-colors focus:outline-none focus:ring-2 focus:ring-accent/40"
                          aria-label={`Open ${sheet.name}`}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-text-primary font-medium truncate">{sheet.name}</p>
                            <p className="text-xs text-text-muted">
                              {sheet.items.length} items · Updated {new Date(sheet.updatedAt).toLocaleDateString('en-GB')}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={e => { e.stopPropagation(); deleteSheet(sheet.id); }}
                            className="p-1.5 rounded text-text-muted hover:text-status-red hover:bg-status-red/10 transition-colors"
                            aria-label={`Delete ${sheet.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-accent group-hover:translate-x-0.5 transition-all" aria-hidden />
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
