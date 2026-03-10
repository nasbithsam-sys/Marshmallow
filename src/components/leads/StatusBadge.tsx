import { LEAD_STATUS_CONFIG, type LeadStatus } from '@/types';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: LeadStatus;
  size?: 'sm' | 'md';
}

const dotColorMap: Record<string, string> = {
  'status-red': 'bg-red-500',
  'status-amber': 'bg-amber-500',
  'status-blue': 'bg-primary',
  'status-green': 'bg-emerald-500',
  'status-muted': 'bg-muted-foreground/50',
};

const bgColorMap: Record<string, string> = {
  'status-red': 'bg-red-50 text-red-700 border-red-100',
  'status-amber': 'bg-amber-50 text-amber-700 border-amber-100',
  'status-blue': 'bg-primary/5 text-primary border-primary/10',
  'status-green': 'bg-emerald-50 text-emerald-700 border-emerald-100',
  'status-muted': 'bg-muted text-muted-foreground border-border',
};

const StatusBadge = ({ status, size = 'md' }: StatusBadgeProps) => {
  const config = LEAD_STATUS_CONFIG[status];
  if (!config) return null;

  const isUrgent = status === 'urgent_job';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium border transition-all duration-200',
        bgColorMap[config.color] ?? bgColorMap['status-muted'],
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
        isUrgent && 'ring-1 ring-red-200 shadow-sm shadow-red-100'
      )}
    >
      <span
        className={cn(
          'rounded-full shrink-0',
          dotColorMap[config.color] ?? dotColorMap['status-muted'],
          size === 'sm' ? 'w-1 h-1' : 'w-1.5 h-1.5',
          isUrgent && 'status-pulse'
        )}
      />
      {config.label}
    </span>
  );
};

export default StatusBadge;
