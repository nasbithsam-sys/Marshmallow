import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { format, subDays, eachDayOfInterval, parseISO, startOfDay } from "date-fns";
import { TrendingUp, Users, Calendar, Sparkles, Activity, CheckCircle2, AlertTriangle, Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem, heroTitle } from "@/lib/motion";

const ranges = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

const Analytics = () => {
  const [activeDays, setActiveDays] = useState(30);
  const startDate = format(subDays(new Date(), activeDays), "yyyy-MM-dd");
  const endDate = format(new Date(), "yyyy-MM-dd");

  const { data: leads = [] } = useQuery({
    queryKey: ["analytics-leads", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("created_at, status")
        .gte("created_at", startDate + "T00:00:00")
        .lte("created_at", endDate + "T23:59:59");

      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: allLeads = [] } = useQuery({
    queryKey: ["analytics-total"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("status, created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: parseISO(startDate),
        end: parseISO(endDate),
      }),
    [startDate, endDate],
  );

  const chartData = useMemo(() => {
    return days.map((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const count = leads.filter((l: any) => l.created_at.startsWith(dateStr)).length;
      return { date: format(day, "MMM d"), count };
    });
  }, [days, leads]);

  const cumulativeData = useMemo(() => {
    let running = 0;
    return chartData.map((item) => {
      running += item.count;
      return {
        date: item.date,
        total: running,
      };
    });
  }, [chartData]);

  const todayStart = startOfDay(new Date());
  const thisWeekLeads = leads.filter((l: any) => new Date(l.created_at) >= subDays(new Date(), 7)).length;
  const todayLeads = allLeads.filter((l: any) => new Date(l.created_at) >= todayStart).length;

  const statusCounts = useMemo(() => {
    const counts = {
      urgent: 0,
      scheduled: 0,
      done: 0,
      cancelled: 0,
      waiting: 0,
    };

    for (const lead of allLeads as any[]) {
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

  const averagePerDay = activeDays ? (leads.length / activeDays).toFixed(1) : "0.0";
  const bestDay = useMemo(() => {
    if (!chartData.length) return null;
    return chartData.reduce((best, current) => (current.count > best.count ? current : best), chartData[0]);
  }, [chartData]);

  const stats = [
    {
      label: "Total Leads",
      value: allLeads.length,
      sub: "All-time volume",
      icon: Users,
      tone: "bg-primary/[0.08] text-primary border-primary/10",
    },
    {
      label: "This Week",
      value: thisWeekLeads,
      sub: "Created in last 7 days",
      icon: TrendingUp,
      tone: "bg-[hsl(var(--success)/0.08)] text-[hsl(var(--success))] border-[hsl(var(--success)/0.12)]",
    },
    {
      label: `Last ${activeDays} Days`,
      value: leads.length,
      sub: "In selected range",
      icon: Calendar,
      tone: "bg-[hsl(var(--warning)/0.08)] text-[hsl(var(--warning))] border-[hsl(var(--warning)/0.12)]",
    },
    {
      label: "Today",
      value: todayLeads,
      sub: "New leads today",
      icon: Activity,
      tone: "bg-muted/70 text-foreground border-border",
    },
  ];

  const statusSummary = [
    {
      label: "Urgent",
      value: statusCounts.urgent,
      icon: AlertTriangle,
      tone: "bg-destructive/[0.08] text-destructive border-destructive/10",
    },
    {
      label: "Scheduled",
      value: statusCounts.scheduled,
      icon: Calendar,
      tone: "bg-primary/[0.08] text-primary border-primary/10",
    },
    {
      label: "Completed / Paid",
      value: statusCounts.done,
      icon: CheckCircle2,
      tone: "bg-[hsl(var(--success)/0.08)] text-[hsl(var(--success))] border-[hsl(var(--success)/0.12)]",
    },
    {
      label: "Waiting",
      value: statusCounts.waiting,
      icon: Clock3,
      tone: "bg-[hsl(var(--warning)/0.08)] text-[hsl(var(--warning))] border-[hsl(var(--warning)/0.12)]",
    },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;

    return (
      <div className="rounded-2xl border border-border/60 bg-card/95 px-4 py-3 shadow-[0_18px_40px_-26px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-sm font-semibold text-foreground">{payload[0].value} leads</p>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-[1450px] space-y-6">
      <div className="relative overflow-hidden rounded-[28px] border border-border/60 bg-gradient-to-br from-card via-card to-muted/[0.35] p-6 shadow-[0_22px_60px_-34px_rgba(0,0,0,0.45)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_28%)]" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <motion.div variants={heroTitle} initial="initial" animate="animate">
            <div className="mb-3 inline-flex items-center gap-1 rounded-full border border-primary/10 bg-primary/[0.06] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
              <Sparkles className="h-2.5 w-2.5" />
              Analytics
            </div>

            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-foreground sm:text-3xl">Lead Performance</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Monitor lead growth, pace, and status distribution across your CRM.
            </p>
          </motion.div>

          <div className="inline-flex w-fit rounded-2xl border border-border/50 bg-muted/[0.35] p-1.5 shadow-[0_14px_34px_-28px_rgba(0,0,0,0.35)]">
            {ranges.map((r) => (
              <button
                key={r.days}
                onClick={() => setActiveDays(r.days)}
                className={cn(
                  "rounded-xl px-4 py-2 text-[12px] font-medium transition-all duration-200",
                  activeDays === r.days
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {stats.map((stat) => (
          <motion.div key={stat.label} variants={staggerItem}>
            <Card className="rounded-2xl border-border/60 bg-card/90 shadow-[0_14px_40px_-28px_rgba(0,0,0,0.35)]">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60">
                      {stat.label}
                    </p>
                    <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground tabular-nums">
                      {stat.value}
                    </p>
                    <p className="mt-1 text-[12px] text-muted-foreground">{stat.sub}</p>
                  </div>

                  <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl border", stat.tone)}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.5fr_1fr]">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.35 }}
        >
          <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-[0_18px_52px_-34px_rgba(0,0,0,0.42)]">
            <CardContent className="p-6">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-foreground">Leads Created</h3>
                  <p className="mt-1 text-[12px] text-muted-foreground">Daily lead creation for the selected range.</p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-muted/[0.22] px-3 py-2 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
                    Average / Day
                  </p>
                  <p className="text-[14px] font-semibold text-foreground">{averagePerDay}</p>
                </div>
              </div>

              <div className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barCategoryGap={10}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
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
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.35)" }} />
                    <Bar dataKey="count" fill="hsl(var(--brand))" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.35 }}
          className="space-y-6"
        >
          <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-[0_18px_52px_-34px_rgba(0,0,0,0.42)]">
            <CardContent className="p-6">
              <div className="mb-5">
                <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-foreground">Cumulative Trend</h3>
                <p className="mt-1 text-[12px] text-muted-foreground">Total accumulation across the selected period.</p>
              </div>

              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cumulativeData}>
                    <defs>
                      <linearGradient id="leadArea" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--brand))" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="hsl(var(--brand))" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="hsl(var(--brand))"
                      strokeWidth={2.5}
                      fill="url(#leadArea)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-[0_18px_52px_-34px_rgba(0,0,0,0.42)]">
            <CardContent className="p-6">
              <div className="mb-4">
                <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-foreground">Status Snapshot</h3>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  Current operational overview across major lead buckets.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {statusSummary.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-2xl border border-border/60 bg-muted/[0.16] px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn("flex h-10 w-10 items-center justify-center rounded-2xl border", item.tone)}>
                        <item.icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-foreground">{item.label}</p>
                        <p className="text-[11px] text-muted-foreground">Current count</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-xl font-semibold tracking-[-0.03em] text-foreground tabular-nums">
                        {item.value}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60">
                  Best Day in Range
                </p>
                <p className="mt-1 text-[14px] font-semibold text-foreground">
                  {bestDay ? `${bestDay.date} · ${bestDay.count} leads` : "No data"}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default Analytics;
