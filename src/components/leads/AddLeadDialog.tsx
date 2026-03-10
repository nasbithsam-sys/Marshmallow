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
import { LEAD_STATUS_CONFIG, type LeadStatus } from '@/types';

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

const AddLeadDialog = ({ open, onOpenChange, onSuccess }: Props) => {
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    service_type: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    status: 'waiting_complete_details' as LeadStatus,
    amount: '',
    cs_notes: '',
    processor_notes: '',
  });

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    const { error } = await supabase.from('leads').insert({
      job_id: generateJobId(),
      customer_name: form.customer_name,
      customer_email: form.customer_email,
      customer_phone: form.customer_phone,
      service_type: form.service_type,
      address: form.address,
      city: form.city,
      state: form.state,
      zip_code: form.zip_code,
      status: form.status,
      amount: form.amount ? parseFloat(form.amount) : null,
      cs_notes: form.cs_notes || null,
      processor_notes: role !== 'customer_service' ? (form.processor_notes || null) : null,
      created_by: user.id,
      assigned_cs: role === 'customer_service' ? user.id : null,
    });

    if (error) {
      toast.error('Failed to create lead: ' + error.message);
    } else {
      toast.success('Lead created');
      onSuccess();
      onOpenChange(false);
      setForm({
        customer_name: '', customer_email: '', customer_phone: '',
        service_type: '', address: '', city: '', state: '', zip_code: '',
        status: 'waiting_complete_details', amount: '', cs_notes: '', processor_notes: '',
      });
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Customer Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Customer Name *</Label>
              <Input value={form.customer_name} onChange={e => update('customer_name', e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Phone *</Label>
              <Input value={form.customer_phone} onChange={e => update('customer_phone', e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.customer_email} onChange={e => update('customer_email', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Service Type *</Label>
              <Input value={form.service_type} onChange={e => update('service_type', e.target.value)} required />
            </div>
          </div>

          {/* Address */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label>Address</Label>
              <Input value={form.address} onChange={e => update('address', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={form.city} onChange={e => update('city', e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>State</Label>
                <Input value={form.state} onChange={e => update('state', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Zip</Label>
                <Input value={form.zip_code} onChange={e => update('zip_code', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Status & Amount */}
          <div className="grid grid-cols-2 gap-4">
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
            <div className="space-y-2">
              <Label>Amount ($)</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={e => update('amount', e.target.value)} />
            </div>
          </div>

          {/* CS Notes */}
          <div className="space-y-2">
            <Label>CS Notes</Label>
            <Textarea
              value={form.cs_notes}
              onChange={e => update('cs_notes', e.target.value)}
              placeholder="Customer service notes..."
              rows={3}
            />
          </div>

          {/* Processor Notes - hidden from CS */}
          {role !== 'customer_service' && (
            <div className="space-y-2">
              <Label>Processor Notes</Label>
              <Textarea
                value={form.processor_notes}
                onChange={e => update('processor_notes', e.target.value)}
                placeholder="Processor notes..."
                rows={3}
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Lead'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddLeadDialog;
