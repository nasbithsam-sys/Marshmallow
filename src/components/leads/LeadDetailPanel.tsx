import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  X,
  User,
  MapPin,
  Clock,
  MessageSquare,
  FileText,
  Check,
  AlertCircle,
  Wrench,
  Sparkles,
  ShieldCheck,
  CalendarDays,
  Save,
} from "lucide-react";
import StatusBadge from "./StatusBadge";
import LeadUpdatesSection from "./LeadUpdatesSection";
import PaymentDialog from "./PaymentDialog";
import CopyLeadButton from "./CopyLeadButton";
import { LEAD_STATUS_CONFIG, type Lead, type LeadStatus } from "@/types";
import { toast } from "sonner";
import { useDuplicatePhoneCheck } from "@/hooks/useDuplicatePhoneCheck";
import { motion, AnimatePresence } from "framer-motion";
import { logActivity } from "@/lib/activity";
import { getChangeableStatuses } from "@/lib/constants";

interface Props {
  leadId: string;
  onClose: () => void;
  onUpdate: () => void;
}

const SectionHeader = ({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
}) => (
  <div className="mb-5 flex items-start gap-3">
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/[0.10] to-primary/[0.04] shadow-inner">
      <Icon className="h-4 w-4 text-primary/80" />
    </div>
    <div className="min-w-0">
      <h3 className="text-[15px] font-semibold tracking-[-0.015em] text-foreground">{title}</h3>
      {subtitle && <p className="mt-0.5 text-[12px] text-muted-foreground">{subtitle}</p>}
    </div>
  </div>
);

const StatusDropdownFiltered = ({
  value,
  onChange,
  role,
}: {
  value: string | undefined;
  onChange: (v: string) => void;
  role?: string | null;
}) => {
  const changeable = getChangeableStatuses(role);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-11 rounded-xl border-border/60 bg-background text-foreground shadow-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {changeable.map((key) => {
          const cfg = LEAD_STATUS_CONFIG[key];
          return cfg ? (
            <SelectItem key={key} value={key}>
              {cfg.label}
            </SelectItem>
          ) : null;
        })}
      </SelectContent>
    </Select>
  );
};

const LeadDetailPanel = ({ leadId, onClose, onUpdate }: Props) => {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();

  const [saved, setSaved] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);

  const { data: lead, isLoading } = useQuery({
    queryKey: ["lead", leadId, role, user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) throw new Error("User not found");

      let query = supabase.from("leads").select("*").eq("id", leadId);

      if (role === "customer_service") {
        query = query.eq("created_by", user.id);
      }

      const { data, error } = await query.single();
      if (error) throw error;
      return data as Lead;
    },
  });

  const { data: lastEditorName } = useQuery({
    queryKey: ["lead-last-editor", lead?.last_edited_by],
    enabled: !!lead?.last_edited_by,
    queryFn: async () => {
      if (!lead?.last_edited_by) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", lead.last_edited_by)
        .single();

      if (error) return null;
      return data?.full_name || null;
    },
  });

  const [form, setForm] = useState<Partial<Lead> & Record<string, any>>({});

  useEffect(() => {
    if (lead) {
      setForm(lead as any);
    }
  }, [lead]);

  const { isDuplicate, duplicateLeadName } = useDuplicatePhoneCheck(form.customer_phone || "", leadId);

  const formattedEditedAt = useMemo(() => {
    if (!lead?.last_edited_at) return null;
    try {
      return format(new Date(lead.last_edited_at), "MMM d, yyyy • h:mm a");
    } catch {
      return lead.last_edited_at;
    }
  }, [lead?.last_edited_at]);

  const buildLeadChanges = () => {
    if (!lead) return {};

    const leadRecord = lead as Record<string, any>;
    const formRecord = form as Record<string, any>;
    const changes: Record<string, { before: unknown; after: unknown }> = {};

    const fieldsToTrack = [
      "customer_name",
      "customer_email",
      "customer_phone",
      "service_type",
      "address",
      "city",
      "state",
      "zip_code",
      "status",
      "scheduled_date",
      "scheduled_time_start",
      "scheduled_time_end",
      "general_notes",
      "cs_notes",
      "processor_notes",
      "number_name",
      "quote",
      "service_details",
      "customer_schedule_requirements",
      "reference_name",
      "tech_name",
      "tech_number",
      "terms",
      "labor_amount",
      "material_amount",
      "for_you_amount",
      "for_us_amount",
      "amount",
    ];

    for (const field of fieldsToTrack) {
      const before = leadRecord[field];
      const after = formRecord[field];

      if ((before ?? null) !== (after ?? null)) {
        changes[field] = {
          before: before ?? null,
          after: after ?? null,
        };
      }
    }

    return changes;
  };

  const update = (key: string, value: any) => {
    if (key === "status" && value === "paid") {
      setPaymentOpen(true);
      return;
    }
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handlePaymentConfirm = async (amount: number, screenshotFile: File | null) => {
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

    setForm((prev) => ({
      ...prev,
      status: "paid" as LeadStatus,
      amount,
      payment_amount: amount,
      payment_screenshot_url: screenshotUrl,
    }));

    let paymentQuery = supabase
      .from("leads")
      .update({
        status: "paid",
        amount,
        payment_amount: amount,
        payment_screenshot_url: screenshotUrl,
        last_edited_by: user?.id,
        last_edited_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    if (role === "customer_service" && user) {
      paymentQuery = paymentQuery.eq("created_by", user.id);
    }

    const { error } = await paymentQuery;

    setPaymentLoading(false);
    setPaymentOpen(false);

    if (error) {
      toast.error(error.message);
    } else {
      if (user && lead) {
        await logActivity(user.id, "payment_recorded", "lead", leadId, {
          target_name: lead.job_id,
          customer_name: lead.customer_name,
          amount,
          status_from: lead.status,
          status_to: "paid",
          screenshot_uploaded: !!screenshotUrl,
        });
      }

      toast.success("Payment recorded");
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      onUpdate();
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      if (isDuplicate) throw new Error(`Duplicate phone: ${duplicateLeadName}`);

      const previousStatus = lead?.status;
      const newStatus = form.status;
      const changes = buildLeadChanges();

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
        general_notes: form.general_notes ?? null,
        cs_notes: role !== "processor" ? form.cs_notes : (lead as any)?.cs_notes,
        processor_notes: role !== "customer_service" ? form.processor_notes : (lead as any)?.processor_notes,
        last_edited_by: user.id,
        last_edited_at: new Date().toISOString(),
        number_name: form.number_name,
        quote: form.quote,
        service_details: form.service_details,
        customer_schedule_requirements: form.customer_schedule_requirements,
        reference_name: form.reference_name,
        tech_name: role !== "customer_service" ? form.tech_name : (lead as any)?.tech_name,
        tech_number: role !== "customer_service" ? form.tech_number : (lead as any)?.tech_number,
        terms: role !== "customer_service" ? form.terms : (lead as any)?.terms,
        labor_amount: role !== "customer_service" ? form.labor_amount : (lead as any)?.labor_amount,
        material_amount: role !== "customer_service" ? form.material_amount : (lead as any)?.material_amount,
        for_you_amount: role !== "customer_service" ? form.for_you_amount : (lead as any)?.for_you_amount,
        for_us_amount: role !== "customer_service" ? form.for_us_amount : (lead as any)?.for_us_amount,
      };

      if (form.status === "paid") {
        updateData.amount = form.amount;
      }

      let updateQuery = supabase.from("leads").update(updateData).eq("id", leadId);

      if (role === "customer_service") {
        updateQuery = updateQuery.eq("created_by", user.id);
      }

      const { error } = await updateQuery;
      if (error) throw error;

      if (lead?.status !== form.status && (form.status === "urgent_job" || form.status === "need_tech")) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("role", ["admin", "processor"]);

        if (roles) {
          const statusLabel = form.status === "urgent_job" ? "Urgent Job" : "Need Tech";
          const notifs = roles.map((r: any) => ({
            user_id: r.user_id,
            title: `🚨 ${statusLabel}`,
            message: `Lead "${form.customer_name}" changed to ${statusLabel}`,
            lead_id: leadId,
            read: false,
          }));
          await supabase.from("notifications").insert(notifs);
        }
      }

      if (Object.keys(changes).length > 0) {
        await logActivity(user.id, "updated", "lead", leadId, {
          target_name: lead?.job_id || leadId,
          customer_name: form.customer_name,
          changes,
        });
      }

      if (previousStatus !== newStatus) {
        await logActivity(user.id, "status_changed", "lead", leadId, {
          target_name: lead?.job_id || leadId,
          customer_name: form.customer_name,
          status_from: previousStatus,
          status_to: newStatus,
        });
      }
    },
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
      toast.success("Lead saved");
      queryClient.invalidateQueries({ queryKey: ["lead", leadId] });
      onUpdate();
    },
    onError: (err: any) => toast.error("Save failed: " + err.message),
  });

  const isCS = role === "customer_service";
  const isProcessor = role === "processor";

  const labelClass = "text-[12px] font-semibold tracking-[-0.01em] text-foreground/82";
  const fieldClass =
    "h-11 rounded-xl border-border/60 bg-background text-foreground shadow-sm placeholder:text-muted-foreground/55";
  const areaClass =
    "rounded-xl border-border/60 bg-background text-foreground shadow-sm placeholder:text-muted-foreground/55 resize-none";
  const sectionClass = "rounded-2xl border border-border/60 bg-card/92 p-5 shadow-[0_14px_38px_-28px_rgba(0,0,0,0.35)]";

  if (isLoading || !lead) {
    return (
      <div className="fixed inset-0 z-40 flex">
        <div className="flex-1 bg-foreground/15 backdrop-blur-sm" onClick={onClose} />
        <div className="w-[58%] max-w-4xl border-l border-border bg-card p-6 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-muted-foreground/20 border-t-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Loading lead...</p>
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
        className="flex-1 bg-foreground/20 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 280, damping: 30 }}
        className="w-[58%] max-w-4xl overflow-y-auto border-l border-border bg-[linear-gradient(to_bottom,rgba(255,255,255,0.02),transparent)] bg-card"
      >
        <div className="sticky top-0 z-20 border-b border-border/60 bg-card/92 backdrop-blur-xl">
          <div className="px-6 pt-5 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="mb-3 flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 rounded-full border border-primary/10 bg-primary/[0.06] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                    <Sparkles className="h-2.5 w-2.5" />
                    Lead Detail
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground/65">{lead.job_id}</span>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="max-w-[360px] truncate text-[20px] font-semibold tracking-[-0.025em] text-foreground">
                    {lead.customer_name}
                  </h2>
                  <StatusBadge status={lead.status as LeadStatus} />
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-muted-foreground">
                  {lead.created_at && (
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Created {format(new Date(lead.created_at), "MMM d, yyyy")}
                    </span>
                  )}

                  {(formattedEditedAt || lastEditorName) && (
                    <span className="inline-flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {lastEditorName ? `Edited by ${lastEditorName}` : "Edited"}
                      {formattedEditedAt ? ` • ${formattedEditedAt}` : ""}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {!isCS && <CopyLeadButton lead={lead} />}

                <Button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || isDuplicate}
                  size="sm"
                  className="min-w-[92px] gap-1.5 rounded-xl shadow-sm"
                >
                  {saved ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Saved
                    </>
                  ) : saveMutation.isPending ? (
                    "Saving..."
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5" />
                      Save
                    </>
                  )}
                </Button>

                <button
                  onClick={onClose}
                  className="rounded-xl border border-border/60 bg-background p-2 text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-foreground"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-border/60 bg-muted/[0.24] p-4">
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/70">
                  Current Status
                </Label>
                {isDuplicate && (
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-destructive/15 bg-destructive/[0.07] px-2.5 py-1 text-[10px] font-medium text-destructive">
                    <AlertCircle className="h-3 w-3" />
                    Duplicate phone: {duplicateLeadName}
                  </div>
                )}
              </div>
              <StatusDropdownFiltered value={form.status} onChange={(v) => update("status", v)} role={role} />
            </div>
          </div>
        </div>

        <div className="space-y-6 p-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className={sectionClass}
          >
            <SectionHeader
              icon={User}
              title="Customer Information"
              subtitle="Primary contact details, service request, and intake information."
            />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className={labelClass}>Name</Label>
                <Input
                  value={form.customer_name ?? ""}
                  onChange={(e) => update("customer_name", e.target.value)}
                  readOnly={isProcessor}
                  className={fieldClass}
                />
              </div>

              <div className="space-y-1.5">
                <Label className={labelClass}>Number Name</Label>
                <Input
                  value={form.number_name ?? ""}
                  onChange={(e) => update("number_name", e.target.value)}
                  readOnly={isProcessor}
                  className={fieldClass}
                />
              </div>

              <div className="space-y-1.5">
                <Label className={labelClass}>Phone</Label>
                <Input
                  value={form.customer_phone ?? ""}
                  onChange={(e) => update("customer_phone", e.target.value)}
                  readOnly={isProcessor}
                  className={`${fieldClass} ${isDuplicate ? "border-destructive ring-1 ring-destructive/40" : ""}`}
                />
              </div>

              <div className="space-y-1.5">
                <Label className={labelClass}>Email</Label>
                <Input
                  value={form.customer_email ?? ""}
                  onChange={(e) => update("customer_email", e.target.value)}
                  readOnly={isProcessor}
                  className={fieldClass}
                />
              </div>

              <div className="space-y-1.5">
                <Label className={labelClass}>Service Type</Label>
                <Input
                  value={form.service_type ?? ""}
                  onChange={(e) => update("service_type", e.target.value)}
                  readOnly={isProcessor}
                  className={fieldClass}
                />
              </div>

              <div className="space-y-1.5">
                <Label className={labelClass}>Quote</Label>
                <Input
                  value={form.quote ?? ""}
                  onChange={(e) => update("quote", e.target.value)}
                  readOnly={isProcessor}
                  className={fieldClass}
                />
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label className={labelClass}>Service Details</Label>
                <Textarea
                  value={form.service_details ?? ""}
                  onChange={(e) => update("service_details", e.target.value)}
                  readOnly={isProcessor}
                  rows={4}
                  className={`${areaClass} min-h-[108px]`}
                />
              </div>

              <div className="space-y-1.5">
                <Label className={labelClass}>Schedule Requirements</Label>
                <Input
                  value={form.customer_schedule_requirements ?? ""}
                  onChange={(e) => update("customer_schedule_requirements", e.target.value)}
                  readOnly={isProcessor}
                  className={fieldClass}
                />
              </div>

              <div className="space-y-1.5">
                <Label className={labelClass}>Reference</Label>
                <Input
                  value={form.reference_name ?? ""}
                  onChange={(e) => update("reference_name", e.target.value)}
                  readOnly={isProcessor}
                  className={fieldClass}
                />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: 0.03 }}
            className={sectionClass}
          >
            <SectionHeader
              icon={MapPin}
              title="Address"
              subtitle="Customer location details used for routing and scheduling."
            />

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label className={labelClass}>Street</Label>
                <Input
                  value={form.address ?? ""}
                  onChange={(e) => update("address", e.target.value)}
                  readOnly={isProcessor}
                  className={fieldClass}
                />
              </div>

              <div className="space-y-1.5">
                <Label className={labelClass}>City</Label>
                <Input
                  value={form.city ?? ""}
                  onChange={(e) => update("city", e.target.value)}
                  readOnly={isProcessor}
                  className={fieldClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className={labelClass}>State</Label>
                  <Input
                    value={form.state ?? ""}
                    onChange={(e) => update("state", e.target.value)}
                    readOnly={isProcessor}
                    className={fieldClass}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className={labelClass}>Zip</Label>
                  <Input
                    value={form.zip_code ?? ""}
                    onChange={(e) => update("zip_code", e.target.value)}
                    readOnly={isProcessor}
                    className={fieldClass}
                  />
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: 0.06 }}
            className={sectionClass}
          >
            <SectionHeader
              icon={Wrench}
              title="Processor Details"
              subtitle="Assigned technician, quote mode, and internal cost breakdown."
            />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className={labelClass}>Tech Name</Label>
                <Input
                  value={form.tech_name ?? ""}
                  onChange={(e) => update("tech_name", e.target.value)}
                  readOnly={isCS}
                  className={fieldClass}
                />
              </div>

              <div className="space-y-1.5">
                <Label className={labelClass}>Tech Number</Label>
                <Input
                  value={form.tech_number ?? ""}
                  onChange={(e) => update("tech_number", e.target.value)}
                  readOnly={isCS}
                  className={fieldClass}
                />
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label className={labelClass}>Terms</Label>
                <Select value={form.terms ?? ""} onValueChange={(v) => update("terms", v)} disabled={isCS}>
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
                <>
                  <div className="space-y-1.5">
                    <Label className={labelClass}>Customer Labor ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.labor_amount ?? ""}
                      onChange={(e) => update("labor_amount", parseFloat(e.target.value) || null)}
                      readOnly={isCS}
                      className={fieldClass}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className={labelClass}>Materials ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.material_amount ?? ""}
                      onChange={(e) => update("material_amount", parseFloat(e.target.value) || null)}
                      readOnly={isCS}
                      className={fieldClass}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className={labelClass}>For You ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.for_you_amount ?? ""}
                      onChange={(e) => update("for_you_amount", parseFloat(e.target.value) || null)}
                      readOnly={isCS}
                      className={fieldClass}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className={labelClass}>For Us ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.for_us_amount ?? ""}
                      onChange={(e) => update("for_us_amount", parseFloat(e.target.value) || null)}
                      readOnly={isCS}
                      className={fieldClass}
                    />
                  </div>
                </>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: 0.09 }}
            className={sectionClass}
          >
            <SectionHeader
              icon={Clock}
              title="Schedule"
              subtitle="Date, time window, and payment amount when applicable."
            />

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className={labelClass}>Date</Label>
                <Input
                  type="date"
                  value={form.scheduled_date ?? ""}
                  onChange={(e) => update("scheduled_date", e.target.value)}
                  className={fieldClass}
                />
              </div>

              <div className="space-y-1.5">
                <Label className={labelClass}>Start Time</Label>
                <Input
                  type="time"
                  value={form.scheduled_time_start ?? ""}
                  onChange={(e) => update("scheduled_time_start", e.target.value)}
                  className={fieldClass}
                />
              </div>

              <div className="space-y-1.5">
                <Label className={labelClass}>End Time</Label>
                <Input
                  type="time"
                  value={form.scheduled_time_end ?? ""}
                  onChange={(e) => update("scheduled_time_end", e.target.value)}
                  className={fieldClass}
                />
              </div>
            </div>

            {form.status === "paid" && (
              <div className="mt-4 w-[220px] space-y-1.5">
                <Label className={labelClass}>Amount ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.amount ?? ""}
                  onChange={(e) => update("amount", parseFloat(e.target.value) || null)}
                  className={fieldClass}
                />
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: 0.12 }}
            className={sectionClass}
          >
            <SectionHeader
              icon={MessageSquare}
              title="General Notes"
              subtitle="Shared notes and customer-related context."
            />
            <div className="space-y-1.5">
              <Label className={labelClass}>General Notes</Label>
              <Textarea
                value={form.general_notes ?? ""}
                onChange={(e) => update("general_notes", e.target.value)}
                placeholder="Write general notes here..."
                rows={6}
                className={`${areaClass} min-h-[150px]`}
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: 0.15 }}
            className={sectionClass}
          >
            <SectionHeader
              icon={MessageSquare}
              title="CS Notes"
              subtitle="Customer service notes and follow-up context."
            />
            <div className="space-y-1.5">
              <Label className={labelClass}>CS Notes</Label>
              <Textarea
                value={form.cs_notes ?? ""}
                onChange={(e) => update("cs_notes", e.target.value)}
                placeholder="Write CS notes here..."
                rows={6}
                readOnly={isProcessor}
                className={`${areaClass} min-h-[150px]`}
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: 0.18 }}
            className={sectionClass}
          >
            <SectionHeader
              icon={FileText}
              title="Processor Notes"
              subtitle="Technician and processing-side internal notes."
            />
            <div className="space-y-1.5">
              <Label className={labelClass}>Processor Notes</Label>
              <Textarea
                value={form.processor_notes ?? ""}
                onChange={(e) => update("processor_notes", e.target.value)}
                placeholder="Write processor notes here..."
                rows={6}
                readOnly={isCS}
                className={`${areaClass} min-h-[150px]`}
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: 0.21 }}
            className={sectionClass}
          >
            <SectionHeader
              icon={FileText}
              title="Activity & Updates"
              subtitle="Recent changes, timeline activity, and lead history."
            />
            <LeadUpdatesSection leadId={leadId} />
          </motion.div>
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
