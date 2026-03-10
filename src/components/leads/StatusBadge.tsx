import { LEAD_STATUS_CONFIG, type LeadStatus } from '@/types';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: LeadStatus;
}

const colorMap: Record<string, string> = {
  'status-red': 'bg-red-100 text-red-800 border-red-200',
  'status-amber': 'bg-amber-100 text-amber-800 border-amber-200',
  'status-blue': 'bg-blue-100 text-blue-800 border-blue-200',
  'status-green': 'bg-green-100 text-green-800 border-green-200',
  'status-muted': 'bg-muted text-muted-foreground border-border',
};

const StatusBadge = ({ status }: StatusBadgeProps) => {
  const config = LEAD_STATUS_CONFIG[status];
  if (!config) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border',
        colorMap[config.color] ?? colorMap['status-muted']
      )}
    >
      {config.label}
    </span>
  );
};

export default StatusBadge;
