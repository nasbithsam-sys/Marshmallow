import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Loader2, Navigation as NavIcon, AlertTriangle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { isValidLatLng, LatLng } from "@/lib/geo";
import { resolveZip, lookupZipCentroidSync, preloadZipDataset, ZipCentroid } from "@/lib/zipCentroids";
import { STATUS_LABELS } from "@/lib/constants";
import type { LeadStatus } from "@/types";

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
}

type ZipUnmappedReason = "zip_missing" | "zip_invalid" | "zip_not_found";

function pinSvg(fill: string, stroke: string, size = 32) {
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

function fullAddress(lead: UrgentLead) {
  return [lead.address, lead.city, lead.state, lead.zip_code].filter((p) => p && String(p).trim()).join(", ");
}

function escapeHtml(v: string) {
  return String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export default function MapViewPage() {
  const navigate = useNavigate();

  const mapRef = useRef<L.Map | null>(null);
  const mapEl = useRef<HTMLDivElement | null>(null);
  const leadLayer = useRef<L.LayerGroup | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    preloadZipDataset().finally(() => { if (!cancelled) setZipDatasetReady(true); });
    return () => { cancelled = true; };
  }, []);

  const { mappedLeads, unmappedLeadList, unmappedReasons } = useMemo(() => {
    const rows = urgentLeadsQuery.data ?? [];
    const mapped: MappedLead[] = [];
    const unmapped: UrgentLead[] = [];
    const reasons: Record<string, ZipUnmappedReason> = {};
    for (const l of rows) {
      const zip = resolveZip({ zip_code: l.zip_code, address: l.address });
      if (!zip) {
        const hasAnyDigits = /\d/.test(String(l.zip_code ?? "")) || /\d/.test(String(l.address ?? ""));
        reasons[l.id] = hasAnyDigits ? "zip_invalid" : "zip_missing";
        unmapped.push(l);
        continue;
      }
      const centroid: ZipCentroid | null = zipDatasetReady ? lookupZipCentroidSync(zip) : null;
      if (!centroid) {
        reasons[l.id] = "zip_not_found";
        unmapped.push(l);
        continue;
      }
      mapped.push({
        ...l,
        coords: { latitude: centroid.latitude, longitude: centroid.longitude },
        zip,
        zipCity: centroid.city,
        zipState: centroid.state,
      });
    }
    return { mappedLeads: mapped, unmappedLeadList: unmapped, unmappedReasons: reasons };
  }, [urgentLeadsQuery.data, zipDatasetReady]);

  const unmappedLeads = unmappedLeadList.length;
  const pendingCount = zipDatasetReady ? 0 : unmappedLeadList.length;

  // Init map when visible.
  useEffect(() => {
    if (!mapVisible) return;
    if (mapRef.current || !mapEl.current) return;
    const map = L.map(mapEl.current, { zoomControl: true, preferCanvas: true }).setView([39.5, -98.35], 4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap" }).addTo(map);
    leadLayer.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 50);
    return () => {
      map.remove();
      mapRef.current = null;
      leadLayer.current = null;
    };
  }, [mapVisible]);

  // Render urgent lead markers.
  useEffect(() => {
    const layer = leadLayer.current;
    if (!layer) return;
    layer.clearLayers();
    const jitter = (id: string, salt: number) => {
      let h = 0;
      for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i) + salt) | 0;
      return (((h % 1000) / 500) - 1) * 0.0015;
    };
    for (const l of mappedLeads) {
      const lat = l.coords.latitude + jitter(l.id, 1);
      const lng = l.coords.longitude + jitter(l.id, 7);
      const m = L.marker([lat, lng], { icon: leadMarkerIcon() });
      const zipCity = [l.zipCity, l.zipState].filter(Boolean).join(", ");
      m.bindPopup(`
        <div style="min-width:230px;font-family:inherit">
          <div style="font-weight:600;font-size:13px">${escapeHtml(l.customer_name || "Unnamed")}</div>
          <div style="font-size:11px;color:#6b7280">Job ${escapeHtml(l.job_id ?? "")}</div>
          <div style="margin-top:6px;font-size:12px">${escapeHtml(l.customer_phone || "")}</div>
          <div style="font-size:12px"><b>ZIP:</b> ${escapeHtml(l.zip)}${zipCity ? ` <span style="color:#6b7280">· ${escapeHtml(zipCity)}</span>` : ""}</div>
          <div style="margin-top:6px;font-size:12px"><b>Service:</b> ${escapeHtml(l.service_type || "—")}</div>
          <div style="font-size:12px"><b>Status:</b> ${escapeHtml(STATUS_LABELS[l.status] ?? l.status)}</div>
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
  }, [mappedLeads, navigate, mapVisible]);

  useEffect(() => {
    if (!mapVisible) return;
    const map = mapRef.current;
    if (!map) return;
    const t = setTimeout(() => map.invalidateSize(), 60);
    return () => clearTimeout(t);
  }, [mapVisible]);

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
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5">
            <Label htmlFor="map-visible-toggle" className="text-[11px] font-medium text-foreground cursor-pointer">
              Map View
            </Label>
            <Switch id="map-visible-toggle" checked={mapVisible} onCheckedChange={setMapVisible} />
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{mapVisible ? "On" : "Off"}</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-500 border border-white" /> Urgent Lead</span>
          </div>
        </div>
      </div>

      {mapVisible && (
        <Card className="overflow-hidden border-border/60">
          <div ref={mapEl} className="h-[calc(100vh-220px)] min-h-[420px] w-full" />
        </Card>
      )}

      {!mapVisible && (
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="text-xs font-medium text-muted-foreground mb-2">Urgent leads ({mappedLeads.length + unmappedLeads})</div>
            <ul className="divide-y max-h-[calc(100vh-260px)] overflow-y-auto">
              {[...mappedLeads, ...unmappedLeadList].map((l) => (
                <li key={l.id} className="py-2 px-1 text-xs hover:bg-muted/40 rounded cursor-pointer" onClick={() => navigate(`/leads/${l.id}`)}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{l.customer_name || "Unnamed"}</span>
                    <span className="text-muted-foreground shrink-0">{l.service_type || "—"}</span>
                  </div>
                  <div className="text-muted-foreground truncate">{fullAddress(l) || "—"}</div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
