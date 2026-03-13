import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { AlertCircle, ImagePlus, X, ChevronDown, User, Wrench, Calendar } from "lucide-react";
import { LEAD_STATUS_CONFIG, type LeadStatus } from "@/types";
import { useDuplicatePhoneCheck } from "@/hooks/useDuplicatePhoneCheck";
import { formatUSPhone } from "@/lib/phone";
import { logActivity } from "@/lib/activity";
import { motion } from "framer-motion";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

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
    message: `New lead "${leadName}" requires attention - marked as ${statusLabel}`,
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

const AddLeadDialog = ({ open, onOpenChange, onSuccess }: Props) => {
  const { user, role } = useAuth();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    number_name: "",
    address: "",
    service_type: "",
    status: "waiting_complete_details" as LeadStatus,
    scheduled_date: "",
    start_hour: "12",
    start_minute: "00",
    start_ampm: "AM",
    end_hour: "2",
    end_minute: "00",
    end_ampm: "PM",

    // CS fields
    quote: "",
    service_details: "",
    customer_schedule_requirements: "",
    reference_name: "",

    // Processor fields
    tech_name: "",
    tech_number: "",
    terms: "" as "" | "free_estimate" | "quoted",
    labor_amount: "",
    material_amount: "",
    for_you_amount: "",
    for_us_amount: "",

    // Notes
    cs_notes: "",
    processor_notes: "",
    general_notes: "",
  });

  const [photos, setPhotos] = useState<File[]>([]);
  const [csOpen, setCsOpen] = useState(true);
  const [processorOpen, setProcessorOpen] = useState(role !== "customer_service");
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const { isDuplicate, duplicateLeadName } = useDuplicatePhoneCheck(form.customer_phone);

  const isCS = role === "customer_service";

  const fieldClass = "bg-background border-border/70 text-foreground placeholder:text-muted-foreground/60";
  const labelClass = "text-[12px] font-semibold text-foreground/80";
  const sectionClass = "rounded-xl border border-border/60 bg-muted/10 p-4 space-y-3";

  const update = (key: string, value: string) => {
    if (key === "customer_phone" || key === "tech_number") {
      setForm((prev) => ({ ...prev, [key]: formatUSPhone(value) }));
    } else {
      setForm((prev) => ({ ...prev, [key]: value }));
    }
  };

  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setPhotos((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const parseTime = (hour: string, minute: string, ampm: string) => {
    let h = parseInt(hour);
    if (ampm === "PM" && h !== 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return `${h.toString().padStart(2, "0")}:${minute}`;
  };

  const resetForm = () => {
    setForm({
      customer_name: "",
      customer_phone: "",
      number_name: "",
      address: "",
      service_type: "",
      status: "waiting_complete_details",
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
      terms: "",
      labor_amount: "",
      material_amount: "",
      for_you_amount: "",
      for_us_amount: "",
      cs_notes: "",
      processor_notes: "",
      general_notes: "",
    });
    setPhotos([]);
    setCsOpen(true);
    setProcessorOpen(role !== "customer_service");
    setScheduleOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

    setLoading(true);

    const jobId = generateJobId();

    let scheduled_time_start: string | null = null;
    let scheduled_time_end: string | null = null;

    if (form.scheduled_date) {
      scheduled_time_start = parseTime(form.start_hour, form.start_minute, form.start_ampm);
      scheduled_time_end = parseTime(form.end_hour, form.end_minute, form.end_ampm);
    }

    const insertData: any = {
      job_id: jobId,
      customer_name: form.customer_name,
      customer_phone: form.customer_phone || null,
      number_name: form.number_name || null,
      address: form.address || null,
      service_type: form.service_type || null,
      status: form.status,
      scheduled_date: form.scheduled_date || null,
      scheduled_time_start,
      scheduled_time_end,
      created_by: user.id,
      assigned_cs: isCS ? user.id : null,

      // notepad-style note fields
      cs_notes: form.cs_notes || null,
      processor_notes: form.processor_notes || null,
      general_notes: form.general_notes || null,

      // CS fields
      quote: form.quote || null,
      service_details: form.service_details || null,
      customer_schedule_requirements: form.customer_schedule_requirements || null,
      reference_name: form.reference_name || null,

      // Processor fields
      tech_name: form.tech_name || null,
      tech_number: form.tech_number || null,
      terms: form.terms || null,
      labor_amount: form.labor_amount ? parseFloat(form.labor_amount) : null,
      material_amount: form.material_amount ? parseFloat(form.material_amount) : null,
      for_you_amount: form.for_you_amount ? parseFloat(form.for_you_amount) : null,
      for_us_amount: form.for_us_amount ? parseFloat(form.for_us_amount) : null,
    };

    const { data, error } = await supabase.from("leads").insert(insertData).select().single();

    if (error) {
      toast.error("Failed to create lead: " + error.message);
      setLoading(false);
      return;
    }

    if (data) {
      for (const photo of photos) {
        const ext = photo.name.split(".").pop();
        const path = `leads/${data.id}_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadErr } = await supabase.storage.from("lead-photos").upload(path, photo);

        if (!uploadErr) {
          await supabase.from("lead_photos").insert({
            lead_id: data.id,
            photo_url: path,
            uploaded_by: user.id,
          });
        }
      }

      await sendNotifications(form.customer_name, form.status, data.id);
      toast.success("Lead created successfully!");
      onSuccess();
      onOpenChange(false);
      resetForm();
    }

    setLoading(false);
  };

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto border border-border/60 bg-card">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-foreground">Add New Lead</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className={sectionClass}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground/60">
              Required Information
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className={labelClass}>Customer Name *</Label>
                <Input
                  value={form.customer_name}
                  onChange={(e) => update("customer_name", e.target.value)}
                  placeholder="John Doe"
                  className={fieldClass}
                />
              </div>

              <div className="space-y-1.5">
                <Label className={labelClass}>Number Name *</Label>
                <Input
                  value={form.number_name}
                  onChange={(e) => update("number_name", e.target.value)}
                  placeholder="Name on phone account"
                  className={fieldClass}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className={labelClass}>Phone Number *</Label>
              <Input
                value={form.customer_phone}
                onChange={(e) => update("customer_phone", e.target.value)}
                placeholder="(555) 123-4567"
                maxLength={14}
                className={`${fieldClass} ${isDuplicate ? "border-destructive ring-1 ring-destructive" : ""}`}
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
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className={labelClass}>Service Type</Label>
                  <Input
                    value={form.service_type}
                    onChange={(e) => update("service_type", e.target.value)}
                    placeholder="HVAC, Plumbing, etc."
                    className={fieldClass}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className={labelClass}>Quote</Label>
                  <Input
                    value={form.quote}
                    onChange={(e) => update("quote", e.target.value)}
                    placeholder="Quote amount or details"
                    className={fieldClass}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className={labelClass}>Service Details</Label>
                <Textarea
                  value={form.service_details}
                  onChange={(e) => update("service_details", e.target.value)}
                  placeholder="Detailed description of the service needed..."
                  rows={3}
                  className={`${fieldClass} resize-none min-h-[96px]`}
                />
              </div>

              <div className="space-y-1.5">
                <Label className={labelClass}>Customer Schedule Requirements</Label>
                <Input
                  value={form.customer_schedule_requirements}
                  onChange={(e) => update("customer_schedule_requirements", e.target.value)}
                  placeholder="Preferred times, availability..."
                  className={fieldClass}
                />
              </div>

              <div className="space-y-1.5">
                <Label className={labelClass}>Reference</Label>
                <Input
                  value={form.reference_name}
                  onChange={(e) => update("reference_name", e.target.value)}
                  placeholder="Referral name or source"
                  className={fieldClass}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[12px] font-semibold text-foreground">CS Notes</Label>
                <Textarea
                  value={form.cs_notes}
                  onChange={(e) => update("cs_notes", e.target.value)}
                  placeholder="Write CS notes here..."
                  rows={4}
                  className={`${fieldClass} resize-none min-h-[110px]`}
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className={labelClass}>Tech Name</Label>
                    <Input
                      value={form.tech_name}
                      onChange={(e) => update("tech_name", e.target.value)}
                      placeholder="Technician name"
                      className={fieldClass}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className={labelClass}>Tech Number</Label>
                    <Input
                      value={form.tech_number}
                      onChange={(e) => update("tech_number", e.target.value)}
                      placeholder="(555) 123-4567"
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

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className={labelClass}>Customer Labor ($)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={form.labor_amount}
                          onChange={(e) => update("labor_amount", e.target.value)}
                          placeholder="0.00"
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
                          placeholder="0.00"
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
                          placeholder="0.00"
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
                          placeholder="0.00"
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
                    placeholder="Write processor notes here..."
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
                    {Object.entries(LEAD_STATUS_CONFIG)
                      .filter(([key]) => key !== "paid")
                      .map(([key, cfg]) => (
                        <SelectItem key={key} value={key}>
                          {cfg.label}
                        </SelectItem>
                      ))}
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
                <div className="grid grid-cols-2 gap-3">
                  <TimePicker prefix="start" label="Start Time" />
                  <TimePicker prefix="end" label="End Time" />
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          <div className="space-y-1.5">
            <Label className={labelClass}>Photos</Label>
            <div className="flex flex-wrap gap-2">
              {photos.map((photo, i) => (
                <div key={i} className="relative h-16 w-16 rounded-lg overflow-hidden border border-border/50 group">
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
              placeholder="Write general notes about this lead..."
              rows={4}
              className={`${fieldClass} resize-none min-h-[110px]`}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || isDuplicate}>
              {loading ? "Creating..." : "Create Lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddLeadDialog;
