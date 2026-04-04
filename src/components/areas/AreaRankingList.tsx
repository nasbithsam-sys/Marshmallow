import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { TrendingUp } from "lucide-react";

export interface AreaItem {
  name: string;
  count: number;
}

const AREA_COLORS = [
  "hsl(221, 83%, 53%)", "hsl(142, 71%, 45%)", "hsl(38, 92%, 50%)",
  "hsl(263, 70%, 58%)", "hsl(0, 84%, 60%)", "hsl(189, 94%, 43%)",
  "hsl(347, 77%, 50%)", "hsl(85, 78%, 42%)", "hsl(25, 95%, 53%)",
  "hsl(160, 60%, 45%)",
];

interface AreaRankingListProps {
  areas: AreaItem[];
  totalLeads: number;
  selectedArea: string | null;
  onSelectArea: (name: string | null) => void;
  label: string;
}

export default function AreaRankingList({ areas, totalLeads, selectedArea, onSelectArea, label }: AreaRankingListProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
          {areas.length} items
        </span>
      </div>
      <ScrollArea className="h-[420px] pr-1">
        <div className="space-y-1.5">
          {areas.map((area, i) => {
            const pct = totalLeads > 0 ? (area.count / totalLeads) * 100 : 0;
            const isSelected = selectedArea === area.name;
            return (
              <button
                key={area.name}
                onClick={() => onSelectArea(isSelected ? null : area.name)}
                className={cn(
                  "w-full text-left rounded-xl px-3.5 py-3 transition-all duration-200 border group",
                  isSelected
                    ? "border-primary/40 bg-primary/[0.06] shadow-sm shadow-primary/10"
                    : "border-transparent hover:bg-muted/60 hover:border-border/60"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="block h-3 w-3 rounded-full shrink-0 ring-2 ring-background"
                      style={{ backgroundColor: AREA_COLORS[i % AREA_COLORS.length] }}
                    />
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-muted-foreground/60 w-5">#{i + 1}</span>
                      <span className="text-sm font-medium text-foreground truncate max-w-[130px]">
                        {area.name}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground tabular-nums">{area.count}</span>
                    <span className="text-[10px] text-muted-foreground font-mono w-12 text-right tabular-nums">
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${Math.max(pct, 1)}%`,
                      backgroundColor: AREA_COLORS[i % AREA_COLORS.length],
                      opacity: isSelected ? 1 : 0.7,
                    }}
                  />
                </div>
              </button>
            );
          })}
          {areas.length === 0 && (
            <div className="text-center py-12">
              <TrendingUp className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No data for this period</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Try adjusting your date range or filters</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export { AREA_COLORS };