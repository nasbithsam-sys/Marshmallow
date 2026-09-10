import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, CornerDownRight, ArrowUpRight, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import StatusBadge from "./StatusBadge";
import { countGroupedLeads, groupLeadsByArea, type AreaLead } from "@/lib/lead-areas";
import type { LeadStatus } from "@/types";

interface Props {
  leads: AreaLead[];
  /** The area currently being viewed, so the open one can be marked. */
  activeArea?: string | null;
  /** Switches the list into the area view for this city. */
  onSelectArea: (areaLabel: string) => void;
}

/**
 * Open leads that share a city, surfaced next to the search bar so several jobs in one area are
 * obvious rather than something you notice by chance while scrolling.
 */
export default function SameAreaLeadsPanel({ leads, activeArea, onSelectArea }: Props) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const groups = useMemo(() => groupLeadsByArea(leads), [leads]);
  const groupedLeadCount = countGroupedLeads(groups);

  if (groups.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="crm-lead-card-inner h-11 w-full shrink-0 gap-2 rounded-[18px] border-amber-400/60 bg-amber-400/10 px-3 text-[13px] font-semibold text-amber-700 hover:bg-amber-400/20 dark:border-amber-400/35 dark:text-amber-300 sm:w-auto"
        >
          {/* Blinks only while there is something in it - the ping stops when the panel is open
              so it does not pulse in the user's face while they read it. */}
          <span className="relative flex h-2 w-2">
            {!open && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" />
            )}
            <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
          </span>
          <MapPin className="h-3.5 w-3.5" />
          Same area
          <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[11px] tabular-nums">
            {groupedLeadCount}
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-[340px] p-0">
        <div className="border-b border-border/40 px-3 py-2">
          <p className="text-[12px] font-semibold text-foreground">Leads in the same area</p>
          <p className="text-[11px] text-muted-foreground">
            {groups.length === 1 ? "1 city" : `${groups.length} cities`} with more than one open
            lead - open a city to see just those leads
          </p>
        </div>

        <div className="max-h-[380px] space-y-3 overflow-y-auto p-3">
          {groups.map((group) => (
            <div
              key={group.key}
              className={`rounded-xl border p-2.5 ${
                activeArea && activeArea.toLowerCase() === group.label.toLowerCase()
                  ? "border-amber-400/70 bg-amber-400/10"
                  : "border-border/60 bg-muted/25"
              }`}
            >
              {/* The city itself opens the area view - the whole list becomes this city. */}
              <button
                type="button"
                onClick={() => {
                  onSelectArea(group.label);
                  setOpen(false);
                }}
                title={`Open ${group.label} in the leads list`}
                className="group mb-1.5 flex w-full items-center justify-between gap-2 rounded-lg px-1 py-0.5 text-left transition-colors hover:bg-background"
              >
                <span className="flex min-w-0 items-center gap-1.5 text-[12px] font-semibold text-foreground">
                  <MapPin className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span className="truncate">{group.label}</span>
                  <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                    {group.leads.length}
                  </span>
                </span>

                <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                  <LayoutGrid className="h-3 w-3" />
                  Open
                </span>
              </button>

              {/* The chain makes the point visually: these are one trip, not three separate jobs. */}
              <ul className="relative space-y-0.5 pl-1">
                {group.leads.map((lead, index) => (
                  <li key={lead.id} className="flex items-start gap-1.5">
                    <span className="mt-1.5 flex w-3 shrink-0 justify-center text-amber-500/70">
                      {index === 0 ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      ) : (
                        <CornerDownRight className="h-3 w-3" />
                      )}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        navigate(`/leads/${lead.id}`);
                      }}
                      className="group flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-background"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[12px] font-medium text-foreground">
                          {lead.customer_name || "Lead"}
                        </span>
                        {lead.address && (
                          <span className="block truncate text-[10.5px] text-muted-foreground">
                            {lead.address}
                          </span>
                        )}
                      </span>

                      <span className="flex shrink-0 items-center gap-1">
                        <StatusBadge status={lead.status as LeadStatus} size="sm" />
                        <ArrowUpRight className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
