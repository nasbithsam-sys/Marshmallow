import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Plus, Calendar } from 'lucide-react';
import StatusBadge from '@/components/leads/StatusBadge';
import AddLeadDialog from '@/components/leads/AddLeadDialog';
import LeadDetailPanel from '@/components/leads/LeadDetailPanel';
import type { Lead, LeadStatus } from '@/types';
import { format } from 'date-fns';

const statusOrder: Record<string, number> = {
  urgent_job: -1,
  cancelled: 100,
};

const AllLeads = () => {
  const { user, role } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  const { data: leads = [], isLoading, refetch } = useQuery({
    queryKey: ['leads', role, user?.id],
    queryFn: async () => {
      let query = supabase.from('leads').select('*');
      // CS can only see their own leads
      if (role === 'customer_service') {
        query = query.eq('created_by', user!.id);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Lead[];
    },
    enabled: !!user,
  });

  // Sort: urgent on top, cancelled on bottom, rest by created_at desc (already sorted)
  const sortedLeads = [...leads].sort((a, b) => {
    const orderA = statusOrder[a.status] ?? 0;
    const orderB = statusOrder[b.status] ?? 0;
    if (orderA !== orderB) return orderA - orderB;
    return 0; // preserve existing order (created_at desc)
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">All Leads</h1>
        <Button onClick={() => setAddOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add New Lead
        </Button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground text-sm">Loading leads...</div>
      ) : sortedLeads.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground text-sm">
          No leads yet. Click "Add New Lead" to create one.
        </div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Job ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Last Edit</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedLeads.map((lead) => (
                <TableRow
                  key={lead.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedLeadId(lead.id)}
                >
                  <TableCell className="font-mono text-xs">{lead.job_id}</TableCell>
                  <TableCell className="font-medium">{lead.customer_name}</TableCell>
                  <TableCell>
                    <StatusBadge status={lead.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{lead.service_type}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {lead.last_edited_at
                      ? format(new Date(lead.last_edited_at), 'MMM d, h:mm a')
                      : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(lead.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    {lead.status === 'scheduled' && (
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    )}
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
