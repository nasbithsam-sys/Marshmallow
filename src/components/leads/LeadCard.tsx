import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { memo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Lead, LeadStatus, STATUS_LABELS, getChangeableStatuses, canChangeStatus } from "@/lib/constants";
import { CS_TAG_LABELS, type CsTag } from "@/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  UserCircle,
  Phone,
  MapPin,
  UserRound,
  Trash2,
  Pencil,
  MessageSquare,
  ChevronDown,
  ArrowUpRight,
  Image as ImageIcon,
  CalendarDays,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import NoteThread from "./NoteThread";
import PaymentDialog from "./PaymentDialog";
import LeadShareDialog from "./LeadShareDialog";
import StatusBadge from "./StatusBadge";
import ImageLightbox from "./ImageLightbox";
import CopyLeadButton from "./CopyLeadButton";
import { adminApi } from "@/lib/admin-api";
import { logActivity } from "@/lib/activity";
import { optimizeImageForUpload } from "@/lib/image-upload";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

interface LeadCardProps {
  lead: Lead;
  profiles: Record<string, string>;
  onRefresh: () => void;
  photoUrls?: string[];
  disablePhotoPreview?: boolean;
}

function formatDateTime(value?: string | null) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatDate(value?: string | null) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

function LeadCard({ lead, profiles, onRefresh, photoUrls, disablePhotoPreview = false }: LeadCardProps) {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const [changingStatus, setChangingStatus] = useState(false);
  const [csOpen, setCsOpen] = useState(false);
  const [processorOpen, setProcessorOpen] = useState(false);
  const [generalOpen, setGeneralOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoOriginals, setPhotoOriginals] = useState<string[]>([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [resolvedPaymentUrl, setResolvedPaymentUrl] = useState<string | null>(null);
  const [resolvedPaymentOriginal, setResolvedPaymentOriginal] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  const isAdmin = role === "admin";
  const isCS = role === "customer_service";
  const isProcessor = role === "processor";
  const isPaid = lead.status === "paid";
  const isUrgent = lead.status === "urgent_job";

  const detailRows = [
    {
      key: "phone",
      label: "Contact",
      value: lead.customer_phone,
      icon: Phone,
      wrap: false,
    },
    {
      key: "address",
      label: "Location",
      value: lead.address,
      icon: MapPin,
      wrap: true,
    },
    {
      key: "technician",
      label: "Technician",
      value: [lead.tech_name, lead.tech_number].filter(Boolean).join(" · "),
      icon: UserRound,
      wrap: true,
    },
  ].filter((row): row is { key: string; label: string; value: string; icon: typeof Phone; wrap: boolean } => Boolean(row.value));

  // Reload triggers when transforms get marked broken mid-session.
  const [reloadKey, setReloadKey] = useState(0);
  const transformCleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    let alive = true;
    void import("@/lib/storage").then(({ onTransformsBroken }) => {
      if (!alive) return;
      transformCleanupRef.current = onTransformsBroken(() => setReloadKey((k) => k + 1));
    });
    return () => {
      alive = false;
      transformCleanupRef.current?.();
      transformCleanupRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (disablePhotoPreview) {
      setPhotos([]);
      return;
    }

    if (photoUrls) {
      setPhotos(photoUrls);
      return;
    }

    const loadPhotos = async () => {
      const { data } = await supabase
        .from("lead_photos")
        .select("photo_url")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: true });

      if (!data || cancelled) return;

      const paths = data.map((photo: { photo_url: string }) => photo.photo_url);
      const { getSignedUrls } = await import("@/lib/storage");
      // Tiny thumbnails for card preview — originals only loaded on lightbox open.
      const urls = await getSignedUrls(paths, { width: 200, height: 200, resize: "cover", quality: 50 });

      if (!cancelled) {
        setPhotos(urls);
        setPhotoOriginals([]); // reset; lazy-load on lightbox open
      }
    };

    void loadPhotos();

    return () => {
      cancelled = true;
    };
  }, [disablePhotoPreview, lead.id, photoUrls, reloadKey]);

  useEffect(() => {
    if (isPaid && lead.payment_screenshot_url) {
      import("@/lib/storage").then(({ getSignedUrl }) =>
        getSignedUrl(lead.payment_screenshot_url!, { width: 200, height: 200, resize: "cover", quality: 50 }).then(
          setResolvedPaymentUrl,
        ),
      );
    } else {
      setResolvedPaymentUrl(null);
    }
    setResolvedPaymentOriginal(null);
  }, [lead.payment_screenshot_url, isPaid, reloadKey]);

  const allImages = disablePhotoPreview ? [] : [...(isPaid && resolvedPaymentUrl ? [resolvedPaymentUrl] : []), ...photos];

  // Lazy-load full-size originals only when the lightbox opens.
  const loadOriginals = async () => {
    const { getSignedUrl, getSignedUrls } = await import("@/lib/storage");
    const tasks: Promise<void>[] = [];
    if (isPaid && lead.payment_screenshot_url && !resolvedPaymentOriginal) {
      tasks.push(getSignedUrl(lead.payment_screenshot_url).then(setResolvedPaymentOriginal));
    }
    if (photos.length && photoOriginals.length === 0) {
      const { data } = await supabase
        .from("lead_photos")
        .select("photo_url")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: true });
      if (data) {
        const paths = data.map((p: { photo_url: string }) => p.photo_url);
        const urls = await getSignedUrls(paths);
        setPhotoOriginals(urls);
      }
    }
    await Promise.all(tasks);
  };

  // Build lightbox slides as { src, fallback } so a broken original
  // (e.g. when Supabase image transforms aren't enabled on the bucket)
  // gracefully falls back to the small cached preview thumbnail.
  const lightboxImages: Array<{ src: string; fallback?: string }> = disablePhotoPreview
    ? []
    : [
        ...(isPaid && (resolvedPaymentOriginal || resolvedPaymentUrl)
          ? [{ src: resolvedPaymentOriginal || resolvedPaymentUrl!, fallback: resolvedPaymentUrl ?? undefined }]
          : []),
        ...photos.map((preview, i) => ({
          src: photoOriginals[i] ?? preview,
          fallback: preview,
        })),
      ];

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
    void loadOriginals();
  };

  const handleStatusChange = async (newStatus: string) => {
    if (isPaid) return;
    if (!canChangeStatus(role, newStatus as LeadStatus)) {
      toast.error("You do not have permission to set that status");
      return;
    }

    if (newStatus === "paid") {
      setPaymentOpen(true);
      return;
    }

    setChangingStatus(true);

    const statusUpdate: Record<string, unknown> = {
      status: newStatus as LeadStatus,
      last_edited_by: user?.id,
      updated_at: new Date().toISOString(),
      last_edited_at: new Date().toISOString(),
    };
    if (newStatus === "scheduled") {
      statusUpdate.cs_tag = null;
    }

    const { error } = await supabase
      .from("leads")
      .update(statusUpdate as never)
      .eq("id", lead.id);

    setChangingStatus(false);

    if (error) {
      toast.error("Failed to update status");
      return;
    }

    toast.success(`Status -> ${STATUS_LABELS[newStatus as LeadStatus]}`);

    await logActivity(user!.id, "status_changed", "lead", lead.id, {
      target_name: lead.job_id,
      customer_name: lead.customer_name,
      job_id: lead.job_id,
      status_from: lead.status,
      status_to: newStatus,
      changes: {
        status: {
          before: lead.status,
          after: newStatus,
        },
      },
    });

    if (newStatus === "urgent_job" || newStatus === "need_tech") {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["admin", "processor", "customer_service", "opr"]);

      if (roles) {
        const statusLabel = newStatus === "urgent_job" ? "Urgent Job" : "Need Tech";
        const notifs = roles.map((r: { user_id: string }) => ({
          user_id: r.user_id,
          title: `[Alert] ${statusLabel}`,
          message: `Lead "${lead.customer_name}" changed to ${statusLabel}`,
          lead_id: lead.id,
          read: false,
        }));
        await supabase.from("notifications").insert(notifs);
      }
    }

    onRefresh();
  };

  const handlePaymentConfirm = async (amount: number, screenshotFile: File | null) => {
    setPaymentLoading(true);
    let screenshotUrl: string | null = null;

    if (screenshotFile) {
      const optimizedScreenshot = await optimizeImageForUpload(screenshotFile);
      const ext = optimizedScreenshot.name.split(".").pop();
      const path = `payments/${lead.id}_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("lead-photos").upload(path, optimizedScreenshot);

      if (!uploadError) {
        screenshotUrl = path;
      }
    }

    const { error } = await supabase
      .from("leads")
      .update({
        status: "paid" as LeadStatus,
        amount,
        payment_amount: amount,
        payment_screenshot_url: screenshotUrl,
        last_edited_by: user?.id,
        updated_at: new Date().toISOString(),
        last_edited_at: new Date().toISOString(),
      })
      .eq("id", lead.id);

    setPaymentLoading(false);
    setPaymentOpen(false);

    if (error) {
      toast.error("Failed to update status");
      return;
    }

    await logActivity(user!.id, "payment_recorded", "lead", lead.id, {
      target_name: lead.job_id,
      customer_name: lead.customer_name,
      job_id: lead.job_id,
      amount,
      status_from: lead.status,
      status_to: "paid",
      changes: {
        status: {
          before: lead.status,
          after: "paid",
        },
        payment_amount: {
          before: lead.payment_amount ?? null,
          after: amount,
        },
        payment_screenshot_url: {
          before: lead.payment_screenshot_url ?? null,
          after: screenshotUrl ?? null,
        },
      },
    });

    toast.success("Payment recorded & status updated to Paid");
    onRefresh();
  };

  const handleDelete = async () => {
    try {
      await adminApi.deleteLead(lead.id);

      await logActivity(user!.id, "deleted", "lead", lead.id, {
        target_name: lead.job_id,
        customer_name: lead.customer_name,
        job_id: lead.job_id,
        message: `${profiles[user!.id] || "Unknown"} deleted lead "${lead.customer_name}".`,
      });

      toast.success("Lead deleted");
      onRefresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("Failed to delete lead: " + message);
    }
  };

  const handleCsTagChange = async (value: string) => {
    const newTag = value === "__clear__" ? null : (value as CsTag);
    const { error } = await supabase
      .from("leads")
      .update({
        cs_tag: newTag,
        last_edited_by: user?.id,
        updated_at: new Date().toISOString(),
        last_edited_at: new Date().toISOString(),
      } as never)
      .eq("id", lead.id);
    if (error) {
      toast.error("Failed to update tag");
      return;
    }
    toast.success(newTag ? `Tag: ${CS_TAG_LABELS[newTag]}` : "Tag cleared");
    onRefresh();
  };

  const renderCollapsible = ({
    open,
    setOpen,
    label,
    noteType,
    tone = "default",
  }: {
    open: boolean;
    setOpen: (v: boolean) => void;
    label: string;
    noteType: "general" | "cs" | "processor";
    tone?: "default" | "cs" | "processor";
  }) => {
    const toneClasses =
      tone === "cs"
        ? "crm-lead-card-soft border-amber-200/70 bg-[linear-gradient(180deg,hsl(42_100%_99%/0.86),hsl(42_100%_96%/0.7))] shadow-[0_14px_22px_-20px_rgba(245,158,11,0.12)] hover:border-amber-300/75 hover:bg-[linear-gradient(180deg,hsl(42_100%_99%/0.92),hsl(42_100%_96%/0.76))] dark:border-amber-400/22 dark:bg-[linear-gradient(180deg,hsl(34_34%_20%/0.94),hsl(32_28%_18%/0.9))] dark:shadow-none"
        : tone === "processor"
          ? "crm-lead-card-soft border-sky-200/72 bg-[linear-gradient(180deg,hsl(198_100%_99%/0.86),hsl(201_100%_96%/0.72))] shadow-[0_14px_22px_-20px_rgba(59,130,246,0.12)] hover:border-sky-300/78 hover:bg-[linear-gradient(180deg,hsl(198_100%_99%/0.92),hsl(201_100%_96%/0.78))] dark:border-sky-400/20 dark:bg-[linear-gradient(180deg,hsl(210_38%_20%/0.95),hsl(214_32%_18%/0.9))] dark:shadow-none"
          : "crm-lead-card-soft shadow-[0_16px_26px_-22px_rgba(59,130,246,0.12)] hover:border-primary/20 hover:bg-[linear-gradient(180deg,hsl(210_100%_99%/0.98),hsl(212_100%_97%/0.86))] dark:bg-[linear-gradient(180deg,hsl(223_22%_18%/0.94),hsl(224_20%_16%/0.9))] dark:shadow-none";

    return (
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`w-full justify-between h-9 rounded-xl border px-3 text-[12px] text-muted-foreground hover:text-foreground ${toneClasses}`}
          >
            <span className="flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="font-medium">{label}</span>
            </span>
            <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: reduceMotion ? 0 : 0.16 }}>
              <ChevronDown className="h-3.5 w-3.5" />
            </motion.span>
          </Button>
        </CollapsibleTrigger>

        {open && (
          <CollapsibleContent forceMount asChild>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="pt-2"
            >
              <NoteThread leadId={lead.id} noteType={noteType} label={label} profiles={profiles} />
            </motion.div>
          </CollapsibleContent>
        )}
      </Collapsible>
    );
  };

  return (
    <motion.div
      className="h-full"
      whileHover={reduceMotion ? undefined : { y: -4, scale: 1.006 }}
      whileTap={reduceMotion ? undefined : { scale: 0.985 }}
      transition={{ type: "spring", stiffness: 200, damping: 24, mass: 0.6 }}
    >
      <Card
        className={`crm-lead-card group relative flex h-full flex-col overflow-hidden rounded-[30px] transition-shadow duration-500 hover:border-primary/28 hover:shadow-[0_42px_92px_-46px_rgba(59,130,246,0.34),0_20px_36px_-26px_rgba(125,211,252,0.2)] ${
          isUrgent ? "ring-1 ring-destructive/15 border-destructive/15" : "border-border/60"
        }`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(194_100%_86%/0.18),transparent_32%),radial-gradient(circle_at_top_right,hsl(211_100%_88%/0.22),transparent_28%),radial-gradient(circle_at_bottom_left,hsl(188_100%_90%/0.14),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.26),transparent_42%)] opacity-100 dark:bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.14),transparent_28%),radial-gradient(circle_at_bottom_left,hsl(196_100%_72%/0.08),transparent_24%)]" />
        <div className="pointer-events-none absolute inset-x-6 top-0 h-16 rounded-b-[28px] bg-[linear-gradient(180deg,rgba(255,255,255,0.5),transparent)] blur-xl opacity-90 dark:hidden" />

        {isUrgent && (
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-destructive via-destructive/70 to-transparent" />
        )}

        <div className="relative p-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="crm-lead-card-inner flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] border border-primary/16 shadow-[0_16px_24px_-22px_rgba(56,189,248,0.24),inset_0_1px_0_rgba(255,255,255,0.75)] dark:border-primary/18">
                <UserCircle className="h-5 w-5 text-primary/75" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="truncate text-[14px] font-semibold tracking-[-0.015em] text-foreground">
                    {lead.customer_name}
                  </p>
                  {lead.service_type && (
                    <span className="crm-lead-card-soft inline-block max-w-[180px] truncate rounded-full border border-sky-200/90 px-2.5 py-1 text-[10px] font-semibold text-foreground/84 shadow-[0_16px_28px_-18px_rgba(59,130,246,0.18)] dark:border-sky-400/18 dark:text-foreground/86">
                      {lead.service_type}
                    </span>
                  )}
                </div>

                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <p className="font-mono text-[10px] text-muted-foreground/70">{lead.job_id}</p>
                  {lead.number_name && (
                    <span className="inline-flex max-w-[160px] items-center gap-1 truncate rounded-full border border-primary/15 bg-primary/[0.07] px-2 py-0.5 text-[10px] font-semibold text-primary/85">
                      <Phone className="h-3 w-3 shrink-0" />
                      <span className="truncate">{lead.number_name}</span>
                    </span>
                  )}
                  {lead.created_at && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70">
                      <CalendarDays className="h-3 w-3" />
                      {formatDate(lead.created_at)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="shrink-0">
              <StatusBadge status={lead.status} size="sm" />
            </div>
          </div>

          <div className="mt-4 grid gap-2">
            {detailRows.map(({ key, label, value, icon: Icon, wrap }) => (
              <div
                key={key}
                className="crm-lead-card-inner flex items-start gap-3 rounded-[20px] px-3 py-2.5 text-[13px] text-foreground/88 shadow-[0_16px_24px_-22px_rgba(59,130,246,0.12),inset_0_1px_0_rgba(255,255,255,0.75)] dark:shadow-none"
              >
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-primary/12 bg-primary/[0.06] dark:border-primary/18 dark:bg-primary/[0.08]">
                  <Icon className="h-3.5 w-3.5 text-primary/70" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/72">{label}</p>
                  <p className={`mt-1 text-[13px] leading-5 text-foreground/90 ${wrap ? "break-words" : "truncate"}`}>{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {allImages.length > 0 && (
          <div className="relative px-4 pb-1">
            <div className="crm-lead-card-soft rounded-[24px] p-3.5 shadow-[0_22px_34px_-26px_rgba(59,130,246,0.16)] dark:shadow-none">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ImageIcon className="h-3.5 w-3.5 text-muted-foreground/40" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
                    {isPaid && lead.payment_screenshot_url ? "Payment & Photos" : "Photos"}
                  </span>
                </div>
                <span className="crm-lead-card-inner rounded-full px-2 py-0.5 text-[10px] font-semibold text-foreground/72">
                  {allImages.length}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 sm:flex sm:flex-wrap">
                {allImages.map((url, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => openLightbox(i)}
                    className="group/image crm-lead-card-inner relative aspect-square h-auto min-h-[56px] w-full overflow-hidden rounded-[14px] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_18px_28px_-20px_rgba(59,130,246,0.22)] sm:h-14 sm:w-14 dark:hover:shadow-none"
                  >
                    <img
                      src={url}
                      alt=""
                      loading="lazy"
                      onError={() => {
                        // Image transforms aren't supported on this bucket
                        // (likely Free-tier Supabase). Disable transforms session-wide
                        // and reload thumbnails using plain signed URLs.
                        void import("@/lib/storage").then(({ markTransformsBroken }) => markTransformsBroken());
                      }}
                      className="h-full w-full object-cover blur-[3px] scale-110 transition-all duration-300 group-hover/image:blur-0 group-hover/image:scale-105"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent transition-opacity duration-200 group-hover/image:opacity-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {(isCS || isAdmin) && lead.status !== "scheduled" && (
          <div className="px-4 pt-2">
            <Select
              value={(lead as { cs_tag?: string | null }).cs_tag ?? "__clear__"}
              onValueChange={handleCsTagChange}
            >
              <SelectTrigger className="crm-lead-card-inner h-9 w-full rounded-[14px] text-[12px] font-medium">
                <SelectValue placeholder="CS Tag (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__clear__" className="text-[12px] text-muted-foreground">
                  No tag
                </SelectItem>
                <SelectItem value="confirmation_sent" className="text-[12px]">
                  {CS_TAG_LABELS.confirmation_sent}
                </SelectItem>
                <SelectItem value="waiting_schedule_confirmation" className="text-[12px]">
                  {CS_TAG_LABELS.waiting_schedule_confirmation}
                </SelectItem>
              </SelectContent>
            </Select>
            {(lead as { cs_tag?: string | null }).cs_tag && (
              <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-400/20 dark:text-amber-200">
                📌 {CS_TAG_LABELS[(lead as { cs_tag: CsTag }).cs_tag]}
              </p>
            )}
          </div>
        )}

        {isProcessor && lead.status !== "scheduled" && (lead as { cs_tag?: string | null }).cs_tag && (
          <div className="px-4 pt-2">
            <p className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-400/20 dark:text-amber-200">
              📌 {CS_TAG_LABELS[(lead as { cs_tag: CsTag }).cs_tag]}
            </p>
          </div>
        )}

        <div className="space-y-2 px-4 pt-3">
          {renderCollapsible({
            open: generalOpen,
            setOpen: setGeneralOpen,
            label: "Notes",
            noteType: "general",
            tone: "default",
          })}

          {(isCS || isProcessor || isAdmin) &&
            renderCollapsible({
              open: csOpen,
              setOpen: setCsOpen,
              label: "CS Notes",
              noteType: "cs",
              tone: "cs",
            })}

          {(isProcessor || isAdmin) &&
            renderCollapsible({
              open: processorOpen,
              setOpen: setProcessorOpen,
              label: "Processor Notes",
              noteType: "processor",
              tone: "processor",
            })}
        </div>

        <div className="mt-3 px-4">
          {lead.last_edited_by && (
            <div className="rounded-[20px] border border-warning/26 bg-[radial-gradient(circle_at_top_left,hsl(48_100%_84%/0.16),transparent_32%),linear-gradient(180deg,hsl(42_100%_98%/0.88),hsl(40_100%_95%/0.72))] px-3.5 py-2.5 shadow-[0_18px_26px_-22px_rgba(245,158,11,0.18)] dark:border-warning/20 dark:bg-[linear-gradient(180deg,hsl(38_24%_21%/0.94),hsl(36_22%_18%/0.9))]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-warning/80" />
                <p className="text-[11px] text-muted-foreground/90">
                  Last edited <span className="font-medium text-foreground">{formatDateTime(lead.updated_at)}</span> by{" "}
                  <span className="font-semibold text-foreground">{profiles[lead.last_edited_by] || "Unknown"}</span>
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="px-4 pt-3">
          <div className="crm-lead-card-inner rounded-[18px] px-3 py-2 shadow-[0_16px_24px_-22px_rgba(59,130,246,0.14)] dark:shadow-none">
            <p className="text-[10px] text-muted-foreground/80">
              Created by <span className="font-semibold text-foreground">{profiles[lead.created_by] || "Unknown"}</span>{" "}
              · {formatDate(lead.created_at)}
            </p>
          </div>
        </div>

        <div className="mt-auto border-t border-white/30 px-4 pb-4 pt-4 dark:border-white/5">
          <div className="crm-lead-card-footer rounded-[24px] p-3 shadow-[0_24px_40px_-28px_rgba(59,130,246,0.18)] dark:shadow-none">
            <div className="mb-3">
              <Select value={lead.status} onValueChange={handleStatusChange} disabled={changingStatus || isPaid}>
                <SelectTrigger
                  className={`crm-lead-card-inner h-10 w-full rounded-[16px] text-[12px] font-medium shadow-[0_18px_28px_-24px_rgba(59,130,246,0.16)] ${
                    isPaid ? "cursor-not-allowed opacity-60" : ""
                  }`}
                >
                  <SelectValue placeholder="Change Status" />
                </SelectTrigger>
                <SelectContent>
                  {getChangeableStatuses(role).map((s) => (
                    <SelectItem key={s} value={s} className="text-[12px]">
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                variant="outline"
                size="sm"
                className="crm-lead-card-inner h-10 w-full flex-1 rounded-[16px] text-[12px] font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/28 hover:bg-primary/[0.05] hover:shadow-[0_18px_28px_-20px_rgba(59,130,246,0.2)] dark:hover:bg-primary/[0.10] dark:hover:shadow-none"
                onClick={() => navigate(`/leads/${lead.id}`)}
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Edit Lead
                <ArrowUpRight className="ml-auto h-3.5 w-3.5 opacity-35" />
              </Button>

              <div className="flex flex-wrap items-center gap-2 sm:w-auto">
                {!isCS && (
                  <CopyLeadButton
                    lead={lead}
                    className="crm-lead-card-inner h-10 rounded-[16px] border-border/60 bg-transparent text-[12px] font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/28 hover:bg-primary/[0.05] hover:shadow-[0_18px_28px_-20px_rgba(59,130,246,0.2)] dark:hover:bg-primary/[0.10] dark:hover:shadow-none"
                  />
                )}

                {isAdmin && (
                  <LeadShareDialog
                    leadId={lead.id}
                    customerName={lead.customer_name}
                    className="crm-lead-card-inner h-10 flex-1 rounded-[16px] border-border/60 bg-transparent text-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/28 hover:bg-primary/[0.05] hover:shadow-[0_18px_28px_-20px_rgba(59,130,246,0.2)] dark:hover:bg-primary/[0.10] dark:hover:shadow-none sm:w-10 sm:flex-none"
                  />
                )}

                {isAdmin && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="crm-lead-card-inner h-10 flex-1 rounded-[16px] text-destructive/60 transition-all duration-200 hover:-translate-y-0.5 hover:border-destructive/30 hover:bg-destructive/[0.06] hover:text-destructive hover:shadow-[0_18px_26px_-20px_rgba(239,68,68,0.22)] sm:w-10 sm:flex-none dark:hover:shadow-none"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>

                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete lead?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete "{lead.customer_name}". This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          </div>
        </div>

        <PaymentDialog
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
          onConfirm={handlePaymentConfirm}
          loading={paymentLoading}
        />

        <ImageLightbox
          images={lightboxImages.length ? lightboxImages : allImages}
          initialIndex={lightboxIndex}
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
        />
      </Card>
    </motion.div>
  );
}

export default memo(LeadCard);


