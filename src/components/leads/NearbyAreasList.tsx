import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { MapPin, RefreshCw, Copy, Loader2, AlertTriangle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface NearbyArea {
  geoid?: string | null;
  name: string;
  state: string;
  state_code?: string | null;
  state_name?: string | null;
  population?: number | null;
  distance_miles?: number | null;
  reason?: string | null;
}

export interface NearbyAreasData {
  center_location:
    | string
    | {
        source_address?: string | null;
        matched_address?: string | null;
        latitude?: number | null;
        longitude?: number | null;
        geocoding_accuracy?: string | null;
        place_name?: string | null;
      };
  radius_miles: number;
  generated_at: string;
  source_address?: string;
  method?: string;
  population_vintage?: number;
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

function fmtNum(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US");
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

function normalizeAreas(raw: NearbyArea[] | undefined | null): NearbyArea[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const cleaned: NearbyArea[] = [];
  for (const a of raw) {
    if (!a || typeof a !== "object") continue;
    const name = (a.name ?? "").trim();
    const st = (a.state_code ?? a.state ?? "").trim();
    if (!name || !st) continue;
    const key = `${a.geoid ?? ""}|${name.toLowerCase()}|${st.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push({
      geoid: a.geoid ?? null,
      name,
      state: st,
      state_code: a.state_code ?? st,
      state_name: a.state_name ?? null,
      population:
        typeof a.population === "number" && Number.isFinite(a.population) ? a.population : null,
      distance_miles:
        typeof a.distance_miles === "number" && Number.isFinite(a.distance_miles)
          ? a.distance_miles
          : null,
    });
  }
  cleaned.sort((a, b) => {
    const pa = a.population ?? -1;
    const pb = b.population ?? -1;
    if (pb !== pa) return pb - pa;
    const da = a.distance_miles ?? Number.POSITIVE_INFINITY;
    const db = b.distance_miles ?? Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    return a.name.localeCompare(b.name);
  });
  return cleaned.slice(0, 5);
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

  useEffect(() => {
    setData(savedNearbyAreas ?? null);
  }, [savedNearbyAreas]);

  const areas = useMemo(() => normalizeAreas(data?.areas), [data]);

  const hasEnough = useMemo(() => {
    const city = (customerCity ?? "").trim();
    const state = (customerState ?? "").trim();
    const addr = (customerAddress ?? "").trim();
    const zip = (customerZip ?? "").trim();
    const hasCoords =
      typeof latitude === "number" &&
      typeof longitude === "number" &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      !(latitude === 0 && longitude === 0);
    return Boolean((city && state) || addr || zip || hasCoords);
  }, [customerAddress, customerCity, customerState, customerZip, latitude, longitude]);

  const currentSig = locationSignature(
    customerAddress,
    customerCity,
    customerState,
    customerZip,
    latitude,
    longitude,
  );
  const savedCenter = data?.center_location;
  const savedSourceAddr =
    typeof savedCenter === "string"
      ? savedCenter
      : savedCenter?.source_address ?? data?.source_address ?? "";
  const savedSig = data
    ? locationSignature(savedSourceAddr, null, null, null, null, null)
    : "";
  const isStale =
    !!data &&
    !!savedSourceAddr &&
    !currentSig.includes((customerCity ?? "").trim().toLowerCase()) &&
    savedSig !== currentSig;

  const generate = async () => {
    if (loading) return;
    if (!hasEnough) {
      toast.error(
        "Add a valid customer address, city and state, ZIP code, or coordinates before finding nearby areas.",
      );
      return;
    }
    setLoading(true);
    try {
      const { data: resp, error } = await supabase.functions.invoke("generate-nearby-areas", {
        body: { leadId },
      });
      if (error) {
        const message =
          (resp as { error?: string } | null)?.error ??
          error.message ??
          "Unable to calculate nearby areas. Please try again.";
        toast.error(message);
        return;
      }
      const payload = (resp as { nearby_areas?: NearbyAreasData })?.nearby_areas;
      if (!payload) {
        toast.error("Unable to calculate nearby areas. Please try again.");
        return;
      }
      const normalized: NearbyAreasData = { ...payload, areas: normalizeAreas(payload.areas) };
      setData(normalized);
      onSaved?.(normalized);
      toast.success("Nearby areas generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Unable to calculate nearby areas.");
    } finally {
      setLoading(false);
    }
  };

  const copyList = async () => {
    if (areas.length === 0) return;
    const lines = [
      `Top ${areas.length} populated areas within 50 miles:`,
      ...areas.map((a, i) => {
        const st = a.state_code ?? a.state;
        const pop = a.population != null ? ` — Population ${fmtNum(a.population)}` : "";
        const dist =
          a.distance_miles != null ? ` — ${a.distance_miles.toFixed(1)} miles` : "";
        return `${i + 1}. ${a.name}, ${st}${pop}${dist}`;
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

  const centerLabel =
    typeof savedCenter === "string"
      ? savedCenter
      : savedCenter?.matched_address || savedCenter?.source_address || "";

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
            <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Top 5 Nearby Populated Areas</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Five highest-population places within 50 miles of the customer.
            </p>
          </div>
        </div>

        {areas.length > 0 && (
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

      {!hasEnough && areas.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Add a valid customer address, city and state, ZIP code, or coordinates before finding
          nearby areas.
        </p>
      )}

      {hasEnough && areas.length === 0 && !loading && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Find the five highest-population places within 50 miles of this customer.
          </p>
          <Button
            size="sm"
            onClick={generate}
            disabled={loading}
            className="gap-1.5"
            aria-label="Find nearby areas"
          >
            <Search className="h-3.5 w-3.5" />
            Find Nearby Areas
          </Button>
        </div>
      )}

      {loading && (
        <div
          className="flex items-center gap-2 text-xs text-muted-foreground mb-3"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Finding the top five populated areas within 50 miles...
        </div>
      )}

      {areas.length > 0 && (
        <>
          <ol className="space-y-1.5" aria-label="Top nearby populated areas">
            {areas.map((a, i) => {
              const st = a.state_code ?? a.state;
              return (
                <li
                  key={`${a.geoid ?? a.name}-${st}-${i}`}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border/50 bg-background/40 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">
                      <span className="text-muted-foreground mr-1.5">{i + 1}.</span>
                      {a.name}, {st}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Population: {fmtNum(a.population)}
                      {a.distance_miles != null && (
                        <> · {a.distance_miles.toFixed(1)} miles away</>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Generated {new Date(data!.generated_at).toLocaleString()}
            {centerLabel ? <> · Center: {centerLabel}</> : null}
            {data?.population_vintage ? <> · Population {data.population_vintage}</> : null}
          </p>
        </>
      )}
    </motion.div>
  );
}
