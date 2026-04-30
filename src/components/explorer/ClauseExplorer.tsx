import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ManagementClause } from '../../data/types';

interface ClauseExplorerProps {
  clauses: ManagementClause[];
  targetId?: string | null;
  onTargetConsumed?: () => void;
}

const categories = ['Context', 'Leadership', 'Planning', 'Support', 'Operation', 'Performance', 'Improvement'] as const;
const categoryClauseNum: Record<string, string> = {
  Context: '4', Leadership: '5', Planning: '6', Support: '7',
  Operation: '8', Performance: '9', Improvement: '10',
};
const categoryForClause = (id: string): string => {
  const prefix = id.split('.')[0];
  return { '4': 'Context', '5': 'Leadership', '6': 'Planning', '7': 'Support', '8': 'Operation', '9': 'Performance', '10': 'Improvement' }[prefix] ?? '';
};

export default function ClauseExplorer({ clauses, targetId, onTargetConsumed }: ClauseExplorerProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Context']));
  const [expandedClauses, setExpandedClauses] = useState<Set<string>>(new Set());
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // When targetId changes, auto-expand the matching category + clause and scroll to it
  useEffect(() => {
    if (!targetId) return;
    const cat = categoryForClause(targetId);
    if (!cat) return;

    setExpandedCategories(prev => new Set([...prev, cat]));
    setExpandedClauses(prev => new Set([...prev, targetId]));

    // Scroll after a short delay to allow the animation to begin
    const timer = setTimeout(() => {
      const el = rowRefs.current[targetId];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Brief highlight flash
        el.style.outline = '2px solid var(--color-accent)';
        el.style.borderRadius = '4px';
        setTimeout(() => { el.style.outline = ''; }, 1500);
      }
      onTargetConsumed?.();
    }, 250);
    return () => clearTimeout(timer);
  }, [targetId, onTargetConsumed]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const toggleClause = (id: string) => {
    setExpandedClauses(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-text-muted mb-4">
        Management system requirements — the "shall" statements that form the basis of your ISMS audit.
      </p>
      {categories.map(cat => {
        const catClauses = clauses.filter(c => c.category === cat);
        const isExpanded = expandedCategories.has(cat);
        return (
          <div key={cat} className="border border-border rounded-lg bg-surface overflow-hidden">
            <button
              onClick={() => toggleCategory(cat)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-alt transition-colors text-left"
            >
              {isExpanded ? <ChevronDown className="w-4 h-4 text-accent" /> : <ChevronRight className="w-4 h-4 text-text-muted" />}
              <span className="font-mono text-accent text-sm">{categoryClauseNum[cat]}</span>
              <span className="font-semibold text-text-primary">{cat} of the organisation</span>
              <span className="ml-auto text-xs text-text-muted">{catClauses.length} sub-clauses</span>
            </button>
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-border/50">
                    {catClauses.map(clause => (
                      <ClauseItem
                        key={clause.id}
                        clause={clause}
                        expanded={expandedClauses.has(clause.id)}
                        onToggle={() => toggleClause(clause.id)}
                        rowRef={(el) => { rowRefs.current[clause.id] = el; }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

function ClauseItem({
  clause, expanded, onToggle, rowRef,
}: {
  clause: ManagementClause;
  expanded: boolean;
  onToggle: () => void;
  rowRef: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div ref={rowRef} className="border-b border-border/30 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-6 py-2.5 hover:bg-surface-alt/50 transition-colors text-left"
      >
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-text-muted" /> : <ChevronRight className="w-3.5 h-3.5 text-text-muted" />}
        <span className="font-mono text-accent text-xs">{clause.id}</span>
        <span className="text-sm text-text-primary">{clause.title}</span>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-8 pb-4 space-y-3">
              <p className="text-xs text-text-secondary">{clause.summary}</p>

              <DetailSection title="Key Requirements">
                <ul className="space-y-0.5">
                  {clause.requirements.map((r, i) => (
                    <li key={i} className="text-xs text-text-secondary flex gap-2">
                      <span className="text-accent">•</span><span>{r}</span>
                    </li>
                  ))}
                </ul>
              </DetailSection>

              <DetailSection title="Audit Questions">
                <ul className="space-y-1">
                  {clause.auditQuestions.map((q, i) => (
                    <li key={i} className="text-xs text-text-secondary flex gap-2">
                      <span className="text-accent font-mono">Q{i + 1}</span><span>{q}</span>
                    </li>
                  ))}
                </ul>
              </DetailSection>

              <DetailSection title="Typical Evidence">
                <ul className="space-y-0.5">
                  {clause.typicalEvidence.map((e, i) => (
                    <li key={i} className="text-xs text-text-secondary flex gap-2">
                      <span className="text-status-green">✓</span><span>{e}</span>
                    </li>
                  ))}
                </ul>
              </DetailSection>

              <DetailSection title="Common Gaps">
                <ul className="space-y-0.5">
                  {clause.commonGaps.map((g, i) => (
                    <li key={i} className="text-xs text-text-secondary flex gap-2">
                      <span className="text-status-red">⚠</span><span>{g}</span>
                    </li>
                  ))}
                </ul>
              </DetailSection>

              <DetailSection title="Consultant Tips">
                <ul className="space-y-0.5">
                  {clause.tips.map((t, i) => (
                    <li key={i} className="text-xs text-text-secondary flex gap-2">
                      <span className="text-accent">★</span><span>{t}</span>
                    </li>
                  ))}
                </ul>
              </DetailSection>

              <div className="flex flex-wrap gap-3">
                {clause.relatedClauses.length > 0 && (
                  <div>
                    <span className="text-[10px] text-text-muted uppercase">Related Clauses: </span>
                    {clause.relatedClauses.map(r => (
                      <span key={r} className="text-xs font-mono text-copper bg-copper/10 px-1.5 py-0.5 rounded mr-1">{r}</span>
                    ))}
                  </div>
                )}
                {clause.relatedControls.length > 0 && (
                  <div>
                    <span className="text-[10px] text-text-muted uppercase">Related Controls: </span>
                    {clause.relatedControls.map(r => (
                      <span key={r} className="text-xs font-mono text-accent bg-accent/10 px-1.5 py-0.5 rounded mr-1">{r}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">{title}</h4>
      {children}
    </div>
  );
}
