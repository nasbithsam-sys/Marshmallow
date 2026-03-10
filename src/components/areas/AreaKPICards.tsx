import { Card, CardContent } from "@/components/ui/card";
import { Lead } from "@/lib/constants";
import { extractCity } from "@/lib/address-utils";
import { Building2, MapPin, TrendingUp, Wrench, CheckCircle, XCircle, BarChart3 } from "lucide-react";
import React from "react";
import type { LeadStatus } from "@/lib/constants";

type TabType = "all" | "closed" | "cancelled";

const CLOSED_STATUSES: LeadStatus[] = ["job_done", "paid"];
const CANCELLED_STATUSES: LeadStatus[] = ["cancelled"];

interface AreaKPICardsProps {
  leads: Lead[];
  allLeads: Lead[];
  activeTab: TabType;
}

function KPICard({ title, value, subtitle, icon: Icon, accentClass }: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  accentClass?: string;
}) {
  return (
    <Card className="group border-border/40 hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 overflow-hidden relative">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <CardContent className="p-5 flex items-center gap-4 relative">
        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 ${accentClass || "bg-primary/10 text-primary"}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-[0.12em] mb-0.5">{title}</p>
          <p className="text-2xl font-bold text-foreground leading-tight truncate tracking-tight">{value}</p>
          {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function getTopByField(leads: Lead[], extract: (l: Lead) => string): { name: string; count: number } | null {
  const counts: Record<string, number> = {};
  leads.forEach((l) => {
    const key = extract(l);
    counts[key] = (counts[key] || 0) + 1;
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted.length > 0 ? { name: sorted[0][0], count: sorted[0][1] } : null;
}

export default function AreaKPICards({ leads, allLeads, activeTab }: AreaKPICardsProps) {
  const topCity = getTopByField(leads, (l) => l.city || extractCity(l.address));
  const topService = getTopByField(leads, (l) => l.service_type || "Unknown");
  const uniqueCities = new Set(leads.map((l) => l.city || extractCity(l.address))).size;

  if (activeTab === "closed") {
    const rate = allLeads.length > 0 ? ((leads.length / allLeads.length) * 100).toFixed(1) : "0";
    return (
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KPICard title="Total Closed" value={leads.length} icon={CheckCircle} accentClass="bg-emerald-500/10 text-emerald-600" />
        <KPICard title="Closure Rate" value={`${rate}%`} subtitle={`of ${allLeads.length} total`} icon={TrendingUp} accentClass="bg-emerald-500/10 text-emerald-600" />
        <KPICard title="Top Closing City" value={topCity?.name || "—"} subtitle={topCity ? `${topCity.count} closed` : ""} icon={MapPin} />
        <KPICard title="Top Closing Service" value={topService?.name || "—"} subtitle={topService ? `${topService.count} closed` : ""} icon={Wrench} />
      </div>
    );
  }

  if (activeTab === "cancelled") {
    const rate = allLeads.length > 0 ? ((leads.length / allLeads.length) * 100).toFixed(1) : "0";
    return (
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KPICard title="Total Cancelled" value={leads.length} icon={XCircle} accentClass="bg-destructive/10 text-destructive" />
        <KPICard title="Cancel Rate" value={`${rate}%`} subtitle={`of ${allLeads.length} total`} icon={TrendingUp} accentClass="bg-destructive/10 text-destructive" />
        <KPICard title="Highest Cancel City" value={topCity?.name || "—"} subtitle={topCity ? `${topCity.count} cancelled` : ""} icon={MapPin} />
        <KPICard title="Highest Cancel Service" value={topService?.name || "—"} subtitle={topService ? `${topService.count} cancelled` : ""} icon={Wrench} />
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      <KPICard title="Total Leads" value={leads.length} icon={BarChart3} />
      <KPICard title="Total Areas" value={uniqueCities} icon={Building2} />
      <KPICard title="Top City" value={topCity?.name || "—"} subtitle={topCity ? `${topCity.count} leads` : ""} icon={MapPin} />
      <KPICard title="Top Service" value={topService?.name || "—"} subtitle={topService ? `${topService.count} leads` : ""} icon={Wrench} />
    </div>
  );
}