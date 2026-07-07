import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Cell } from "recharts";
import { format, subDays, eachDayOfInterval, parseISO, startOfDay } from "date-fns";
import { TrendingUp, Users, Calendar, Sparkles, Activity, CheckCircle2, AlertTriangle, Clock3, DollarSign, Percent, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { heroTitle } from "@/lib/motion";

interface AnalyticsLeadRow {
  id: string;
  created_at: string;
  status: string;
  amount: number | null;
  payment_amount: number | null;
  service_type: string;
  number_name: string | null;
}

const ranges = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

const Analytics = () => {
  const [activeDays, setActiveDays] = useState(30);
  const startDate = format(subDays(new Date(), activeDays), "yyyy-MM-dd");
  const endDate = format(new Date(), "yyyy-MM-dd");

  // Fetch full details of all leads
  const { data: allLeads = [] } = useQuery<AnalyticsLeadRow[]>({
    queryKey: ["analytics-total"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, status, created_at, amount, payment_amount, service_type, number_name");
      if (error) throw error;
      return (data ?? []) as AnalyticsLeadRow[];
    },
  });

  // Filter leads for the selected range (robust Date comparisons)
  const leads = useMemo(() => {
    const startMs = subDays(new Date(), activeDays).getTime();
    const endMs = new Date().getTime();
    return allLeads.filter((lead) => {
      const leadTime = new Date(lead.created_at).getTime();
      return leadTime >= startMs && leadTime <= endMs;
    });
  }, [allLeads, activeDays]);

  // Filter leads for the previous range of equal length (for comparison stats)
  const prevLeads = useMemo(() => {
    const endMs = subDays(new Date(), activeDays).getTime();
    const startMs = subDays(new Date(), activeDays * 2).getTime();
    return allLeads.filter((lead) => {
      const leadTime = new Date(lead.created_at).getTime();
      return leadTime >= startMs && leadTime <= endMs;
    });
  }, [allLeads, activeDays]);

  // Generate Date interval steps
  const days = useMemo(() => {
    return eachDayOfInterval({
      start: parseISO(startDate),
      end: parseISO(endDate),
    });
  }, [startDate, endDate]);

  // Lead growth/volume chart data
  const chartData = useMemo(() => {
    const countsByDate = new Map<string, number>();
    const revenueByDate = new Map<string, number>();

    for (const lead of leads) {
      const dateKey = lead.created_at.slice(0, 10);
      countsByDate.set(dateKey, (countsByDate.get(dateKey) ?? 0) + 1);
      revenueByDate.set(dateKey, (revenueByDate.get(dateKey) ?? 0) + (lead.payment_amount ?? 0));
    }

    return days.map((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      return {
        date: format(day, "MMM d"),
        count: countsByDate.get(dateStr) ?? 0,
        revenue: revenueByDate.get(dateStr) ?? 0,
      };
    });
  }, [days, leads]);

  // Cumulative Lead count chart data
  const cumulativeData = useMemo(() => {
    let runningLeads = 0;
    let runningRevenue = 0;
    return chartData.map((item) => {
      runningLeads += item.count;
      runningRevenue += item.revenue;
      return {
        date: item.date,
        totalLeads: runningLeads,
        totalRevenue: runningRevenue,
      };
    });
  }, [chartData]);

  // Calculate current range summaries
  const currentStats = useMemo(() => {
    const totalLeads = leads.length;
    const estimatedRevenue = leads.reduce((sum, l) => sum + (l.amount ?? 0), 0);
    const collectedRevenue = leads.reduce((sum, l) => sum + (l.payment_amount ?? 0), 0);
    const completedLeads = leads.filter(l => ["job_done", "paid", "partial_paid"].includes(l.status)).length;
    const conversionRate = totalLeads > 0 ? (completedLeads / totalLeads) * 100 : 0;

    return { totalLeads, estimatedRevenue, collectedRevenue, conversionRate };
  }, [leads]);

  // Calculate previous range summaries (for delta metrics)
  const prevStats = useMemo(() => {
    const totalLeads = prevLeads.length;
    const estimatedRevenue = prevLeads.reduce((sum, l) => sum + (l.amount ?? 0), 0);
    const collectedRevenue = prevLeads.reduce((sum, l) => sum + (l.payment_amount ?? 0), 0);
    const completedLeads = prevLeads.filter(l => ["job_done", "paid", "partial_paid"].includes(l.status)).length;
    const conversionRate = totalLeads > 0 ? (completedLeads / totalLeads) * 100 : 0;

    return { totalLeads, estimatedRevenue, collectedRevenue, conversionRate };
  }, [prevLeads]);

  // Calculate stats for all-time totals (not filtered by date)
  const summary = useMemo(() => {
    const todayStart = startOfDay(new Date());
    const weekAgo = subDays(new Date(), 7);
    const counts = {
      urgent: 0,
      scheduled: 0,
      done: 0,
      cancelled: 0,
      waiting: 0,
      today: 0,
      thisWeek: 0,
    };

    for (const lead of allLeads) {
      const createdAt = new Date(lead.created_at);

      if (createdAt >= weekAgo) counts.thisWeek += 1;
      if (createdAt >= todayStart) counts.today += 1;
      if (lead.status === "urgent_job") counts.urgent += 1;
      if (lead.status === "scheduled") counts.scheduled += 1;
      if (lead.status === "job_done" || lead.status === "paid") counts.done += 1;
      if (lead.status === "cancelled") counts.cancelled += 1;
      if (
        [
          "waiting_customer_response",
          "waiting_complete_details",
          "quote_sent_waiting",
          "quote_sent_need_follow_up",
          "needs_quote",
          "needs_reschedule",
        ].includes(lead.status)
      ) {
        counts.waiting += 1;
      }
    }

    return counts;
  }, [allLeads]);

  // Service Type Breakdown
  const serviceDistribution = useMemo(() => {
    const counts = new Map<string, { count: number; value: number }>();
    for (const lead of leads) {
      const type = lead.service_type?.trim() || "General / Unknown";
      const current = counts.get(type) ?? { count: 0, value: 0 };
      counts.set(type, {
        count: current.count + 1,
        value: current.value + (lead.amount ?? 0)
      });
    }
    return Array.from(counts.entries())
      .map(([name, data]) => ({ name, count: data.count, value: data.value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // top 5
  }, [leads]);

  // Lead Phone Source Breakdown
  const sourceDistribution = useMemo(() => {
    const counts = new Map<string, { count: number; value: number }>();
    for (const lead of leads) {
      const source = lead.number_name?.trim() || "Web / Scraper";
      const current = counts.get(source) ?? { count: 0, value: 0 };
      counts.set(source, {
        count: current.count + 1,
        value: current.value + (lead.amount ?? 0)
      });
    }
    return Array.from(counts.entries())
      .map(([name, data]) => ({ name, count: data.count, value: data.value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [leads]);

  // Format currencies beautifully
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(val);
  };

  const getGrowth = (current: number, prev: number) => {
    if (prev === 0) return current > 0 ? 100 : 0;
    const delta = ((current - prev) / prev) * 100;
    return Math.round(delta);
  };

  const formatDelta = (growth: number) => {
    if (growth > 0) return `+${growth}%`;
    if (growth < 0) return `${growth}%`;
    return "0%";
  };

  const stats = [
    {
      label: "Total Leads",
      value: currentStats.totalLeads,
      sub: `${formatDelta(getGrowth(currentStats.totalLeads, prevStats.totalLeads))} vs last period`,
      icon: Users,
      tone: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    },
    {
      label: "Est. Deal Value",
      value: formatCurrency(currentStats.estimatedRevenue),
      sub: `${formatDelta(getGrowth(currentStats.estimatedRevenue, prevStats.estimatedRevenue))} vs last period`,
      icon: DollarSign,
      tone: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    },
    {
      label: "Revenue Collected",
      value: formatCurrency(currentStats.collectedRevenue),
      sub: `${formatDelta(getGrowth(currentStats.collectedRevenue, prevStats.collectedRevenue))} vs last period`,
      icon: TrendingUp,
      tone: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    },
    {
      label: "Conversion Rate",
      value: `${currentStats.conversionRate.toFixed(1)}%`,
      sub: `${formatDelta(getGrowth(currentStats.conversionRate, prevStats.conversionRate))} vs last period`,
      icon: Percent,
      tone: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    },
  ];

  const statusSummary = [
    {
      label: "Urgent Attention",
      value: summary.urgent,
      icon: AlertTriangle,
      tone: "bg-red-500/10 text-red-400 border-red-500/20",
    },
    {
      label: "Scheduled Visits",
      value: summary.scheduled,
      icon: Calendar,
      tone: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    },
    {
      label: "Completed Jobs",
      value: summary.done,
      icon: CheckCircle2,
      tone: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    },
    {
      label: "Waiting Response",
      value: summary.waiting,
      icon: Clock3,
      tone: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    },
  ];

  const CustomCountTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ value: number }>;
    label?: string;
  }) => {
    if (!active || !payload?.length) return null;

    return (
      <div className="rounded-2xl border border-slate-800 bg-[#16171d] px-4 py-3 shadow-[0_18px_40px_-26px_rgba(0,0,0,0.45)]">
        <p className="text-[11px] font-medium text-slate-400">{label}</p>
        <p className="mt-1 text-sm font-semibold text-slate-100">{payload[0].value} leads</p>
      </div>
    );
  };

  const CustomRevenueTooltip = ({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ value: number }>;
    label?: string;
  }) => {
    if (!active || !payload?.length) return null;

    return (
      <div className="rounded-2xl border border-slate-800 bg-[#16171d] px-4 py-3 shadow-[0_18px_40px_-26px_rgba(0,0,0,0.45)]">
        <p className="text-[11px] font-medium text-slate-400">{label}</p>
        <p className="mt-1 text-sm font-semibold text-emerald-400">{formatCurrency(payload[0].value)}</p>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-[1450px] space-y-6 text-slate-100">
      {/* Header Block */}
      <div className="relative overflow-hidden rounded-[28px] border border-slate-800 bg-[#15161c] p-6 shadow-[0_22px_60px_-34px_rgba(0,0,0,0.45)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.02),transparent_28%)]" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <motion.div variants={heroTitle} initial="initial" animate="animate">
            <div className="mb-3 inline-flex items-center gap-1 rounded-full border border-blue-500/10 bg-blue-500/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-400">
              <Sparkles className="h-2.5 w-2.5" />
              Advanced Analytics
            </div>

            <h1 className="text-2xl font-bold tracking-[-0.03em] text-slate-100 sm:text-3xl">Business Overview</h1>
            <p className="mt-2 text-sm text-slate-400">
              Analyze leads performance, estimated values, conversion rates, and revenue trends.
            </p>
          </motion.div>

          <div className="inline-flex w-fit rounded-2xl border border-slate-800 bg-[#0e0f12] p-1.5 shadow-[0_14px_34px_-28px_rgba(0,0,0,0.35)]">
            {ranges.map((r) => (
              <button
                key={r.days}
                onClick={() => setActiveDays(r.days)}
                className={cn(
                  "rounded-xl px-4 py-2 text-[12px] font-semibold transition-all duration-200",
                  activeDays === r.days
                    ? "bg-[#1d1f27] text-slate-100 shadow-sm border border-slate-800/40"
                    : "text-slate-400 hover:text-slate-200",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label}>
            <Card className="rounded-2xl border border-slate-800 bg-[#15161c] shadow-[0_14px_40px_-28px_rgba(0,0,0,0.35)]">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {stat.label}
                    </p>
                    <p className="mt-2 text-2xl font-bold tracking-[-0.03em] text-slate-100 tabular-nums">
                      {stat.value}
                    </p>
                    <p className={cn(
                      "mt-1 text-[11px] font-medium flex items-center gap-1",
                      stat.sub.startsWith("-") ? "text-red-400" : stat.sub.startsWith("0") ? "text-slate-500" : "text-emerald-400"
                    )}>
                      {stat.sub}
                    </p>
                  </div>

                  <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl border", stat.tone)}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          {/* Daily Leads Volume */}
          <Card className="rounded-[28px] border border-slate-800 bg-[#15161c] shadow-[0_18px_52px_-34px_rgba(0,0,0,0.42)]">
            <CardContent className="p-6">
              <div className="mb-5">
                <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-slate-200">Daily Leads Intake</h3>
                <p className="mt-1 text-[12px] text-slate-400">Track the number of leads received daily over the period.</p>
              </div>

              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barCategoryGap={10}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#22242e" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<CustomCountTooltip />} cursor={{ fill: "rgba(255,255,255,0.02)" }} />
                    <Bar dataKey="count" fill="hsl(217, 91%, 60%)" radius={[8, 8, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Daily Revenue Growth Chart */}
          <Card className="rounded-[28px] border border-slate-800 bg-[#15161c] shadow-[0_18px_52px_-34px_rgba(0,0,0,0.42)]">
            <CardContent className="p-6">
              <div className="mb-5">
                <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-slate-200">Revenue Collections</h3>
                <p className="mt-1 text-[12px] text-slate-400">Total collected customer payments in selected range.</p>
              </div>

              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="revenueArea" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="hsl(142, 72%, 50%)" stopOpacity={0.24} />
                        <stop offset="100%" stopColor="hsl(142, 72%, 50%)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#22242e" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) => `$${v}`}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<CustomRevenueTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="hsl(142, 72%, 50%)"
                      strokeWidth={2.5}
                      fill="url(#revenueArea)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right sidebars */}
        <div className="space-y-6">
          {/* Status Overview Snapshot */}
          <Card className="rounded-[28px] border border-slate-800 bg-[#15161c] shadow-[0_18px_52px_-34px_rgba(0,0,0,0.42)]">
            <CardContent className="p-6">
              <div className="mb-4">
                <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-slate-200">CRM Pipelines Status</h3>
                <p className="mt-1 text-[12px] text-slate-400">
                  Global pipelines summary of all leads in database.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {statusSummary.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-2xl border border-slate-800/80 bg-[#0e0f12]/50 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("flex h-10 w-10 items-center justify-center rounded-2xl border", item.tone)}>
                        <item.icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-slate-200">{item.label}</p>
                        <p className="text-[11px] text-slate-500">Pipeline active leads</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-xl font-bold tracking-[-0.03em] text-slate-100 tabular-nums">
                        {item.value}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Service Types Performance */}
          <Card className="rounded-[28px] border border-slate-800 bg-[#15161c] shadow-[0_18px_52px_-34px_rgba(0,0,0,0.42)]">
            <CardContent className="p-6">
              <div className="mb-4">
                <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-slate-200">Top Service Sectors</h3>
                <p className="mt-1 text-[12px] text-slate-400">Distribution by estimated job valuation.</p>
              </div>

              {serviceDistribution.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">No services metadata recorded yet.</div>
              ) : (
                <div className="space-y-4">
                  {serviceDistribution.map((item) => (
                    <div key={item.name} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="truncate text-slate-300 flex items-center gap-1.5">
                          <Briefcase className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                          {item.name}
                        </span>
                        <span className="text-slate-100">{formatCurrency(item.value)}</span>
                      </div>
                      <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-900">
                        <div
                          className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full"
                          style={{
                            width: `${currentStats.estimatedRevenue > 0 ? (item.value / currentStats.estimatedRevenue) * 100 : 0}%`
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>{item.count} jobs</span>
                        <span>
                          {currentStats.estimatedRevenue > 0
                            ? ((item.value / currentStats.estimatedRevenue) * 100).toFixed(0)
                            : 0}
                          % share
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Lead Generating Sources (Phone numbers) */}
          <Card className="rounded-[28px] border border-slate-800 bg-[#15161c] shadow-[0_18px_52px_-34px_rgba(0,0,0,0.42)]">
            <CardContent className="p-6">
              <div className="mb-4">
                <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-slate-200">Top Ingestion Sources</h3>
                <p className="mt-1 text-[12px] text-slate-400">Leads grouped by phone line or scraper source.</p>
              </div>

              {sourceDistribution.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">No lead sources mapped in this range.</div>
              ) : (
                <div className="space-y-4">
                  {sourceDistribution.map((item) => (
                    <div key={item.name} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="truncate text-slate-300 flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                          {item.name}
                        </span>
                        <span className="text-slate-100">{item.count} leads</span>
                      </div>
                      <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-900">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full"
                          style={{
                            width: `${currentStats.totalLeads > 0 ? (item.count / currentStats.totalLeads) * 100 : 0}%`
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span>Est. {formatCurrency(item.value)}</span>
                        <span>
                          {currentStats.totalLeads > 0
                            ? ((item.count / currentStats.totalLeads) * 100).toFixed(0)
                            : 0}
                          % share
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
