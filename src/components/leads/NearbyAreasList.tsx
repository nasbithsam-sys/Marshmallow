import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { MapPin, Sparkles, RefreshCw, Copy, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface NearbyArea {
  name: string;
  state: string;
  distance_miles?: number | null;
  reason?: string | null;
}

export interface NearbyAreasData {
  center_location: string;
  radius_miles: number;
  generated_at: string;
  source_address: string;
  areas: NearbyArea[];
}

interface Props {
  leadId: string;
  customerAddress?: string | null;
  customerCity?: string | null;
  customerState?: string | null;
  customerZip?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  savedNearbyAreas?: NearbyAreasData | null;
  canManage: boolean;
  onSaved?: (data: NearbyAreasData) => void;
}

function locationSignature(
  addr?: string | null,
  city?: string | null,
  state?: string | null,
  zip?: string | null,
  lat?: number | null,
  lng?: number | null,
) {
  return [
    (addr ?? "").trim().toLowerCase(),
    (city ?? "").trim().toLowerCase(),
    (state ?? "").trim().toLowerCase(),
    (zip ?? "").trim().toLowerCase(),
    lat ?? "",
    lng ?? "",
  ].join("|");
}

export default function NearbyAreasList({
  leadId,
  customerAddress,
  customerCity,
  customerState,
  customerZip,
  latitude,
  longitude,
  savedNearbyAreas,
  canManage,
  onSaved,
}: Props) {
  const [data, setData] = useState<NearbyAreasData | null>(savedNearbyAreas ?? null);
  const [loading, setLoading] = useState(false);

  const hasEnough = useMemo(() => {
    const city = (customerCity ?? "").trim();
    const state = (customerState ?? "").trim();
    const addr = (customerAddress ?? "").trim();
    const zip = (customerZip ?? "").trim();
    return Boolean((city && state) || addr || zip || (latitude != null && longitude != null));
  }, [customerAddress, customerCity, customerState, customerZip, latitude, longitude]);

  const currentSig = locationSignature(
    customerAddress,
    customerCity,
    customerState,
    customerZip,
    latitude,
    longitude,
  );
  const savedSig = data
    ? locationSignature(data.source_address, null, null, null, null, null)
    : "";
  const isStale =
    !!data &&
    !!data.source_address &&
    !currentSig.includes((customerCity ?? "").trim().toLowerCase()) &&
    savedSig !== currentSig;

  const generate = async () => {
    if (loading) return;
    if (!hasEnough) {
      toast.error("Add a customer city and state or complete address before generating nearby areas.");
      return;
    }
    setLoading(true);
    try {
      const { data: resp, error } = await supabase.functions.invoke("generate-nearby-areas", {
        body: { leadId },
      });
      if (error) {
        const message =
          (resp as { error?: string } | null)?.error ?? error.message ?? "Unable to generate nearby areas. Please try again.";
        toast.error(message);
        return;
      }
      const payload = (resp as { nearby_areas?: NearbyAreasData })?.nearby_areas;
      if (!payload) {
        toast.error("Unable to generate nearby areas. Please try again.");
        return;
      }
      setData(payload);
      onSaved?.(payload);
      toast.success("Nearby areas generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to generate nearby areas.");
    } finally {
      setLoading(false);
    }
  };

  const copyList = async () => {
    if (!data || data.areas.length === 0) return;
    const lines = [
      `Nearby Areas within ${data.radius_miles} miles of ${data.center_location}:`,
      ...data.areas.map((a, i) => {
        const dist =
          a.distance_miles != null
            ? ` — approximately ${Math.round(a.distance_miles)} miles`
            : "";
        return `${i + 1}. ${a.name}, ${a.state}${dist}`;
      }),
    ];
    const text = lines.join("\n");
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      toast.success("Nearby areas copied");
    } catch {
      toast.error("Unable to copy nearby areas");
    }
  };

  if (!canManage) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: 0.07 }}
      className="rounded-2xl border border-border/60 bg-card/60 p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <MapPin className="h-4.5 w-4.5 text-primary" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Nearby Areas List</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Most populated areas within approximately 50 miles of the customer.
            </p>
          </div>
        </div>

        {data && data.areas.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={copyList}
              aria-label="Copy nearby areas list"
              className="h-8 gap-1.5"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy List
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={generate}
              disabled={loading}
              aria-label="Refresh nearby areas list"
              className="h-8 gap-1.5"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Refresh
            </Button>
          </div>
        )}
      </div>

      {isStale && data && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300 mb-3"
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Customer location changed. Refresh the nearby areas list.
        </div>
      )}

      {!hasEnough && !data && (
        <p className="text-xs text-muted-foreground">
          Add a customer city and state or complete address before generating nearby areas.
        </p>
      )}

      {hasEnough && !data && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Generate a list of populated areas within 50 miles of this customer.
          </p>
          <Button size="sm" onClick={generate} disabled={loading} className="gap-1.5" aria-label="Generate nearby areas">
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Finding nearby populated areas...
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                Generate Nearby Areas
              </>
            )}
          </Button>
        </div>
      )}

      {loading && data && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3" role="status" aria-live="polite">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Finding nearby populated areas...
        </div>
      )}

      {data && data.areas.length > 0 && (
        <>
          <ul className="space-y-1.5 max-h-72 overflow-y-auto pr-1" aria-label="Nearby populated areas">
            {data.areas.map((a, i) => (
              <li
                key={`${a.name}-${a.state}-${i}`}
                className="flex items-start justify-between gap-3 rounded-lg border border-border/50 bg-background/40 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">
                    {a.name}, {a.state}
                  </div>
                  {a.reason && (
                    <div className="text-[11px] text-muted-foreground truncate">{a.reason}</div>
                  )}
                </div>
                {a.distance_miles != null && (
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    ~{Math.round(a.distance_miles)} mi
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Generated {new Date(data.generated_at).toLocaleString()} · Center: {data.center_location}
          </p>
        </>
      )}
    </motion.div>
  );
}
