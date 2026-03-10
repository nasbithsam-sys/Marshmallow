import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Search, Calendar, LayoutList } from 'lucide-react';
import StatusBadge from '@/components/leads/StatusBadge';
import AddLeadDialog from '@/components/leads/AddLeadDialog';
import LeadDetailPanel from '@/components/leads/LeadDetailPanel';
import type { Lead, LeadStatus } from '@/types';
import { LEAD_STATUS_CONFIG } from '@/types';
import { format } from 'date-fns';

const statusOrder: Record<string, number> = {
  urgent_job: -1,
  cancelled: 100,
};

const AllLeads = () => {
  const { user, role } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: leads = [], isLoading, refetch } = useQuery({
    queryKey: ['leads', role, user?.id],
    queryFn: async () => {
      let query = supabase.from('leads').select('*');
      if (role === 'customer_service') {
        query = query.eq('created_by', user!.id);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Lead[];
    },
    enabled: !!user,
  });

  const filteredLeads = useMemo(() => {
    let result = [...leads];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        l.customer_name.toLowerCase().includes(q) ||
        l.customer_phone?.toLowerCase().includes(q) ||
        l.job_id.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      result = result.filter(l => l.status === statusFilter);
    }
    return result.sort((a, b) => {
      const orderA = statusOrder[a.status] ?? 0;
      const orderB = statusOrder[b.status] ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return 0;
    });
  }, [leads, search, statusFilter]);

  const urgentCount = leads.filter(l => l.status === 'urgent_job').length;
  const scheduledCount = leads.filter(l => l.status === 'scheduled').length;
  const activeCount = leads.filter(l => l.status !== 'cancelled' && l.status !== 'paid' && l.status !== 'job_done').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">All Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">{leads.length} total leads</p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add New Lead
        </Button>
      </div>

      {/* Summary chips */}
      <div className="flex gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card border text-sm">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="font-medium">{activeCount}</span>
          <span className="text-muted-foreground">Active</span>
        </div>
        {urgentCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 border border-red-200 text-sm">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="font-medium text-red-700">{urgentCount}</span>
            <span className="text-red-600">Urgent</span>
          </div>
        )}
        {scheduledCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card border text-sm">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium">{scheduledCount}</span>
            <span className="text-muted-foreground">Scheduled</span>
          </div>
        )}
      </div>

      {/* Search & Filter bar */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone, or job ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(LEAD_STATUS_CONFIG).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="bg-card border rounded-lg p-1">
          <div className="space-y-0">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 border-b last:border-0">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-card border rounded-lg">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <LayoutList className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-foreground font-medium mb-1">
            {search || statusFilter !== 'all' ? 'No leads match your filters' : 'No leads yet'}
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            {search || statusFilter !== 'all'
              ? 'Try adjusting your search or filter criteria'
              : 'Click "Add New Lead" to create your first lead'}
          </p>
          {!search && statusFilter === 'all' && (
            <Button onClick={() => setAddOpen(true)} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Add New Lead
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-card border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[110px] px-5">Job ID</TableHead>
                <TableHead className="px-5">Customer</TableHead>
                <TableHead className="px-5">Status</TableHead>
                <TableHead className="px-5">Service</TableHead>
                <TableHead className="px-5">Last Edit</TableHead>
                <TableHead className="px-5">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeads.map((lead) => (
                <TableRow
                  key={lead.id}
                  className="cursor-pointer transition-colors hover:bg-muted/50"
                  onClick={() => setSelectedLeadId(lead.id)}
                >
                  <TableCell className="font-mono text-xs px-5 py-4">{lead.job_id}</TableCell>
                  <TableCell className="font-medium px-5 py-4">{lead.customer_name}</TableCell>
                  <TableCell className="px-5 py-4">
                    <StatusBadge status={lead.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground px-5 py-4">{lead.service_type}</TableCell>
                  <TableCell className="text-xs text-muted-foreground px-5 py-4">
                    {lead.last_edited_at
                      ? format(new Date(lead.last_edited_at), 'MMM d, h:mm a')
                      : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground px-5 py-4">
                    {format(new Date(lead.created_at), 'MMM d, yyyy')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AddLeadDialog open={addOpen} onOpenChange={setAddOpen} onSuccess={refetch} />

      {selectedLeadId && (
        <LeadDetailPanel
          leadId={selectedLeadId}
          onClose={() => setSelectedLeadId(null)}
          onUpdate={refetch}
        />
      )}
    </div>
  );
};

export default AllLeads;
