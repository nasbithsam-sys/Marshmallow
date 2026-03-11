import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { AlertCircle, ImagePlus, X } from 'lucide-react';
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
    start_hour: '12',
    start_minute: '00',
    start_ampm: 'AM',
    end_hour: '2',
    end_minute: '00',
    end_ampm: 'PM',
    cs_notes: '',
    processor_notes: '',
    general_notes: '',
  });
  const [photos, setPhotos] = useState<File[]>([]);

  const { isDuplicate, duplicateLeadName } = useDuplicatePhoneCheck(form.customer_phone);

  const update = (key: string, value: string) => {
    if (key === 'customer_phone') {
      setForm(prev => ({ ...prev, [key]: formatUSPhone(value) }));
    } else {
      setForm(prev => ({ ...prev, [key]: value }));
    }
  };

  const isCS = role === 'customer_service';

  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setPhotos(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const parseTime = (hour: string, minute: string, ampm: string) => {
    let h = parseInt(hour);
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return `${h.toString().padStart(2, '0')}:${minute}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (isDuplicate) {
      toast.error(`A lead with this phone number already exists (${duplicateLeadName})`);
      return;
    }

    setLoading(true);

    const jobId = generateJobId();

    let scheduled_time_start: string | null = null;
    let scheduled_time_end: string | null = null;
    if (form.scheduled_date) {
      scheduled_time_start = parseTime(form.start_hour, form.start_minute, form.start_ampm);
      scheduled_time_end = parseTime(form.end_hour, form.end_minute, form.end_ampm);
    }

    const { data, error } = await supabase.from('leads').insert({
      job_id: jobId,
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
      cs_notes: form.cs_notes || null,
      processor_notes: form.processor_notes || null,
    }).select().single();

    if (error) {
      toast.error('Failed to create lead: ' + error.message);
    } else if (data) {
      // Upload photos
      for (const photo of photos) {
        const ext = photo.name.split('.').pop();
        const path = `leads/${data.id}_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('lead-photos').upload(path, photo);
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('lead-photos').getPublicUrl(path);
          await supabase.from('lead_photos').insert({
            lead_id: data.id,
            photo_url: urlData.publicUrl,
            uploaded_by: user.id,
          });
        }
      }

      // Add general notes as a lead_notes entry
      if (form.general_notes.trim()) {
        await supabase.from('lead_notes').insert({
          lead_id: data.id,
          user_id: user.id,
          note_type: 'general',
          content: form.general_notes.trim(),
        });
      }

      await sendNotifications(form.customer_name, form.status, data.id);
      toast.success('Lead created successfully!');
      onSuccess();
      onOpenChange(false);
      setForm({
        customer_name: '', customer_phone: '',
        address: '', service_type: '',
        status: 'waiting_complete_details', scheduled_date: '',
        start_hour: '12', start_minute: '00', start_ampm: 'AM',
        end_hour: '2', end_minute: '00', end_ampm: 'PM',
        cs_notes: '', processor_notes: '', general_notes: '',
      });
      setPhotos([]);
    }
    setLoading(false);
  };

  const TimePicker = ({ prefix, label }: { prefix: 'start' | 'end'; label: string }) => (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-medium text-muted-foreground/60">{label}</Label>
      <div className="flex items-center gap-1.5">
        <Select value={form[`${prefix}_hour`]} onValueChange={v => update(`${prefix}_hour`, v)}>
          <SelectTrigger className="w-[60px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
              <SelectItem key={h} value={String(h)}>{h}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground/40">:</span>
        <Select value={form[`${prefix}_minute`]} onValueChange={v => update(`${prefix}_minute`, v)}>
          <SelectTrigger className="w-[60px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {['00', '15', '30', '45'].map(m => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={form[`${prefix}_ampm`]} onValueChange={v => update(`${prefix}_ampm`, v)}>
          <SelectTrigger className="w-[60px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="AM">AM</SelectItem>
            <SelectItem value="PM">PM</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Customer Name */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground/60">Customer Name *</Label>
            <Input value={form.customer_name} onChange={e => update('customer_name', e.target.value)} required placeholder="John Doe" />
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground/60">Phone Number *</Label>
            <Input
              value={form.customer_phone}
              onChange={e => update('customer_phone', e.target.value)}
              placeholder="(555) 123-4567"
              required
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

          {/* Address */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground/60">Address</Label>
            <Input value={form.address} onChange={e => update('address', e.target.value)} placeholder="123 Main St, City, State, Zip" />
          </div>

          {/* Service Type */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground/60">Service Type</Label>
            <Input value={form.service_type} onChange={e => update('service_type', e.target.value)} placeholder="HVAC Repair, Plumbing, etc." />
          </div>

          {/* Status */}
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

          {/* Schedule */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground/60">Job Scheduled For</Label>
            <Input
              type="date"
              value={form.scheduled_date}
              onChange={e => update('scheduled_date', e.target.value)}
            />
          </div>

          {form.scheduled_date && (
            <div className="grid grid-cols-2 gap-3">
              <TimePicker prefix="start" label="Start Time" />
              <TimePicker prefix="end" label="End Time" />
            </div>
          )}

          {/* Photo Attachments */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground/60">Photos</Label>
            <div className="flex flex-wrap gap-2">
              {photos.map((photo, i) => (
                <div key={i} className="relative h-16 w-16 rounded-lg overflow-hidden border border-border/40 group">
                  <img src={URL.createObjectURL(photo)} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
              <label className="h-16 w-16 rounded-lg border-2 border-dashed border-border/40 flex items-center justify-center cursor-pointer hover:border-primary/40 transition-colors">
                <ImagePlus className="h-5 w-5 text-muted-foreground/40" />
                <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoAdd} />
              </label>
            </div>
          </div>

          {/* General Notes */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground/60">Notes</Label>
            <Textarea
              value={form.general_notes}
              onChange={e => update('general_notes', e.target.value)}
              placeholder="General notes about this lead..."
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Customer Service Notes */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-primary">Customer Service Notes</Label>
            <Textarea
              value={form.cs_notes}
              onChange={e => update('cs_notes', e.target.value)}
              placeholder="Notes for customer service..."
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Processor Notes - hidden from CS */}
          {!isCS && (
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-primary">Processor Notes</Label>
              <Textarea
                value={form.processor_notes}
                onChange={e => update('processor_notes', e.target.value)}
                placeholder="Notes for processor..."
                rows={3}
                className="resize-none"
              />
            </div>
          )}

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
