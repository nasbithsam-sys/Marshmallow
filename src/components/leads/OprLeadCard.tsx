import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Lead } from "@/lib/constants";
import { Wrench, MapPin, FileText, CalendarClock, Image as ImageIcon, AlertTriangle } from "lucide-react";
import StatusBadge from "./StatusBadge";
import ImageLightbox from "./ImageLightbox";
import { motion } from "framer-motion";

interface Props {
  lead: Lead;
}

// Show only first half (rounded up) of the address
function halfAddress(addr?: string | null) {
  if (!addr) return "";
  const half = Math.ceil(addr.length / 2);
  return addr.slice(0, half) + "…";
}

export default function OprLeadCard({ lead }: Props) {
  const [photos, setPhotos] = useState<string[]>([]);
  const [originals, setOriginals] = useState<string[]>([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

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

  return (
    <motion.div whileHover={{ y: -2 }} transition={{ type: "spring", stiffness: 220, damping: 24 }} className="h-full">
      <Card className="relative flex h-full flex-col overflow-hidden rounded-3xl border-destructive/25">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-destructive via-destructive/70 to-transparent" />

        <div className="flex items-center justify-between gap-3 p-4 pb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-destructive">Urgent Job</p>
              <p className="font-mono text-[10px] text-muted-foreground">{lead.job_id}</p>
            </div>
          </div>
          <StatusBadge status={lead.status} size="sm" />
        </div>

        <div className="grid gap-2 px-4 pb-3">
          {lead.service_type && (
            <Row icon={Wrench} label="Service" value={lead.service_type} />
          )}
          {lead.service_details && (
            <Row icon={FileText} label="Service Details" value={lead.service_details} wrap />
          )}
          {lead.address && (
            <Row icon={MapPin} label="Area (partial)" value={halfAddress(lead.address)} />
          )}
          {lead.customer_schedule_requirements && (
            <Row
              icon={CalendarClock}
              label="Customer Schedule"
              value={lead.customer_schedule_requirements}
              wrap
            />
          )}
        </div>

        {photos.length > 0 && (
          <div className="px-4 pb-4">
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
