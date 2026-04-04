<<<<<<< HEAD
﻿import { useState, useEffect, useMemo } from "react";
=======
import { useState, useEffect, useMemo } from "react";
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
import { supabase } from "@/integrations/supabase/client";
import { Lead } from "@/lib/constants";
import { useAllowedStatuses } from "@/hooks/useAllowedStatuses";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Phone,
  User,
  Calendar,
  Wrench,
  ArrowUpRight,
  Sparkles,
  CalendarDays,
  Filter,
  LayoutGrid,
} from "lucide-react";
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, isAfter, isBefore } from "date-fns";
import { useNavigate } from "react-router-dom";
<<<<<<< HEAD
import { motion, useReducedMotion } from "framer-motion";
=======
import { motion } from "framer-motion";
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
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
<<<<<<< HEAD
  const reduceMotion = useReducedMotion();
=======
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
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
<<<<<<< HEAD
  const [showFilters, setShowFilters] = useState(false);
=======
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f

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
<<<<<<< HEAD
      profilesRes.data.forEach((p: { id: string; full_name: string }) => {
=======
      profilesRes.data.forEach((p: any) => {
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
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

  const totalVisibleScheduled = filteredLeads.length;

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-[28px] border border-border/60 bg-gradient-to-br from-card via-card to-muted/[0.35] p-6 shadow-[0_22px_60px_-34px_rgba(0,0,0,0.45)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_28%)]" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="min-w-0">
            <div className="mb-3 inline-flex items-center gap-1 rounded-full border border-primary/10 bg-primary/[0.06] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
              <Sparkles className="h-2.5 w-2.5" />
              Schedule
            </div>

            <h1 className="text-2xl font-semibold tracking-[-0.03em] text-foreground sm:text-3xl">Job Schedule</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Visualize scheduled work by day, week, and custom date range.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-2 flex-wrap"
          >
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-xl border-border/60 bg-background/70 shadow-sm"
              onClick={handlePrev}
              disabled={hasCustomRange}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-10 rounded-xl border-border/60 bg-background/70 px-4 shadow-sm"
              onClick={handleToday}
            >
              Today
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-xl border-border/60 bg-background/70 shadow-sm"
              onClick={handleNext}
              disabled={hasCustomRange}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

<<<<<<< HEAD
            <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-2 shadow-sm">
=======
            <div className="ml-1 rounded-2xl border border-border/60 bg-background/70 px-4 py-2 shadow-sm">
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
              <span className="text-sm font-medium text-muted-foreground">
                {hasCustomRange
                  ? `${format(new Date(appliedFromDate + "T00:00:00"), "MMM d, yyyy")} - ${format(
                      new Date(appliedToDate + "T00:00:00"),
                      "MMM d, yyyy",
                    )}`
                  : format(viewMode === "day" ? selectedDay : weekStart, "MMMM yyyy")}
              </span>
            </div>

            <div className="flex items-center bg-muted/[0.35] rounded-2xl p-1.5 border border-border/40 shadow-sm">
              <button
                onClick={() => setViewMode("day")}
                className={`px-4 py-2 text-xs rounded-xl font-medium transition-all duration-200 ${
                  viewMode === "day"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                disabled={hasCustomRange}
              >
                Day
              </button>
              <button
                onClick={() => setViewMode("week")}
                className={`px-4 py-2 text-xs rounded-xl font-medium transition-all duration-200 ${
                  viewMode === "week"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                disabled={hasCustomRange}
              >
                Week
              </button>
            </div>
<<<<<<< HEAD

            <Button
              variant="outline"
              size="sm"
              className="h-10 rounded-xl border-border/60 bg-background/70 px-4 shadow-sm xl:hidden"
              onClick={() => setShowFilters((value) => !value)}
            >
              <Filter className="mr-2 h-4 w-4" />
              {showFilters ? "Hide Filters" : "Show Filters"}
            </Button>
=======
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
          </motion.div>
        </div>
      </div>

<<<<<<< HEAD
      <div className={`grid grid-cols-1 gap-4 xl:grid xl:grid-cols-[1.35fr_0.65fr] ${showFilters ? "block" : "hidden xl:grid"}`}>
=======
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_0.65fr]">
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
        <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-[0_18px_52px_-34px_rgba(0,0,0,0.42)]">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-primary/10 bg-primary/[0.07]">
                <Filter className="h-4 w-4 text-primary/80" />
              </div>
              <div>
                <p className="text-[14px] font-semibold tracking-[-0.02em] text-foreground">Date Filters</p>
                <p className="text-[12px] text-muted-foreground">Apply a custom range for schedule visibility.</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-muted-foreground">From</label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="h-11 w-full rounded-xl border-border/60 bg-background shadow-sm lg:w-[190px]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-muted-foreground">To</label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="h-11 w-full rounded-xl border-border/60 bg-background shadow-sm lg:w-[190px]"
                />
              </div>

<<<<<<< HEAD
              <div className="flex flex-col gap-2 sm:flex-row">
=======
              <div className="flex gap-2">
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
                <Button
                  onClick={handleApplyRange}
                  disabled={!fromDate || !toDate || fromDate > toDate}
                  className="h-11 rounded-xl px-4"
                >
                  Apply Range
                </Button>

                <Button
                  variant="outline"
                  onClick={handleClearRange}
                  className="h-11 rounded-xl border-border/60 bg-background px-4 shadow-sm"
                >
                  Clear
                </Button>
              </div>
            </div>

            {fromDate && toDate && fromDate > toDate && (
              <p className="mt-3 text-sm text-destructive">From date cannot be after To date.</p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-border/60 bg-card/95 shadow-[0_18px_52px_-34px_rgba(0,0,0,0.42)]">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60">
                  Scheduled Jobs
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground tabular-nums">
                  {totalVisibleScheduled}
                </p>
                <p className="mt-1 text-[12px] text-muted-foreground">Visible jobs in the selected schedule range.</p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/10 bg-primary/[0.07]">
                <LayoutGrid className="h-5 w-5 text-primary/80" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {displayDays.map((day, dayIdx) => {
        const dayLeads = getLeadsForDay(day);
        const rows = computeRows(dayLeads);

        return (
          <motion.div
            key={day.toISOString()}
<<<<<<< HEAD
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={reduceMotion ? undefined : { delay: dayIdx * 0.05 + 0.12, duration: 0.35 }}
=======
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: dayIdx * 0.05 + 0.12, duration: 0.35 }}
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
            className="space-y-3"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/60 bg-card shadow-sm">
                <span className="text-2xl font-semibold tracking-[-0.03em] text-foreground">{format(day, "dd")}</span>
              </div>

              <div>
                <span className="block text-sm font-semibold text-foreground">{format(day, "EEEE")}</span>
                <span className="block text-[11px] text-muted-foreground">{format(day, "MMMM yyyy")}</span>
              </div>
            </div>

            <Card className="overflow-hidden rounded-[28px] border-border/50 shadow-[0_18px_46px_-34px_rgba(0,0,0,0.38)] transition-all duration-300 hover:shadow-[0_22px_56px_-34px_rgba(0,0,0,0.45)]">
              <CardContent className="overflow-x-auto p-0">
<<<<<<< HEAD
                <div className="min-w-[1380px] xl:min-w-[1800px]">
=======
                <div className="min-w-[1800px]">
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
                  <div className="flex border-b border-border/30 bg-gradient-to-r from-muted/[0.25] via-muted/[0.12] to-transparent">
                    <div className="w-[120px] shrink-0 border-r border-border/20 p-4">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60">
                        GMT {new Date().getTimezoneOffset() / -60 > 0 ? "+" : ""}
                        {new Date().getTimezoneOffset() / -60}
                      </span>
                    </div>

                    <div className="flex flex-1">
                      {hours.map((h) => (
                        <div key={h} className="flex-1 border-r border-border/10 px-1 py-4 text-center last:border-r-0">
                          <span className="text-[10px] font-medium text-muted-foreground/60 tabular-nums">
                            {h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {loading ? (
                    <div className="p-12 text-center text-sm text-muted-foreground/55">
                      <div className="mx-auto mb-3 h-7 w-7 rounded-full border-2 border-muted-foreground/20 border-t-primary animate-spin" />
                      Loading schedule...
                    </div>
                  ) : rows.length === 0 ? (
                    <div className="p-14 text-center text-sm text-muted-foreground/55">
                      <CalendarDays className="mx-auto mb-3 h-8 w-8 text-muted-foreground/20" />
                      No scheduled jobs for this day
                    </div>
                  ) : (
                    rows.map((row, rowIndex) => (
<<<<<<< HEAD
                      <div
                        key={rowIndex}
                        className="flex border-b border-border/15 last:border-b-0 transition-colors duration-150 hover:bg-muted/[0.04]"
=======
                      <motion.div
                        key={rowIndex}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: rowIndex * 0.04 }}
                        className="flex border-b border-border/15 last:border-b-0 hover:bg-muted/[0.04] transition-colors duration-200"
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
                      >
                        <div className="w-[120px] shrink-0 border-r border-border/15 p-3 flex items-center justify-center">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/45">
                            Row {rowIndex + 1}
                          </span>
                        </div>

                        <div className="relative h-[74px] flex-1">
                          <div className="absolute inset-0 flex">
                            {hours.map((h) => (
                              <div key={h} className="flex-1 border-r border-border/8 last:border-r-0" />
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
<<<<<<< HEAD
                              <div
                                key={lead.id}
                                className={`absolute bottom-2 top-2 flex cursor-pointer items-center gap-2 rounded-2xl border px-3 py-2 text-white shadow-[0_14px_30px_-18px_rgba(0,0,0,0.45)] transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-[0_16px_30px_-18px_rgba(0,0,0,0.48)] ${leadBlockColor}`}
=======
                              <motion.div
                                key={lead.id}
                                initial={{ opacity: 0, scale: 0.92 }}
                                animate={{ opacity: 1, scale: 1 }}
                                whileHover={{ scale: 1.025, y: -1 }}
                                className={`absolute bottom-2 top-2 flex cursor-pointer items-center gap-2 rounded-2xl border px-3 py-2 text-white shadow-[0_14px_30px_-18px_rgba(0,0,0,0.45)] transition-all ${leadBlockColor}`}
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
                                style={{ left: pos.left, width: pos.width }}
                                onClick={() => setSelectedLead(lead)}
                              >
                                <Wrench className="h-3.5 w-3.5 shrink-0 opacity-85" />
                                <span className="truncate text-[11px] font-semibold tracking-[-0.01em]">
                                  {lead.customer_name}
                                </span>
                                <Avatar className="ml-auto h-6 w-6 shrink-0 ring-1 ring-white/20">
                                  <AvatarFallback className={`text-[8px] font-bold ${colorClass}`}>
                                    {getInitials(empName)}
                                  </AvatarFallback>
                                </Avatar>
<<<<<<< HEAD
                              </div>
                            );
                          })}
                        </div>
                      </div>
=======
                              </motion.div>
                            );
                          })}
                        </div>
                      </motion.div>
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}

      <Dialog open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <DialogContent className="sm:max-w-lg rounded-[28px] border border-border/60 bg-card shadow-[0_24px_70px_-36px_rgba(0,0,0,0.50)]">
          {selectedLead && (
            <>
              <DialogHeader>
                <div className="mb-2 inline-flex items-center gap-1 rounded-full border border-primary/10 bg-primary/[0.06] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                  <Sparkles className="h-2.5 w-2.5" />
                  Scheduled Job
                </div>

                <DialogTitle className="flex items-center gap-3 flex-wrap">
                  <span className="text-lg font-semibold tracking-[-0.02em]">{selectedLead.customer_name}</span>
                  <StatusBadge status={selectedLead.status} size="sm" />
                </DialogTitle>
              </DialogHeader>

              <div className="mt-2 space-y-4">
                <div className="grid gap-3 text-sm">
                  <span className="w-fit rounded-xl bg-muted/50 px-2.5 py-1 font-mono text-[10px]">
                    {selectedLead.job_id}
                  </span>

                  {selectedLead.customer_phone && (
                    <div className="flex items-center gap-2.5 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span className="text-foreground">{selectedLead.customer_phone}</span>
                    </div>
                  )}

                  {selectedLead.address && (
                    <div className="flex items-center gap-2.5 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span className="text-foreground">{selectedLead.address}</span>
                    </div>
                  )}

                  {selectedLead.service_type && (
                    <div className="flex items-center gap-2.5 text-muted-foreground">
                      <Wrench className="h-4 w-4" />
                      <span className="font-medium text-foreground">{selectedLead.service_type}</span>
                    </div>
                  )}

                  <div className="space-y-2.5 rounded-2xl border border-border/50 bg-gradient-to-br from-muted/[0.22] to-transparent p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60">
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
<<<<<<< HEAD
                          {selectedLead.scheduled_time_end && ` - ${formatTime(selectedLead.scheduled_time_end)}`}
=======
                          {selectedLead.scheduled_time_end && ` – ${formatTime(selectedLead.scheduled_time_end)}`}
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground/65">
                    <User className="h-3.5 w-3.5" />
                    Created by{" "}
                    <strong className="text-foreground">{profiles[selectedLead.created_by] || "Unknown"}</strong>
                  </div>
                </div>

<<<<<<< HEAD
                <motion.div whileHover={reduceMotion ? undefined : { scale: 1.01 }} whileTap={reduceMotion ? undefined : { scale: 0.99 }}>
=======
                <motion.div whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.985 }}>
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
                  <Button
                    className="w-full gap-2 rounded-xl shadow-sm"
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
<<<<<<< HEAD


=======
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
