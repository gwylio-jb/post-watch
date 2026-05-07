import { useMemo, useState } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import type {
  SavedCheatsheet,
  GapAnalysisSession,
  ImplementationSession,
  Client,
} from '../data/types';
import { UNASSIGNED_CLIENT_ID } from '../utils/clientMigration';

// The "Saved items" dashboard is a read-only overview of everything the user
// has created across compliance-adjacent modules. V2.1: everything is grouped
// by client so a single customer's paper trail reads top-to-bottom.

export default function SavedItems() {
  const [cheatsheets] = useLocalStorage<SavedCheatsheet[]>('cheatsheets', []);
  const [gapSessions] = useLocalStorage<GapAnalysisSession[]>('gap-sessions', []);
  const [implSessions] = useLocalStorage<ImplementationSession[]>('impl-sessions', []);
  const [clients] = useLocalStorage<Client[]>('clients', []);
  const [scope, setScope] = useState<'all' | string>('all');

  const safeCheat = Array.isArray(cheatsheets) ? cheatsheets : [];
  const safeGap = Array.isArray(gapSessions) ? gapSessions : [];
  const safeImpl = Array.isArray(implSessions) ? implSessions : [];
  // useMemo so the empty-array fallback keeps stable identity across
  // renders — without it, every consuming useMemo's deps churn.
  const safeClients = useMemo(() => Array.isArray(clients) ? clients : [], [clients]);

  const pickerClients = useMemo<Client[]>(() => {
    if (safeClients.some(c => c.id === UNASSIGNED_CLIENT_ID)) return safeClients;
    return [
      { id: UNASSIGNED_CLIENT_ID, name: 'Unassigned', createdAt: new Date(0).toISOString() },
      ...safeClients,
    ];
  }, [safeClients]);

  const clientName = (id?: string) =>
    pickerClients.find(c => c.id === (id ?? UNASSIGNED_CLIENT_ID))?.name ?? 'Unassigned';

  const filterByScope = <T extends { clientId?: string }>(arr: T[]): T[] =>
    scope === 'all' ? arr : arr.filter(i => (i.clientId ?? UNASSIGNED_CLIENT_ID) === scope);

  const audits = filterByScope(safeCheat);
  const gaps = filterByScope(safeGap);
  // ImplementationSession doesn't carry a clientId yet — keep ungrouped.
  const impls = safeImpl;

  const hasItems = audits.length > 0 || gaps.length > 0 || impls.length > 0;

  return (
    <div className="space-y-6">
      {/* Client filter */}
      {(safeCheat.length + safeGap.length) > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-text-muted">Client</span>
          <select
            value={scope}
            onChange={e => setScope(e.target.value)}
            className="text-xs bg-surface-alt border border-border rounded-md px-2 py-1 text-text-primary outline-none focus:border-accent/50"
          >
            <option value="all">All clients</option>
            {pickerClients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {!hasItems && (
        <div className="text-center py-12 text-text-muted text-sm">
          No saved items yet. Create audits, gap analyses, or implementation trackers to see them here.
        </div>
      )}

      {audits.length > 0 && (
        <Section title="Saved Audits" count={audits.length}>
          {groupByClient(audits).map(([cid, group]) => (
            <ClientGroup key={cid} name={clientName(cid)} count={group.length}>
              {group.map(s => (
                <ItemCard key={s.id} name={s.name} detail={`${s.items.length} items`} date={s.updatedAt} />
              ))}
            </ClientGroup>
          ))}
        </Section>
      )}

      {gaps.length > 0 && (
        <Section title="Gap Analysis Sessions" count={gaps.length}>
          {groupByClient(gaps).map(([cid, group]) => (
            <ClientGroup key={cid} name={clientName(cid)} count={group.length}>
              {group.map(s => (
                <ItemCard key={s.id} name={s.name} detail={`${s.items.length} items`} date={s.updatedAt} />
              ))}
            </ClientGroup>
          ))}
        </Section>
      )}

      {impls.length > 0 && (
        <Section title="Implementation Trackers" count={impls.length}>
          {impls.map(s => (
            <ItemCard key={s.id} name={s.name} detail={`${s.items.length} controls`} date={s.updatedAt} />
          ))}
        </Section>
      )}
    </div>
  );
}

function groupByClient<T extends { clientId?: string }>(items: T[]): [string, T[]][] {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const cid = it.clientId ?? UNASSIGNED_CLIENT_ID;
    if (!m.has(cid)) m.set(cid, []);
    m.get(cid)!.push(it);
  }
  return [...m.entries()];
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-text-secondary mb-2">
        {title} <span className="text-text-muted">({count})</span>
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function ClientGroup({ name, count, children }: { name: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-medium text-text-muted mb-1.5">
        {name} <span className="opacity-70">({count})</span>
      </h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ItemCard({ name, detail, date }: { name: string; detail: string; date: string }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-surface border border-border rounded-lg">
      <div className="flex-1">
        <p className="text-sm text-text-primary">{name}</p>
        <p className="text-xs text-text-muted">{detail} · Updated {new Date(date).toLocaleDateString('en-GB')}</p>
      </div>
    </div>
  );
}
