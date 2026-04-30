import { useState } from 'react';
import type { ManagementClause, AnnexAControl } from '../../data/types';

interface AuditModuleProps {
  clauses: ManagementClause[];
  controls: AnnexAControl[];
  targetId: string | null;
  onTargetConsumed: () => void;
  onAddToCheatsheet: (controlId: string) => void;
}

type AuditTab = 'clauses' | 'controls' | 'cross-reference' | 'reference';

const tabs: { id: AuditTab; label: string }[] = [
  { id: 'clauses',         label: 'Clauses 4–10' },
  { id: 'controls',        label: 'Annex A controls' },
  { id: 'cross-reference', label: 'Cross-references' },
  { id: 'reference',       label: 'Quick reference' },
];

// Lazy imports to keep initial bundle smaller
import ClauseExplorer from '../explorer/ClauseExplorer';
import ControlExplorer from '../explorer/ControlExplorer';
import CrossReferenceMatrix from '../cross-reference/CrossReferenceMatrix';
import QuickReference from '../reference/QuickReference';

export default function AuditModule({ clauses, controls, targetId, onTargetConsumed, onAddToCheatsheet }: AuditModuleProps) {
  const [activeTab, setActiveTab] = useState<AuditTab>('clauses');

  return (
    <div className="flex flex-col h-full">
      {/* Sub-nav tabs */}
      <div
        className="flex items-center gap-1 px-8 pt-2 pb-0"
        style={{ borderBottom: '1px solid var(--color-border)' }}
      >
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-4 py-2.5 text-sm font-medium transition-all relative"
            style={{
              color: activeTab === tab.id ? 'var(--color-text-accent)' : 'var(--color-text-muted)',
              borderBottom: activeTab === tab.id ? '2px solid var(--color-accent)' : '2px solid transparent',
              marginBottom: '-1px',
              background: 'none',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden pt-6">
        {activeTab === 'clauses' && (
          <ClauseExplorer
            clauses={clauses}
            targetId={targetId}
            onTargetConsumed={onTargetConsumed}
          />
        )}
        {activeTab === 'controls' && (
          <ControlExplorer
            controls={controls}
            onAddToCheatsheet={onAddToCheatsheet}
            targetId={targetId}
            onTargetConsumed={onTargetConsumed}
          />
        )}
        {activeTab === 'cross-reference' && (
          <CrossReferenceMatrix controls={controls} clauses={clauses} />
        )}
        {activeTab === 'reference' && <QuickReference />}
      </div>
    </div>
  );
}
