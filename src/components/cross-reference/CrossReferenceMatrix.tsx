import { useState, useMemo } from 'react';
import type { AnnexAControl, ManagementClause } from '../../data/types';
import { crossReferences } from '../../data/crossReferences';
import Badge from '../shared/Badge';

interface CrossReferenceMatrixProps {
  controls: AnnexAControl[];
  clauses: ManagementClause[];
}

type ViewMode = 'control-clause' | 'control-control' | 'framework';

export default function CrossReferenceMatrix({ controls, clauses }: CrossReferenceMatrixProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('framework');
  const [selectedControl, setSelectedControl] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRefs = useMemo(() => {
    if (!searchQuery) return crossReferences;
    const q = searchQuery.toLowerCase();
    return crossReferences.filter(ref => {
      const ctrl = controls.find(c => c.id === ref.controlId);
      return ref.controlId.toLowerCase().includes(q) || (ctrl && ctrl.title.toLowerCase().includes(q));
    });
  }, [searchQuery, controls]);

  const selectedRef = selectedControl ? crossReferences.find(r => r.controlId === selectedControl) : null;
  const selectedCtrl = selectedControl ? controls.find(c => c.id === selectedControl) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {(['framework', 'control-clause', 'control-control'] as ViewMode[]).map(mode => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${viewMode === mode ? 'bg-accent/20 text-accent' : 'bg-surface border border-border text-text-secondary hover:text-text-primary'}`}
          >
            {mode === 'framework' ? 'Framework Mapping' : mode === 'control-clause' ? 'Control ↔ Clause' : 'Control ↔ Control'}
          </button>
        ))}
        <input
          type="text"
          placeholder="Search controls..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="ml-auto bg-surface-alt border border-border rounded-md px-3 py-1.5 text-xs text-text-primary placeholder-text-muted outline-none focus:border-accent/50 w-48"
        />
      </div>

      {viewMode === 'framework' && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-2 py-2 text-text-secondary font-semibold">Control</th>
                <th className="text-left px-2 py-2 text-text-secondary font-semibold">Title</th>
                <th className="text-left px-2 py-2 text-text-secondary font-semibold">SOC 2</th>
                <th className="text-left px-2 py-2 text-text-secondary font-semibold">Cyber Essentials</th>
                <th className="text-left px-2 py-2 text-text-secondary font-semibold">NIST CSF</th>
              </tr>
            </thead>
            <tbody>
              {filteredRefs.map(ref => {
                const ctrl = controls.find(c => c.id === ref.controlId);
                return (
                  <tr key={ref.controlId} className="border-b border-border/30 hover:bg-surface-alt/50 transition-colors">
                    <td className="px-2 py-1.5 font-mono text-accent">{ref.controlId}</td>
                    <td className="px-2 py-1.5 text-text-primary">{ctrl?.title || ''}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex flex-wrap gap-0.5">
                        {ref.soc2Criteria.map(c => <Badge key={c} small variant="blue">{c}</Badge>)}
                        {ref.soc2Criteria.length === 0 && <span className="text-text-muted">—</span>}
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex flex-wrap gap-0.5">
                        {ref.cyberEssentials.map(c => <Badge key={c} small variant="green">{c}</Badge>)}
                        {ref.cyberEssentials.length === 0 && <span className="text-text-muted">—</span>}
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex flex-wrap gap-0.5">
                        {ref.nistCsf.map(c => <Badge key={c} small variant="detective">{c}</Badge>)}
                        {ref.nistCsf.length === 0 && <span className="text-text-muted">—</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {viewMode === 'control-clause' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="glass-tile space-y-1 max-h-[70vh] overflow-y-auto">
            {filteredRefs.map(ref => {
              const ctrl = controls.find(c => c.id === ref.controlId);
              return (
                <button
                  key={ref.controlId}
                  onClick={() => setSelectedControl(ref.controlId)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${selectedControl === ref.controlId ? 'bg-accent/10 text-accent' : 'hover:bg-surface-alt text-text-secondary'}`}
                >
                  <span className="font-mono">{ref.controlId}</span>
                  <span className="truncate">{ctrl?.title}</span>
                </button>
              );
            })}
          </div>
          <div className="glass-tile p-4">
            {selectedRef && selectedCtrl ? (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-text-primary">
                  <span className="font-mono text-accent">{selectedCtrl.id}</span> — {selectedCtrl.title}
                </h3>
                <div>
                  <h4 className="text-xs font-semibold text-text-secondary uppercase mb-1">Related Clauses</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedRef.relatedClauseIds.map(cId => {
                      const clause = clauses.find(c => c.id === cId);
                      return (
                        <div key={cId} className="px-2 py-1 bg-copper/10 rounded text-xs">
                          <span className="font-mono text-copper">{cId}</span>
                          {clause && <span className="text-text-secondary ml-1">— {clause.title}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-text-secondary uppercase mb-1">Related Controls</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedRef.relatedControlIds.map(cId => {
                      const ctrl = controls.find(c => c.id === cId);
                      return (
                        <div key={cId} className="px-2 py-1 bg-accent/10 rounded text-xs">
                          <span className="font-mono text-accent">{cId}</span>
                          {ctrl && <span className="text-text-secondary ml-1">— {ctrl.title}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-text-muted text-center py-8">Select a control to see relationships</p>
            )}
          </div>
        </div>
      )}

      {viewMode === 'control-control' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="glass-tile space-y-1 max-h-[70vh] overflow-y-auto">
            {filteredRefs.map(ref => {
              const ctrl = controls.find(c => c.id === ref.controlId);
              return (
                <button
                  key={ref.controlId}
                  onClick={() => setSelectedControl(ref.controlId)}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${selectedControl === ref.controlId ? 'bg-accent/10 text-accent' : 'hover:bg-surface-alt text-text-secondary'}`}
                >
                  <span className="font-mono">{ref.controlId}</span>
                  <span className="truncate">{ctrl?.title}</span>
                  <span className="ml-auto text-text-muted">{ref.relatedControlIds.length}</span>
                </button>
              );
            })}
          </div>
          <div className="glass-tile p-4">
            {selectedRef && selectedCtrl ? (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-text-primary">
                  <span className="font-mono text-accent">{selectedCtrl.id}</span> — {selectedCtrl.title}
                </h3>
                <p className="text-xs text-text-secondary">{selectedCtrl.summary}</p>
                <div>
                  <h4 className="text-xs font-semibold text-text-secondary uppercase mb-2">Reinforcing Controls</h4>
                  <div className="space-y-1.5">
                    {selectedRef.relatedControlIds.map(cId => {
                      const ctrl = controls.find(c => c.id === cId);
                      return (
                        <div key={cId} className="p-2 bg-surface-alt rounded text-xs">
                          <span className="font-mono text-accent">{cId}</span>
                          {ctrl && (
                            <>
                              <span className="text-text-primary ml-1">— {ctrl.title}</span>
                              <p className="text-text-muted mt-0.5 line-clamp-2">{ctrl.summary}</p>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-text-muted text-center py-8">Select a control to see reinforcing controls</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
