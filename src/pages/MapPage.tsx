<<<<<<< HEAD
﻿import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Lead, LeadStatus, STATUS_LABELS, ALL_LEAD_STATUSES } from "@/lib/constants";
import { useAllowedStatuses } from "@/hooks/useAllowedStatuses";
import { Button } from "@/components/ui/button";
=======
import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Lead, LeadStatus, STATUS_LABELS, ALL_LEAD_STATUSES } from "@/lib/constants";
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Search, Loader2, Calendar, Filter, Sparkles, Map, Navigation, Clock3 } from "lucide-react";
import { motion } from "framer-motion";
import { fadeUp } from "@/lib/motion";
<<<<<<< HEAD
=======
import { useNavigate } from "react-router-dom";
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface GeocodedLead {
  lead: Lead;
  lat: number;
  lng: number;
}

const DATE_PRESETS = [
  { label: "This Week", value: "week" },
  { label: "This Month", value: "month" },
  { label: "All Time", value: "all" },
  { label: "Custom Range", value: "custom" },
];

const GEOCODE_CACHE_KEY = "lead_geocode_cache";

function loadGeoCache(): Record<string, [number, number]> {
  try {
    return JSON.parse(localStorage.getItem(GEOCODE_CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveGeoCache(cache: Record<string, [number, number]>) {
  localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
}

async function geocodeAddress(address: string): Promise<[number, number] | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      { headers: { "User-Agent": "ServiceCRM/1.0" } },
    );
    const data = await res.json();
    if (data.length > 0) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
<<<<<<< HEAD
  } catch {
    return null;
  }
=======
  } catch {}
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
  return null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const STATUS_MARKER_COLORS: Record<LeadStatus, string> = {
  waiting_complete_details: "#f59e0b",
  urgent_job: "#ef4444",
  quote_sent_waiting: "#3b82f6",
  quote_sent_need_follow_up: "#f97316",
  needs_quote: "#a855f7",
  waiting_customer_response: "#eab308",
  need_tech: "#6366f1",
  scheduled: "#06b6d4",
  job_in_progress: "#0ea5e9",
  needs_reschedule: "#f43f5e",
  job_done: "#10b981",
  payment_pending: "#84cc16",
  cancelled: "#6b7280",
  paid: "#22c55e",
};

export default function MapPage() {
<<<<<<< HEAD
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
  const geocodeRunRef = useRef(0);
  const initialGeoCache = useMemo(() => loadGeoCache(), []);
  const addressCoordsRef = useRef<Record<string, [number, number]>>(initialGeoCache);
=======
  const navigate = useNavigate();
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.CircleMarker[]>([]);
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeProgress, setGeocodeProgress] = useState({ done: 0, total: 0 });
<<<<<<< HEAD
  const [addressCoords, setAddressCoords] = useState<Record<string, [number, number]>>(initialGeoCache);
=======
  const [geocodedLeads, setGeocodedLeads] = useState<GeocodedLead[]>([]);
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
  const [datePreset, setDatePreset] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<Set<LeadStatus>>(new Set(ALL_LEAD_STATUSES));
<<<<<<< HEAD
  const { allowedStatuses } = useAllowedStatuses();
  const availableStatuses = useMemo(
    () => ALL_LEAD_STATUSES.filter((status) => allowedStatuses.has(status)),
    [allowedStatuses],
  );
=======
  const geocodingRef = useRef(false);
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView([39.8283, -98.5795], 4);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
<<<<<<< HEAD
  }, []);

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("leads")
      .select("id, customer_name, address, status, created_at")
      .order("created_at", { ascending: false });
    if (data) setLeads(data as Lead[]);
    setLoading(false);
  };

  const toggleStatus = (status: LeadStatus) => {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const dateFiltered = useMemo(() => {
    const now = new Date();

    return leads.filter((l) => {
      if (!l.address) return false;
      if (!allowedStatuses.has(l.status)) return false;
      if (!selectedStatuses.has(l.status)) return false;

      const created = new Date(l.created_at);

      if (datePreset === "week") {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return created >= weekAgo;
      }

      if (datePreset === "month") {
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return created >= monthAgo;
      }

      if (datePreset === "custom") {
        if (customFrom && created < new Date(customFrom)) return false;
        if (customTo && created > new Date(customTo + "T23:59:59")) return false;
      }

      return true;
    });
  }, [allowedStatuses, leads, datePreset, customFrom, customTo, selectedStatuses]);

  const visibleGeocodedLeads = useMemo(
    () =>
      dateFiltered.flatMap((lead) => {
        if (!lead.address) return [];
        const coords = addressCoords[lead.address];
        if (!coords) return [];
        return [{ lead, lat: coords[0], lng: coords[1] }];
      }),
    [addressCoords, dateFiltered],
  );
=======
  }, [loading]);
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

<<<<<<< HEAD
    visibleGeocodedLeads.forEach((g) => {
=======
    geocodedLeads.forEach((g) => {
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
      const marker = L.circleMarker([g.lat, g.lng], {
        radius: 8,
        fillColor: STATUS_MARKER_COLORS[g.lead.status] || "#3b82f6",
        fillOpacity: 0.9,
        color: "#ffffff",
        weight: 2,
      }).addTo(map);

      marker.bindPopup(`
        <div style="min-width:200px;padding:2px 0">
          <p style="font-weight:700;font-size:13px;margin:0 0 6px;color:#111827">${g.lead.customer_name}</p>
          <p style="font-size:11px;color:#6b7280;margin:0 0 6px">${g.lead.address || ""}</p>
          <p style="font-size:11px;margin:0 0 6px;color:#111827">
            <span style="display:inline-block;height:8px;width:8px;border-radius:9999px;margin-right:6px;background:${STATUS_MARKER_COLORS[g.lead.status]}"></span>
            ${STATUS_LABELS[g.lead.status]}
          </p>
          <p style="font-size:11px;color:#9ca3af;margin:0">${new Date(g.lead.created_at).toLocaleDateString()}</p>
        </div>
      `);

      marker.on("click", () => {
        marker.openPopup();
      });

      markersRef.current.push(marker);
    });

<<<<<<< HEAD
    if (visibleGeocodedLeads.length > 0) {
      const bounds = L.latLngBounds(visibleGeocodedLeads.map((g) => [g.lat, g.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [visibleGeocodedLeads]);

  const geocodeEligibleAddresses = useMemo(
    () => [...new Set(leads.filter((lead) => lead.address && allowedStatuses.has(lead.status)).map((lead) => lead.address!))],
    [allowedStatuses, leads],
  );

  useEffect(() => {
    let isActive = true;

    if (geocodeEligibleAddresses.length === 0) {
      setGeocoding(false);
      setGeocodeProgress({ done: 0, total: 0 });
      return;
    }

    const runId = ++geocodeRunRef.current;
    const cache = { ...addressCoordsRef.current };
    const cachedCount = geocodeEligibleAddresses.filter((address) => cache[address]).length;
    const uncachedAddresses = geocodeEligibleAddresses.filter((address) => !cache[address]);

    setGeocodeProgress({ done: cachedCount, total: geocodeEligibleAddresses.length });

    if (uncachedAddresses.length === 0) {
      setGeocoding(false);
      return;
    }

    setGeocoding(true);

    const flushBatch = (updates: Record<string, [number, number]>) => {
      if (Object.keys(updates).length === 0 || runId !== geocodeRunRef.current || !isActive) return;
      Object.assign(cache, updates);
      addressCoordsRef.current = cache;
      saveGeoCache(cache);
      setAddressCoords({ ...cache });
    };

    const runGeocoding = async () => {
      let pendingUpdates: Record<string, [number, number]> = {};

      for (let i = 0; i < uncachedAddresses.length; i++) {
        const address = uncachedAddresses[i];
        const coords = await geocodeAddress(address);

        if (runId !== geocodeRunRef.current || !isActive) return;

        if (coords) {
          pendingUpdates[address] = coords;
        }

        const doneCount = cachedCount + i + 1;
        setGeocodeProgress({ done: doneCount, total: geocodeEligibleAddresses.length });

        if ((i + 1) % 10 === 0 || i === uncachedAddresses.length - 1) {
          flushBatch(pendingUpdates);
          pendingUpdates = {};
        }

        if (i < uncachedAddresses.length - 1) await sleep(350);
      }

      if (runId !== geocodeRunRef.current || !isActive) return;

      setGeocoding(false);
    };

    void runGeocoding();

    return () => {
      isActive = false;
    };
  }, [geocodeEligibleAddresses]);
=======
    if (geocodedLeads.length > 0) {
      const bounds = L.latLngBounds(geocodedLeads.map((g) => [g.lat, g.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [geocodedLeads, navigate]);

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    const { data } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
    if (data) setLeads(data as Lead[]);
    setLoading(false);
  };

  const toggleStatus = (status: LeadStatus) => {
    setSelectedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const dateFiltered = useMemo(() => {
    const now = new Date();

    return leads.filter((l) => {
      if (!l.address) return false;
      if (!selectedStatuses.has(l.status)) return false;

      const created = new Date(l.created_at);

      if (datePreset === "week") {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return created >= weekAgo;
      }

      if (datePreset === "month") {
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return created >= monthAgo;
      }

      if (datePreset === "custom") {
        if (customFrom && created < new Date(customFrom)) return false;
        if (customTo && created > new Date(customTo + "T23:59:59")) return false;
      }

      return true;
    });
  }, [leads, datePreset, customFrom, customTo, selectedStatuses]);

  useEffect(() => {
    if (dateFiltered.length === 0) {
      setGeocodedLeads([]);
      return;
    }
    geocodeLeads(dateFiltered);
  }, [dateFiltered]);

  const geocodeLeads = async (leadsToGeocode: Lead[]) => {
    if (geocodingRef.current) return;

    geocodingRef.current = true;
    setGeocoding(true);

    const cache = loadGeoCache();
    const results: GeocodedLead[] = [];
    const needsGeocode: Lead[] = [];

    for (const lead of leadsToGeocode) {
      if (!lead.address) continue;
      const cached = cache[lead.address];
      if (cached) results.push({ lead, lat: cached[0], lng: cached[1] });
      else needsGeocode.push(lead);
    }

    setGeocodedLeads([...results]);
    setGeocodeProgress({ done: results.length, total: results.length + needsGeocode.length });

    for (let i = 0; i < needsGeocode.length; i++) {
      const lead = needsGeocode[i];
      if (!lead.address) continue;

      const coords = await geocodeAddress(lead.address);
      if (coords) {
        cache[lead.address] = coords;
        results.push({ lead, lat: coords[0], lng: coords[1] });
        setGeocodedLeads([...results]);
      }

      setGeocodeProgress({
        done: results.length,
        total: results.length + needsGeocode.length - i - 1,
      });

      if (i < needsGeocode.length - 1) await sleep(1100);
    }

    saveGeoCache(cache);
    setGeocoding(false);
    geocodingRef.current = false;
  };
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    const coords = await geocodeAddress(searchQuery);
    if (coords && mapRef.current) {
      mapRef.current.flyTo(coords, 13, { duration: 1.5 });
      return;
    }

<<<<<<< HEAD
    const match = visibleGeocodedLeads.find((g) => g.lead.address?.toLowerCase().includes(searchQuery.toLowerCase()));
=======
    const match = geocodedLeads.find((g) => g.lead.address?.toLowerCase().includes(searchQuery.toLowerCase()));
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f

    if (match && mapRef.current) {
      mapRef.current.flyTo([match.lat, match.lng], 13, { duration: 1.5 });
    }
  };

<<<<<<< HEAD
  const plottedCount = visibleGeocodedLeads.length;
=======
  const plottedCount = geocodedLeads.length;
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
  const activeStatusCount = selectedStatuses.size;

  return (
    <div className="space-y-6">
      <motion.div {...fadeUp}>
        <div className="relative overflow-hidden rounded-[28px] border border-border/60 bg-gradient-to-br from-card via-card to-muted/[0.35] p-6 shadow-[0_22px_60px_-34px_rgba(0,0,0,0.45)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_28%)]" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-1 rounded-full border border-primary/10 bg-primary/[0.06] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                <Sparkles className="h-2.5 w-2.5" />
                Map View
              </div>

              <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-[-0.03em] text-foreground sm:text-3xl">
                <MapPin className="h-5 w-5 text-primary" />
                Lead Map
              </h1>

              <p className="mt-2 text-sm text-muted-foreground">
                {plottedCount} lead{plottedCount !== 1 ? "s" : ""} plotted
                {geocoding && " · Geocoding in progress"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Card className="rounded-2xl border-border/60 bg-card/90 shadow-[0_14px_40px_-28px_rgba(0,0,0,0.35)]">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60">
                        Plotted
                      </p>
                      <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground tabular-nums">
                        {plottedCount}
                      </p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/10 bg-primary/[0.07]">
                      <Map className="h-4 w-4 text-primary/80" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-2xl border-border/60 bg-card/90 shadow-[0_14px_40px_-28px_rgba(0,0,0,0.35)]">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60">
                        Active Statuses
                      </p>
                      <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground tabular-nums">
                        {activeStatusCount}
                      </p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border/60 bg-muted/[0.28]">
                      <Filter className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="col-span-2 rounded-2xl border-border/60 bg-card/90 shadow-[0_14px_40px_-28px_rgba(0,0,0,0.35)] sm:col-span-1">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60">
                        Range
                      </p>
                      <p className="mt-2 text-[14px] font-semibold tracking-[-0.02em] text-foreground">
                        {DATE_PRESETS.find((p) => p.value === datePreset)?.label || "All Time"}
                      </p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/10 bg-primary/[0.07]">
                      <Calendar className="h-4 w-4 text-primary/80" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </motion.div>

      <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-[0_18px_52px_-34px_rgba(0,0,0,0.42)]">
        <CardContent className="p-5">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_auto_auto]">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40" />
              <Input
                placeholder="Search city, state, ZIP, neighborhood, or saved address..."
                className="h-11 rounded-xl border-border/60 bg-background pl-10 shadow-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch();
                }}
              />
            </div>

            <Select value={datePreset} onValueChange={setDatePreset}>
              <SelectTrigger className="h-11 w-full rounded-xl border-border/60 bg-background shadow-sm xl:w-[190px]">
                <Calendar className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <button
<<<<<<< HEAD
                type="button"
=======
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
                onClick={handleSearch}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-border/60 bg-background px-4 text-sm font-medium text-foreground shadow-sm transition-all duration-200 hover:border-primary/25 hover:bg-primary/[0.03]"
              >
                <Navigation className="mr-2 h-4 w-4" />
                Locate
              </button>
            </div>
          </div>

          {datePreset === "custom" && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[180px_180px_auto]">
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-11 rounded-xl border-border/60 bg-background shadow-sm"
              />
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-11 rounded-xl border-border/60 bg-background shadow-sm"
              />
              <div className="flex items-center">
                <div className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-muted/[0.16] px-3 py-2 text-[12px] text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" />
                  Custom range filters map results instantly
                </div>
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Filter className="mr-1 h-3.5 w-3.5 text-muted-foreground" />
<<<<<<< HEAD
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-full border-border/50 bg-background/70 px-3 text-[11px]"
              onClick={() => setSelectedStatuses(new Set(availableStatuses))}
            >
              Show Allowed
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 rounded-full px-3 text-[11px] text-muted-foreground"
              onClick={() => setSelectedStatuses(new Set())}
            >
              Hide All
            </Button>
            {availableStatuses.map((status) => (
              <button
                key={status}
                type="button"
=======
            {ALL_LEAD_STATUSES.map((status) => (
              <button
                key={status}
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
                onClick={() => toggleStatus(status)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-all duration-200 ${
                  selectedStatuses.has(status)
                    ? "border-primary/25 bg-primary/[0.08] text-foreground shadow-sm"
                    : "border-border/40 bg-muted/[0.20] text-muted-foreground/55 line-through"
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_MARKER_COLORS[status] }} />
                {STATUS_LABELS[status]}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {geocoding && (
        <Card className="rounded-2xl border-primary/20 bg-primary/[0.05] shadow-[0_14px_40px_-28px_rgba(0,0,0,0.35)]">
          <CardContent className="flex items-center gap-3 p-4">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">
              Geocoding addresses... {geocodeProgress.done} of {geocodeProgress.total}
            </span>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden rounded-[28px] border-border/60 shadow-[0_18px_52px_-34px_rgba(0,0,0,0.42)]">
        {loading ? (
          <div className="flex h-[calc(100vh-320px)] min-h-[440px] items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading leads...
          </div>
        ) : (
          <div className="relative">
            <div className="pointer-events-none absolute left-4 top-4 z-[500] rounded-2xl border border-border/60 bg-card/92 px-3 py-2 text-[12px] text-muted-foreground shadow-sm backdrop-blur-xl">
              Interactive map · click markers for lead preview
            </div>
            <div ref={mapContainerRef} className="z-0 h-[calc(100vh-320px)] min-h-[440px]" />
          </div>
        )}
      </Card>

      <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-[0_18px_52px_-34px_rgba(0,0,0,0.42)]">
        <CardContent className="p-5">
          <div className="mb-4">
            <p className="text-[14px] font-semibold tracking-[-0.02em] text-foreground">Status Legend</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Marker colors map directly to the current lead status.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
<<<<<<< HEAD
            {availableStatuses.map((status) => (
=======
            {Object.entries(STATUS_MARKER_COLORS).map(([status, color]) => (
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
              <div
                key={status}
                className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-muted/[0.18] px-3 py-1.5 text-[11px]"
              >
<<<<<<< HEAD
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: STATUS_MARKER_COLORS[status] }} />
                <span className="text-muted-foreground">{STATUS_LABELS[status]}</span>
=======
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-muted-foreground">{STATUS_LABELS[status as LeadStatus]}</span>
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
<<<<<<< HEAD


=======
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
