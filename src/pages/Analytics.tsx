import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays, eachDayOfInterval, parseISO } from 'date-fns';
import { TrendingUp, Users, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { staggerContainer, staggerItem, heroTitle } from '@/lib/motion';

const ranges = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

const Analytics = () => {
  const [activeDays, setActiveDays] = useState(30);
  const startDate = format(subDays(new Date(), activeDays), 'yyyy-MM-dd');
  const endDate = format(new Date(), 'yyyy-MM-dd');

  const { data: leads = [] } = useQuery({
    queryKey: ['analytics-leads', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('created_at, status')
        .gte('created_at', startDate + 'T00:00:00')
        .lte('created_at', endDate + 'T23:59:59');
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: allLeads = [] } = useQuery({
    queryKey: ['analytics-total'],
    queryFn: async () => {
      const { data, error } = await supabase.from('leads').select('status');
      if (error) throw error;
      return data ?? [];
    },
  });

  const days = eachDayOfInterval({
    start: parseISO(startDate),
    end: parseISO(endDate),
  });

  const chartData = days.map(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const count = leads.filter((l: any) => l.created_at.startsWith(dateStr)).length;
    return { date: format(day, 'MMM d'), count };
  });

  const thisWeekLeads = leads.filter((l: any) => {
    const d = new Date(l.created_at);
    return d >= subDays(new Date(), 7);
  }).length;

  const stats = [
    { label: 'Total Leads', value: allLeads.length, icon: Users, color: 'bg-primary/8 text-primary' },
    { label: 'This Week', value: thisWeekLeads, icon: TrendingUp, color: 'bg-[hsl(var(--success)/0.08)] text-[hsl(var(--success))]' },
    { label: `Last ${activeDays}d`, value: leads.length, icon: Calendar, color: 'bg-[hsl(var(--warning)/0.08)] text-[hsl(var(--warning))]' },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border border-border/50 rounded-lg px-3.5 py-2.5 shadow-premium-lg">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-sm font-bold text-foreground">{payload[0].value} leads</p>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <motion.div variants={heroTitle} initial="initial" animate="animate">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Lead creation overview</p>
        </motion.div>
        <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1 border border-border/30">
          {ranges.map(r => (
            <button
              key={r.days}
              onClick={() => setActiveDays(r.days)}
              className={cn(
                'px-3.5 py-1.5 rounded-md text-[12px] font-medium transition-all duration-200',
                activeDays === r.days
                  ? 'bg-card text-foreground shadow-premium-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-3 gap-4"
      >
        {stats.map(stat => (
          <motion.div key={stat.label} variants={staggerItem}>
            <Card className="hover:shadow-premium-md">
              <CardContent className="p-5 flex items-center gap-4">
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', stat.color)}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground tabular-nums">{stat.value}</p>
                  <p className="text-[12px] text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Leads Created</h3>
            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted) / 0.4)', radius: 4 }} />
                  <Bar dataKey="count" fill="hsl(var(--brand))" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default Analytics;
