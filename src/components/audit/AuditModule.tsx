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
      {/* Hero */}
      <section className="hero">
        <div className="hero-l">
          <span className="kicker">post_audit · 27001 helper</span>
          <h1 className="h-condensed title">
            ISO 27001<span className="u">_</span><br />in plain reach.
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

        {/* Right pane — tab map for at-a-glance navigation */}
        <div className="gauge-wrap" style={{ alignItems: 'stretch' }}>
          <div
            style={{
              padding: '20px 22px',
              borderRadius: 22,
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-bd)',
              backdropFilter: 'blur(20px)',
              display: 'flex', flexDirection: 'column', gap: 10,
              minWidth: 240,
            }}
          >
            <span className="kicker violet">sections</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {tabs.map(t => {
                const active = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 12px',
                      borderRadius: 12,
                      background: active
                        ? 'color-mix(in oklab, var(--mint) 16%, transparent)'
                        : 'transparent',
                      border: active
                        ? '1px solid color-mix(in oklab, var(--mint) 40%, transparent)'
                        : '1px solid transparent',
                      color: active ? 'var(--mint)' : 'var(--ink-2)',
                      fontFamily: 'inherit',
                      fontSize: 13, fontWeight: 500,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                    aria-pressed={active}
                  >
                    <t.Icon className="w-4 h-4" style={{ flexShrink: 0 }} />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Sub-nav tab strip — duplicate of hero map for top-of-content access */}
      <div
        role="tablist"
        aria-label="ISO 27001 sections"
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '0 4px',
          borderBottom: '1px solid var(--line-2)',
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
      </div>

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
