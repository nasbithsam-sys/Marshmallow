import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logActivity } from "@/lib/activity";
import { formatUSPhone } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Save, AlertCircle, ImagePlus, X, ChevronDown, User, Wrench, Calendar, Check } from "lucide-react";
import { motion } from "framer-motion";
import { useDuplicatePhoneCheck } from "@/hooks/useDuplicatePhoneCheck";
import PaymentDialog from "@/components/leads/PaymentDialog";
import ImageLightbox from "@/components/leads/ImageLightbox";
import CopyLeadButton from "@/components/leads/CopyLeadButton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { LEAD_STATUS_CONFIG, type Lead, type LeadStatus } from "@/types";
import { getChangeableStatuses } from "@/lib/constants";

const generateJobId = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "LD-";
  for (let i = 0; i < 6; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
};

const sendNotifications = async (leadName: string, status: string, leadId: string) => {
  if (status !== "urgent_job" && status !== "need_tech") return;

  const { data: roles } = await supabase.from("user_roles").select("user_id, role").in("role", ["admin", "processor"]);

  if (!roles || roles.length === 0) return;

  const statusLabel = status === "urgent_job" ? "Urgent Job" : "Need Tech";

  const notifications = roles.map((r: any) => ({
    user_id: r.user_id,
    title: `🚨 ${statusLabel}`,
    message: `Lead "${leadName}" changed to ${statusLabel}`,
    lead_id: leadId,
    read: false,
  }));

  await supabase.from("notifications").insert(notifications);
};

const SectionHeader = ({ icon: Icon, title, open }: { icon: React.ElementType; title: string; open: boolean }) => (
  <div className="flex items-center gap-2.5 w-full">
    <div className="w-7 h-7 rounded-md bg-primary/10 border border-primary/15 flex items-center justify-center">
      <Icon className="h-3.5 w-3.5 text-primary/80" />
    </div>
    <span className="text-[13px] font-semibold text-foreground flex-1">{title}</span>
    <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
      <ChevronDown className="h-4 w-4 text-muted-foreground/70" />
    </motion.span>
  </div>
);

export default function LeadDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();

  const isNew = id === "new";
  const isCS = role === "customer_service";
  const isProcessor = role === "processor";
  const isAdmin = role === "admin";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [leadId, setLeadId] = useState<string | null>(isNew ? null : id || null);
  const [originalLead, setOriginalLead] = useState<Lead | null>(null);

  const [jobId, setJobId] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [lastEditedBy, setLastEditedBy] = useState("");
  const [lastEditedAt, setLastEditedAt] = useState("");

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);

  const [photos, setPhotos] = useState<{ id: string; url: string; path?: string }[]>([]);
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const [csOpen, setCsOpen] = useState(true);
  const [processorOpen, setProcessorOpen] = useState(role !== "customer_service");
  const [scheduleOpen, setScheduleOpen] = useState(true);

  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    number_name: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
    service_type: "",
    status: "waiting_complete_details" as LeadStatus,
    scheduled_date: "",
    start_hour: "12",
    start_minute: "00",
    start_ampm: "AM",
    end_hour: "2",
    end_minute: "00",
    end_ampm: "PM",

    quote: "",
    service_details: "",
    customer_schedule_requirements: "",
    reference_name: "",

    tech_name: "",
    tech_number: "",
    terms: "" as "" | "free_estimate" | "quoted",
    labor_amount: "",
    material_amount: "",
    for_you_amount: "",
    for_us_amount: "",

    cs_notes: "",
    processor_notes: "",
    general_notes: "",

    amount: "",
    payment_screenshot_url: "",
  });

  const duplicateCheckId = isNew ? undefined : leadId || undefined;
  const { isDuplicate, duplicateLeadName } = useDuplicatePhoneCheck(form.customer_phone, duplicateCheckId);

  const fieldClass = "bg-background border-border/70 text-foreground placeholder:text-muted-foreground/60";
  const labelClass = "text-[12px] font-semibold text-foreground/80";
  const sectionClass = "rounded-xl border border-border/60 bg-muted/10 p-4 space-y-3";

  const fetchProfilesAndMeta = async (lead: any) => {
    const { data: creator } = await supabase.from("profiles").select("full_name").eq("id", lead.created_by).single();
    setCreatedBy(creator?.full_name || "Unknown");

    if (lead.last_edited_by) {
      const { data: editor } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", lead.last_edited_by)
        .single();
      setLastEditedBy(editor?.full_name || "Unknown");
    } else {
      setLastEditedBy("");
    }

    setLastEditedAt(lead.updated_at || "");
  };

  const setFormFromLead = (lead: any) => {
    const parseTimeParts = (time?: string | null, fallbackHour = "12", fallbackMinute = "00", fallbackAmpm = "AM") => {
      if (!time) {
        return { hour: fallbackHour, minute: fallbackMinute, ampm: fallbackAmpm };
      }

      const [rawHour, minute] = time.split(":");
      let hourNum = parseInt(rawHour, 10);
      const ampm = hourNum >= 12 ? "PM" : "AM";
      hourNum = hourNum % 12 || 12;

      return {
        hour: String(hourNum),
        minute: minute || "00",
        ampm,
      };
    };

    const start = parseTimeParts(lead.scheduled_time_start, "12", "00", "AM");
    const end = parseTimeParts(lead.scheduled_time_end, "2", "00", "PM");

    setForm({
      customer_name: lead.customer_name || "",
      customer_phone: lead.customer_phone ? formatUSPhone(lead.customer_phone) : "",
      customer_email: lead.customer_email || "",
      number_name: lead.number_name || "",
      address: lead.address || "",
      city: lead.city || "",
      state: lead.state || "",
      zip_code: lead.zip_code || "",
      service_type: lead.service_type || "",
      status: (lead.status || "waiting_complete_details") as LeadStatus,
      scheduled_date: lead.scheduled_date || "",
      start_hour: start.hour,
      start_minute: start.minute,
      start_ampm: start.ampm,
      end_hour: end.hour,
      end_minute: end.minute,
      end_ampm: end.ampm,

      quote: lead.quote || "",
      service_details: lead.service_details || "",
      customer_schedule_requirements: lead.customer_schedule_requirements || "",
      reference_name: lead.reference_name || "",

      tech_name: lead.tech_name || "",
      tech_number: lead.tech_number ? formatUSPhone(lead.tech_number) : "",
      terms: lead.terms || "",
      labor_amount: lead.labor_amount != null ? String(lead.labor_amount) : "",
      material_amount: lead.material_amount != null ? String(lead.material_amount) : "",
      for_you_amount: lead.for_you_amount != null ? String(lead.for_you_amount) : "",
      for_us_amount: lead.for_us_amount != null ? String(lead.for_us_amount) : "",

      cs_notes: lead.cs_notes || "",
      processor_notes: lead.processor_notes || "",
      general_notes: lead.general_notes || "",

      amount: lead.amount != null ? String(lead.amount) : "",
      payment_screenshot_url: lead.payment_screenshot_url || "",
    });
  };

  const fetchLead = async () => {
    if (!id || isNew) return;

    setLoading(true);

    const { data: lead, error } = await supabase.from("leads").select("*").eq("id", id).single();

    if (error || !lead) {
      toast.error("Lead not found");
      navigate("/leads");
      return;
    }

    setLeadId(lead.id);
    setOriginalLead(lead as Lead);
    setJobId(lead.job_id);
    setFormFromLead(lead);
    await fetchProfilesAndMeta(lead);
    setLoading(false);
  };

  const fetchPhotos = async (currentLeadId: string) => {
    const { data } = await supabase
      .from("lead_photos")
      .select("id, photo_url")
      .eq("lead_id", currentLeadId)
      .order("created_at", { ascending: true });

    if (data) {
      const { getSignedUrls } = await import("@/lib/storage");
      const paths = data.map((p: any) => p.photo_url);
      const urls = await getSignedUrls(paths);
      setPhotos(data.map((p: any, i: number) => ({ id: p.id, url: urls[i], path: p.photo_url })));
    } else {
      setPhotos([]);
    }
  };

  useEffect(() => {
    if (isNew) {
      setLoading(false);
      setJobId(generateJobId());
      return;
    }
    fetchLead();
  }, [id, isNew]);

  useEffect(() => {
    if (leadId) {
      fetchPhotos(leadId);
    }
  }, [leadId]);

  const update = (key: string, value: string) => {
    if (key === "customer_phone" || key === "tech_number") {
      setForm((prev) => ({ ...prev, [key]: formatUSPhone(value) }));
      return;
    }

    if (key === "status" && value === "paid") {
      setPaymentOpen(true);
      return;
    }

    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const parseTime = (hour: string, minute: string, ampm: string) => {
    let h = parseInt(hour, 10);
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return `${h.toString().padStart(2, "0")}:${minute}`;
  };

  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setNewPhotos((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeNewPhoto = (index: number) => {
    setNewPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingPhoto = async (photoId: string) => {
    await supabase.from("lead_photos").delete().eq("id", photoId);
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
  };

  const handlePaymentConfirm = async (amount: number, screenshotFile: File | null) => {
    if (!leadId || !user) {
      toast.error("Save the lead first before recording payment");
      setPaymentOpen(false);
      return;
    }

    setPaymentLoading(true);
    let screenshotUrl: string | null = null;

    if (screenshotFile) {
      const ext = screenshotFile.name.split(".").pop();
      const path = `payments/${leadId}_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("lead-photos").upload(path, screenshotFile);

      if (!uploadError) {
        screenshotUrl = path;
      }
    }

    const { error } = await supabase
      .from("leads")
      .update({
        status: "paid",
        amount,
        payment_amount: amount,
        payment_screenshot_url: screenshotUrl,
        last_edited_by: user.id,
        updated_at: new Date().toISOString(),
        last_edited_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    setPaymentLoading(false);
    setPaymentOpen(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setForm((prev) => ({
      ...prev,
      status: "paid",
      amount: String(amount),
      payment_screenshot_url: screenshotUrl || prev.payment_screenshot_url,
    }));

    await fetchLead();
    toast.success("Payment recorded & status updated to Paid");
  };

  const uploadNewPhotos = async (currentLeadId: string) => {
    for (const photo of newPhotos) {
      const ext = photo.name.split(".").pop();
      const path = `leads/${currentLeadId}_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadErr } = await supabase.storage.from("lead-photos").upload(path, photo);

      if (!uploadErr) {
        await supabase.from("lead_photos").insert({
          lead_id: currentLeadId,
          photo_url: path,
          uploaded_by: user!.id,
        });
      }
    }

    setNewPhotos([]);
    await fetchPhotos(currentLeadId);
  };

  const handleSave = async () => {
    if (!user) return;

    if (!form.customer_name.trim()) {
      toast.error("Customer Name is required");
      return;
    }

    if (!form.customer_phone.trim()) {
      toast.error("Phone Number is required");
      return;
    }

    if (!form.number_name.trim()) {
      toast.error("Number Name is required");
      return;
    }

    if (isDuplicate) {
      toast.error(`A lead with this phone number already exists (${duplicateLeadName})`);
      return;
    }

    setSaving(true);

    let scheduled_time_start: string | null = null;
    let scheduled_time_end: string | null = null;

    if (form.scheduled_date) {
      scheduled_time_start = parseTime(form.start_hour, form.start_minute, form.start_ampm);
      scheduled_time_end = parseTime(form.end_hour, form.end_minute, form.end_ampm);
    }

    const payload: any = {
      customer_name: form.customer_name,
      customer_phone: form.customer_phone || null,
      customer_email: form.customer_email || null,
      number_name: form.number_name || null,
      address: form.address || null,
      city: form.city || null,
      state: form.state || null,
      zip_code: form.zip_code || null,
      service_type: form.service_type || null,
      status: form.status,
      scheduled_date: form.scheduled_date || null,
      scheduled_time_start,
      scheduled_time_end,

      quote: form.quote || null,
      service_details: form.service_details || null,
      customer_schedule_requirements: form.customer_schedule_requirements || null,
      reference_name: form.reference_name || null,

      general_notes: form.general_notes || null,
      cs_notes: form.cs_notes || null,
      processor_notes: form.processor_notes || null,

      tech_name: role !== "customer_service" ? form.tech_name || null : (originalLead?.tech_name ?? null),
      tech_number: role !== "customer_service" ? form.tech_number || null : (originalLead?.tech_number ?? null),
      terms: role !== "customer_service" ? form.terms || null : (originalLead?.terms ?? null),
      labor_amount:
        role !== "customer_service"
          ? form.labor_amount
            ? parseFloat(form.labor_amount)
            : null
          : (originalLead?.labor_amount ?? null),
      material_amount:
        role !== "customer_service"
          ? form.material_amount
            ? parseFloat(form.material_amount)
            : null
          : (originalLead?.material_amount ?? null),
      for_you_amount:
        role !== "customer_service"
          ? form.for_you_amount
            ? parseFloat(form.for_you_amount)
            : null
          : (originalLead?.for_you_amount ?? null),
      for_us_amount:
        role !== "customer_service"
          ? form.for_us_amount
            ? parseFloat(form.for_us_amount)
            : null
          : (originalLead?.for_us_amount ?? null),

      last_edited_by: user.id,
      updated_at: new Date().toISOString(),
      last_edited_at: new Date().toISOString(),
    };

    try {
      if (isNew) {
        const insertData = {
          ...payload,
          job_id: jobId || generateJobId(),
          created_by: user.id,
          assigned_cs: isCS ? user.id : null,
        };

        const { data, error } = await supabase.from("leads").insert(insertData).select().single();

        if (error) throw error;

        const newLeadId = data.id;
        setLeadId(newLeadId);
        setOriginalLead(data as Lead);

        if (newPhotos.length > 0) {
          await uploadNewPhotos(newLeadId);
        }

        await sendNotifications(form.customer_name, form.status, newLeadId);
        await logActivity(user.id, "created", "lead", newLeadId, { customer_name: form.customer_name });

        toast.success("Lead created!");

        navigate(`/leads/${newLeadId}`, { replace: true });
        setSaving(false);
        return;
      }

      if (!leadId) throw new Error("Missing lead id");

      const previousStatus = originalLead?.status;
      if (form.status === "paid" && form.amount) {
        payload.amount = parseFloat(form.amount);
      }

      const { error } = await supabase.from("leads").update(payload).eq("id", leadId);

      if (error) throw error;

      if (newPhotos.length > 0) {
        await uploadNewPhotos(leadId);
      }

      if (previousStatus !== form.status && (form.status === "urgent_job" || form.status === "need_tech")) {
        await sendNotifications(form.customer_name, form.status, leadId);
      }

      const changedDetails: Record<string, unknown> = { customer_name: form.customer_name };
      if (previousStatus && previousStatus !== form.status) {
        changedDetails.status_from = LEAD_STATUS_CONFIG[previousStatus]?.label || previousStatus;
        changedDetails.status_to = LEAD_STATUS_CONFIG[form.status]?.label || form.status;
      }
      await logActivity(user.id, "updated", "lead", leadId, changedDetails);

      setSaved(true);
      setTimeout(() => setSaved(false), 2000);

      await fetchLead();
      toast.success("Lead updated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save lead");
    } finally {
      setSaving(false);
    }
  };

  const currentCopyLead = useMemo(() => {
    if (isNew || !leadId) return null;

    return {
      ...(originalLead || {}),
      id: leadId,
      job_id: jobId,
      customer_name: form.customer_name,
      customer_phone: form.customer_phone || null,
      customer_email: form.customer_email || null,
      number_name: form.number_name || null,
      address: form.address || null,
      city: form.city || null,
      state: form.state || null,
      zip_code: form.zip_code || null,
      service_type: form.service_type || null,
      status: form.status,
      scheduled_date: form.scheduled_date || null,
      scheduled_time_start: form.scheduled_date ? parseTime(form.start_hour, form.start_minute, form.start_ampm) : null,
      scheduled_time_end: form.scheduled_date ? parseTime(form.end_hour, form.end_minute, form.end_ampm) : null,
      quote: form.quote || null,
      service_details: form.service_details || null,
      customer_schedule_requirements: form.customer_schedule_requirements || null,
      reference_name: form.reference_name || null,
      tech_name: form.tech_name || null,
      tech_number: form.tech_number || null,
      terms: form.terms || null,
      labor_amount: form.labor_amount ? parseFloat(form.labor_amount) : null,
      material_amount: form.material_amount ? parseFloat(form.material_amount) : null,
      for_you_amount: form.for_you_amount ? parseFloat(form.for_you_amount) : null,
      for_us_amount: form.for_us_amount ? parseFloat(form.for_us_amount) : null,
      general_notes: form.general_notes || null,
      cs_notes: form.cs_notes || null,
      processor_notes: form.processor_notes || null,
      created_by: originalLead?.created_by || user?.id || "",
      created_at: originalLead?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_edited_by: user?.id || originalLead?.last_edited_by || "",
      payment_screenshot_url: form.payment_screenshot_url || null,
      amount: form.amount ? parseFloat(form.amount) : null,
      payment_amount: form.amount ? parseFloat(form.amount) : null,
    } as Lead;
  }, [originalLead, form, isNew, leadId, jobId, user]);

  const newPhotoUrls = useMemo(() => newPhotos.map((p) => URL.createObjectURL(p)), [newPhotos]);

  useEffect(() => {
    return () => {
      newPhotoUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [newPhotoUrls]);

  const allImageUrls = [...photos.map((p) => p.url), ...newPhotoUrls];

  const TimePicker = ({ prefix, label }: { prefix: "start" | "end"; label: string }) => (
    <div className="space-y-1.5">
      <Label className={labelClass}>{label}</Label>
      <div className="flex items-center gap-1.5">
        <Select value={form[`${prefix}_hour` as keyof typeof form]} onValueChange={(v) => update(`${prefix}_hour`, v)}>
          <SelectTrigger className="w-[60px] h-9 bg-background border-border/70">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
              <SelectItem key={h} value={String(h)}>
                {h}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="text-muted-foreground/50">:</span>

        <Select
          value={form[`${prefix}_minute` as keyof typeof form]}
          onValueChange={(v) => update(`${prefix}_minute`, v)}
        >
          <SelectTrigger className="w-[60px] h-9 bg-background border-border/70">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["00", "15", "30", "45"].map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={form[`${prefix}_ampm` as keyof typeof form]} onValueChange={(v) => update(`${prefix}_ampm`, v)}>
          <SelectTrigger className="w-[60px] h-9 bg-background border-border/70">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AM">AM</SelectItem>
            <SelectItem value="PM">PM</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/leads")} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>

        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">{isNew ? "New Lead" : form.customer_name || "Lead"}</h1>
          {jobId && <p className="text-sm text-muted-foreground font-mono">{jobId}</p>}
        </div>

        <Badge variant="outline" className="shrink-0 text-xs">
          {LEAD_STATUS_CONFIG[form.status]?.label || form.status}
        </Badge>

        {!isCS && currentCopyLead && <CopyLeadButton lead={currentCopyLead} />}

        <Button onClick={handleSave} disabled={saving || isDuplicate} className="gap-2 shrink-0">
          {saved ? (
            <>
              <Check className="h-4 w-4" /> Saved
            </>
          ) : (
            <>
              <Save className="h-4 w-4" /> {saving ? "Saving..." : isNew ? "Create Lead" : "Save"}
            </>
          )}
        </Button>
      </div>

      {!isNew && (
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span>
            Created by: <strong className="text-foreground">{createdBy}</strong>
          </span>
          {lastEditedBy && lastEditedAt && (
            <span>
              Last edited by: <strong className="text-foreground">{lastEditedBy}</strong> on{" "}
              {new Date(lastEditedAt).toLocaleString()}
            </span>
          )}
        </div>
      )}

      <Card className="border-border/60">
        <CardContent className="p-6 space-y-4">
          <div className={sectionClass}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/60">
              Required Information
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className={labelClass}>Customer Name *</Label>
                <Input
                  value={form.customer_name}
                  onChange={(e) => update("customer_name", e.target.value)}
                  className={fieldClass}
                  readOnly={isProcessor}
                />
              </div>

              <div className="space-y-1.5">
                <Label className={labelClass}>Number Name *</Label>
                <Input
                  value={form.number_name}
                  onChange={(e) => update("number_name", e.target.value)}
                  className={fieldClass}
                  readOnly={isProcessor}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className={labelClass}>Phone Number *</Label>
                <Input
                  value={form.customer_phone}
                  onChange={(e) => update("customer_phone", e.target.value)}
                  maxLength={14}
                  className={`${fieldClass} ${isDuplicate ? "border-destructive ring-1 ring-destructive" : ""}`}
                  readOnly={isProcessor}
                />
                {isDuplicate && (
                  <div className="flex items-center gap-1.5 text-destructive text-[11px] mt-1">
                    <AlertCircle className="h-3 w-3" />
                    <span>
                      Duplicate: <strong>{duplicateLeadName}</strong>
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className={labelClass}>Email</Label>
                <Input
                  value={form.customer_email}
                  onChange={(e) => update("customer_email", e.target.value)}
                  className={fieldClass}
                  readOnly={isProcessor}
                />
              </div>
            </div>
          </div>

          <Collapsible open={csOpen} onOpenChange={setCsOpen}>
            <CollapsibleTrigger className="w-full rounded-lg border border-border/50 px-4 py-3 hover:bg-muted/20 transition-colors">
              <SectionHeader icon={User} title="Customer Service Details" open={csOpen} />
            </CollapsibleTrigger>

            <CollapsibleContent className="mt-2 space-y-3 px-1">
              <div className="space-y-1.5">
                <Label className={labelClass}>Address</Label>
                <Input
                  value={form.address}
                  onChange={(e) => update("address", e.target.value)}
                  placeholder="123 Main St, City, State, Zip"
                  className={fieldClass}
                  readOnly={isProcessor}
                />
              </div>


              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className={labelClass}>Service Type</Label>
                  <Input
                    value={form.service_type}
                    onChange={(e) => update("service_type", e.target.value)}
                    className={fieldClass}
                    readOnly={isProcessor}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className={labelClass}>Quote</Label>
                  <Input
                    value={form.quote}
                    onChange={(e) => update("quote", e.target.value)}
                    className={fieldClass}
                    readOnly={isProcessor}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className={labelClass}>Service Details</Label>
                <Textarea
                  value={form.service_details}
                  onChange={(e) => update("service_details", e.target.value)}
                  rows={3}
                  className={`${fieldClass} resize-none min-h-[96px]`}
                  readOnly={isProcessor}
                />
              </div>

              <div className="space-y-1.5">
                <Label className={labelClass}>Customer Schedule Requirements</Label>
                <Input
                  value={form.customer_schedule_requirements}
                  onChange={(e) => update("customer_schedule_requirements", e.target.value)}
                  className={fieldClass}
                  readOnly={isProcessor}
                />
              </div>

              <div className="space-y-1.5">
                <Label className={labelClass}>Reference</Label>
                <Input
                  value={form.reference_name}
                  onChange={(e) => update("reference_name", e.target.value)}
                  className={fieldClass}
                  readOnly={isProcessor}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[12px] font-semibold text-foreground">CS Notes</Label>
                <Textarea
                  value={form.cs_notes}
                  onChange={(e) => update("cs_notes", e.target.value)}
                  rows={4}
                  className={`${fieldClass} resize-none min-h-[110px]`}
                  readOnly={isProcessor}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {!isCS && (
            <Collapsible open={processorOpen} onOpenChange={setProcessorOpen}>
              <CollapsibleTrigger className="w-full rounded-lg border border-border/50 px-4 py-3 hover:bg-muted/20 transition-colors">
                <SectionHeader icon={Wrench} title="Processor Details" open={processorOpen} />
              </CollapsibleTrigger>

              <CollapsibleContent className="mt-2 space-y-3 px-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className={labelClass}>Tech Name</Label>
                    <Input
                      value={form.tech_name}
                      onChange={(e) => update("tech_name", e.target.value)}
                      className={fieldClass}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className={labelClass}>Tech Number</Label>
                    <Input
                      value={form.tech_number}
                      onChange={(e) => update("tech_number", e.target.value)}
                      maxLength={14}
                      className={fieldClass}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className={labelClass}>Terms</Label>
                  <Select value={form.terms} onValueChange={(v) => update("terms", v)}>
                    <SelectTrigger className={fieldClass}>
                      <SelectValue placeholder="Select terms..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free_estimate">Free Estimate Visit</SelectItem>
                      <SelectItem value="quoted">Quoted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {form.terms === "quoted" && (
                  <div className="rounded-lg border border-border/40 bg-background/70 p-3 space-y-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/60">
                      Quoted Details
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className={labelClass}>Customer Labor ($)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={form.labor_amount}
                          onChange={(e) => update("labor_amount", e.target.value)}
                          className={fieldClass}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className={labelClass}>Materials ($)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={form.material_amount}
                          onChange={(e) => update("material_amount", e.target.value)}
                          className={fieldClass}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className={labelClass}>For You ($ incl. material)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={form.for_you_amount}
                          onChange={(e) => update("for_you_amount", e.target.value)}
                          className={fieldClass}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className={labelClass}>For Us ($ from labor)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={form.for_us_amount}
                          onChange={(e) => update("for_us_amount", e.target.value)}
                          className={fieldClass}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-[12px] font-semibold text-foreground">Processor Notes</Label>
                  <Textarea
                    value={form.processor_notes}
                    onChange={(e) => update("processor_notes", e.target.value)}
                    rows={4}
                    className={`${fieldClass} resize-none min-h-[110px]`}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          <Collapsible open={scheduleOpen} onOpenChange={setScheduleOpen}>
            <CollapsibleTrigger className="w-full rounded-lg border border-border/50 px-4 py-3 hover:bg-muted/20 transition-colors">
              <SectionHeader icon={Calendar} title="Schedule & Status" open={scheduleOpen} />
            </CollapsibleTrigger>

            <CollapsibleContent className="mt-2 space-y-3 px-1">
              <div className="space-y-1.5">
                <Label className={labelClass}>Status</Label>
                <Select value={form.status} onValueChange={(v) => update("status", v)}>
                  <SelectTrigger className={fieldClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getChangeableStatuses(role).map((key) => {
                      const cfg = LEAD_STATUS_CONFIG[key];
                      return cfg ? (
                        <SelectItem key={key} value={key}>
                          {cfg.label}
                        </SelectItem>
                      ) : null;
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className={labelClass}>Job Scheduled For</Label>
                <Input
                  type="date"
                  value={form.scheduled_date}
                  onChange={(e) => update("scheduled_date", e.target.value)}
                  className={fieldClass}
                />
              </div>

              {form.scheduled_date && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <TimePicker prefix="start" label="Start Time" />
                  <TimePicker prefix="end" label="End Time" />
                </div>
              )}

              {form.status === "paid" && (
                <div className="space-y-1.5">
                  <Label className={labelClass}>Amount ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => update("amount", e.target.value)}
                    className={fieldClass}
                  />
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          <div className="space-y-1.5">
            <Label className={labelClass}>Photos</Label>
            <div className="flex flex-wrap gap-2">
              {photos.map((photo, i) => (
                <div
                  key={photo.id}
                  className="relative h-16 w-16 rounded-lg overflow-hidden border border-border/50 group"
                >
                  <img
                    src={photo.url}
                    alt=""
                    className="h-full w-full object-cover cursor-pointer"
                    onClick={() => {
                      setLightboxIndex(i);
                      setLightboxOpen(true);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => removeExistingPhoto(photo.id)}
                    className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}

              {newPhotos.map((photo, i) => (
                <div
                  key={`new-${i}`}
                  className="relative h-16 w-16 rounded-lg overflow-hidden border border-border/50 group"
                >
                  <img src={URL.createObjectURL(photo)} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeNewPhoto(i)}
                    className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}

              <label className="h-16 w-16 rounded-lg border-2 border-dashed border-border/50 flex items-center justify-center cursor-pointer hover:border-primary/40 transition-colors bg-background/60">
                <ImagePlus className="h-5 w-5 text-muted-foreground/50" />
                <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoAdd} />
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12px] font-semibold text-foreground">General Notes</Label>
            <Textarea
              value={form.general_notes}
              onChange={(e) => update("general_notes", e.target.value)}
              rows={4}
              className={`${fieldClass} resize-none min-h-[110px]`}
            />
          </div>
        </CardContent>
      </Card>

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
    </div>
  );
}
