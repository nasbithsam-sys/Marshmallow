import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays, eachDayOfInterval, parseISO } from 'date-fns';

const Analytics = () => {
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data: leads = [] } = useQuery({
    queryKey: ['analytics-leads', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('created_at')
        .gte('created_at', startDate + 'T00:00:00')
        .lte('created_at', endDate + 'T23:59:59');
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
    const count = leads.filter(l => l.created_at.startsWith(dateStr)).length;
    return { date: format(day, 'MMM d'), count };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-foreground">Analytics</h1>

      <div className="flex items-end gap-4">
        <div className="space-y-2">
          <Label>Start Date</Label>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>End Date</Label>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        <div className="px-4 py-2 bg-muted rounded-md">
          <span className="text-sm font-medium">{leads.length} total leads</span>
        </div>
      </div>

      <div className="border rounded-md p-4 h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 86%)" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" fill="hsl(220 12% 13%)" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default Analytics;
