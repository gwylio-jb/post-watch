import type { GapAnalysisItem, ComplianceStatus } from '../../data/types';

interface GapDashboardProps {
  items: GapAnalysisItem[];
}

const statusColors: Record<ComplianceStatus, string> = {
  'Compliant': '#4ade80',
  'Partially Compliant': '#fbbf24',
  'Non-Compliant': '#f87171',
  'Not Assessed': '#6b6980',
  'Not Applicable': '#3a3858',
};

export default function GapDashboard({ items }: GapDashboardProps) {
  const counts: Record<ComplianceStatus, number> = {
    'Compliant': 0,
    'Partially Compliant': 0,
    'Non-Compliant': 0,
    'Not Assessed': 0,
    'Not Applicable': 0,
  };

  for (const item of items) {
    counts[item.status]++;
  }

  const assessed = items.filter(i => i.status !== 'Not Assessed' && i.status !== 'Not Applicable');
  const compliantCount = counts['Compliant'];
  const compliancePercentage = assessed.length > 0 ? Math.round((compliantCount / assessed.length) * 100) : 0;

  const highPriorityGaps = items.filter(i => i.priority === 'High' && (i.status === 'Non-Compliant' || i.status === 'Partially Compliant'));

  const total = items.length;
  const segments = Object.entries(counts).filter(([, count]) => count > 0);

  // Donut chart
  const size = 160;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let currentOffset = 0;
  const arcs = segments.map(([status, count]) => {
    const pct = count / total;
    const length = pct * circumference;
    const offset = currentOffset;
    currentOffset += length;
    return { status, count, length, offset, color: statusColors[status as ComplianceStatus] };
  });

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="bg-surface border border-border rounded-lg p-4 flex flex-col items-center justify-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
          {arcs.map(arc => (
            <circle
              key={arc.status}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${arc.length} ${circumference - arc.length}`}
              strokeDashoffset={-arc.offset}
            />
          ))}
        </svg>
        <div className="text-center mt-2">
          <span className="text-2xl font-bold text-text-primary">{compliancePercentage}%</span>
          <p className="text-[10px] text-text-muted">Compliance Rate</p>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg p-4">
        <h4 className="text-xs font-semibold text-text-secondary uppercase mb-3">Status Breakdown</h4>
        <div className="space-y-2">
          {Object.entries(counts).map(([status, count]) => (
            <div key={status} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: statusColors[status as ComplianceStatus] }} />
                <span className="text-text-secondary">{status}</span>
              </div>
              <span className="font-mono text-text-primary">{count}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-2 border-t border-border/50 flex justify-between text-xs">
          <span className="text-text-muted">Total</span>
          <span className="font-mono text-text-primary">{total}</span>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg p-4">
        <h4 className="text-xs font-semibold text-text-secondary uppercase mb-3">
          High Priority Gaps
          <span className="ml-1 text-status-red">({highPriorityGaps.length})</span>
        </h4>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {highPriorityGaps.length === 0 ? (
            <p className="text-xs text-text-muted">No high-priority gaps</p>
          ) : (
            highPriorityGaps.map(item => (
              <div key={item.itemId} className="flex items-center gap-2 text-xs">
                <span className="font-mono text-accent">{item.itemId}</span>
                <span className={item.status === 'Non-Compliant' ? 'text-status-red' : 'text-status-amber'}>
                  {item.status === 'Non-Compliant' ? '●' : '◐'}
                </span>
                <span className="text-text-secondary truncate">{item.notes || item.status}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
