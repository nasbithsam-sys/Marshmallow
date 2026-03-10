import { LEAD_STATUS_CONFIG, type LeadStatus } from '@/types';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: LeadStatus;
  size?: 'sm' | 'md';
}

const dotColorMap: Record<string, string> = {
  'status-red': 'bg-[hsl(var(--status-red))]',
  'status-amber': 'bg-[hsl(var(--status-amber))]',
  'status-blue': 'bg-primary',
  'status-green': 'bg-[hsl(var(--status-green))]',
  'status-muted': 'bg-muted-foreground/40',
};

const bgColorMap: Record<string, string> = {
  'status-red': 'bg-[hsl(var(--status-red)/0.08)] text-[hsl(var(--status-red))] border-[hsl(var(--status-red)/0.12)]',
  'status-amber': 'bg-[hsl(var(--status-amber)/0.08)] text-[hsl(var(--status-amber))] border-[hsl(var(--status-amber)/0.12)]',
  'status-blue': 'bg-primary/6 text-primary border-primary/10',
  'status-green': 'bg-[hsl(var(--status-green)/0.08)] text-[hsl(var(--status-green))] border-[hsl(var(--status-green)/0.12)]',
  'status-muted': 'bg-muted text-muted-foreground border-border',
};

const StatusBadge = ({ status, size = 'md' }: StatusBadgeProps) => {
  const config = LEAD_STATUS_CONFIG[status];
  if (!config) return null;

  const isUrgent = status === 'urgent_job';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-semibold border transition-all duration-200',
        bgColorMap[config.color] ?? bgColorMap['status-muted'],
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]',
        isUrgent && 'ring-1 ring-[hsl(var(--status-red)/0.15)]'
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
