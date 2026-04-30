import type { CheatsheetItem, AnnexAControl, ManagementClause } from '../../data/types';

interface CheatsheetPreviewProps {
  items: CheatsheetItem[];
  controls: AnnexAControl[];
  clauses: ManagementClause[];
}

export default function CheatsheetPreview({ items, controls, clauses }: CheatsheetPreviewProps) {
  return (
    <div className="space-y-4 bg-surface border border-border rounded-lg p-4">
      <h3 className="font-semibold text-lg text-text-primary border-b border-border pb-2">Cheatsheet Preview</h3>
      {items.map(item => {
        const source = item.itemType === 'control'
          ? controls.find(c => c.id === item.itemId)
          : clauses.find(c => c.id === item.itemId);
        if (!source) return null;
        return (
          <div key={item.itemId} className="border-b border-border/50 pb-4 last:border-0">
            <h4 className="text-sm font-medium text-text-primary">
              <span className="font-mono text-accent">{source.id}</span> — {source.title}
              <span className="ml-2 text-[10px] text-text-muted uppercase bg-surface-alt px-1.5 py-0.5 rounded">{item.focus}</span>
            </h4>

            <div className="mt-2 space-y-2">
              <div>
                <h5 className="text-[10px] font-semibold text-text-muted uppercase mb-1">Audit Questions</h5>
                <ul className="space-y-0.5">
                  {source.auditQuestions.map((q, i) => (
                    <li key={i} className="text-xs text-text-secondary">
                      <span className="font-mono text-accent mr-1">Q{i + 1}.</span> {q}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h5 className="text-[10px] font-semibold text-text-muted uppercase mb-1">Evidence Checklist</h5>
                <ul className="space-y-0.5">
                  {source.typicalEvidence.map((e, i) => (
                    <li key={i} className="text-xs text-text-secondary flex items-center gap-2">
                      <input type="checkbox" className="rounded border-border bg-surface accent-accent w-3 h-3" />
                      {e}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h5 className="text-[10px] font-semibold text-text-muted uppercase mb-1">Watch For</h5>
                <ul className="space-y-0.5">
                  {source.commonGaps.map((g, i) => (
                    <li key={i} className="text-xs text-status-amber">⚠ {g}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
