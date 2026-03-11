import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { X, User, MapPin, Clock, MessageSquare, FileText, Check, AlertCircle, Wrench, Copy } from 'lucide-react';
import StatusBadge from './StatusBadge';
import LeadUpdatesSection from './LeadUpdatesSection';
import NoteThread from './NoteThread';
import PaymentDialog from './PaymentDialog';
import CopyLeadButton from './CopyLeadButton';
import { LEAD_STATUS_CONFIG, type Lead, type LeadStatus } from '@/types';
import { toast } from 'sonner';
import { useDuplicatePhoneCheck } from '@/hooks/useDuplicatePhoneCheck';
import { motion } from 'framer-motion';

interface Props {
  leadId: string;
  onClose: () => void;
  onUpdate: () => void;
}

const SectionHeader = ({ icon: Icon, title }: { icon: React.ElementType; title: string }) => (
  <div className="flex items-center gap-2.5 mb-4">
    <div className="w-7 h-7 rounded-lg bg-primary/6 border border-primary/8 flex items-center justify-center">
      <Icon className="h-3.5 w-3.5 text-primary/70" />
    </div>
    <h3 className="text-sm font-semibold text-foreground tracking-[-0.01em]">{title}</h3>
  </div>
);

const LeadDetailPanel = ({ leadId, onClose, onUpdate }: Props) => {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);

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

  useEffect(() => {
    const fetchProfiles = async () => {
      const { data } = await supabase.from("profiles").select("id, full_name");
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((p: any) => (map[p.id] = p.full_name));
        setProfiles(map);
      }
    };
    fetchProfiles();
  }, []);

  const { isDuplicate, duplicateLeadName } = useDuplicatePhoneCheck(
    form.customer_phone || '', leadId
  );

  const update = (key: string, value: any) => {
    if (key === 'status' && value === 'paid') {
      setPaymentOpen(true);
      return;
    }
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handlePaymentConfirm = async (amount: number, screenshotFile: File | null) => {
    setPaymentLoading(true);
    let screenshotUrl: string | null = null;

    if (screenshotFile) {
      const ext = screenshotFile.name.split('.').pop();
      const path = `payments/${leadId}_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('lead-photos').upload(path, screenshotFile);
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('lead-photos').getPublicUrl(path);
        screenshotUrl = urlData.publicUrl;
      }
    }

    setForm(prev => ({ ...prev, status: 'paid' as LeadStatus, amount, payment_amount: amount, payment_screenshot_url: screenshotUrl }));

    const { error } = await supabase.from('leads').update({
      status: 'paid',
      amount,
      payment_amount: amount,
      payment_screenshot_url: screenshotUrl,
      last_edited_by: user?.id,
      last_edited_at: new Date().toISOString(),
    }).eq('id', leadId);

    setPaymentLoading(false);
    setPaymentOpen(false);

    if (error) toast.error(error.message);
    else {
      toast.success("Payment recorded");
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] });
      onUpdate();
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      if (isDuplicate) throw new Error(`Duplicate phone: ${duplicateLeadName}`);

      const updateData: any = {
        customer_name: form.customer_name,
        customer_email: form.customer_email,
        customer_phone: form.customer_phone,
        service_type: form.service_type,
        address: form.address,
        city: form.city,
        state: form.state,
        zip_code: form.zip_code,
        status: form.status,
        scheduled_date: form.scheduled_date,
        scheduled_time_start: form.scheduled_time_start,
        scheduled_time_end: form.scheduled_time_end,
        cs_notes: role !== 'processor' ? form.cs_notes : lead?.cs_notes,
        processor_notes: role !== 'customer_service' ? form.processor_notes : lead?.processor_notes,
        last_edited_by: user.id,
        last_edited_at: new Date().toISOString(),
        // CS fields
        number_name: form.number_name,
        quote: form.quote,
        service_details: form.service_details,
        customer_schedule_requirements: form.customer_schedule_requirements,
        reference_name: form.reference_name,
        // Processor fields
        tech_name: role !== 'customer_service' ? form.tech_name : lead?.tech_name,
        tech_number: role !== 'customer_service' ? form.tech_number : lead?.tech_number,
        terms: role !== 'customer_service' ? form.terms : lead?.terms,
        labor_amount: role !== 'customer_service' ? form.labor_amount : lead?.labor_amount,
        material_amount: role !== 'customer_service' ? form.material_amount : lead?.material_amount,
        for_you_amount: role !== 'customer_service' ? form.for_you_amount : lead?.for_you_amount,
        for_us_amount: role !== 'customer_service' ? form.for_us_amount : lead?.for_us_amount,
      };

      if (form.status === 'paid') {
        updateData.amount = form.amount;
      }

      const { error } = await supabase
        .from('leads')
        .update(updateData)
        .eq('id', leadId);
      if (error) throw error;

      if (lead?.status !== form.status && (form.status === 'urgent_job' || form.status === 'need_tech')) {
        const { data: roles } = await supabase.from('user_roles').select('user_id, role').in('role', ['admin', 'processor']);
        if (roles) {
          const statusLabel = form.status === 'urgent_job' ? 'Urgent Job' : 'Need Tech';
          const notifs = roles.map((r: any) => ({
            user_id: r.user_id,
            title: `🚨 ${statusLabel}`,
            message: `Lead "${form.customer_name}" changed to ${statusLabel}`,
            lead_id: leadId,
            read: false,
          }));
          await supabase.from('notifications').insert(notifs);
        }
      }
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
        <div className="flex-1 bg-foreground/15 backdrop-blur-sm" onClick={onClose} />
        <div className="w-[55%] max-w-3xl bg-card border-l border-border p-6 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-7 h-7 rounded-full border-2 border-muted-foreground/20 border-t-primary animate-spin" />
            <p className="text-muted-foreground text-sm">Loading lead...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex-1 bg-foreground/15 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 35 }}
        className="w-[55%] max-w-3xl bg-card border-l border-border overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-card/95 backdrop-blur-md border-b border-border/60 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[12px] text-muted-foreground/60">{lead.job_id}</span>
            <span className="text-muted-foreground/30">›</span>
            <span className="text-sm font-medium text-foreground truncate max-w-[200px]">{lead.customer_name}</span>
            <StatusBadge status={lead.status as LeadStatus} />
          </div>
          <div className="flex items-center gap-2">
            {(!isCS) && <CopyLeadButton lead={lead} />}
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || isDuplicate}
              size="sm"
              className="gap-1.5 min-w-[80px]"
            >
              {saved ? (
                <><Check className="h-3.5 w-3.5" /> Saved</>
              ) : saveMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Status */}
          <div className="rounded-xl bg-muted/40 border border-border/40 p-4">
            <Label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2 block font-semibold">Status</Label>
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
          <div className="rounded-xl bg-card border border-border/50 p-5">
            <SectionHeader icon={User} title="Customer Information" />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground/60 font-medium">Name</Label>
                <Input value={form.customer_name ?? ''} onChange={e => update('customer_name', e.target.value)} readOnly={isProcessor} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground/60 font-medium">Number Name</Label>
                <Input value={form.number_name ?? ''} onChange={e => update('number_name', e.target.value)} readOnly={isProcessor} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground/60 font-medium">Phone</Label>
                <Input
                  value={form.customer_phone ?? ''}
                  onChange={e => update('customer_phone', e.target.value)}
                  readOnly={isProcessor}
                  className={isDuplicate ? 'border-destructive ring-1 ring-destructive' : ''}
                />
                {isDuplicate && (
                  <div className="flex items-center gap-1.5 text-destructive text-[11px]">
                    <AlertCircle className="h-3 w-3" />
                    <span>Duplicate: <strong>{duplicateLeadName}</strong></span>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground/60 font-medium">Email</Label>
                <Input value={form.customer_email ?? ''} onChange={e => update('customer_email', e.target.value)} readOnly={isProcessor} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground/60 font-medium">Service Type</Label>
                <Input value={form.service_type ?? ''} onChange={e => update('service_type', e.target.value)} readOnly={isProcessor} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground/60 font-medium">Quote</Label>
                <Input value={form.quote ?? ''} onChange={e => update('quote', e.target.value)} readOnly={isProcessor} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-[11px] text-muted-foreground/60 font-medium">Service Details</Label>
                <Textarea value={form.service_details ?? ''} onChange={e => update('service_details', e.target.value)} readOnly={isProcessor} rows={2} className="resize-none" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground/60 font-medium">Schedule Requirements</Label>
                <Input value={form.customer_schedule_requirements ?? ''} onChange={e => update('customer_schedule_requirements', e.target.value)} readOnly={isProcessor} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground/60 font-medium">Reference</Label>
                <Input value={form.reference_name ?? ''} onChange={e => update('reference_name', e.target.value)} readOnly={isProcessor} />
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="rounded-xl bg-card border border-border/50 p-5">
            <SectionHeader icon={MapPin} title="Address" />
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-[11px] text-muted-foreground/60 font-medium">Street</Label>
                <Input value={form.address ?? ''} onChange={e => update('address', e.target.value)} readOnly={isProcessor} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground/60 font-medium">City</Label>
                <Input value={form.city ?? ''} onChange={e => update('city', e.target.value)} readOnly={isProcessor} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground/60 font-medium">State</Label>
                  <Input value={form.state ?? ''} onChange={e => update('state', e.target.value)} readOnly={isProcessor} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground/60 font-medium">Zip</Label>
                  <Input value={form.zip_code ?? ''} onChange={e => update('zip_code', e.target.value)} readOnly={isProcessor} />
                </div>
              </div>
            </div>
          </div>

          {/* Processor Details - hidden from CS */}
          {!isCS && (
            <div className="rounded-xl bg-card border border-border/50 p-5">
              <SectionHeader icon={Wrench} title="Processor Details" />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground/60 font-medium">Tech Name</Label>
                  <Input value={form.tech_name ?? ''} onChange={e => update('tech_name', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground/60 font-medium">Tech Number</Label>
                  <Input value={form.tech_number ?? ''} onChange={e => update('tech_number', e.target.value)} />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground/60 font-medium">Terms</Label>
                  <Select value={form.terms ?? ''} onValueChange={v => update('terms', v)}>
                    <SelectTrigger><SelectValue placeholder="Select terms..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free_estimate">Free Estimate Visit</SelectItem>
                      <SelectItem value="quoted">Quoted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.terms === 'quoted' && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-muted-foreground/60 font-medium">Customer Labor ($)</Label>
                      <Input type="number" step="0.01" value={form.labor_amount ?? ''} onChange={e => update('labor_amount', parseFloat(e.target.value) || null)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-muted-foreground/60 font-medium">Materials ($)</Label>
                      <Input type="number" step="0.01" value={form.material_amount ?? ''} onChange={e => update('material_amount', parseFloat(e.target.value) || null)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-muted-foreground/60 font-medium">For You ($)</Label>
                      <Input type="number" step="0.01" value={form.for_you_amount ?? ''} onChange={e => update('for_you_amount', parseFloat(e.target.value) || null)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] text-muted-foreground/60 font-medium">For Us ($)</Label>
                      <Input type="number" step="0.01" value={form.for_us_amount ?? ''} onChange={e => update('for_us_amount', parseFloat(e.target.value) || null)} />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Schedule */}
          <div className="rounded-xl bg-card border border-border/50 p-5">
            <SectionHeader icon={Clock} title="Schedule" />
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground/60 font-medium">Date</Label>
                <Input type="date" value={form.scheduled_date ?? ''} onChange={e => update('scheduled_date', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground/60 font-medium">Start Time</Label>
                <Input type="time" value={form.scheduled_time_start ?? ''} onChange={e => update('scheduled_time_start', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-muted-foreground/60 font-medium">End Time</Label>
                <Input type="time" value={form.scheduled_time_end ?? ''} onChange={e => update('scheduled_time_end', e.target.value)} />
              </div>
            </div>
            {form.status === 'paid' && (
              <div className="mt-4 space-y-1.5 w-[180px]">
                <Label className="text-[11px] text-muted-foreground/60 font-medium">Amount ($)</Label>
                <Input type="number" step="0.01" value={form.amount ?? ''} onChange={e => update('amount', parseFloat(e.target.value) || null)} />
              </div>
            )}
          </div>

          {/* General Notes Thread */}
          <div className="rounded-xl bg-card border border-border/50 p-5">
            <SectionHeader icon={MessageSquare} title="General Notes" />
            <NoteThread leadId={leadId} noteType="general" label="Notes" profiles={profiles} />
          </div>

          {/* CS Notes Thread */}
          {!isProcessor && (
            <div className="rounded-xl bg-card border border-border/50 p-5">
              <SectionHeader icon={MessageSquare} title="CS Notes Thread" />
              <NoteThread leadId={leadId} noteType="cs" label="CS Notes" profiles={profiles} />
            </div>
          )}

          {/* Processor Notes Thread */}
          {!isCS && (
            <div className="rounded-xl bg-card border border-border/50 p-5">
              <SectionHeader icon={FileText} title="Processor Notes Thread" />
              <NoteThread leadId={leadId} noteType="processor" label="Processor Notes" profiles={profiles} />
            </div>
          )}

          {/* Updates */}
          <div className="rounded-xl bg-card border border-border/50 p-5">
            <LeadUpdatesSection leadId={leadId} />
          </div>
        </div>

        <PaymentDialog
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
          onConfirm={handlePaymentConfirm}
          loading={paymentLoading}
        />
      </motion.div>
    </div>
  );
};

export default LeadDetailPanel;
