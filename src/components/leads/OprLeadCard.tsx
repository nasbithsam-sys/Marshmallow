import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Lead } from "@/lib/constants";
import { Wrench, MapPin, FileText, Image as ImageIcon, Briefcase, ChevronDown, MessageSquare } from "lucide-react";
import StatusBadge from "./StatusBadge";
import ImageLightbox from "./ImageLightbox";
import NoteThread from "./NoteThread";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface Props {
  lead: Lead;
}

export default function OprLeadCard({ lead }: Props) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [originals, setOriginals] = useState<string[]>([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [oprNotesOpen, setOprNotesOpen] = useState(false);
  const [hasOprNotes, setHasOprNotes] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("lead_photos")
        .select("photo_url")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: true });
      if (!data || cancelled) return;
      const paths = data.map((p: { photo_url: string }) => p.photo_url);
      const { getSignedUrls } = await import("@/lib/storage");
      const urls = await getSignedUrls(paths, { width: 240, height: 240, resize: "cover", quality: 55 });
      if (!cancelled) setPhotos(urls);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [lead.id]);

  // Check if OPR notes exist
  useEffect(() => {
    let cancelled = false;
    const checkNotes = async () => {
      const { data } = await supabase
        .from("lead_notes")
        .select("id")
        .eq("lead_id", lead.id)
        .eq("note_type", "opr")
        .limit(1);
      if (!cancelled && data) {
        setHasOprNotes(data.length > 0);
      }
    };
    void checkNotes();
    return () => { cancelled = true; };
  }, [lead.id]);

  const openLightbox = async (i: number) => {
    setLightboxIndex(i);
    setLightboxOpen(true);
    if (originals.length === 0 && photos.length > 0) {
      const { data } = await supabase
        .from("lead_photos")
        .select("photo_url")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: true });
      if (data) {
        const paths = data.map((p: { photo_url: string }) => p.photo_url);
        const { getSignedUrls } = await import("@/lib/storage");
        const urls = await getSignedUrls(paths);
        setOriginals(urls);
      }
    }
  };

  const slides = photos.map((src, i) => ({ src: originals[i] ?? src, fallback: src }));

  // Build address from city/state
  const locationDisplay = [lead.city, lead.state].filter(Boolean).join(", ");

  return (
    <motion.div whileHover={{ y: -2 }} transition={{ type: "spring", stiffness: 220, damping: 24 }} className="h-full">
      <Card className="relative flex h-full flex-col overflow-hidden rounded-3xl border-border/60">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary/70 to-transparent" />

        <div className="flex items-center justify-between gap-3 p-4 pb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Briefcase className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Assigned Lead</p>
              <p className="font-mono text-[10px] text-muted-foreground">{lead.job_id}</p>
            </div>
          </div>
          <StatusBadge status={lead.status} size="sm" />
        </div>

        <div className="grid gap-2 px-4 pb-3">
          {locationDisplay && (
            <Row icon={MapPin} label="Location" value={locationDisplay} />
          )}
          {lead.service_type && (
            <Row icon={Wrench} label="Service" value={lead.service_type} />
          )}
          {lead.service_details && (
            <Row icon={FileText} label="Service Details" value={lead.service_details} wrap />
          )}
        </div>

        {photos.length > 0 && (
          <div className="px-4 pb-3">
            <div className="rounded-2xl border border-border/60 bg-background/60 p-3">
              <div className="mb-2 flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Photos ({photos.length})
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {photos.map((u, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => openLightbox(i)}
                    className="aspect-square overflow-hidden rounded-xl border border-border/60"
                  >
                    <img src={u} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* OPR Notes Thread */}
        <div className="px-4 pb-4">
          <Collapsible open={oprNotesOpen} onOpenChange={setOprNotesOpen}>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-between h-9 rounded-xl border px-3 text-[12px] text-muted-foreground hover:text-foreground crm-lead-card-soft border-emerald-200/70 bg-[linear-gradient(180deg,hsl(152_100%_99%/0.86),hsl(155_100%_96%/0.7))] shadow-[0_14px_22px_-20px_rgba(16,185,129,0.12)] hover:border-emerald-300/75 dark:border-emerald-400/22 dark:bg-[linear-gradient(180deg,hsl(158_34%_20%/0.94),hsl(156_28%_18%/0.9))] dark:shadow-none"
              >
                <span className="flex items-center gap-2">
                  <span className="relative inline-flex h-3.5 w-3.5 items-center justify-center">
                    <MessageSquare className="h-3.5 w-3.5" />
                    {hasOprNotes && (
                      <span className="absolute -right-1 -top-1 flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-70" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                      </span>
                    )}
                  </span>
                  <span className="font-medium">OPR Notes</span>
                  {hasOprNotes && (
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-300">
                      has notes
                    </span>
                  )}
                </span>
                <motion.span animate={{ rotate: oprNotesOpen ? 180 : 0 }} transition={{ duration: 0.16 }}>
                  <ChevronDown className="h-3.5 w-3.5" />
                </motion.span>
              </Button>
            </CollapsibleTrigger>

            {oprNotesOpen && (
              <CollapsibleContent forceMount asChild>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                  className="pt-2"
                >
                  <NoteThread
                    leadId={lead.id}
                    noteType="opr"
                    label="OPR Notes"
                    onNotesChanged={() => setHasOprNotes(true)}
                  />
                </motion.div>
              </CollapsibleContent>
            )}
          </Collapsible>
        </div>

        <ImageLightbox
          images={slides.length ? slides : photos}
          initialIndex={lightboxIndex}
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
        />
      </Card>
    </motion.div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  wrap,
}: {
  icon: typeof Wrench;
  label: string;
  value: string;
  wrap?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border/50 bg-background/60 px-3 py-2.5">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/[0.06]">
        <Icon className="h-3.5 w-3.5 text-primary/70" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
        <p className={`mt-0.5 text-[13px] leading-5 text-foreground ${wrap ? "break-words" : "truncate"}`}>{value}</p>
      </div>
    </div>
  );
}
