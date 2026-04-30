import { useState } from 'react';
import type { ManagementClause, AnnexAControl } from '../../data/types';
import GapAnalysis from '../gap-analysis/GapAnalysis';
import ImplementationTracker from '../implementation/ImplementationTracker';
import CheatsheetBuilder from '../cheatsheet/CheatsheetBuilder';
import SavedItems from '../SavedItems';

interface ComplyModuleProps {
  clauses: ManagementClause[];
  controls: AnnexAControl[];
}

type ComplyTab = 'gap-analysis' | 'projects' | 'checklists' | 'saved';

const tabs: { id: ComplyTab; label: string }[] = [
  { id: 'gap-analysis', label: 'Gap analysis' },
  { id: 'projects',     label: 'Implementations' },
  { id: 'checklists',   label: 'Audits' },
  { id: 'saved',        label: 'Saved items' },
];

export default function ComplyModule({ clauses, controls }: ComplyModuleProps) {
  const [activeTab, setActiveTab] = useState<ComplyTab>('gap-analysis');

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
        {activeTab === 'gap-analysis' && (
          <GapAnalysis controls={controls} clauses={clauses} />
        )}
        {activeTab === 'projects' && <ImplementationTracker />}
        {activeTab === 'checklists' && (
          <CheatsheetBuilder controls={controls} clauses={clauses} />
        )}
        {activeTab === 'saved' && <SavedItems />}
      </div>
    </div>
  );
}
