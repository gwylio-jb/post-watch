import type { ComplianceStatus, ImplementationStatus } from '../../data/types';

const complianceColors: Record<ComplianceStatus, string> = {
  'Compliant': 'bg-status-green',
  'Partially Compliant': 'bg-status-amber',
  'Non-Compliant': 'bg-status-red',
  'Not Assessed': 'bg-text-muted',
  'Not Applicable': 'bg-surface-alt',
};

const implementationColors: Record<ImplementationStatus, string> = {
  'Not Started': 'bg-text-muted',
  'In Progress': 'bg-status-blue',
  'Implemented': 'bg-status-amber',
  'Verified': 'bg-status-green',
};

interface StatusIndicatorProps {
  status: ComplianceStatus | ImplementationStatus;
  type?: 'compliance' | 'implementation';
  showLabel?: boolean;
}

export default function StatusIndicator({ status, type = 'compliance', showLabel = true }: StatusIndicatorProps) {
  const colors = type === 'compliance' ? complianceColors : implementationColors;
  const color = colors[status as keyof typeof colors] || 'bg-text-muted';

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      {showLabel && <span className="text-xs text-text-secondary">{status}</span>}
    </span>
  );
}
