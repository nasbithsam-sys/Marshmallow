import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Lead, LeadStatus, STATUS_LABELS, STATUS_DOT_COLORS, ALL_LEAD_STATUSES } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin, Search, Loader2, Calendar } from "lucide-react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import { motion } from "framer-motion";
import { fadeUp } from "@/lib/motion";
import { useNavigate } from "react-router-dom";
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
  try { return JSON.parse(localStorage.getItem(GEOCODE_CACHE_KEY) || "{}"); }
  catch { return {}; }
}

function saveGeoCache(cache: Record<string, [number, number]>) {
  localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
}

async function geocodeAddress(address: string): Promise<[number, number] | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      { headers: { "User-Agent": "ServiceCRM/1.0" } }
    );
    const data = await res.json();
    if (data.length > 0) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  } catch {}
  return null;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function MapSearchControl({ onSearch }: { onSearch: (query: string) => void }) {
  const [query, setQuery] = useState("");
  return (
    <div className="relative flex-1">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Search city, state, ZIP, or neighborhood..."
        className="pl-9 bg-card border-border/60"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onSearch(query); }}
      />
    </div>
  );
}

function FlyToLocation({ coords }: { coords: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (coords) map.flyTo(coords, 13, { duration: 1.5 });
  }, [coords, map]);
  return null;
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
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeProgress, setGeocodeProgress] = useState({ done: 0, total: 0 });
  const [geocodedLeads, setGeocodedLeads] = useState<GeocodedLead[]>([]);
  const [datePreset, setDatePreset] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);
  const geocodingRef = { current: false };

  useEffect(() => { fetchLeads(); }, []);

  const fetchLeads = async () => {
    setLoading(true);
    const { data } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
    if (data) setLeads(data as Lead[]);
    setLoading(false);
  };

  const dateFiltered = useMemo(() => {
    const now = new Date();
    return leads.filter((l) => {
      if (!l.address) return false;
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
  }, [leads, datePreset, customFrom, customTo]);

  useEffect(() => {
    if (dateFiltered.length === 0) { setGeocodedLeads([]); return; }
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
      if (cached) {
        results.push({ lead, lat: cached[0], lng: cached[1] });
      } else {
        needsGeocode.push(lead);
      }
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
      setGeocodeProgress({ done: results.length, total: results.length + needsGeocode.length - i - 1 });
      if (i < needsGeocode.length - 1) await sleep(1100);
    }

    saveGeoCache(cache);
    setGeocoding(false);
    geocodingRef.current = false;
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) return;
    const coords = await geocodeAddress(query);
    if (coords) {
      setFlyTo(coords);
    } else {
      const match = geocodedLeads.find((g) =>
        g.lead.address?.toLowerCase().includes(query.toLowerCase())
      );
      if (match) setFlyTo([match.lat, match.lng]);
    }
  };

  const center: [number, number] = geocodedLeads.length > 0
    ? [
        geocodedLeads.reduce((s, g) => s + g.lat, 0) / geocodedLeads.length,
        geocodedLeads.reduce((s, g) => s + g.lng, 0) / geocodedLeads.length,
      ]
    : [39.8283, -98.5795];

  return (
    <div className="space-y-4">
      <motion.div {...fadeUp}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" /> Lead Map
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {geocodedLeads.length} lead{geocodedLeads.length !== 1 ? "s" : ""} plotted
              {geocoding && ` · Geocoding...`}
            </p>
          </div>
        </div>
      </motion.div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <MapSearchControl onSearch={handleSearch} />
        <Select value={datePreset} onValueChange={setDatePreset}>
          <SelectTrigger className="w-full sm:w-[180px] bg-card border-border/60">
            <Calendar className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_PRESETS.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {datePreset === "custom" && (
          <div className="flex gap-2">
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="bg-card border-border/60 w-[150px]" />
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="bg-card border-border/60 w-[150px]" />
          </div>
        )}
      </div>

      {geocoding && (
        <Card className="p-3 flex items-center gap-3 border-primary/20 bg-primary/5">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">
            Geocoding addresses... {geocodeProgress.done} of {geocodeProgress.total}
          </span>
        </Card>
      )}

      <Card className="overflow-hidden border-border/60 rounded-xl">
        {loading ? (
          <div className="h-[calc(100vh-280px)] flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading leads...
          </div>
        ) : (
          <div className="h-[calc(100vh-280px)] min-h-[400px]">
            <MapContainer center={center} zoom={geocodedLeads.length > 0 ? 5 : 4} className="h-full w-full z-0" scrollWheelZoom={true}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FlyToLocation coords={flyTo} />
              {geocodedLeads.map((g) => (
                <CircleMarker
                  key={g.lead.id}
                  center={[g.lat, g.lng]}
                  radius={7}
                  pathOptions={{
                    fillColor: STATUS_MARKER_COLORS[g.lead.status] || "#3b82f6",
                    fillOpacity: 0.85,
                    color: "#fff",
                    weight: 2,
                  }}
                >
                  <Popup>
                    <div className="min-w-[180px] space-y-1.5">
                      <p className="font-semibold text-sm">{g.lead.customer_name}</p>
                      <p className="text-xs text-gray-500">{g.lead.address}</p>
                      <p className="text-xs">
                        <span className="inline-block h-2 w-2 rounded-full mr-1" style={{ backgroundColor: STATUS_MARKER_COLORS[g.lead.status] }} />
                        {STATUS_LABELS[g.lead.status]}
                      </p>
                      <p className="text-xs text-gray-400">{new Date(g.lead.created_at).toLocaleDateString()}</p>
                      <button className="text-xs text-blue-600 underline cursor-pointer" onClick={() => navigate(`/leads/${g.lead.id}`)}>
                        View Lead →
                      </button>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        )}
      </Card>

      <Card className="p-3 border-border/60">
        <p className="text-xs font-semibold text-muted-foreground mb-2">Status Legend</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(STATUS_MARKER_COLORS).map(([status, color]) => (
            <div key={status} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[11px] text-muted-foreground">{STATUS_LABELS[status as LeadStatus]}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}