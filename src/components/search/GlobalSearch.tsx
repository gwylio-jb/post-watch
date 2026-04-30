import { useEffect, useRef } from 'react';
import { Search, X, BookOpen, Shield, HelpCircle, FileCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SearchResult } from '../../hooks/useSearch';
import type { AppSection } from '../../data/types';

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  query: string;
  onQueryChange: (q: string) => void;
  results: SearchResult[];
  onResultClick: (result: SearchResult) => void;
  onNavigate: (section: AppSection, id?: string) => void;
}

const typeIcons: Record<string, React.ElementType> = {
  clause: BookOpen,
  control: Shield,
  question: HelpCircle,
  evidence: FileCheck,
};

const typeLabels: Record<string, string> = {
  clause: 'Clause',
  control: 'Control',
  question: 'Audit Question',
  evidence: 'Evidence',
};

export default function GlobalSearch({ isOpen, onClose, query, onQueryChange, results, onResultClick }: GlobalSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4"
          onClick={onClose}
        >
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="relative w-full max-w-2xl bg-surface border border-border rounded-xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <Search className="w-5 h-5 text-text-muted" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => onQueryChange(e.target.value)}
                placeholder="Search clauses, controls, audit questions, evidence..."
                className="flex-1 bg-transparent text-text-primary placeholder-text-muted outline-none text-sm"
              />
              {query && (
                <button onClick={() => onQueryChange('')} className="p-1 text-text-muted hover:text-text-primary">
                  <X className="w-4 h-4" />
                </button>
              )}
              <kbd className="text-[10px] text-text-muted bg-surface-alt px-1.5 py-0.5 rounded font-mono border border-border">ESC</kbd>
            </div>

            {results.length > 0 && (
              <div className="max-h-[60vh] overflow-y-auto">
                {results.map((result, i) => {
                  const Icon = typeIcons[result.type] || Shield;
                  return (
                    <button
                      key={`${result.type}-${result.id}-${i}`}
                      onClick={() => { onResultClick(result); onClose(); }}
                      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-surface-alt transition-colors text-left border-b border-border/50"
                    >
                      <Icon className="w-4 h-4 text-text-muted mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-accent uppercase">{typeLabels[result.type]}</span>
                          <span className="text-xs font-mono text-text-muted">{result.id}</span>
                        </div>
                        <p className="text-sm text-text-primary truncate">{result.title}</p>
                        <p className="text-xs text-text-muted truncate mt-0.5">{result.matchText}</p>
                        {result.parentTitle && (
                          <p className="text-[10px] text-text-muted mt-0.5">in {result.parentId} — {result.parentTitle}</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {query.length >= 2 && results.length === 0 && (
              <div className="px-4 py-8 text-center text-text-muted text-sm">
                No results found for "{query}"
              </div>
            )}

            {query.length < 2 && (
              <div className="px-4 py-6 text-center text-text-muted text-xs">
                Type at least 2 characters to search across clauses, controls, audit questions, and evidence
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
