import { useState, useMemo } from 'react';
import { ClipboardCheck, Network, BookOpen, ListChecks } from 'lucide-react';
import type { ManagementClause, AnnexAControl } from '../../data/types';

interface AuditModuleProps {
  clauses: ManagementClause[];
  controls: AnnexAControl[];
  targetId: string | null;
  onTargetConsumed: () => void;
  onAddToCheatsheet: (controlId: string) => void;
}

type AuditTab = 'clauses' | 'controls' | 'cross-reference' | 'reference';

const tabs: { id: AuditTab; label: string; Icon: React.ElementType }[] = [
  { id: 'clauses',         label: 'Clauses 4–10',     Icon: ClipboardCheck },
  { id: 'controls',        label: 'Annex A controls', Icon: ListChecks    },
  { id: 'cross-reference', label: 'Cross-references', Icon: Network        },
  { id: 'reference',       label: 'Quick reference',  Icon: BookOpen       },
];

import ClauseExplorer from '../explorer/ClauseExplorer';
import ControlExplorer from '../explorer/ControlExplorer';
import CrossReferenceMatrix from '../cross-reference/CrossReferenceMatrix';
import QuickReference from '../reference/QuickReference';

export default function AuditModule({ clauses, controls, targetId, onTargetConsumed, onAddToCheatsheet }: AuditModuleProps) {
  const [activeTab, setActiveTab] = useState<AuditTab>('clauses');

  // Hero stat — Annex A control families are useful at-a-glance metadata
  const familyCount = useMemo(() => new Set(controls.map(c => c.category)).size, [controls]);

  return (
    <div className="page">
      {/* Hero — single-column. The Sprint 12 user-QA pass removed the
          duplicate "// sections" map that used to live in the right pane
          and replaced it with a sticky nav-tabs strip below (which scales
          better on smaller windows + meets the user's accessibility
          expectation that tab nav stays reachable as you scroll). */}
      <section className="hero" style={{ gridTemplateColumns: '1fr', padding: '24px 28px' }}>
        <div className="hero-l">
          <span className="kicker">post_audit · 27001 helper</span>
          <h1 className="h-condensed title" style={{ fontSize: 44 }}>
            ISO 27001<span className="u">_</span> in plain reach.
          </h1>
          <p className="sub">
            The full text of clauses 4–10 plus all Annex A controls, cross-referenced with each other and surfaced through search. Click anything to jump in.
          </p>
          <div className="hero-stats">
            <div className="hero-stat">
              <div className="l">Clauses</div>
              <div className="v">{clauses.length}</div>
            </div>
            <div className="hero-stat">
              <div className="l">Annex A controls</div>
              <div className="v">{controls.length}</div>
            </div>
            <div className="hero-stat">
              <div className="l">Control families</div>
              <div className="v">{familyCount}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Sub-nav tab strip — sticks to the top of the .page scroll
          container. Glass background so content scrolling underneath
          doesn't bleed through. z-index keeps it above the .bubble
          surfaces, below the topbar (z:30) and modals (z:50). */}
      <nav
        role="tablist"
        aria-label="ISO 27001 sections"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 5,
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '4px 4px 0',
          borderBottom: '1px solid var(--line-2)',
          background: 'color-mix(in oklab, var(--bg-1) 85%, transparent)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          // Negative left/right margin so the glass pulls to the page edges
          // even though the parent .page has padding.
          marginLeft: -28,
          marginRight: -28,
          paddingLeft: 32,
          paddingRight: 32,
        }}
      >
        {tabs.map(tab => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '10px 14px',
                fontSize: 13,
                fontWeight: 500,
                color: active ? 'var(--mint)' : 'var(--ink-3)',
                borderBottom: active ? '2px solid var(--mint)' : '2px solid transparent',
                marginBottom: -1,
                background: 'none',
                border: 0,
                borderBottomWidth: 2,
                borderBottomStyle: 'solid',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <tab.Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Tab content — wrapped in a bubble so each module sits on glass */}
      <div role="tabpanel" style={{ minHeight: 0 }}>
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
