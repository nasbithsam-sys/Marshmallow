import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Lead } from "@/lib/constants";
import { useAllowedStatuses } from "@/hooks/useAllowedStatuses";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ChevronLeft, ChevronRight, Clock, MapPin, Phone, User, Calendar, Wrench, ArrowUpRight } from "lucide-react";
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, isAfter, isBefore } from "date-fns";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import StatusBadge from "@/components/leads/StatusBadge";

const EMPLOYEE_COLORS = [
  "bg-gradient-to-br from-blue-500 to-blue-600 text-white",
  "bg-gradient-to-br from-amber-500 to-amber-600 text-white",
  "bg-gradient-to-br from-rose-500 to-rose-600 text-white",
  "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white",
  "bg-gradient-to-br from-violet-500 to-violet-600 text-white",
  "bg-gradient-to-br from-cyan-500 to-cyan-600 text-white",
  "bg-gradient-to-br from-orange-500 to-orange-600 text-white",
  "bg-gradient-to-br from-pink-500 to-pink-600 text-white",
];

const STATUS_BLOCK_COLORS: Record<string, string> = {
  urgent_job: "bg-gradient-to-r from-red-500 to-red-600 border-red-700/20",
  cancelled: "bg-gradient-to-r from-yellow-500 to-yellow-600 border-yellow-700/20",
  job_done: "bg-gradient-to-r from-emerald-400 to-emerald-500 border-emerald-600/20",
  paid: "bg-gradient-to-r from-green-500 to-green-600 border-green-700/20",
};

const DEFAULT_BLOCK_COLOR = "bg-gradient-to-r from-blue-500 to-blue-600 border-blue-700/20";
const getBlockColor = (status: string) => STATUS_BLOCK_COLORS[status] || DEFAULT_BLOCK_COLOR;

export default function SchedulePage() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [viewMode, setViewMode] = useState<"week" | "day">("day");
  const [selectedDay, setSelectedDay] = useState(() => new Date());

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [appliedFromDate, setAppliedFromDate] = useState("");
  const [appliedToDate, setAppliedToDate] = useState("");

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);

  const hasCustomRange = !!appliedFromDate && !!appliedToDate;

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const rangeDays = useMemo(() => {
    if (!hasCustomRange) return [];

    const start = new Date(appliedFromDate + "T00:00:00");
    const end = new Date(appliedToDate + "T00:00:00");

    if (isAfter(start, end)) return [];

    const days: Date[] = [];
    let current = start;

    while (!isAfter(current, end)) {
      days.push(current);
      current = addDays(current, 1);
    }

    return days;
  }, [appliedFromDate, appliedToDate, hasCustomRange]);

  const displayDays = useMemo(() => {
    if (hasCustomRange) return rangeDays;
    return viewMode === "day" ? [selectedDay] : weekDays;
  }, [hasCustomRange, rangeDays, viewMode, selectedDay, weekDays]);

  useEffect(() => {
    fetchData();
  }, [weekStart, appliedFromDate, appliedToDate]);

  const fetchData = async () => {
    setLoading(true);

    let startStr: string;
    let endStr: string;

    if (hasCustomRange) {
      startStr = appliedFromDate;
      endStr = appliedToDate;
    } else {
      startStr = format(weekStart, "yyyy-MM-dd");
      endStr = format(addDays(weekStart, 6), "yyyy-MM-dd");
    }

    const [leadsRes, profilesRes] = await Promise.all([
      supabase
        .from("leads")
        .select("*")
        .not("scheduled_date", "is", null)
        .gte("scheduled_date", startStr)
        .lte("scheduled_date", endStr),
      supabase.from("profiles").select("id, full_name"),
    ]);

    if (leadsRes.data) setLeads(leadsRes.data as Lead[]);

    if (profilesRes.data) {
      const map: Record<string, string> = {};
      profilesRes.data.forEach((p: any) => {
        map[p.id] = p.full_name;
      });
      setProfiles(map);
    }

    setLoading(false);
  };

  const { filterLeads } = useAllowedStatuses();
  const filteredLeads = useMemo(() => filterLeads(leads), [leads, filterLeads]);

  const getLeadsForDay = (day: Date) =>
    filteredLeads.filter((l) => l.scheduled_date && isSameDay(new Date(l.scheduled_date + "T00:00:00"), day));

  const computeRows = (dayLeads: Lead[]) => {
    const sorted = [...dayLeads].sort((a, b) =>
      (a.scheduled_time_start || "").localeCompare(b.scheduled_time_start || ""),
    );

    const rows: Lead[][] = [];

    for (const lead of sorted) {
      let placed = false;

      for (const row of rows) {
        const overlaps = row.some((existing) => {
          const aStart = existing.scheduled_time_start || "00:00";
          const aEnd = existing.scheduled_time_end || "23:59";
          const bStart = lead.scheduled_time_start || "00:00";
          const bEnd = lead.scheduled_time_end || "23:59";
          return bStart < aEnd && bEnd > aStart;
        });

        if (!overlaps) {
          row.push(lead);
          placed = true;
          break;
        }
      }

      if (!placed) rows.push([lead]);
    }

    return rows;
  };

  const getLeadPosition = (lead: Lead) => {
    if (!lead.scheduled_time_start) return null;

    const [h, m] = lead.scheduled_time_start.split(":").map(Number);
    const startHour = h + m / 60;

    let duration = 2;
    if (lead.scheduled_time_end) {
      const [eh, em] = lead.scheduled_time_end.split(":").map(Number);
      duration = eh + em / 60 - startHour;
    }

    const left = (startHour / 24) * 100;
    const width = (duration / 24) * 100;

    return { left: `${left}%`, width: `${Math.max(width, 3)}%` };
  };

  const formatTime = (t: string | null) => {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const handlePrev = () => {
    if (hasCustomRange) return;

    if (viewMode === "day") {
      const prev = addDays(selectedDay, -1);
      setSelectedDay(prev);
      if (isBefore(prev, weekStart)) setWeekStart(subWeeks(weekStart, 1));
    } else {
      setWeekStart(subWeeks(weekStart, 1));
    }
  };

  const handleNext = () => {
    if (hasCustomRange) return;

    if (viewMode === "day") {
      const next = addDays(selectedDay, 1);
      setSelectedDay(next);
      if (!isBefore(next, addDays(weekStart, 7))) setWeekStart(addWeeks(weekStart, 1));
    } else {
      setWeekStart(addWeeks(weekStart, 1));
    }
  };

  const handleToday = () => {
    const today = new Date();
    setSelectedDay(today);
    setWeekStart(startOfWeek(today, { weekStartsOn: 1 }));
    setFromDate("");
    setToDate("");
    setAppliedFromDate("");
    setAppliedToDate("");
  };

  const handleApplyRange = () => {
    if (!fromDate || !toDate) return;
    if (fromDate > toDate) return;

    setAppliedFromDate(fromDate);
    setAppliedToDate(toDate);

    const start = new Date(fromDate + "T00:00:00");
    setSelectedDay(start);
    setWeekStart(startOfWeek(start, { weekStartsOn: 1 }));
  };

  const handleClearRange = () => {
    setFromDate("");
    setToDate("");
    setAppliedFromDate("");
    setAppliedToDate("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xl sm:text-2xl font-bold tracking-tight"
        >
          Job Schedule
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-2 flex-wrap"
        >
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-xl border-border/50"
            onClick={handlePrev}
            disabled={hasCustomRange}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="px-4 font-medium rounded-xl border-border/50"
            onClick={handleToday}
          >
            Today
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-xl border-border/50"
            onClick={handleNext}
            disabled={hasCustomRange}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <span className="text-sm font-medium text-muted-foreground ml-2">
            {hasCustomRange
              ? `${format(new Date(appliedFromDate + "T00:00:00"), "MMM d, yyyy")} - ${format(
                  new Date(appliedToDate + "T00:00:00"),
                  "MMM d, yyyy",
                )}`
              : format(viewMode === "day" ? selectedDay : weekStart, "MMMM yyyy")}
          </span>

          <div className="flex items-center ml-4 bg-muted/50 rounded-xl p-0.5 border border-border/30">
            <button
              onClick={() => setViewMode("day")}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all duration-200 ${
                viewMode === "day"
                  ? "bg-card text-foreground shadow-premium-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              disabled={hasCustomRange}
            >
              Day
            </button>
            <button
              onClick={() => setViewMode("week")}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all duration-200 ${
                viewMode === "week"
                  ? "bg-card text-foreground shadow-premium-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              disabled={hasCustomRange}
            >
              Week
            </button>
          </div>
        </motion.div>
      </div>

      <Card className="border-border/40 rounded-2xl">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-muted-foreground">From</label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full lg:w-[180px]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-muted-foreground">To</label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full lg:w-[180px]"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleApplyRange} disabled={!fromDate || !toDate || fromDate > toDate}>
                Apply Range
              </Button>

              <Button variant="outline" onClick={handleClearRange}>
                Clear
              </Button>
            </div>

            {fromDate && toDate && fromDate > toDate && (
              <p className="text-sm text-destructive">From date cannot be after To date.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {displayDays.map((day, dayIdx) => {
        const dayLeads = getLeadsForDay(day);
        const rows = computeRows(dayLeads);

        return (
          <motion.div
            key={day.toISOString()}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: dayIdx * 0.05 + 0.15, duration: 0.4 }}
          >
            <div className="mb-3 flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-foreground">{format(day, "dd")}</span>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-foreground">{format(day, "EEEE")}</span>
                  <span className="text-[10px] text-muted-foreground">{format(day, "MMMM yyyy")}</span>
                </div>
              </div>
            </div>

            <Card className="border-border/40 overflow-hidden rounded-2xl shadow-premium-sm hover:shadow-premium-md transition-all duration-300">
              <CardContent className="p-0 overflow-x-auto">
                <div className="min-w-[1800px]">
                  <div className="flex border-b border-border/30 bg-gradient-to-r from-muted/20 to-transparent">
                    <div className="w-[110px] shrink-0 p-3 border-r border-border/20">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                        GMT {new Date().getTimezoneOffset() / -60 > 0 ? "+" : ""}
                        {new Date().getTimezoneOffset() / -60}
                      </span>
                    </div>

                    <div className="flex-1 flex">
                      {hours.map((h) => (
                        <div key={h} className="flex-1 px-1 py-3 text-center border-r border-border/15 last:border-r-0">
                          <span className="text-[10px] font-medium text-muted-foreground/60 tabular-nums">
                            {h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {loading ? (
                    <div className="p-10 text-center text-muted-foreground/50 text-sm">
                      <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/20 border-t-primary animate-spin mx-auto mb-3" />
                      Loading schedule...
                    </div>
                  ) : rows.length === 0 ? (
                    <div className="p-10 text-center text-muted-foreground/50 text-sm">
                      <Calendar className="h-8 w-8 mx-auto mb-2 text-muted-foreground/20" />
                      No scheduled jobs for this day
                    </div>
                  ) : (
                    rows.map((row, rowIndex) => (
                      <motion.div
                        key={rowIndex}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: rowIndex * 0.05 }}
                        className="flex border-b border-border/20 last:border-b-0 hover:bg-muted/5 transition-colors duration-200"
                      >
                        <div className="w-[110px] shrink-0 p-3 border-r border-border/20 flex items-center justify-center">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">
                            Row {rowIndex + 1}
                          </span>
                        </div>

                        <div className="flex-1 relative h-[68px]">
                          <div className="absolute inset-0 flex">
                            {hours.map((h) => (
                              <div key={h} className="flex-1 border-r border-border/10 last:border-r-0" />
                            ))}
                          </div>

                          {row.map((lead) => {
                            const pos = getLeadPosition(lead);
                            if (!pos) return null;

                            const empId = lead.assigned_cs || lead.created_by;
                            const empName = profiles[empId] || "Unknown";
                            const empColorIdx = Object.keys(profiles).indexOf(empId);
                            const colorClass = EMPLOYEE_COLORS[Math.abs(empColorIdx) % EMPLOYEE_COLORS.length];
                            const leadBlockColor = getBlockColor(lead.status);

                            return (
                              <motion.div
                                key={lead.id}
                                initial={{ opacity: 0, scale: 0.85 }}
                                animate={{ opacity: 1, scale: 1 }}
                                whileHover={{ scale: 1.03, zIndex: 10, y: -1 }}
                                className={`absolute top-2 bottom-2 rounded-xl px-3 py-1.5 cursor-pointer border text-white shadow-premium-md hover:shadow-premium-xl transition-all flex items-center gap-2 ${leadBlockColor}`}
                                style={{ left: pos.left, width: pos.width }}
                                onClick={() => setSelectedLead(lead)}
                              >
                                <Wrench className="h-3 w-3 shrink-0 opacity-80" />
                                <span className="text-[11px] font-semibold truncate">{lead.customer_name}</span>
                                <Avatar className="h-5 w-5 shrink-0 ml-auto ring-1 ring-white/20">
                                  <AvatarFallback className={`text-[7px] font-bold ${colorClass}`}>
                                    {getInitials(empName)}
                                  </AvatarFallback>
                                </Avatar>
                              </motion.div>
                            );
                          })}
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}

      <Dialog open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          {selectedLead && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <span className="text-lg">{selectedLead.customer_name}</span>
                  <StatusBadge status={selectedLead.status} size="sm" />
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                <div className="grid gap-3 text-sm">
                  <span className="text-[10px] font-mono bg-muted/50 px-2.5 py-1 rounded-lg w-fit">
                    {selectedLead.job_id}
                  </span>

                  {selectedLead.customer_phone && (
                    <div className="flex items-center gap-2.5 text-muted-foreground">
                      <Phone className="h-4 w-4" />{" "}
                      <span className="text-foreground">{selectedLead.customer_phone}</span>
                    </div>
                  )}

                  {selectedLead.address && (
                    <div className="flex items-center gap-2.5 text-muted-foreground">
                      <MapPin className="h-4 w-4" /> <span className="text-foreground">{selectedLead.address}</span>
                    </div>
                  )}

                  {selectedLead.service_type && (
                    <div className="flex items-center gap-2.5 text-muted-foreground">
                      <Wrench className="h-4 w-4" />{" "}
                      <span className="text-foreground font-medium">{selectedLead.service_type}</span>
                    </div>
                  )}

                  <div className="border border-border/40 rounded-2xl p-4 bg-gradient-to-br from-muted/20 to-transparent space-y-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                      Schedule
                    </p>

                    <div className="flex items-center gap-2.5">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span className="font-medium">
                        {selectedLead.scheduled_date &&
                          format(new Date(selectedLead.scheduled_date + "T00:00:00"), "EEEE, MMMM d, yyyy")}
                      </span>
                    </div>

                    {selectedLead.scheduled_time_start && (
                      <div className="flex items-center gap-2.5">
                        <Clock className="h-4 w-4 text-primary" />
                        <span>
                          {formatTime(selectedLead.scheduled_time_start)}
                          {selectedLead.scheduled_time_end && ` – ${formatTime(selectedLead.scheduled_time_end)}`}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground/60">
                    <User className="h-3.5 w-3.5" />
                    Created by{" "}
                    <strong className="text-foreground">{profiles[selectedLead.created_by] || "Unknown"}</strong>
                  </div>
                </div>

                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    className="w-full gap-2 rounded-xl shadow-brand btn-glow"
                    onClick={() => {
                      setSelectedLead(null);
                      navigate(`/leads/${selectedLead.id}`);
                    }}
                  >
                    Open Lead Details
                    <ArrowUpRight className="h-4 w-4" />
                  </Button>
                </motion.div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
