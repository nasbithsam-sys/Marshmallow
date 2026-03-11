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
import { ArrowLeft, Save, AlertCircle, ImagePlus, X } from "lucide-react";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { useDuplicatePhoneCheck } from "@/hooks/useDuplicatePhoneCheck";
import NoteThread from "@/components/leads/NoteThread";
import PaymentDialog from "@/components/leads/PaymentDialog";
import ImageLightbox from "@/components/leads/ImageLightbox";

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
  const [photos, setPhotos] = useState<{ id: string; url: string }[]>([]);
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const { isDuplicate, duplicateLeadName } = useDuplicatePhoneCheck(form.customer_phone, isNew ? undefined : id);

  const isCS = role === "customer_service";
  const isProcessor = role === "processor";
  const isAdmin = role === "admin";
  const isStatusLocked = previousStatus === "paid";

  useEffect(() => {
    fetchProfiles();
    if (!isNew && id) {
      fetchLead();
      fetchPhotos();
    }
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
      status: lead.status as LeadStatus,
      scheduled_date: lead.scheduled_date || "",
      scheduled_time_start: lead.scheduled_time_start || "",
      scheduled_time_end: lead.scheduled_time_end || "",
      amount: lead.amount ? String(lead.amount) : "",
      cs_notes: lead.cs_notes || "",
      processor_notes: lead.processor_notes || "",
    });
    setPreviousStatus(lead.status as LeadStatus);
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

  const fetchPhotos = async () => {
    const { data } = await supabase
      .from("lead_photos")
      .select("id, photo_url")
      .eq("lead_id", id!)
      .order("created_at", { ascending: true });
    if (data) setPhotos(data.map((p: any) => ({ id: p.id, url: p.photo_url })));
  };

  const handleChange = (field: string, value: string) => {
    const newVal = field === "customer_phone" ? formatUSPhone(value) : value;

    if (field === 'status' && value === 'paid') {
      setPaymentOpen(true);
      return;
    }

    setForm((prev) => ({ ...prev, [field]: newVal }));
  };

  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setNewPhotos(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeNewPhoto = (index: number) => {
    setNewPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingPhoto = async (photoId: string) => {
    await supabase.from("lead_photos").delete().eq("id", photoId);
    setPhotos(prev => prev.filter(p => p.id !== photoId));
  };

  const handlePaymentConfirm = async (amount: number, screenshotFile: File | null) => {
    setPaymentLoading(true);
    let screenshotUrl: string | null = null;

    if (screenshotFile) {
      const ext = screenshotFile.name.split('.').pop();
      const path = `payments/${id}_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('lead-photos').upload(path, screenshotFile);
      if (!uploadError) {
        screenshotUrl = path;
      }
    }

    setForm(prev => ({
      ...prev,
      status: 'paid',
      amount: String(amount),
    }));

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
        setPreviousStatus('paid');
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

    // Upload new photos helper
    const uploadPhotos = async (leadId: string) => {
      for (const photo of newPhotos) {
        const ext = photo.name.split('.').pop();
        const path = `leads/${leadId}_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('lead-photos').upload(path, photo);
        if (!uploadErr) {
          await supabase.from('lead_photos').insert({
            lead_id: leadId,
            photo_url: path,
            uploaded_by: user.id,
          });
        }
      }
      setNewPhotos([]);
    };

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
        await uploadPhotos(data.id);
        await logActivity(user.id, "created", "lead", data.id, { customer_name: form.customer_name });
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
      if (form.status === 'paid') {
        updateData.amount = form.amount ? parseFloat(form.amount) : null;
      }
      if (isCS || isAdmin) updateData.cs_notes = form.cs_notes;
      if (isProcessor || isAdmin) updateData.processor_notes = form.processor_notes;

      const { error } = await supabase.from("leads").update(updateData).eq("id", id!);
      if (error) { toast.error(error.message); setSaving(false); return; }

      await uploadPhotos(id!);

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

  const allImageUrls = photos.map(p => p.url);

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
              <Input value={form.address} onChange={(e) => handleChange("address", e.target.value)} placeholder="123 Main St, City, State, Zip" />
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
              <Select value={form.status} onValueChange={(v) => handleChange("status", v)} disabled={isStatusLocked}>
                <SelectTrigger className={isStatusLocked ? 'opacity-60 cursor-not-allowed' : ''}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_LEAD_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isStatusLocked && (
                <p className="text-[11px] text-muted-foreground/60">Status is locked after payment.</p>
              )}
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
            {form.status === 'paid' && (
              <div className="space-y-2">
                <Label>Amount ($)</Label>
                <Input type="number" value={form.amount} onChange={(e) => handleChange("amount", e.target.value)} placeholder="0.00" />
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Photos Section */}
      <motion.div variants={staggerItem}>
        <Card className="border-border/60">
          <CardHeader><CardTitle className="text-base">Photos</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {photos.map((photo, i) => (
                <div key={photo.id} className="relative h-20 w-20 rounded-lg overflow-hidden border border-border/40 group">
                  <img
                    src={photo.url}
                    alt=""
                    className="h-full w-full object-cover cursor-pointer"
                    onClick={() => { setLightboxIndex(i); setLightboxOpen(true); }}
                  />
                  {!isStatusLocked && (
                    <button
                      onClick={() => removeExistingPhoto(photo.id)}
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
              {newPhotos.map((photo, i) => (
                <div key={`new-${i}`} className="relative h-20 w-20 rounded-lg overflow-hidden border border-dashed border-primary/40 group">
                  <img src={URL.createObjectURL(photo)} alt="" className="h-full w-full object-cover" />
                  <button
                    onClick={() => removeNewPhoto(i)}
                    className="absolute top-1 right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <label className="h-20 w-20 rounded-lg border-2 border-dashed border-border/40 flex items-center justify-center cursor-pointer hover:border-primary/40 transition-colors">
                <ImagePlus className="h-6 w-6 text-muted-foreground/40" />
                <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoAdd} />
              </label>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Note Threads */}
      <motion.div variants={staggerItem} className="grid gap-6 md:grid-cols-2">
        {/* General Notes - visible to all */}
        <Card className="border-border/60">
          <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
          <CardContent>
            {!isNew && id ? (
              <NoteThread leadId={id} noteType="general" label="Notes" profiles={profiles} />
            ) : (
              <p className="text-sm text-muted-foreground">Save the lead first to start adding notes.</p>
            )}
          </CardContent>
        </Card>

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

      <ImageLightbox
        images={allImageUrls}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />
    </motion.div>
  );
}
