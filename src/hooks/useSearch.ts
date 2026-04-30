import { useState, useMemo, useRef, useEffect } from 'react';
import type { ManagementClause, AnnexAControl } from '../data/types';

export interface SearchResult {
  type: 'clause' | 'control' | 'question' | 'evidence';
  id: string;
  title: string;
  matchText: string;
  parentId?: string;
  parentTitle?: string;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '');
}

function fuzzyMatch(query: string, text: string): boolean {
  const nq = normalize(query);
  const nt = normalize(text);
  if (nt.includes(nq)) return true;
  const words = nq.split(/\s+/);
  return words.every(w => nt.includes(w));
}

function scoreMatch(query: string, text: string): number {
  const nq = normalize(query);
  const nt = normalize(text);
  if (nt === nq) return 100;
  if (nt.startsWith(nq)) return 90;
  if (nt.includes(nq)) return 70;
  const words = nq.split(/\s+/);
  const matchCount = words.filter(w => nt.includes(w)).length;
  return (matchCount / words.length) * 50;
}

export function useSearch(clauses: ManagementClause[], controls: AnnexAControl[]) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQuery(query), 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query]);

  const results = useMemo((): SearchResult[] => {
    if (!debouncedQuery || debouncedQuery.length < 2) return [];
    const q = debouncedQuery;
    const all: (SearchResult & { score: number })[] = [];

    for (const clause of clauses) {
      const text = `${clause.id} ${clause.title} ${clause.summary}`;
      if (fuzzyMatch(q, text)) {
        all.push({
          type: 'clause', id: clause.id, title: clause.title,
          matchText: clause.summary.slice(0, 120),
          score: scoreMatch(q, text),
        });
      }
      for (const aq of clause.auditQuestions) {
        if (fuzzyMatch(q, aq)) {
          all.push({
            type: 'question', id: clause.id, title: aq.slice(0, 100),
            matchText: aq, parentId: clause.id, parentTitle: clause.title,
            score: scoreMatch(q, aq),
          });
        }
      }
      for (const ev of clause.typicalEvidence) {
        if (fuzzyMatch(q, ev)) {
          all.push({
            type: 'evidence', id: clause.id, title: ev.slice(0, 100),
            matchText: ev, parentId: clause.id, parentTitle: clause.title,
            score: scoreMatch(q, ev),
          });
        }
      }
    }

    for (const ctrl of controls) {
      const text = `${ctrl.id} ${ctrl.title} ${ctrl.summary} ${ctrl.implementationGuidance}`;
      if (fuzzyMatch(q, text)) {
        all.push({
          type: 'control', id: ctrl.id, title: ctrl.title,
          matchText: ctrl.summary.slice(0, 120),
          score: scoreMatch(q, text),
        });
      }
      for (const aq of ctrl.auditQuestions) {
        if (fuzzyMatch(q, aq)) {
          all.push({
            type: 'question', id: ctrl.id, title: aq.slice(0, 100),
            matchText: aq, parentId: ctrl.id, parentTitle: ctrl.title,
            score: scoreMatch(q, aq),
          });
        }
      }
      for (const ev of ctrl.typicalEvidence) {
        if (fuzzyMatch(q, ev)) {
          all.push({
            type: 'evidence', id: ctrl.id, title: ev.slice(0, 100),
            matchText: ev, parentId: ctrl.id, parentTitle: ctrl.title,
            score: scoreMatch(q, ev),
          });
        }
      }
      for (const gap of ctrl.commonGaps) {
        if (fuzzyMatch(q, gap)) {
          all.push({
            type: 'evidence', id: ctrl.id, title: gap.slice(0, 100),
            matchText: gap, parentId: ctrl.id, parentTitle: ctrl.title,
            score: scoreMatch(q, gap),
          });
        }
      }
    }

    all.sort((a, b) => b.score - a.score);
    return all.slice(0, 50);
  }, [debouncedQuery, clauses, controls]);

  return { query, setQuery, results, debouncedQuery };
}
