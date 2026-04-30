import { useState, useMemo, useEffect, useRef } from 'react';
import { Grid3X3, List, Filter } from 'lucide-react';
import type { AnnexAControl } from '../../data/types';
import { filterControls, emptyFilters, type ControlFilters } from '../../utils/filters';
import ControlCard from './ControlCard';
import FilterPanel from '../shared/FilterPanel';

interface ControlExplorerProps {
  controls: AnnexAControl[];
  onAddToCheatsheet?: (controlId: string) => void;
  targetId?: string | null;
  onTargetConsumed?: () => void;
}

export default function ControlExplorer({ controls, onAddToCheatsheet, targetId, onTargetConsumed }: ControlExplorerProps) {
  const [filters, setFilters] = useState<ControlFilters>(emptyFilters);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showFilters, setShowFilters] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const filtered = useMemo(() => filterControls(controls, filters), [controls, filters]);

  // When targetId changes, clear filters (so the item is visible), expand it, scroll to it
  useEffect(() => {
    if (!targetId) return;
    // Clear filters so the target is guaranteed to be in the list
    setFilters(emptyFilters);
    setExpandedIds(prev => new Set([...prev, targetId]));

    const timer = setTimeout(() => {
      const el = rowRefs.current[targetId];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el.style.outline = '2px solid var(--color-accent)';
        el.style.borderRadius = '8px';
        setTimeout(() => { el.style.outline = ''; }, 1500);
      }
      onTargetConsumed?.();
    }, 250);
    return () => clearTimeout(timer);
  }, [targetId, onTargetConsumed]);

  const activeFilterCount = [
    filters.category.length,
    filters.controlType.length,
    filters.securityProperty.length,
    filters.cybersecurityConcept.length,
    filters.securityDomain.length,
    filters.newIn2022 !== null ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const filterGroups = [
    {
      label: 'Category',
      options: ['Organisational', 'People', 'Physical', 'Technological'],
      selected: filters.category,
      onChange: (s: string[]) => setFilters(f => ({ ...f, category: s as any })),
    },
    {
      label: 'Control Type',
      options: ['Preventive', 'Detective', 'Corrective'],
      selected: filters.controlType,
      onChange: (s: string[]) => setFilters(f => ({ ...f, controlType: s as any })),
    },
    {
      label: 'Security Property',
      options: ['Confidentiality', 'Integrity', 'Availability'],
      selected: filters.securityProperty,
      onChange: (s: string[]) => setFilters(f => ({ ...f, securityProperty: s as any })),
    },
    {
      label: 'Cybersecurity Concept',
      options: ['Identify', 'Protect', 'Detect', 'Respond', 'Recover'],
      selected: filters.cybersecurityConcept,
      onChange: (s: string[]) => setFilters(f => ({ ...f, cybersecurityConcept: s as any })),
    },
    {
      label: 'Security Domain',
      options: ['Governance and Ecosystem', 'Protection', 'Defence', 'Resilience'],
      selected: filters.securityDomain,
      onChange: (s: string[]) => setFilters(f => ({ ...f, securityDomain: s as any })),
    },
  ];

  return (
    <div className="flex gap-4">
      {showFilters && (
        <div className="w-56 flex-shrink-0 space-y-3">
          <FilterPanel
            groups={filterGroups}
            onClearAll={() => setFilters(emptyFilters)}
            activeCount={activeFilterCount}
          />
          <label className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-lg text-xs text-text-secondary cursor-pointer hover:text-text-primary">
            <input
              type="checkbox"
              checked={filters.newIn2022 === true}
              onChange={() => setFilters(f => ({ ...f, newIn2022: f.newIn2022 === true ? null : true }))}
              className="rounded border-border bg-surface accent-accent w-3.5 h-3.5"
            />
            New in 2022 only
          </label>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border transition-colors ${
                showFilters ? 'border-accent/50 text-accent bg-accent/10' : 'border-border text-text-secondary hover:text-text-primary'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              Filters
              {activeFilterCount > 0 && <span className="text-accent">({activeFilterCount})</span>}
            </button>
            <input
              type="text"
              placeholder="Filter controls..."
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              className="bg-surface-alt border border-border rounded-md px-3 py-1.5 text-xs text-text-primary placeholder-text-muted outline-none focus:border-accent/50 w-48"
            />
            <span className="text-xs text-text-muted">{filtered.length} of {controls.length} controls</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded ${viewMode === 'list' ? 'text-accent bg-accent/10' : 'text-text-muted hover:text-text-primary'}`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded ${viewMode === 'grid' ? 'text-accent bg-accent/10' : 'text-text-muted hover:text-text-primary'}`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-2'}>
          {filtered.map(ctrl => (
            <div key={ctrl.id} ref={(el) => { rowRefs.current[ctrl.id] = el; }}>
              <ControlCard
                control={ctrl}
                onAddToCheatsheet={onAddToCheatsheet}
                compact={viewMode === 'grid'}
                forceExpanded={expandedIds.has(ctrl.id)}
              />
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-text-muted text-sm">
            No controls match the current filters.
          </div>
        )}
      </div>
    </div>
  );
}
