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
  const safeSessions = Array.isArray(gapSessions) ? gapSessions : [];

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
      {/* Hero */}
      <section className="hero">
        <div className="hero-l">
          <span className="kicker">post_comply · gap &amp; treat</span>
          <h1 className="h-condensed title">
            Track every clause<span className="u">_</span><br />close every gap.
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

        {/* Right pane — tab map */}
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
            <span className="kicker violet">workflow</span>
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

      {/* Sub-nav tab strip */}
      <div
        role="tablist"
        aria-label="Compliance workflow"
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
