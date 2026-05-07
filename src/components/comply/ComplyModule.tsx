import { useState, useMemo } from 'react';
import { ShieldCheck, Hammer, ClipboardList, Bookmark } from 'lucide-react';
import type { ManagementClause, AnnexAControl, GapAnalysisSession } from '../../data/types';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import GapAnalysis from '../gap-analysis/GapAnalysis';
import ImplementationTracker from '../implementation/ImplementationTracker';
import CheatsheetBuilder from '../cheatsheet/CheatsheetBuilder';
import SavedItems from '../SavedItems';

interface ComplyModuleProps {
  clauses: ManagementClause[];
  controls: AnnexAControl[];
}

type ComplyTab = 'gap-analysis' | 'projects' | 'checklists' | 'saved';

const tabs: { id: ComplyTab; label: string; Icon: React.ElementType }[] = [
  { id: 'gap-analysis', label: 'Gap analysis',     Icon: ShieldCheck    },
  { id: 'projects',     label: 'Implementations',  Icon: Hammer         },
  { id: 'checklists',   label: 'Audits',           Icon: ClipboardList  },
  { id: 'saved',        label: 'Saved items',      Icon: Bookmark       },
];

export default function ComplyModule({ clauses, controls }: ComplyModuleProps) {
  const [activeTab, setActiveTab] = useState<ComplyTab>('gap-analysis');

  // Hero stats — pulled live from gap sessions to anchor the page in real data.
  const [gapSessions] = useLocalStorage<GapAnalysisSession[]>('gap-sessions', []);
  const safeSessions = useMemo(
    () => Array.isArray(gapSessions) ? gapSessions : [],
    [gapSessions],
  );

  const stats = useMemo(() => {
    let compliant = 0, total = 0;
    for (const s of safeSessions) {
      for (const item of s.items) {
        total += 1;
        if (item.status === 'Compliant') compliant += 1;
      }
    }
    const pct = total > 0 ? Math.round((compliant / total) * 100) : null;
    return { sessions: safeSessions.length, total, compliant, pct };
  }, [safeSessions]);

  return (
    <div className="page">
      {/* Hero — single-column, no nav-map right pane (Sprint 12 user QA).
          Workflow nav lives in the sticky tab strip below. */}
      <section className="hero" style={{ gridTemplateColumns: '1fr', padding: '24px 28px' }}>
        <div className="hero-l">
          <span className="kicker">post_comply · gap &amp; treat</span>
          <h1 className="h-condensed title" style={{ fontSize: 44 }}>
            Track every clause<span className="u">_</span> close every gap.
          </h1>
          <p className="sub">
            Map current posture against ISO 27001, plan the work, and keep an evidence trail your auditor will actually accept.
          </p>
          <div className="hero-stats">
            <div className="hero-stat">
              <div className="l">Compliance</div>
              <div className="v">{stats.pct !== null ? <>{stats.pct}<small>%</small></> : '—'}</div>
            </div>
            <div className="hero-stat">
              <div className="l">Sessions</div>
              <div className="v">{stats.sessions}</div>
            </div>
            <div className="hero-stat">
              <div className="l">Items assessed</div>
              <div className="v">{stats.total}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Sub-nav tab strip — sticky to top of .page scroll. Glass background
          so content scrolling underneath doesn't bleed through. */}
      <nav
        role="tablist"
        aria-label="Compliance workflow"
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

      {/* Tab content */}
      <div role="tabpanel" style={{ minHeight: 0 }}>
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
