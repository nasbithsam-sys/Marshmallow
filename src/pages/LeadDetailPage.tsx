import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { LeadStatus, STATUS_LABELS, ALL_LEAD_STATUSES } from "@/lib/constants";
import { logActivity } from "@/lib/activity";
import { formatUSPhone } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/motion";

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

  const isCS = role === "customer_service";
  const isProcessor = role === "processor";
  const isAdmin = role === "admin";

  useEffect(() => {
    if (!isNew && id) fetchLead();
  }, [id]);

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
    setJobId(lead.job_id);

    // Fetch creator name
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
    setForm((prev) => ({ ...prev, [field]: newVal }));
  };

  const handleSave = async () => {
    if (!user) return;
    if (!form.customer_name.trim()) { toast.error("Customer name is required"); return; }
    setSaving(true);

    if (isNew) {
      const { data, error } = await supabase.from("leads").insert({
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
        amount: form.amount ? parseFloat(form.amount) : null,
        last_edited_by: user.id,
      };
      if (isCS || isAdmin) updateData.cs_notes = form.cs_notes;
      if (isProcessor || isAdmin) updateData.processor_notes = form.processor_notes;

      const { error } = await supabase.from("leads").update(updateData).eq("id", id!);
      if (error) { toast.error(error.message); setSaving(false); return; }

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
          <Button onClick={handleSave} disabled={saving} className="gap-2 shrink-0 shadow-lg shadow-primary/20">
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
              <Input value={form.customer_phone} onChange={(e) => handleChange("customer_phone", e.target.value)} placeholder="(555) 123-4567" maxLength={14} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={form.customer_email} onChange={(e) => handleChange("customer_email", e.target.value)} placeholder="email@example.com" type="email" />
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
            <div className="space-y-2">
              <Label>Amount ($)</Label>
              <Input type="number" value={form.amount} onChange={(e) => handleChange("amount", e.target.value)} placeholder="0.00" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Notes */}
      <motion.div variants={staggerItem} className="grid gap-6 md:grid-cols-2">
        {(isCS || isAdmin) && (
          <Card className="border-border/60">
            <CardHeader><CardTitle className="text-base">CS Notes</CardTitle></CardHeader>
            <CardContent>
              <Textarea
                value={form.cs_notes}
                onChange={(e) => handleChange("cs_notes", e.target.value)}
                rows={6}
                placeholder="Customer service notes..."
                disabled={isProcessor}
              />
            </CardContent>
          </Card>
        )}
        {(isProcessor || isAdmin) && (
          <Card className="border-border/60">
            <CardHeader><CardTitle className="text-base">Processor Notes</CardTitle></CardHeader>
            <CardContent>
              <Textarea
                value={form.processor_notes}
                onChange={(e) => handleChange("processor_notes", e.target.value)}
                rows={6}
                placeholder="Processor notes..."
                disabled={isCS}
              />
            </CardContent>
          </Card>
        )}
      </motion.div>
    </motion.div>
  );
}