import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { AlertCircle, MessageSquare } from 'lucide-react';
import { LEAD_STATUS_CONFIG, type LeadStatus } from '@/types';
import { useDuplicatePhoneCheck } from '@/hooks/useDuplicatePhoneCheck';
import { formatUSPhone } from '@/lib/phone';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const generateJobId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'LD-';
  for (let i = 0; i < 6; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
};

const sendNotifications = async (leadName: string, status: string, leadId: string) => {
  if (status !== 'urgent_job' && status !== 'need_tech') return;

  const { data: roles } = await supabase
    .from('user_roles')
    .select('user_id, role')
    .in('role', ['admin', 'processor']);

  if (!roles || roles.length === 0) return;

  const statusLabel = status === 'urgent_job' ? 'Urgent Job' : 'Need Tech';
  const notifications = roles.map((r: any) => ({
    user_id: r.user_id,
    title: `🚨 ${statusLabel}`,
    message: `New lead "${leadName}" requires attention - marked as ${statusLabel}`,
    lead_id: leadId,
    read: false,
  }));

  await supabase.from('notifications').insert(notifications);
};

const AddLeadDialog = ({ open, onOpenChange, onSuccess }: Props) => {
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    address: '',
    service_type: '',
    status: 'waiting_complete_details' as LeadStatus,
    scheduled_date: '',
    scheduled_hour: '12',
    scheduled_minute: '00',
    scheduled_ampm: 'AM',
  });

  const { isDuplicate, duplicateLeadName } = useDuplicatePhoneCheck(form.customer_phone);

  const update = (key: string, value: string) => {
    if (key === 'customer_phone') {
      setForm(prev => ({ ...prev, [key]: formatUSPhone(value) }));
    } else {
      setForm(prev => ({ ...prev, [key]: value }));
    }
  };

  const isCS = role === 'customer_service';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (isDuplicate) {
      toast.error(`A lead with this phone number already exists (${duplicateLeadName})`);
      return;
    }

    setLoading(true);

    let scheduled_time_start: string | null = null;
    let scheduled_time_end: string | null = null;
    if (form.scheduled_date) {
      let hour = parseInt(form.scheduled_hour);
      if (form.scheduled_ampm === 'PM' && hour !== 12) hour += 12;
      if (form.scheduled_ampm === 'AM' && hour === 12) hour = 0;
      scheduled_time_start = `${hour.toString().padStart(2, '0')}:${form.scheduled_minute}`;
      const endHour = Math.min(hour + 2, 23);
      scheduled_time_end = `${endHour.toString().padStart(2, '0')}:${form.scheduled_minute}`;
    }

    const { data, error } = await supabase.from('leads').insert({
      job_id: generateJobId(),
      customer_name: form.customer_name,
      customer_phone: form.customer_phone || null,
      address: form.address || null,
      service_type: form.service_type || null,
      status: form.status,
      scheduled_date: form.scheduled_date || null,
      scheduled_time_start,
      scheduled_time_end,
      created_by: user.id,
      assigned_cs: isCS ? user.id : null,
    }).select().single();

    if (error) {
      toast.error('Failed to create lead: ' + error.message);
    } else {
      if (data) {
        await sendNotifications(form.customer_name, form.status, data.id);
      }
      toast.success('Lead created! You can now add notes from the lead detail page.');
      onSuccess();
      onOpenChange(false);
      setForm({
        customer_name: '', customer_phone: '',
        address: '', service_type: '',
        status: 'waiting_complete_details', scheduled_date: '',
        scheduled_hour: '12', scheduled_minute: '00', scheduled_ampm: 'AM',
      });
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground/60">Customer Name *</Label>
            <Input value={form.customer_name} onChange={e => update('customer_name', e.target.value)} required placeholder="John Doe" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground/60">Phone Number</Label>
            <Input
              value={form.customer_phone}
              onChange={e => update('customer_phone', e.target.value)}
              placeholder="(555) 123-4567"
              maxLength={14}
              className={isDuplicate ? 'border-destructive ring-1 ring-destructive' : ''}
            />
            {isDuplicate && (
              <div className="flex items-center gap-1.5 text-destructive text-[11px] mt-1">
                <AlertCircle className="h-3 w-3" />
                <span>A lead already exists with this number: <strong>{duplicateLeadName}</strong></span>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground/60">Address</Label>
            <Input value={form.address} onChange={e => update('address', e.target.value)} placeholder="123 Main St, City, State" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground/60">Service Type</Label>
            <Input value={form.service_type} onChange={e => update('service_type', e.target.value)} placeholder="HVAC Repair, Plumbing, etc." />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground/60">Status</Label>
            <Select value={form.status} onValueChange={v => update('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(LEAD_STATUS_CONFIG)
                  .filter(([key]) => key !== 'paid')
                  .map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground/60">Job Scheduled For</Label>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={form.scheduled_date}
                onChange={e => update('scheduled_date', e.target.value)}
                className="flex-1"
              />
              <Select value={form.scheduled_hour} onValueChange={v => update('scheduled_hour', v)}>
                <SelectTrigger className="w-[65px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                    <SelectItem key={h} value={String(h)}>{h}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-muted-foreground/40">:</span>
              <Select value={form.scheduled_minute} onValueChange={v => update('scheduled_minute', v)}>
                <SelectTrigger className="w-[65px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['00', '15', '30', '45'].map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={form.scheduled_ampm} onValueChange={v => update('scheduled_ampm', v)}>
                <SelectTrigger className="w-[65px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AM">AM</SelectItem>
                  <SelectItem value="PM">PM</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border border-border/40 bg-muted/20 p-3 flex items-start gap-2.5">
            <MessageSquare className="h-4 w-4 text-muted-foreground/40 mt-0.5 shrink-0" />
            <div>
              <p className="text-[12px] font-medium text-foreground">Notes</p>
              <p className="text-[11px] text-muted-foreground/60">
                Create the lead first, then add notes from the lead detail page using the threaded notes system.
              </p>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || isDuplicate}>
              {loading ? 'Creating...' : 'Create Lead'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddLeadDialog;
