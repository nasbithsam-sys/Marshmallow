import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { MapPin, Plus, Upload, Search, Loader2, X, Users, Navigation as NavIcon, AlertTriangle, Contact } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { TechnicianDialog, TechnicianRecord } from "@/components/technicians/TechnicianDialog";
import { ImportTechniciansDialog } from "@/components/technicians/ImportTechniciansDialog";
import { haversineMiles, geocodeAddress, isValidLatLng, LatLng } from "@/lib/geo";
import { resolveZip, lookupZipCentroidSync, preloadZipDataset, ZipCentroid } from "@/lib/zipCentroids";
import { STATUS_LABELS } from "@/lib/constants";
import { toast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import type { LeadStatus } from "@/types";

const RADIUS_MILES = 20;
const RADIUS_METERS = RADIUS_MILES * 1609.344;

interface UrgentLead {
  id: string;
  job_id: string;
  customer_name: string;
  customer_phone: string;
  address: string;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  service_type: string;
  status: LeadStatus;
  latitude: number | null;
  longitude: number | null;
}

interface MappedLead extends UrgentLead {
  coords: LatLng;
  zip: string;
  zipCity: string;
  zipState: string;
  locationSource: "zip_centroid";
}

type ZipUnmappedReason = "zip_missing" | "zip_invalid" | "zip_not_found";

interface MappedTech extends TechnicianRecord {
  coords: LatLng;
}

type EntityFilter = "urgent" | "technicians";

function pinSvg(fill: string, stroke: string, size = 32) {
  // Classic teardrop map pin. Anchor at bottom tip.
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 32" style="display:block;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35))">
      <path d="M12 0.75 C5.65 0.75 0.75 5.65 0.75 12 C0.75 20.5 12 31.25 12 31.25 C12 31.25 23.25 20.5 23.25 12 C23.25 5.65 18.35 0.75 12 0.75 Z"
        fill="${fill}" stroke="${stroke}" stroke-width="1.5" stroke-linejoin="round"/>
      <circle cx="12" cy="12" r="4.25" fill="#ffffff"/>
    </svg>`;
}

function leadMarkerIcon() {
  return L.divIcon({
    className: "marshmallow-lead-marker",
    html: pinSvg("#ef4444", "#ffffff", 32),
    iconSize: [32, 32],
    iconAnchor: [16, 31],
    popupAnchor: [0, -28],
  });
}

function techMarkerIcon(selected: boolean) {
  const color = selected ? "#2563eb" : "#3b82f6";
  return L.divIcon({
    className: "marshmallow-tech-marker",
    html: pinSvg(color, "#ffffff", selected ? 36 : 32),
    iconSize: [selected ? 36 : 32, selected ? 36 : 32],
    iconAnchor: [selected ? 18 : 16, selected ? 35 : 31],
    popupAnchor: [0, -28],
  });
}

function fullAddress(lead: UrgentLead) {
  const parts = [lead.address, lead.city, lead.state, lead.zip_code].filter((p) => p && String(p).trim());
  return parts.join(", ");
}

export default function MapViewPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isMobile = useIsMobile();

  const mapRef = useRef<L.Map | null>(null);
  const mapEl = useRef<HTMLDivElement | null>(null);
  const leadLayer = useRef<L.LayerGroup | null>(null);
  const techLayer = useRef<L.LayerGroup | null>(null);
  const radiusLayer = useRef<L.Circle | null>(null);
  const markerIndex = useRef<Map<string, L.Marker>>(new Map());

  const [addOpen, setAddOpen] = useState(false);
  const [editTech, setEditTech] = useState<TechnicianRecord | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTech, setDeleteTech] = useState<TechnicianRecord | null>(null);
  const [selectedTechId, setSelectedTechId] = useState<string | null>(null);
  const [entityFilter, setEntityFilter] = useState<EntityFilter>("urgent");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [techSearch, setTechSearch] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [zipDatasetReady, setZipDatasetReady] = useState(false);
  const [mapVisible, setMapVisible] = useState(true);

  const urgentLeadsQuery = useQuery({
    queryKey: ["map-urgent-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, job_id, customer_name, customer_phone, address, city, state, zip_code, service_type, status, latitude, longitude")
        .eq("status", "urgent_job")
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as UrgentLead[];
    },
    staleTime: 60_000,
  });

  const techniciansQuery = useQuery({
    queryKey: ["technicians"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technicians")
        .select("id, name, area, service, notes, latitude, longitude")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TechnicianRecord[];
    },
    staleTime: 60_000,
  });

  // Load local ZIP centroid dataset once (lazy import keeps it out of main bundle).
  useEffect(() => {
    let cancelled = false;
    preloadZipDataset()
      .then(() => { if (!cancelled) setZipDatasetReady(true); })
      .catch(() => { if (!cancelled) setZipDatasetReady(true); });
    return () => { cancelled = true; };
  }, []);

  // Geocode ONLY technicians (urgent leads use ZIP centroids — no street geocoding).
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const techsNeedGeo = (techniciansQuery.data ?? []).filter((t) => !isValidLatLng(t.latitude, t.longitude));
      if (!techsNeedGeo.length) return;
      setGeocoding(true);
      for (const t of techsNeedGeo) {
        if (cancelled) break;
        const c = await geocodeAddress(t.area);
        if (c) await supabase.from("technicians").update({ latitude: c.latitude, longitude: c.longitude }).eq("id", t.id);
      }
      if (!cancelled) {
        setGeocoding(false);
        qc.invalidateQueries({ queryKey: ["technicians"] });
      }
    };
    void run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [techniciansQuery.data]);

  // Resolve every urgent lead to (mapped via ZIP centroid) or (unmapped w/ reason).
  const { mappedLeads, unmappedLeadList, unmappedReasons } = useMemo(() => {
    const rows = urgentLeadsQuery.data ?? [];
    const mapped: MappedLead[] = [];
    const unmapped: UrgentLead[] = [];
    const reasons: Record<string, ZipUnmappedReason> = {};

    for (const l of rows) {
      const zip = resolveZip({ zip_code: l.zip_code, address: l.address });
      if (!zip) {
        // Distinguish "nothing at all" vs "something present but not a 5-digit ZIP".
        const hasAnyDigits = /\d/.test(String(l.zip_code ?? "")) || /\d/.test(String(l.address ?? ""));
        reasons[l.id] = hasAnyDigits ? "zip_invalid" : "zip_missing";
        unmapped.push(l);
        continue;
      }
      const centroid: ZipCentroid | null = zipDatasetReady ? lookupZipCentroidSync(zip) : null;
      if (!centroid) {
        if (!zipDatasetReady) {
          // Dataset still loading — treat as unmapped for now, will re-eval on ready.
          reasons[l.id] = "zip_not_found";
        } else {
          reasons[l.id] = "zip_not_found";
        }
        unmapped.push(l);
        continue;
      }
      mapped.push({
        ...l,
        coords: { latitude: centroid.latitude, longitude: centroid.longitude },
        zip,
        zipCity: centroid.city,
        zipState: centroid.state,
        locationSource: "zip_centroid",
      });
    }
    return { mappedLeads: mapped, unmappedLeadList: unmapped, unmappedReasons: reasons };
  }, [urgentLeadsQuery.data, zipDatasetReady]);

  const unmappedLeads = unmappedLeadList.length;
  const pendingCount = zipDatasetReady ? 0 : unmappedLeadList.length;


  const mappedTechs = useMemo<MappedTech[]>(() => {
    const rows = techniciansQuery.data ?? [];
    return rows
      .filter((t) => isValidLatLng(t.latitude, t.longitude))
      .map((t) => ({ ...t, coords: { latitude: t.latitude as number, longitude: t.longitude as number } }));
  }, [techniciansQuery.data]);

  const services = useMemo(() => {
    const set = new Set<string>();
    for (const t of techniciansQuery.data ?? []) if (t.service) set.add(t.service);
    return Array.from(set).sort();
  }, [techniciansQuery.data]);

  const filteredTechs = useMemo(() => {
    return mappedTechs.filter((t) => {
      if (serviceFilter !== "all" && (t.service ?? "") !== serviceFilter) return false;
      if (techSearch.trim() && !t.name.toLowerCase().includes(techSearch.trim().toLowerCase())) return false;
      return true;
    });
  }, [mappedTechs, serviceFilter, techSearch]);

  const selectedTech = useMemo(
    () => mappedTechs.find((t) => t.id === selectedTechId) ?? null,
    [mappedTechs, selectedTechId],
  );

  const leadsInRange = useMemo(() => {
    if (!selectedTech) return [] as Array<MappedLead & { distance: number }>;
    return mappedLeads
      .map((l) => ({ ...l, distance: haversineMiles(selectedTech.coords, l.coords) }))
      .filter((l) => l.distance <= RADIUS_MILES)
      .sort((a, b) => a.distance - b.distance);
  }, [selectedTech, mappedLeads]);

  const visibleLeads = useMemo(() => {
    if (selectedTech && onlyInRange) return leadsInRange;
    return mappedLeads.map((l) => ({
      ...l,
      distance: selectedTech ? haversineMiles(selectedTech.coords, l.coords) : null,
    }));
  }, [mappedLeads, selectedTech, onlyInRange, leadsInRange]);

  // Init map once
  useEffect(() => {
    if (mapRef.current || !mapEl.current) return;
    const map = L.map(mapEl.current, { zoomControl: true, preferCanvas: true }).setView([39.5, -98.35], 4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    leadLayer.current = L.layerGroup().addTo(map);
    techLayer.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    // Ensure size is measured after mount
    setTimeout(() => map.invalidateSize(), 50);
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Render lead markers
  useEffect(() => {
    const layer = leadLayer.current;
    const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();
    if (entityFilter === "technicians") return;
    // Deterministic jitter so multiple leads sharing the same ZIP centroid
    // don't render as one un-clickable overlapping marker. ~150m spread.
    const jitter = (id: string, salt: number) => {
      let h = 0;
      for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i) + salt) | 0;
      // pseudo-random in [-1, 1)
      const r = ((h % 1000) / 500) - 1;
      return r * 0.0015;
    };
    for (const l of visibleLeads) {
      const lat = l.coords.latitude + jitter(l.id, 1);
      const lng = l.coords.longitude + jitter(l.id, 7);
      const m = L.marker([lat, lng], { icon: leadMarkerIcon() });
      const dist = l.distance != null ? `<div style="font-size:11px;color:#6b7280;margin-top:4px">${l.distance.toFixed(1)} mi from selected technician (approx.)</div>` : "";
      const zipCity = [l.zipCity, l.zipState].filter(Boolean).join(", ");
      m.bindPopup(`
        <div style="min-width:230px;font-family:inherit">
          <div style="font-weight:600;font-size:13px">${escapeHtml(l.customer_name || "Unnamed")}</div>
          <div style="font-size:11px;color:#6b7280">Job ${escapeHtml(l.job_id ?? "")}</div>
          <div style="margin-top:6px;font-size:12px">${escapeHtml(l.customer_phone || "")}</div>
          <div style="font-size:12px"><b>ZIP:</b> ${escapeHtml(l.zip)}${zipCity ? ` <span style="color:#6b7280">· ${escapeHtml(zipCity)}</span>` : ""}</div>
          <div style="margin-top:6px;font-size:12px"><b>Service:</b> ${escapeHtml(l.service_type || "—")}</div>
          <div style="font-size:12px"><b>Status:</b> ${escapeHtml(STATUS_LABELS[l.status] ?? l.status)}</div>
          ${dist}
          <div style="margin-top:6px;font-size:10px;color:#92400e;background:#fef3c7;border:1px solid #fde68a;padding:3px 6px;border-radius:4px;display:inline-block">Approximate ZIP area</div>
          <div><button data-lead-id="${l.id}" class="ml-view-lead" style="margin-top:8px;padding:6px 10px;background:#111827;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer">View Lead</button></div>
        </div>
      `);
      m.on("popupopen", () => {
        const el = document.querySelector<HTMLButtonElement>(`.ml-view-lead[data-lead-id="${l.id}"]`);
        if (el) el.onclick = () => navigate(`/leads/${l.id}`);
      });
      m.addTo(layer);
    }
  }, [visibleLeads, entityFilter, navigate]);

  // Render technician markers
  useEffect(() => {
    const layer = techLayer.current;
    const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();
    markerIndex.current.clear();
    if (entityFilter === "urgent") return;
    for (const t of filteredTechs) {
      const isSelected = t.id === selectedTechId;
      const m = L.marker([t.coords.latitude, t.coords.longitude], { icon: techMarkerIcon(isSelected) });
      m.on("click", () => {
        setSelectedTechId(t.id);
        if (isMobile) setSheetOpen(true);
      });
      m.addTo(layer);
      markerIndex.current.set(t.id, m);
    }
  }, [filteredTechs, selectedTechId, entityFilter, isMobile]);

  // Render selected-technician radius
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (radiusLayer.current) {
      map.removeLayer(radiusLayer.current);
      radiusLayer.current = null;
    }
    if (selectedTech) {
      radiusLayer.current = L.circle([selectedTech.coords.latitude, selectedTech.coords.longitude], {
        radius: RADIUS_METERS,
        color: "#2563eb",
        weight: 1.5,
        fillColor: "#3b82f6",
        fillOpacity: 0.08,
      }).addTo(map);
      map.flyTo([selectedTech.coords.latitude, selectedTech.coords.longitude], 8, { duration: 0.6 });
    }
  }, [selectedTech]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["technicians"] });
    qc.invalidateQueries({ queryKey: ["map-urgent-leads"] });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTech) return;
    const { error } = await supabase.from("technicians").delete().eq("id", deleteTech.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Technician deleted" });
      if (selectedTechId === deleteTech.id) setSelectedTechId(null);
      refresh();
    }
    setDeleteTech(null);
  };

  const focusLead = (lead: MappedLead) => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo([lead.coords.latitude, lead.coords.longitude], 11, { duration: 0.6 });
  };

  const SidePanel = (
    <div className="space-y-3">
      {selectedTech ? (
        <>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">{selectedTech.name}</div>
              <div className="text-xs text-muted-foreground">{selectedTech.area}</div>
              {selectedTech.service && <div className="text-xs mt-0.5">Service: <span className="font-medium">{selectedTech.service}</span></div>}
              {selectedTech.notes && <div className="text-xs mt-1 text-muted-foreground line-clamp-3">{selectedTech.notes}</div>}
            </div>
            <Button size="icon" variant="ghost" onClick={() => setSelectedTechId(null)}><X className="h-4 w-4" /></Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Coverage: {RADIUS_MILES} mi</Badge>
            <Badge>{leadsInRange.length} urgent lead{leadsInRange.length === 1 ? "" : "s"} in range</Badge>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setEditTech(selectedTech)}>Edit</Button>
            <Button size="sm" variant="destructive" onClick={() => setDeleteTech(selectedTech)}>Delete</Button>
            <label className="ml-auto flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={onlyInRange} onChange={(e) => setOnlyInRange(e.target.checked)} />
              Only in range
            </label>
          </div>
          <div className="border-t pt-2">
            <div className="text-xs font-medium text-muted-foreground mb-1">Urgent leads by distance</div>
            {leadsInRange.length === 0 ? (
              <div className="text-xs text-muted-foreground">No urgent leads within {RADIUS_MILES} miles.</div>
            ) : (
              <ul className="space-y-1 max-h-[45vh] overflow-y-auto pr-1">
                {leadsInRange.map((l) => {
                  const svcMatch = selectedTech.service && l.service_type &&
                    l.service_type.toLowerCase().includes(selectedTech.service.toLowerCase());
                  return (
                    <li key={l.id} className="rounded-md border p-2 text-xs hover:bg-muted/40 transition cursor-pointer" onClick={() => focusLead(l)}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{l.customer_name || "Unnamed"}</span>
                        <span className="text-muted-foreground shrink-0">{l.distance.toFixed(1)} mi</span>
                      </div>
                      <div className="text-muted-foreground truncate">{l.service_type || "—"}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {svcMatch ? <Badge variant="secondary" className="text-[10px]">Service Match</Badge> : selectedTech.service && <Badge variant="outline" className="text-[10px]">Different Service</Badge>}
                        <Button size="sm" variant="link" className="h-5 px-0 text-[11px]" onClick={(e) => { e.stopPropagation(); navigate(`/leads/${l.id}`); }}>View Lead →</Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      ) : (
        <div className="text-xs text-muted-foreground">Select a technician marker to see coverage and matching urgent leads.</div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Map View</h1>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
              <Users className="h-3 w-3" /> {mappedTechs.length} techs
              <span>·</span>
              <NavIcon className="h-3 w-3" /> {mappedLeads.length} urgent leads mapped
              {pendingCount > 0 && (
                <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  · {pendingCount} pending location processing
                  <Loader2 className="h-3 w-3 animate-spin" />
                </span>
              )}
              {unmappedLeads > 0 && (
                <>
                  <span>·</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="text-amber-600 dark:text-amber-400 underline-offset-2 hover:underline inline-flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> {unmappedLeads} unmapped
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[380px] p-0" align="start">
                      <div className="p-3 border-b">
                        <div className="text-xs font-semibold">Unmapped urgent leads</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Leads without a usable ZIP code cannot be placed on the map.
                        </div>
                      </div>
                      <ul className="max-h-[360px] overflow-y-auto divide-y">
                        {unmappedLeadList.map((l) => {
                          const reason = unmappedReasons[l.id];
                          const label =
                            reason === "zip_missing" ? "ZIP code missing" :
                            reason === "zip_invalid" ? "Invalid ZIP code" :
                            reason === "zip_not_found" ? "ZIP code not found in dataset" :
                            "ZIP code missing";
                          return (
                            <li key={l.id} className="p-2.5 text-xs">
                              <div className="min-w-0">
                                <div className="font-medium truncate">{l.customer_name || "Unnamed"}</div>
                                <div className="text-muted-foreground truncate">{fullAddress(l) || "—"}</div>
                                <div className="text-[11px] mt-0.5 text-amber-600 dark:text-amber-400">{label}</div>
                              </div>
                            </li>
                          );
                        })}
                        {unmappedLeadList.length === 0 && (
                          <li className="p-3 text-xs text-muted-foreground">All urgent leads are mapped.</li>
                        )}
                      </ul>
                    </PopoverContent>
                  </Popover>
                </>
              )}
              {geocoding && pendingCount === 0 && <Loader2 className="h-3 w-3 animate-spin" />}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1.5 h-4 w-4" /> Import Technicians
          </Button>
          <Button size="sm" onClick={() => { setEditTech(null); setAddOpen(true); }}>
            <Plus className="mr-1.5 h-4 w-4" /> Add Technician
          </Button>
        </div>
      </div>

      <Card className="border-border/60">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border bg-card p-0.5 gap-0.5">
              {(["both", "urgent", "technicians"] as EntityFilter[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setEntityFilter(v)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                    entityFilter === v ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {v === "both" ? "Both" : v === "urgent" ? "Urgent Leads" : "Technicians"}
                </button>
              ))}
            </div>
            <Select value={serviceFilter} onValueChange={setServiceFilter}>
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue placeholder="All services" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All services</SelectItem>
                {services.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={techSearch}
                onChange={(e) => setTechSearch(e.target.value)}
                placeholder="Search technician"
                className="h-8 w-[200px] pl-7 text-xs"
              />
            </div>
            <div className="ml-auto flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500 border border-white" /> Urgent Lead</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-blue-500 border border-white" /> Technician</span>
              {selectedTech && <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border-2 border-blue-500 bg-blue-500/10" /> 50-mile radius</span>}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <Card className="overflow-hidden border-border/60">
          <div ref={mapEl} className="h-[calc(100vh-260px)] min-h-[420px] w-full" />
        </Card>

        {isMobile ? (
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
              <SheetHeader><SheetTitle>Technician</SheetTitle></SheetHeader>
              <div className="pt-3">{SidePanel}</div>
            </SheetContent>
          </Sheet>
        ) : (
          <Card className="border-border/60">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-3">
                <Contact className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Technician</span>
              </div>
              {SidePanel}
            </CardContent>
          </Card>
        )}
      </div>

      <TechnicianDialog
        open={addOpen || editTech !== null}
        onOpenChange={(o) => { if (!o) { setAddOpen(false); setEditTech(null); } }}
        technician={editTech}
        onSaved={refresh}
      />
      <ImportTechniciansDialog open={importOpen} onOpenChange={setImportOpen} onImported={refresh} />

      <AlertDialog open={!!deleteTech} onOpenChange={(o) => !o && setDeleteTech(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this technician?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTech?.name} will be permanently removed from the Map View. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function escapeHtml(v: string) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
