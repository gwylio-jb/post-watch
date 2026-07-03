import { useEffect, useRef, useState, useMemo } from 'react';
import { Search, X, BookOpen, Shield, HelpCircle, FileCheck, Clock, Sparkles, AlertTriangle, FileText, Users, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { SearchResult } from '../../hooks/useSearch';
import type { AppSection, RiskItem, Client, GapAnalysisSession } from '../../data/types';
import type { AuditReport, AiSettings } from '../../data/auditTypes';
import { useSearchHistory } from '../../hooks/useSearchHistory';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { planAndExecute, type PlanOutcome } from '../../utils/ai/planQuery';
import type { QueryResult } from '../../utils/ai/queryExecutor';

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

const nlIconForCollection: Record<QueryResult['collection'], React.ElementType> = {
  risks: AlertTriangle,
  reports: FileText,
  sessions: FileCheck,
  clients: Users,
};

const nlSectionForCollection: Record<QueryResult['collection'], AppSection> = {
  risks: 'post_risk',
  reports: 'post_scan',
  sessions: 'post_comply',
  clients: 'post_clients',
};

/**
 * Sprint 20: heuristic for "is this a natural-language question worth
 * asking the local LLM about?". Cheap to avoid lighting up Ollama for
 * every keystroke — we only show the affordance when the query looks
 * like a sentence rather than a token.
 */
function looksLikeQuestion(q: string): boolean {
  if (q.length < 12) return false;
  if (/\s/.test(q) === false) return false; // single word
  return /\b(show|list|find|what|which|all|any|recent|last|open|critical|high|risks?|reports?|clients?|sessions?)\b/i.test(q);
}

export default function GlobalSearch({ isOpen, onClose, query, onQueryChange, results, onResultClick, onNavigate }: GlobalSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Sprint 19: per-scope search history.
  const { history, push: pushHistory, clear: clearHistory } = useSearchHistory('global-search');

  // Sprint 20: pull the data + AI settings the planner needs. These are
  // all already persisted under their existing keys — we don't own the
  // schema, just read it.
  const [risks] = useLocalStorage<RiskItem[]>('post-watch:risks', []);
  const [reports] = useLocalStorage<AuditReport[]>('wp-audit-reports', []);
  const [sessions] = useLocalStorage<GapAnalysisSession[]>('gap-sessions', []);
  const [clients] = useLocalStorage<Client[]>('clients', []);
  const [aiSettings] = useLocalStorage<AiSettings>('ai-settings', {});

  // NL search state — kept local because it only matters while this
  // modal is open and resets on close.
  const [nlBusy, setNlBusy] = useState(false);
  const [nlOutcome, setNlOutcome] = useState<PlanOutcome | null>(null);
  /** In-flight NL request; aborted when the modal closes. */
  const nlAbortRef = useRef<AbortController | null>(null);

  const data = useMemo(() => ({
    risks: Array.isArray(risks) ? risks : [],
    reports: Array.isArray(reports) ? reports : [],
    sessions: Array.isArray(sessions) ? sessions : [],
    clients: Array.isArray(clients) ? clients : [],
  }), [risks, reports, sessions, clients]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      // Reset NL state when the modal closes so a stale plan doesn't
      // flash back into view on next open — and abort any in-flight
      // Ollama request so it can't setState on the closed modal.
      nlAbortRef.current?.abort();
      nlAbortRef.current = null;
      setNlOutcome(null);
      setNlBusy(false);
    }
  }, [isOpen]);

  // Clear the NL outcome whenever the query text changes — the plan was
  // for the previous question.
  useEffect(() => {
    if (nlOutcome) setNlOutcome(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const handleResultClick = (result: SearchResult) => {
    if (query.trim()) pushHistory(query);
    onResultClick(result);
    onClose();
  };

  const askNl = async () => {
    if (!query.trim() || nlBusy) return;
    setNlBusy(true);
    setNlOutcome(null);
    const controller = new AbortController();
    nlAbortRef.current = controller;
    try {
      const outcome = await planAndExecute({
        question: query.trim(),
        data,
        settings: aiSettings ?? {},
        signal: controller.signal,
      });
      // Aborted = the modal closed; its state was already reset.
      if (controller.signal.aborted) return;
      setNlOutcome(outcome);
      if (outcome.kind === 'ok') pushHistory(query.trim());
    } finally {
      if (nlAbortRef.current === controller) nlAbortRef.current = null;
      if (!controller.signal.aborted) setNlBusy(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Cmd/Ctrl+Enter dispatches the NL planner explicitly. Plain Enter
    // just records to history so the substring search results stay
    // primary for short, token-y queries.
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void askNl();
      return;
    }
    if (e.key === 'Enter' && query.trim()) {
      pushHistory(query);
    }
  };

  const handleNlResultClick = (r: QueryResult) => {
    pushHistory(query.trim());
    onNavigate(nlSectionForCollection[r.collection], r.id);
    onClose();
  };

  const showNlSuggest = looksLikeQuestion(query) && !nlOutcome && !nlBusy;

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
                onKeyDown={handleKeyDown}
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

            {showNlSuggest && (
              <button
                onClick={askNl}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-alt transition-colors text-left border-b border-border/50"
              >
                <Sparkles className="w-4 h-4 text-accent flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary">Ask Post_Watch: <em>"{query.trim()}"</em></p>
                  <p className="text-[10px] text-text-muted mt-0.5">Local AI — uses your installed Ollama model</p>
                </div>
                <kbd className="text-[10px] text-text-muted bg-surface-alt px-1.5 py-0.5 rounded font-mono border border-border">⌘↵</kbd>
              </button>
            )}

            {nlBusy && (
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 text-sm text-text-muted">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Asking local AI…</span>
              </div>
            )}

            {nlOutcome?.kind === 'ok' && nlOutcome.results.length > 0 && (
              <div className="max-h-[60vh] overflow-y-auto">
                <div className="px-4 py-2 bg-surface-alt/50 border-b border-border/50">
                  <span className="text-[10px] uppercase tracking-wider font-mono text-accent">AI · {nlOutcome.plan.collection}</span>
                  {nlOutcome.plan.summary && (
                    <p className="text-xs text-text-muted mt-0.5">{nlOutcome.plan.summary}</p>
                  )}
                </div>
                {nlOutcome.results.map(r => {
                  const Icon = nlIconForCollection[r.collection];
                  return (
                    <button
                      key={`${r.collection}-${r.id}`}
                      onClick={() => handleNlResultClick(r)}
                      className="w-full flex items-start gap-3 px-4 py-3 hover:bg-surface-alt transition-colors text-left border-b border-border/50"
                    >
                      <Icon className="w-4 h-4 text-text-muted mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text-primary truncate">{r.title}</p>
                        {r.subtitle && <p className="text-xs text-text-muted truncate mt-0.5">{r.subtitle}</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {nlOutcome?.kind === 'ok' && nlOutcome.results.length === 0 && (
              <div className="px-4 py-6 text-center text-text-muted text-sm">
                AI found no matches for "{query}".
              </div>
            )}

            {nlOutcome?.kind === 'failed' && (
              <div className="px-4 py-4 text-xs text-text-muted border-b border-border/50">
                {nlOutcome.reason === 'no-model' && 'Configure a local AI model in Settings to use natural-language search.'}
                {nlOutcome.reason === 'unreachable' && 'Could not reach Ollama. Is it running?'}
                {nlOutcome.reason === 'model-missing' && (nlOutcome.detail ?? 'Selected model is not installed.')}
                {nlOutcome.reason === 'unparseable' && 'The AI response wasn\'t a valid query. Try rephrasing.'}
                {nlOutcome.reason === 'http' && (nlOutcome.detail ?? 'AI request failed.')}
                {nlOutcome.reason === 'aborted' && 'AI request cancelled.'}
              </div>
            )}

            {results.length > 0 && (
              <div className="max-h-[60vh] overflow-y-auto">
                {results.map((result, i) => {
                  const Icon = typeIcons[result.type] || Shield;
                  return (
                    <button
                      key={`${result.type}-${result.id}-${i}`}
                      onClick={() => handleResultClick(result)}
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

            {query.length >= 2 && results.length === 0 && !nlBusy && !nlOutcome && !showNlSuggest && (
              <div className="px-4 py-8 text-center text-text-muted text-sm">
                No results found for "{query}"
              </div>
            )}

            {query.length < 2 && (
              <div className="px-4 py-4">
                {history.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider font-mono text-text-muted">Recent</span>
                      <button
                        onClick={clearHistory}
                        className="text-[10px] text-text-muted hover:text-text-primary"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {history.map(q => (
                        <button
                          key={q}
                          onClick={() => onQueryChange(q)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-alt text-xs text-text-primary hover:bg-surface-alt/70 border border-border"
                        >
                          <Clock className="w-3 h-3 text-text-muted" />
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="py-2 text-center text-text-muted text-xs">
                    Type a search, or ask a question like "show me high-severity risks for Acme"
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
