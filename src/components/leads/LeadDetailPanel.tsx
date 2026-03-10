import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, User, MapPin, Clock, DollarSign, MessageSquare, FileText, Check } from 'lucide-react';
import StatusBadge from './StatusBadge';
import LeadUpdatesSection from './LeadUpdatesSection';
import { LEAD_STATUS_CONFIG, type Lead, type LeadStatus } from '@/types';
import { toast } from 'sonner';

interface Props {
  leadId: string;
  onClose: () => void;
  onUpdate: () => void;
}

const SectionHeader = ({ icon: Icon, title }: { icon: React.ElementType; title: string }) => (
  <div className="flex items-center gap-2 mb-4">
    <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
    </div>
    <h3 className="text-sm font-semibold text-foreground">{title}</h3>
  </div>
);

const LeadDetailPanel = ({ leadId, onClose, onUpdate }: Props) => {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);

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
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
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
        <div className="flex-1 bg-foreground/20 backdrop-blur-sm" onClick={onClose} />
        <div className="w-[55%] max-w-3xl bg-card border-l border-border p-6 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin" />
            <p className="text-muted-foreground text-sm">Loading lead...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-foreground/20 backdrop-blur-sm" onClick={onClose} />
      <div className="w-[55%] max-w-3xl bg-card border-l border-border overflow-y-auto animate-slide-in-right">
        {/* Header */}
        <div className="sticky top-0 bg-card/95 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-muted-foreground">{lead.job_id}</span>
            <span className="text-muted-foreground/40">›</span>
            <span className="text-sm font-medium text-foreground truncate max-w-[200px]">{lead.customer_name}</span>
            <StatusBadge status={lead.status as LeadStatus} />
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              size="sm"
              className="gap-1.5 min-w-[80px]"
            >
              {saved ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Saved
                </>
              ) : saveMutation.isPending ? (
                'Saving...'
              ) : (
                'Save'
              )}
            </Button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* Status */}
          <div className="bg-muted/50 rounded-lg p-4">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Status</Label>
            <Select value={form.status} onValueChange={v => update('status', v)}>
              <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(LEAD_STATUS_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Customer Info */}
          <div className="bg-card border rounded-lg p-5">
            <SectionHeader icon={User} title="Customer Information" />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Name</Label>
                <Input value={form.customer_name ?? ''} onChange={e => update('customer_name', e.target.value)} readOnly={isProcessor} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Phone</Label>
                <Input value={form.customer_phone ?? ''} onChange={e => update('customer_phone', e.target.value)} readOnly={isProcessor} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <Input value={form.customer_email ?? ''} onChange={e => update('customer_email', e.target.value)} readOnly={isProcessor} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Service Type</Label>
                <Input value={form.service_type ?? ''} onChange={e => update('service_type', e.target.value)} readOnly={isProcessor} />
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="bg-card border rounded-lg p-5">
            <SectionHeader icon={MapPin} title="Address" />
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs text-muted-foreground">Street</Label>
                <Input value={form.address ?? ''} onChange={e => update('address', e.target.value)} placeholder="Street address" readOnly={isProcessor} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">City</Label>
                <Input value={form.city ?? ''} onChange={e => update('city', e.target.value)} readOnly={isProcessor} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">State</Label>
                  <Input value={form.state ?? ''} onChange={e => update('state', e.target.value)} readOnly={isProcessor} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Zip</Label>
                  <Input value={form.zip_code ?? ''} onChange={e => update('zip_code', e.target.value)} readOnly={isProcessor} />
                </div>
              </div>
            </div>
          </div>

          {/* Schedule & Amount */}
          <div className="bg-card border rounded-lg p-5">
            <SectionHeader icon={Clock} title="Schedule & Amount" />
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Date</Label>
                <Input type="date" value={form.scheduled_date ?? ''} onChange={e => update('scheduled_date', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Start Time</Label>
                <Input type="time" value={form.scheduled_time_start ?? ''} onChange={e => update('scheduled_time_start', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">End Time</Label>
                <Input type="time" value={form.scheduled_time_end ?? ''} onChange={e => update('scheduled_time_end', e.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center">
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="space-y-1.5 w-[180px]">
                <Label className="text-xs text-muted-foreground">Amount ($)</Label>
                <Input type="number" step="0.01" value={form.amount ?? ''} onChange={e => update('amount', parseFloat(e.target.value) || null)} />
              </div>
            </div>
          </div>

          {/* CS Notes */}
          <div className="bg-card border rounded-lg p-5">
            <SectionHeader icon={MessageSquare} title="CS Notes" />
            <Textarea
              value={form.cs_notes ?? ''}
              onChange={e => update('cs_notes', e.target.value)}
              readOnly={isProcessor}
              rows={4}
              placeholder="Customer service notes..."
              className={isProcessor ? 'opacity-60' : ''}
            />
          </div>

          {/* Processor Notes */}
          {!isCS && (
            <div className="bg-card border rounded-lg p-5">
              <SectionHeader icon={FileText} title="Processor Notes" />
              <Textarea
                value={form.processor_notes ?? ''}
                onChange={e => update('processor_notes', e.target.value)}
                rows={4}
                placeholder="Processor notes..."
              />
            </div>
          )}

          {/* Updates */}
          <div className="bg-card border rounded-lg p-5">
            <LeadUpdatesSection leadId={leadId} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadDetailPanel;
