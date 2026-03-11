import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { LeadStatus, STATUS_LABELS, ALL_LEAD_STATUSES } from "@/lib/constants";
import { logActivity } from "@/lib/activity";
import { formatUSPhone } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Save, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { useDuplicatePhoneCheck } from "@/hooks/useDuplicatePhoneCheck";
import NoteThread from "@/components/leads/NoteThread";
import PaymentDialog from "@/components/leads/PaymentDialog";

export default function LeadDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const isNew = id === "new";

  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
    service_type: "",
    status: "waiting_complete_details" as LeadStatus,
    scheduled_date: "",
    scheduled_time_start: "",
    scheduled_time_end: "",
    amount: "",
    cs_notes: "",
    processor_notes: "",
  });
  const [jobId, setJobId] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [lastEditedBy, setLastEditedBy] = useState("");
  const [lastEditedAt, setLastEditedAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [previousStatus, setPreviousStatus] = useState<LeadStatus | null>(null);

  const { isDuplicate, duplicateLeadName } = useDuplicatePhoneCheck(form.customer_phone, isNew ? undefined : id);

  const isCS = role === "customer_service";
  const isProcessor = role === "processor";
  const isAdmin = role === "admin";

  useEffect(() => {
    fetchProfiles();
    if (!isNew && id) fetchLead();
  }, [id]);

  const fetchProfiles = async () => {
    const { data } = await supabase.from("profiles").select("id, full_name");
    if (data) {
      const map: Record<string, string> = {};
      data.forEach((p: any) => (map[p.id] = p.full_name));
      setProfiles(map);
    }
  };

  const fetchLead = async () => {
    setLoading(true);
    const { data: lead } = await supabase.from("leads").select("*").eq("id", id!).single();
    if (!lead) { navigate("/leads"); return; }

    setForm({
      customer_name: lead.customer_name,
      customer_phone: lead.customer_phone ? formatUSPhone(lead.customer_phone) : "",
      customer_email: lead.customer_email || "",
      address: lead.address || "",
      city: lead.city || "",
      state: lead.state || "",
      zip_code: lead.zip_code || "",
      service_type: lead.service_type || "",
      status: lead.status,
      scheduled_date: lead.scheduled_date || "",
      scheduled_time_start: lead.scheduled_time_start || "",
      scheduled_time_end: lead.scheduled_time_end || "",
      amount: lead.amount ? String(lead.amount) : "",
      cs_notes: lead.cs_notes || "",
      processor_notes: lead.processor_notes || "",
    });
    setPreviousStatus(lead.status);
    setJobId(lead.job_id);

    const { data: creator } = await supabase.from("profiles").select("full_name").eq("id", lead.created_by).single();
    setCreatedBy(creator?.full_name || "Unknown");
    if (lead.last_edited_by) {
      const { data: editor } = await supabase.from("profiles").select("full_name").eq("id", lead.last_edited_by).single();
      setLastEditedBy(editor?.full_name || "");
    }
    setLastEditedAt(lead.updated_at);
    setLoading(false);
  };

  const handleChange = (field: string, value: string) => {
    const newVal = field === "customer_phone" ? formatUSPhone(value) : value;

    // If changing status to paid, show payment dialog
    if (field === 'status' && value === 'paid') {
      setPaymentOpen(true);
      return;
    }

    setForm((prev) => ({ ...prev, [field]: newVal }));
  };

  const handlePaymentConfirm = async (amount: number, screenshotFile: File | null) => {
    setPaymentLoading(true);
    let screenshotUrl: string | null = null;

    if (screenshotFile) {
      const ext = screenshotFile.name.split('.').pop();
      const path = `payments/${id}_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('lead-photos').upload(path, screenshotFile);
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('lead-photos').getPublicUrl(path);
        screenshotUrl = urlData.publicUrl;
      }
    }

    setForm(prev => ({
      ...prev,
      status: 'paid',
      amount: String(amount),
    }));

    // If editing existing lead, save immediately
    if (!isNew && id) {
      const { error } = await supabase.from("leads").update({
        status: 'paid',
        amount,
        payment_amount: amount,
        payment_screenshot_url: screenshotUrl,
        last_edited_by: user?.id,
      }).eq("id", id);

      if (error) toast.error(error.message);
      else {
        toast.success("Payment recorded & status updated to Paid");
        await logActivity(user!.id, "payment_recorded", "lead", id, { amount });
      }
    }

    setPaymentLoading(false);
    setPaymentOpen(false);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!form.customer_name.trim()) { toast.error("Customer name is required"); return; }
    if (isDuplicate) {
      toast.error(`A lead with this phone number already exists (${duplicateLeadName})`);
      return;
    }
    setSaving(true);

    if (isNew) {
      const jobChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let jobId = 'LD-';
      for (let i = 0; i < 6; i++) jobId += jobChars[Math.floor(Math.random() * jobChars.length)];
      const { data, error } = await supabase.from("leads").insert({
        job_id: jobId,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone || null,
        customer_email: form.customer_email || null,
        address: form.address || null,
        city: form.city || null,
        state: form.state || null,
        zip_code: form.zip_code || null,
        service_type: form.service_type || null,
        status: form.status,
        scheduled_date: form.scheduled_date || null,
        scheduled_time_start: form.scheduled_time_start || null,
        scheduled_time_end: form.scheduled_time_end || null,
        amount: form.amount ? parseFloat(form.amount) : null,
        cs_notes: isCS || isAdmin ? form.cs_notes : undefined,
        processor_notes: isProcessor || isAdmin ? form.processor_notes : undefined,
        created_by: user.id,
        last_edited_by: user.id,
      }).select().single();

      if (error) { toast.error(error.message); setSaving(false); return; }
      if (data) {
        await logActivity(user.id, "created", "lead", data.id, { customer_name: form.customer_name });
        // Notify for urgent/need_tech
        if (form.status === 'urgent_job' || form.status === 'need_tech') {
          const { data: roles } = await supabase.from('user_roles').select('user_id, role').in('role', ['admin', 'processor']);
          if (roles) {
            const statusLabel = form.status === 'urgent_job' ? 'Urgent Job' : 'Need Tech';
            const notifs = roles.map((r: any) => ({
              user_id: r.user_id,
              title: `🚨 ${statusLabel}`,
              message: `New lead "${form.customer_name}" - ${statusLabel}`,
              lead_id: data.id,
              read: false,
            }));
            await supabase.from('notifications').insert(notifs);
          }
        }
        toast.success("Lead created!");
        navigate("/leads");
      }
    } else {
      const updateData: any = {
        customer_name: form.customer_name,
        customer_phone: form.customer_phone || null,
        customer_email: form.customer_email || null,
        address: form.address || null,
        city: form.city || null,
        state: form.state || null,
        zip_code: form.zip_code || null,
        service_type: form.service_type || null,
        status: form.status,
        scheduled_date: form.scheduled_date || null,
        scheduled_time_start: form.scheduled_time_start || null,
        scheduled_time_end: form.scheduled_time_end || null,
        last_edited_by: user.id,
      };
      // Only include amount if status is paid
      if (form.status === 'paid') {
        updateData.amount = form.amount ? parseFloat(form.amount) : null;
      }
      if (isCS || isAdmin) updateData.cs_notes = form.cs_notes;
      if (isProcessor || isAdmin) updateData.processor_notes = form.processor_notes;

      const { error } = await supabase.from("leads").update(updateData).eq("id", id!);
      if (error) { toast.error(error.message); setSaving(false); return; }

      // Notify for urgent/need_tech if status changed
      if (previousStatus !== form.status && (form.status === 'urgent_job' || form.status === 'need_tech')) {
        const { data: roles } = await supabase.from('user_roles').select('user_id, role').in('role', ['admin', 'processor']);
        if (roles) {
          const statusLabel = form.status === 'urgent_job' ? 'Urgent Job' : 'Need Tech';
          const notifs = roles.map((r: any) => ({
            user_id: r.user_id,
            title: `🚨 ${statusLabel}`,
            message: `Lead "${form.customer_name}" changed to ${statusLabel}`,
            lead_id: id,
            read: false,
          }));
          await supabase.from('notifications').insert(notifs);
        }
      }

      await logActivity(user.id, "updated", "lead", id, { fields: Object.keys(updateData) });
      toast.success("Lead updated!");
      navigate("/leads");
    }
    setSaving(false);
  };

  if (loading) return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading...</div>;

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="max-w-4xl mx-auto space-y-6"
    >
      {/* Header */}
      <motion.div variants={staggerItem} className="flex items-center gap-4">
        <motion.div whileHover={{ x: -3 }} whileTap={{ scale: 0.9 }}>
          <Button variant="ghost" size="icon" onClick={() => navigate("/leads")} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </motion.div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">{isNew ? "New Lead" : form.customer_name}</h1>
          {jobId && <p className="text-sm text-muted-foreground font-mono">{jobId}</p>}
        </div>
        <Badge variant="outline" className="shrink-0 text-xs">
          {isNew ? "Draft" : STATUS_LABELS[form.status]}
        </Badge>
        <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
          <Button onClick={handleSave} disabled={saving || isDuplicate} className="gap-2 shrink-0 shadow-lg shadow-primary/20">
            <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save"}
          </Button>
        </motion.div>
      </motion.div>

      {!isNew && (
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span>Created by: <strong className="text-foreground">{createdBy}</strong></span>
          {lastEditedBy && (
            <span>Last edited by: <strong className="text-foreground">{lastEditedBy}</strong> on {new Date(lastEditedAt).toLocaleString()}</span>
          )}
        </div>
      )}

      <motion.div variants={staggerItem} className="grid gap-6 md:grid-cols-2">
        {/* Customer Details */}
        <Card className="border-border/60 hover:shadow-md transition-shadow duration-300">
          <CardHeader><CardTitle className="text-base">Customer Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Customer Name *</Label>
              <Input value={form.customer_name} onChange={(e) => handleChange("customer_name", e.target.value)} placeholder="Customer name" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={form.customer_phone}
                onChange={(e) => handleChange("customer_phone", e.target.value)}
                placeholder="(555) 123-4567"
                maxLength={14}
                className={isDuplicate ? 'border-destructive ring-1 ring-destructive' : ''}
              />
              {isDuplicate && (
                <div className="flex items-center gap-1.5 text-destructive text-xs">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>A lead already exists with this number: <strong>{duplicateLeadName}</strong></span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => handleChange("address", e.target.value)} placeholder="123 Main St" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-2">
                <Label>City</Label>
                <Input value={form.city} onChange={(e) => handleChange("city", e.target.value)} placeholder="City" />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input value={form.state} onChange={(e) => handleChange("state", e.target.value)} placeholder="ST" maxLength={2} />
              </div>
              <div className="space-y-2">
                <Label>Zip</Label>
                <Input value={form.zip_code} onChange={(e) => handleChange("zip_code", e.target.value)} placeholder="12345" maxLength={10} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Service Type</Label>
              <Input value={form.service_type} onChange={(e) => handleChange("service_type", e.target.value)} placeholder="e.g. HVAC, Plumbing" />
            </div>
          </CardContent>
        </Card>

        {/* Status & Scheduling */}
        <Card className="border-border/60 hover:shadow-md transition-shadow duration-300">
          <CardHeader><CardTitle className="text-base">Status & Scheduling</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => handleChange("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_LEAD_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Scheduled Date</Label>
              <Input type="date" value={form.scheduled_date} onChange={(e) => handleChange("scheduled_date", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input type="time" value={form.scheduled_time_start} onChange={(e) => handleChange("scheduled_time_start", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input type="time" value={form.scheduled_time_end} onChange={(e) => handleChange("scheduled_time_end", e.target.value)} />
              </div>
            </div>
            {/* Amount only shows when status is paid */}
            {form.status === 'paid' && (
              <div className="space-y-2">
                <Label>Amount ($)</Label>
                <Input type="number" value={form.amount} onChange={(e) => handleChange("amount", e.target.value)} placeholder="0.00" />
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Note Threads */}
      <motion.div variants={staggerItem} className="grid gap-6 md:grid-cols-2">
        {(isCS || isAdmin) && (
          <Card className="border-border/60">
            <CardHeader><CardTitle className="text-base text-primary">CS Notes Thread</CardTitle></CardHeader>
            <CardContent>
              {!isNew && id ? (
                <NoteThread leadId={id} noteType="cs" label="CS Notes" profiles={profiles} />
              ) : (
                <p className="text-sm text-muted-foreground">Save the lead first to start adding notes.</p>
              )}
            </CardContent>
          </Card>
        )}
        {(isProcessor || isAdmin) && (
          <Card className="border-border/60">
            <CardHeader><CardTitle className="text-base text-primary">Processor Notes Thread</CardTitle></CardHeader>
            <CardContent>
              {!isNew && id ? (
                <NoteThread leadId={id} noteType="processor" label="Processor Notes" profiles={profiles} />
              ) : (
                <p className="text-sm text-muted-foreground">Save the lead first to start adding notes.</p>
              )}
            </CardContent>
          </Card>
        )}
      </motion.div>

      <PaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        onConfirm={handlePaymentConfirm}
        loading={paymentLoading}
      />
    </motion.div>
  );
}
