import { Lead, LeadStatus, STATUS_LABELS, STATUS_COLORS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useMemo } from "react";
import { Info } from "lucide-react";

interface AreaStatusBreakdownProps {
  leads: Lead[];
  areaName: string;
}

const CLOSED_STATUSES: LeadStatus[] = ["job_done", "paid"];
const CANCELLED_STATUSES: LeadStatus[] = ["cancelled"];

const STATUS_BAR_COLORS: Record<string, string> = {
  job_done: "hsl(142, 71%, 45%)",
  paid: "hsl(142, 71%, 38%)",
  cancelled: "hsl(0, 84%, 60%)",
  urgent_job: "hsl(0, 84%, 55%)",
  scheduled: "hsl(189, 94%, 43%)",
  job_in_progress: "hsl(199, 89%, 48%)",
  needs_quote: "hsl(263, 70%, 58%)",
  payment_pending: "hsl(85, 78%, 42%)",
  partial_paid: "hsl(142, 71%, 41%)",
  waiting_complete_details: "hsl(38, 92%, 50%)",
  quote_sent_waiting: "hsl(221, 83%, 53%)",
  quote_sent_need_follow_up: "hsl(25, 95%, 53%)",
  waiting_customer_response: "hsl(45, 93%, 47%)",
  need_tech: "hsl(239, 84%, 67%)",
  needs_reschedule: "hsl(347, 77%, 50%)",
  exclude_mature_lead: "hsl(0, 0%, 60%)",
};

export default function AreaStatusBreakdown({ leads, areaName }: AreaStatusBreakdownProps) {
  const { statusCounts, closedCount, cancelledCount } = useMemo(() => {
    const counts: Record<string, number> = {};
    let closed = 0;
    let cancelled = 0;
    leads.forEach((l) => {
      counts[l.status] = (counts[l.status] || 0) + 1;
      if (CLOSED_STATUSES.includes(l.status as LeadStatus)) closed++;
      if (CANCELLED_STATUSES.includes(l.status as LeadStatus)) cancelled++;
    });
    return { statusCounts: counts, closedCount: closed, cancelledCount: cancelled };
  }, [leads]);

  const total = leads.length;
  const closePct = total > 0 ? ((closedCount / total) * 100).toFixed(1) : "0";
  const cancelPct = total > 0 ? ((cancelledCount / total) * 100).toFixed(1) : "0";
  const activePct = total > 0 ? (((total - closedCount - cancelledCount) / total) * 100).toFixed(1) : "0";

  const sortedStatuses = Object.entries(statusCounts).sort((a, b) => b[1] - a[1]);

  return (
    <Card className="border-border/40 overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-primary/[0.03] to-transparent">
        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Info className="h-4 w-4 text-primary" />
          Status Breakdown — {areaName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-3 gap-3">
          <SummaryTile value={total - closedCount - cancelledCount} label="Active" pct={`${activePct}%`} className="bg-primary/[0.06] border-primary/20" valueClass="text-primary" />
          <SummaryTile value={closedCount} label="Closed" pct={`${closePct}%`} className="bg-emerald-500/[0.06] border-emerald-500/20" valueClass="text-emerald-600" />
          <SummaryTile value={cancelledCount} label="Cancelled" pct={`${cancelPct}%`} className="bg-destructive/[0.06] border-destructive/20" valueClass="text-destructive" />
        </div>

        {total > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
              <span>Status Distribution</span>
              <span>{total} total</span>
            </div>
            <div className="h-5 rounded-lg overflow-hidden flex bg-muted/50 shadow-inner">
              {sortedStatuses.map(([status, count]) => {
                const widthPct = (count / total) * 100;
                return (
                  <div
                    key={status}
                    className="h-full transition-all duration-500 first:rounded-l-lg last:rounded-r-lg"
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: STATUS_BAR_COLORS[status] || "hsl(var(--muted-foreground))",
                    }}
                    title={`${STATUS_LABELS[status as LeadStatus]}: ${count} (${widthPct.toFixed(1)}%)`}
                  />
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {sortedStatuses.map(([status, count]) => (
            <Badge key={status} variant="outline" className={cn("text-[11px] px-2.5 py-1 font-medium", STATUS_COLORS[status as LeadStatus])}>
              {STATUS_LABELS[status as LeadStatus]}: {count}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryTile({ value, label, pct, className, valueClass }: {
  value: number; label: string; pct: string; className: string; valueClass: string;
}) {
  return (
    <div className={cn("rounded-xl border p-3.5 text-center transition-all", className)}>
      <p className={cn("text-2xl font-bold leading-tight tabular-nums", valueClass)}>{value}</p>
      <p className="text-[11px] text-muted-foreground font-medium mt-0.5">{label} · {pct}</p>
    </div>
  );
}