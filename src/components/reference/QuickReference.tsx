import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { referenceCards } from '../../data/quickReference';

export default function QuickReference() {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    const next = new Set(expandedCards);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedCards(next);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-text-muted mb-4">
        Pre-built reference cards for common consultant scenarios. Click to expand.
      </p>
      {referenceCards.map(card => {
        const isExpanded = expandedCards.has(card.id);
        return (
          <div key={card.id} className="border border-border rounded-lg bg-surface overflow-hidden">
            <button
              onClick={() => toggle(card.id)}
              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-surface-alt transition-colors text-left"
            >
              {isExpanded ? <ChevronDown className="w-4 h-4 text-accent mt-0.5" /> : <ChevronRight className="w-4 h-4 text-text-muted mt-0.5" />}
              <div>
                <h3 className="font-semibold text-text-primary">{card.title}</h3>
                <p className="text-xs text-text-secondary mt-0.5">{card.description}</p>
              </div>
            </button>
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-6 pb-4 border-t border-border/50 pt-3 space-y-4">
                    {card.content.map((section, i) => (
                      <div key={i}>
                        <h4 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">{section.heading}</h4>
                        <ul className="space-y-1">
                          {section.items.map((item, j) => (
                            <li key={j} className="text-xs text-text-secondary flex gap-2">
                              <span className="text-accent mt-0.5">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
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
