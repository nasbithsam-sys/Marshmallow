import { Lead } from "@/lib/constants";
import { extractCity } from "@/lib/address-utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMemo } from "react";
import { Grid3X3 } from "lucide-react";

interface AreaCrossTabProps {
  leads: Lead[];
  topN: number;
  searchQuery: string;
}

export default function AreaCrossTab({ leads, topN, searchQuery }: AreaCrossTabProps) {
  const { cities, services, matrix } = useMemo(() => {
    const m = new Map<string, Map<string, number>>();
    const serviceTotals: Record<string, number> = {};
    const cityTotals: Record<string, number> = {};

    leads.forEach((l) => {
      const city = l.city || extractCity(l.address);
      const service = l.service_type || "Unknown";
      if (!m.has(city)) m.set(city, new Map());
      const row = m.get(city)!;
      row.set(service, (row.get(service) || 0) + 1);
      serviceTotals[service] = (serviceTotals[service] || 0) + 1;
      cityTotals[city] = (cityTotals[city] || 0) + 1;
    });

    let sortedCities = Object.entries(cityTotals).sort((a, b) => b[1] - a[1]);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      sortedCities = sortedCities.filter(([name]) => name.toLowerCase().includes(q));
    }
    sortedCities = sortedCities.slice(0, topN);

    const sortedServices = Object.entries(serviceTotals).sort((a, b) => b[1] - a[1]).map(([s]) => s);

    return {
      cities: sortedCities.map(([name, total]) => ({ name, total })),
      services: sortedServices,
      matrix: m,
    };
  }, [leads, topN, searchQuery]);

  if (cities.length === 0) {
    return (
      <div className="text-center py-16">
        <Grid3X3 className="h-12 w-12 text-muted-foreground/25 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No cross-tab data available</p>
      </div>
    );
  }

  const maxCount = Math.max(...cities.flatMap((c) => services.map((s) => matrix.get(c.name)?.get(s) || 0)), 1);

  return (
    <ScrollArea className="h-[500px]">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border/40">
              <TableHead className="sticky left-0 bg-card z-10 min-w-[140px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                City
              </TableHead>
              {services.map((s) => (
                <TableHead key={s} className="text-center text-[11px] font-semibold min-w-[100px] text-muted-foreground">
                  {s}
                </TableHead>
              ))}
              <TableHead className="text-center text-[11px] font-bold uppercase tracking-wider text-foreground min-w-[70px]">
                Total
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cities.map((city, rowIdx) => {
              const row = matrix.get(city.name);
              return (
                <TableRow key={city.name} className="border-border/30 hover:bg-muted/40 transition-colors">
                  <TableCell className="sticky left-0 bg-card z-10 font-medium text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono text-muted-foreground/50">#{rowIdx + 1}</span>
                      {city.name}
                    </div>
                  </TableCell>
                  {services.map((s) => {
                    const count = row?.get(s) || 0;
                    const intensity = count > 0 ? Math.max(0.08, (count / maxCount) * 0.35) : 0;
                    return (
                      <TableCell key={s} className="text-center p-1.5">
                        {count > 0 ? (
                          <span
                            className="inline-flex items-center justify-center h-8 min-w-[2rem] px-2 rounded-lg font-semibold text-xs transition-all"
                            style={{
                              backgroundColor: `hsl(221 83% 53% / ${intensity})`,
                              color: intensity > 0.2 ? "hsl(221, 83%, 40%)" : "hsl(var(--foreground))",
                            }}
                          >
                            {count}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/25 text-xs">·</span>
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-center">
                    <span className="font-bold text-sm text-foreground tabular-nums">{city.total}</span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </ScrollArea>
  );
}