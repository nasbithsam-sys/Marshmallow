import { LEAD_STATUS_CONFIG, type LeadStatus } from '@/types';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: LeadStatus;
}

const dotColorMap: Record<string, string> = {
  'status-red': 'bg-red-500',
  'status-amber': 'bg-amber-500',
  'status-blue': 'bg-blue-500',
  'status-green': 'bg-green-500',
  'status-muted': 'bg-muted-foreground/50',
};

const bgColorMap: Record<string, string> = {
  'status-red': 'bg-red-50 text-red-700',
  'status-amber': 'bg-amber-50 text-amber-700',
  'status-blue': 'bg-blue-50 text-blue-700',
  'status-green': 'bg-green-50 text-green-700',
  'status-muted': 'bg-muted text-muted-foreground',
};

const StatusBadge = ({ status }: StatusBadgeProps) => {
  const config = LEAD_STATUS_CONFIG[status];
  if (!config) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        bgColorMap[config.color] ?? bgColorMap['status-muted']
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', dotColorMap[config.color] ?? dotColorMap['status-muted'])} />
      {config.label}
    </span>
  );
};

export default StatusBadge;
