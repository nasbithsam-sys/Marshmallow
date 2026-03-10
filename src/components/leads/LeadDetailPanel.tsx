import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X } from 'lucide-react';
import StatusBadge from './StatusBadge';
import LeadUpdatesSection from './LeadUpdatesSection';
import { LEAD_STATUS_CONFIG, type Lead, type LeadStatus } from '@/types';
import { toast } from 'sonner';

interface Props {
  leadId: string;
  onClose: () => void;
  onUpdate: () => void;
}

const LeadDetailPanel = ({ leadId, onClose, onUpdate }: Props) => {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();

  const { data: lead, isLoading } = useQuery({
    queryKey: ['lead', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single();
      if (error) throw error;
      return data as Lead;
    },
  });

  const [form, setForm] = useState<Partial<Lead>>({});

  useEffect(() => {
    if (lead) setForm(lead);
  }, [lead]);

  const update = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase
        .from('leads')
        .update({
          customer_name: form.customer_name,
          customer_email: form.customer_email,
          customer_phone: form.customer_phone,
          service_type: form.service_type,
          address: form.address,
          city: form.city,
          state: form.state,
          zip_code: form.zip_code,
          status: form.status,
          amount: form.amount,
          scheduled_date: form.scheduled_date,
          scheduled_time_start: form.scheduled_time_start,
          scheduled_time_end: form.scheduled_time_end,
          cs_notes: role !== 'processor' ? form.cs_notes : lead?.cs_notes,
          processor_notes: role !== 'customer_service' ? form.processor_notes : lead?.processor_notes,
          last_edited_by: user.id,
          last_edited_at: new Date().toISOString(),
        })
        .eq('id', leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Lead saved');
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      onUpdate();
    },
    onError: (err: any) => toast.error('Save failed: ' + err.message),
  });

  const isCS = role === 'customer_service';
  const isProcessor = role === 'processor';

  if (isLoading || !lead) {
    return (
      <div className="fixed inset-0 z-40 flex">
        <div className="flex-1 bg-foreground/20" onClick={onClose} />
        <div className="w-[60%] bg-card border-l border-border p-6 flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-foreground/20" onClick={onClose} />
      <div className="w-[60%] bg-card border-l border-border overflow-y-auto animate-in slide-in-from-right">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-muted-foreground">{lead.job_id}</span>
            <StatusBadge status={lead.status as LeadStatus} />
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} size="sm">
              {saveMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
            <button onClick={onClose} className="p-1 rounded hover:bg-accent transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Status */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => update('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(LEAD_STATUS_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Customer Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Customer Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={form.customer_name ?? ''} onChange={e => update('customer_name', e.target.value)} readOnly={isProcessor} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={form.customer_phone ?? ''} onChange={e => update('customer_phone', e.target.value)} readOnly={isProcessor} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={form.customer_email ?? ''} onChange={e => update('customer_email', e.target.value)} readOnly={isProcessor} />
              </div>
              <div className="space-y-2">
                <Label>Service Type</Label>
                <Input value={form.service_type ?? ''} onChange={e => update('service_type', e.target.value)} readOnly={isProcessor} />
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Address</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Input value={form.address ?? ''} onChange={e => update('address', e.target.value)} placeholder="Street address" readOnly={isProcessor} />
              </div>
              <div className="space-y-2">
                <Input value={form.city ?? ''} onChange={e => update('city', e.target.value)} placeholder="City" readOnly={isProcessor} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input value={form.state ?? ''} onChange={e => update('state', e.target.value)} placeholder="State" readOnly={isProcessor} />
                <Input value={form.zip_code ?? ''} onChange={e => update('zip_code', e.target.value)} placeholder="Zip" readOnly={isProcessor} />
              </div>
            </div>
          </div>

          {/* Schedule & Amount */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Schedule & Amount</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={form.scheduled_date ?? ''} onChange={e => update('scheduled_date', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input type="time" value={form.scheduled_time_start ?? ''} onChange={e => update('scheduled_time_start', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input type="time" value={form.scheduled_time_end ?? ''} onChange={e => update('scheduled_time_end', e.target.value)} />
              </div>
            </div>
            <div className="space-y-2 max-w-[200px]">
              <Label>Amount ($)</Label>
              <Input type="number" step="0.01" value={form.amount ?? ''} onChange={e => update('amount', parseFloat(e.target.value) || null)} />
            </div>
          </div>

          {/* CS Notes — editable by CS & Admin, read-only for Processor */}
          <div className="space-y-2">
            <Label>CS Notes</Label>
            <Textarea
              value={form.cs_notes ?? ''}
              onChange={e => update('cs_notes', e.target.value)}
              readOnly={isProcessor}
              rows={4}
              placeholder="Customer service notes..."
              className={isProcessor ? 'opacity-60' : ''}
            />
          </div>

          {/* Processor Notes — hidden from CS */}
          {!isCS && (
            <div className="space-y-2">
              <Label>Processor Notes</Label>
              <Textarea
                value={form.processor_notes ?? ''}
                onChange={e => update('processor_notes', e.target.value)}
                rows={4}
                placeholder="Processor notes..."
              />
            </div>
          )}

          {/* Updated Details Feed */}
          <LeadUpdatesSection leadId={leadId} />
        </div>
      </div>
    </div>
  );
};

export default LeadDetailPanel;
