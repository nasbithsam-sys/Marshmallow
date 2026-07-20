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
import { MapPin, Plus, Upload, Search, Wrench, Loader2, X, Users, Navigation as NavIcon, RefreshCw, AlertTriangle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TechnicianDialog, TechnicianRecord } from "@/components/technicians/TechnicianDialog";
import { ImportTechniciansDialog } from "@/components/technicians/ImportTechniciansDialog";
import { haversineMiles, geocodeAddress, geocodeWithFallback, isValidLatLng, buildGeocodeQueries, normalizeAddress, LatLng, GeocodeFailReason } from "@/lib/geo";
import { STATUS_LABELS } from "@/lib/constants";
import { toast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import type { LeadStatus } from "@/types";

const RADIUS_MILES = 50;
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
}

interface MappedTech extends TechnicianRecord {
  coords: LatLng;
}

type EntityFilter = "both" | "urgent" | "technicians";

function leadMarkerIcon() {
  return L.divIcon({
    className: "marshmallow-lead-marker",
    html: `<div style="width:22px;height:22px;border-radius:50%;background:#ef4444;border:2px solid #fff;box-shadow:0 2px 6px rgba(239,68,68,0.6);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700">!</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function techMarkerIcon(selected: boolean) {
  const color = selected ? "#2563eb" : "#3b82f6";
  return L.divIcon({
    className: "marshmallow-tech-marker",
    html: `<div style="width:26px;height:26px;border-radius:8px;background:${color};border:2px solid #fff;box-shadow:0 3px 8px rgba(59,130,246,${selected ? 0.75 : 0.55});display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;transform:rotate(-4deg)">T</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
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
  const [entityFilter, setEntityFilter] = useState<EntityFilter>("both");
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [techSearch, setTechSearch] = useState("");
  const [onlyInRange, setOnlyInRange] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  // Reason per unmapped lead id
  const [unmappedReasons, setUnmappedReasons] = useState<Record<string, GeocodeFailReason | "invalid_existing" | "queued">>({});
  const [processedIds, setProcessedIds] = useState<Set<string>>(() => new Set());

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

  const leadNeedsGeo = (l: UrgentLead) => !isValidLatLng(l.latitude, l.longitude);

  // Controlled geocoding queue: uses fallback + duplicate-address dedupe;
  // persists coords back to Supabase; updates markers as they resolve.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const techsNeedGeo = (techniciansQuery.data ?? []).filter((t) => !isValidLatLng(t.latitude, t.longitude));
      const allLeads = urgentLeadsQuery.data ?? [];
      const invalidExisting: UrgentLead[] = [];
      const needsGeo: UrgentLead[] = [];
      for (const l of allLeads) {
        if (isValidLatLng(l.latitude, l.longitude)) continue;
        if (l.latitude != null || l.longitude != null) invalidExisting.push(l);
        needsGeo.push(l);
      }
      // Seed reasons: pending + invalid_existing
      setUnmappedReasons((prev) => {
        const next = { ...prev };
        for (const l of needsGeo) if (!processedIds.has(l.id) && !next[l.id]) next[l.id] = "queued";
        for (const l of invalidExisting) next[l.id] = "invalid_existing";
        return next;
      });

      if (!techsNeedGeo.length && !needsGeo.length) return;
      setGeocoding(true);

      for (const t of techsNeedGeo) {
        if (cancelled) break;
        const c = await geocodeAddress(t.area);
        if (c) await supabase.from("technicians").update({ latitude: c.latitude, longitude: c.longitude }).eq("id", t.id);
      }

      // Dedupe leads by normalized address query set — geocode each address once.
      const groups = new Map<string, UrgentLead[]>();
      for (const l of needsGeo) {
        if (processedIds.has(l.id)) continue;
        const queries = buildGeocodeQueries({ address: l.address, city: l.city, state: l.state, zip: l.zip_code });
        const key = queries[0] ? normalizeAddress(queries[0]) : `__no_input__${l.id}`;
        const arr = groups.get(key) ?? [];
        arr.push(l);
        groups.set(key, arr);
      }

      for (const [, leadsForKey] of groups) {
        if (cancelled) break;
        const first = leadsForKey[0];
        const result = await geocodeWithFallback({
          address: first.address, city: first.city, state: first.state, zip: first.zip_code,
        });
        if (cancelled) break;
        setProcessedIds((prev) => {
          const s = new Set(prev);
          for (const l of leadsForKey) s.add(l.id);
          return s;
        });
        if (result.coords) {
          const { latitude, longitude } = result.coords;
          // Persist to every matching lead individually (safe, small volume).
          for (const l of leadsForKey) {
            const { error } = await supabase.from("leads")
              .update({ latitude, longitude })
              .eq("id", l.id);
            if (error) {
              setUnmappedReasons((prev) => ({ ...prev, [l.id]: "request_failed" }));
            }
          }
          setUnmappedReasons((prev) => {
            const next = { ...prev };
            for (const l of leadsForKey) delete next[l.id];
            return next;
          });
          // Optimistically update React Query cache so markers appear immediately.
          qc.setQueryData<UrgentLead[]>(["map-urgent-leads"], (old) =>
            (old ?? []).map((r) => leadsForKey.find((x) => x.id === r.id) ? { ...r, latitude, longitude } : r),
          );
        } else {
          setUnmappedReasons((prev) => {
            const next = { ...prev };
            for (const l of leadsForKey) next[l.id] = result.reason ?? "no_result";
            return next;
          });
        }
      }

      if (!cancelled) {
        setGeocoding(false);
        qc.invalidateQueries({ queryKey: ["technicians"] });
      }
    };
    void run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urgentLeadsQuery.data, techniciansQuery.data, retryTick]);

  const retryUnmapped = () => {
    setProcessedIds(new Set());
    setUnmappedReasons({});
    setRetryTick((t) => t + 1);
  };

  const retrySingleLead = async (lead: UrgentLead) => {
    setUnmappedReasons((prev) => ({ ...prev, [lead.id]: "queued" }));
    const result = await geocodeWithFallback({ address: lead.address, city: lead.city, state: lead.state, zip: lead.zip_code });
    if (result.coords) {
      const { latitude, longitude } = result.coords;
      await supabase.from("leads").update({ latitude, longitude }).eq("id", lead.id);
      qc.setQueryData<UrgentLead[]>(["map-urgent-leads"], (old) =>
        (old ?? []).map((r) => r.id === lead.id ? { ...r, latitude, longitude } : r),
      );
      setUnmappedReasons((prev) => { const n = { ...prev }; delete n[lead.id]; return n; });
    } else {
      setUnmappedReasons((prev) => ({ ...prev, [lead.id]: result.reason ?? "no_result" }));
    }
  };

  const mappedLeads = useMemo<MappedLead[]>(() => {
    const rows = urgentLeadsQuery.data ?? [];
    return rows
      .filter((l) => isValidLatLng(l.latitude, l.longitude))
      .map((l) => ({ ...l, coords: { latitude: l.latitude as number, longitude: l.longitude as number } }));
  }, [urgentLeadsQuery.data]);

  const unmappedLeadList = useMemo(() => {
    const rows = urgentLeadsQuery.data ?? [];
    return rows.filter((l) => !isValidLatLng(l.latitude, l.longitude));
  }, [urgentLeadsQuery.data]);

  const unmappedLeads = unmappedLeadList.length;
  const pendingCount = unmappedLeadList.filter((l) => (unmappedReasons[l.id] ?? "queued") === "queued").length;

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
    for (const l of visibleLeads) {
      const m = L.marker([l.coords.latitude, l.coords.longitude], { icon: leadMarkerIcon() });
      const dist = l.distance != null ? `<div style="font-size:11px;color:#6b7280;margin-top:4px">${l.distance.toFixed(1)} mi from selected technician</div>` : "";
      m.bindPopup(`
        <div style="min-width:220px;font-family:inherit">
          <div style="font-weight:600;font-size:13px">${escapeHtml(l.customer_name || "Unnamed")}</div>
          <div style="font-size:11px;color:#6b7280">Job ${escapeHtml(l.job_id ?? "")}</div>
          <div style="margin-top:6px;font-size:12px">${escapeHtml(l.customer_phone || "")}</div>
          <div style="font-size:12px;color:#6b7280">${escapeHtml(fullAddress(l))}</div>
          <div style="margin-top:6px;font-size:12px"><b>Service:</b> ${escapeHtml(l.service_type || "—")}</div>
          <div style="font-size:12px"><b>Status:</b> ${escapeHtml(STATUS_LABELS[l.status] ?? l.status)}</div>
          ${dist}
          <button data-lead-id="${l.id}" class="ml-view-lead" style="margin-top:8px;padding:6px 10px;background:#111827;color:#fff;border:none;border-radius:6px;font-size:12px;cursor:pointer">View Lead</button>
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
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
              <Users className="h-3 w-3" /> {mappedTechs.length} techs
              <span>·</span>
              <NavIcon className="h-3 w-3" /> {mappedLeads.length} urgent leads mapped
              {unmappedLeads > 0 && <span className="text-amber-600 dark:text-amber-400">· {unmappedLeads} unmapped</span>}
              {geocoding && <Loader2 className="h-3 w-3 animate-spin" />}
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
                <Wrench className="h-4 w-4 text-muted-foreground" />
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
