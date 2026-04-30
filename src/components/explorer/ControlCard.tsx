import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AnnexAControl } from '../../data/types';
import Badge from '../shared/Badge';

interface ControlCardProps {
  control: AnnexAControl;
  onAddToCheatsheet?: (controlId: string) => void;
  compact?: boolean;
  forceExpanded?: boolean;
}

export default function ControlCard({ control, onAddToCheatsheet, compact, forceExpanded }: ControlCardProps) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (forceExpanded) setExpanded(true);
  }, [forceExpanded]);

  return (
    <div className="border border-border rounded-lg bg-surface hover:border-accent/30 transition-colors">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 p-3 text-left"
      >
        <span className="mt-0.5 text-text-muted">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-accent text-sm font-medium">{control.id}</span>
            <span className="text-sm text-text-primary">{control.title}</span>
            {control.isNew2022 && <Badge variant="new" small>NEW 2022</Badge>}
          </div>
          {!compact && (
            <p className="text-xs text-text-secondary mt-1 line-clamp-2">{control.summary}</p>
          )}
          <div className="flex flex-wrap gap-1 mt-1.5">
            <Badge variant="default" small>{control.category}</Badge>
            {control.controlType.map(t => (
              <Badge key={t} variant={t === 'Preventive' ? 'blue' : t === 'Detective' ? 'detective' : 'corrective'} small>{t}</Badge>
            ))}
          </div>
        </div>
        {onAddToCheatsheet && (
          <button
            onClick={e => { e.stopPropagation(); onAddToCheatsheet(control.id); }}
            className="p-1 text-text-muted hover:text-accent transition-colors"
            title="Add to cheatsheet"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <h4 className="font-semibold text-text-secondary mb-1">Security Properties</h4>
                  <div className="flex flex-wrap gap-1">
                    {control.securityProperties.map(p => <Badge key={p} small>{p}</Badge>)}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-text-secondary mb-1">Cybersecurity Concepts</h4>
                  <div className="flex flex-wrap gap-1">
                    {control.cybersecurityConcepts.map(c => <Badge key={c} small>{c}</Badge>)}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-text-secondary mb-1">Operational Capabilities</h4>
                  <div className="flex flex-wrap gap-1">
                    {control.operationalCapabilities.map(o => <Badge key={o} small>{o}</Badge>)}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-text-secondary mb-1">Security Domains</h4>
                  <div className="flex flex-wrap gap-1">
                    {control.securityDomains.map(d => <Badge key={d} small>{d}</Badge>)}
                  </div>
                </div>
              </div>

              <Section title="Implementation Guidance">
                <p className="text-xs text-text-secondary">{control.implementationGuidance}</p>
              </Section>

              <Section title="Audit Questions">
                <ul className="space-y-1">
                  {control.auditQuestions.map((q, i) => (
                    <li key={i} className="text-xs text-text-secondary flex gap-2">
                      <span className="text-accent font-mono">Q{i + 1}</span>
                      <span>{q}</span>
                    </li>
                  ))}
                </ul>
              </Section>

              <Section title="Typical Evidence">
                <ul className="space-y-0.5">
                  {control.typicalEvidence.map((e, i) => (
                    <li key={i} className="text-xs text-text-secondary flex gap-2">
                      <span className="text-status-green">✓</span>
                      <span>{e}</span>
                    </li>
                  ))}
                </ul>
              </Section>

              <Section title="Common Gaps">
                <ul className="space-y-0.5">
                  {control.commonGaps.map((g, i) => (
                    <li key={i} className="text-xs text-text-secondary flex gap-2">
                      <span className="text-status-red">⚠</span>
                      <span>{g}</span>
                    </li>
                  ))}
                </ul>
              </Section>

              <Section title="Consultant Tips">
                <ul className="space-y-0.5">
                  {control.tips.map((t, i) => (
                    <li key={i} className="text-xs text-text-secondary flex gap-2">
                      <span className="text-accent">★</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </Section>

              {control.relatedControls.length > 0 && (
                <Section title="Related Controls">
                  <div className="flex flex-wrap gap-1">
                    {control.relatedControls.map(r => (
                      <span key={r} className="text-xs font-mono text-accent bg-accent/10 px-1.5 py-0.5 rounded">{r}</span>
                    ))}
                  </div>
                </Section>
              )}

              {control.relatedClauses.length > 0 && (
                <Section title="Related Clauses">
                  <div className="flex flex-wrap gap-1">
                    {control.relatedClauses.map(r => (
                      <span key={r} className="text-xs font-mono text-copper bg-copper/10 px-1.5 py-0.5 rounded">{r}</span>
                    ))}
                  </div>
                </Section>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">{title}</h4>
      {children}
    </div>
  );
}
