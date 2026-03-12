import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Lead, STATUS_LABELS, STATUS_COLORS } from "@/lib/constants";
import { useAllowedStatuses } from "@/hooks/useAllowedStatuses";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronLeft, ChevronRight, Clock, MapPin, Phone, User, Calendar, Wrench, ArrowUpRight } from "lucide-react";
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay } from "date-fns";
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
  const [viewMode, setViewMode] = useState<'week' | 'day'>('day');
  const [selectedDay, setSelectedDay] = useState(() => new Date());

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const displayDays = useMemo(() =>
    viewMode === 'day' ? [selectedDay] : weekDays,
    [viewMode, selectedDay, weekDays]
  );

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);

  useEffect(() => { fetchData(); }, [weekStart]);

  const fetchData = async () => {
    setLoading(true);
    const startStr = format(weekStart, "yyyy-MM-dd");
    const endStr = format(addDays(weekStart, 6), "yyyy-MM-dd");

    const [leadsRes, profilesRes] = await Promise.all([
      supabase.from("leads").select("*").not("scheduled_date", "is", null).gte("scheduled_date", startStr).lte("scheduled_date", endStr),
      supabase.from("profiles").select("id, full_name"),
    ]);

    if (leadsRes.data) setLeads(leadsRes.data as Lead[]);
    if (profilesRes.data) {
      const map: Record<string, string> = {};
      profilesRes.data.forEach((p: any) => (map[p.id] = p.full_name));
      setProfiles(map);
    }
    setLoading(false);
  };

  const employees = useMemo(() => {
    const empMap = new Map<string, { id: string; name: string; leads: Lead[] }>();
    leads.forEach(lead => {
      const empId = lead.assigned_cs || lead.created_by;
      if (!empMap.has(empId)) {
        empMap.set(empId, { id: empId, name: profiles[empId] || 'Unknown', leads: [] });
      }
      empMap.get(empId)!.leads.push(lead);
    });
    return Array.from(empMap.values());
  }, [leads, profiles]);

  const getLeadsForDay = (day: Date) =>
    leads.filter(l => l.scheduled_date && isSameDay(new Date(l.scheduled_date + "T00:00:00"), day));

  const getLeadsForEmployeeAndDay = (empId: string, day: Date) =>
    leads.filter(l => {
      const lid = l.assigned_cs || l.created_by;
      return lid === empId && l.scheduled_date && isSameDay(new Date(l.scheduled_date + "T00:00:00"), day);
    });

  // Stack overlapping leads into rows
  const computeRows = (dayLeads: Lead[]) => {
    const sorted = [...dayLeads].sort((a, b) => (a.scheduled_time_start || '').localeCompare(b.scheduled_time_start || ''));
    const rows: Lead[][] = [];
    for (const lead of sorted) {
      let placed = false;
      for (const row of rows) {
        const overlaps = row.some(existing => {
          const aStart = existing.scheduled_time_start || '00:00';
          const aEnd = existing.scheduled_time_end || '23:59';
          const bStart = lead.scheduled_time_start || '00:00';
          const bEnd = lead.scheduled_time_end || '23:59';
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
      duration = (eh + em / 60) - startHour;
    }
    const top = (startHour / 24) * 100;
    const width = (duration / 24) * 100;
    return { left: `${top}%`, width: `${Math.max(width, 3)}%` };
  };

  const formatTime = (t: string | null) => {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
  };

  const getInitials = (name: string) =>
    name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  const handlePrev = () => {
    if (viewMode === 'day') {
      const prev = addDays(selectedDay, -1);
      setSelectedDay(prev);
      if (prev < weekStart) setWeekStart(subWeeks(weekStart, 1));
    } else {
      setWeekStart(subWeeks(weekStart, 1));
    }
  };

  const handleNext = () => {
    if (viewMode === 'day') {
      const next = addDays(selectedDay, 1);
      setSelectedDay(next);
      if (next >= addDays(weekStart, 7)) setWeekStart(addWeeks(weekStart, 1));
    } else {
      setWeekStart(addWeeks(weekStart, 1));
    }
  };

  const handleToday = () => {
    const today = new Date();
    setSelectedDay(today);
    setWeekStart(startOfWeek(today, { weekStartsOn: 1 }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
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
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-border/50" onClick={handlePrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Button variant="outline" size="sm" className="px-4 font-medium rounded-xl border-border/50" onClick={handleToday}>
              Today
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl border-border/50" onClick={handleNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </motion.div>

          <span className="text-sm font-medium text-muted-foreground ml-2">
            {format(viewMode === 'day' ? selectedDay : weekStart, "MMMM yyyy")}
          </span>

          <div className="flex items-center ml-4 bg-muted/50 rounded-xl p-0.5 border border-border/30">
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all duration-200 ${viewMode === 'day' ? 'bg-card text-foreground shadow-premium-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Day
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all duration-200 ${viewMode === 'week' ? 'bg-card text-foreground shadow-premium-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Week
            </button>
          </div>
        </motion.div>
      </div>

      {/* Schedule Grid */}
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
            {/* Day header */}
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
                  {/* Time header */}
                  <div className="flex border-b border-border/30 bg-gradient-to-r from-muted/20 to-transparent">
                    <div className="w-[110px] shrink-0 p-3 border-r border-border/20">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                        GMT {new Date().getTimezoneOffset() / -60 > 0 ? '+' : ''}{new Date().getTimezoneOffset() / -60}
                      </span>
                    </div>
                    <div className="flex-1 flex">
                      {hours.map(h => (
                        <div key={h} className="flex-1 px-1 py-3 text-center border-r border-border/15 last:border-r-0">
                          <span className="text-[10px] font-medium text-muted-foreground/60 tabular-nums">
                            {h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Job rows */}
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
                    rows.map((row, rowIndex) => {
                      const blockColor = BLOCK_COLORS[rowIndex % BLOCK_COLORS.length];

                      return (
                        <motion.div
                          key={rowIndex}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: rowIndex * 0.05 }}
                          className="flex border-b border-border/20 last:border-b-0 hover:bg-muted/5 transition-colors duration-200"
                        >
                          {/* Row label */}
                          <div className="w-[110px] shrink-0 p-3 border-r border-border/20 flex items-center justify-center">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40">
                              Row {rowIndex + 1}
                            </span>
                          </div>

                          {/* Timeline */}
                          <div className="flex-1 relative h-[68px]">
                            <div className="absolute inset-0 flex">
                              {hours.map(h => (
                                <div key={h} className="flex-1 border-r border-border/10 last:border-r-0" />
                              ))}
                            </div>

                            {row.map((lead, leadIdx) => {
                              const pos = getLeadPosition(lead);
                              if (!pos) return null;
                              const empId = lead.assigned_cs || lead.created_by;
                              const empName = profiles[empId] || 'Unknown';
                              const empColorIdx = Object.keys(profiles).indexOf(empId);
                              const colorClass = EMPLOYEE_COLORS[Math.abs(empColorIdx) % EMPLOYEE_COLORS.length];
                              const leadBlockColor = BLOCK_COLORS[Math.abs(empColorIdx) % BLOCK_COLORS.length];

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
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}

      {/* Lead detail dialog */}
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
                  <span className="text-[10px] font-mono bg-muted/50 px-2.5 py-1 rounded-lg w-fit">{selectedLead.job_id}</span>
                  {selectedLead.customer_phone && (
                    <div className="flex items-center gap-2.5 text-muted-foreground">
                      <Phone className="h-4 w-4" /> <span className="text-foreground">{selectedLead.customer_phone}</span>
                    </div>
                  )}
                  {selectedLead.address && (
                    <div className="flex items-center gap-2.5 text-muted-foreground">
                      <MapPin className="h-4 w-4" /> <span className="text-foreground">{selectedLead.address}</span>
                    </div>
                  )}
                  {selectedLead.service_type && (
                    <div className="flex items-center gap-2.5 text-muted-foreground">
                      <Wrench className="h-4 w-4" /> <span className="text-foreground font-medium">{selectedLead.service_type}</span>
                    </div>
                  )}
                  <div className="border border-border/40 rounded-2xl p-4 bg-gradient-to-br from-muted/20 to-transparent space-y-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">Schedule</p>
                    <div className="flex items-center gap-2.5">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span className="font-medium">
                        {selectedLead.scheduled_date && format(new Date(selectedLead.scheduled_date + "T00:00:00"), "EEEE, MMMM d, yyyy")}
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
                    Created by <strong className="text-foreground">{profiles[selectedLead.created_by] || "Unknown"}</strong>
                  </div>
                </div>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button className="w-full gap-2 rounded-xl shadow-brand btn-glow" onClick={() => { setSelectedLead(null); navigate(`/leads/${selectedLead.id}`); }}>
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
