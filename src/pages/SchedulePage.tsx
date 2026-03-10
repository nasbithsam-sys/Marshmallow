import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Lead, STATUS_LABELS, STATUS_COLORS } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronLeft, ChevronRight, Clock, MapPin, Phone, User, Calendar, Wrench } from "lucide-react";
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, isToday } from "date-fns";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const EMPLOYEE_COLORS = [
  "bg-blue-600 text-white",
  "bg-amber-700 text-white",
  "bg-rose-600 text-white",
  "bg-emerald-600 text-white",
  "bg-violet-600 text-white",
  "bg-cyan-600 text-white",
  "bg-orange-600 text-white",
  "bg-pink-600 text-white",
];

const BLOCK_COLORS = [
  "bg-blue-500/80 border-blue-600",
  "bg-amber-600/80 border-amber-700",
  "bg-rose-500/80 border-rose-600",
  "bg-emerald-500/80 border-emerald-600",
  "bg-violet-500/80 border-violet-600",
  "bg-cyan-500/80 border-cyan-600",
  "bg-orange-500/80 border-orange-600",
  "bg-pink-500/80 border-pink-600",
];

export default function SchedulePage() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');

  const currentDay = useMemo(() => {
    const today = new Date();
    const ws = weekStart;
    for (let i = 0; i < 7; i++) {
      if (isSameDay(addDays(ws, i), today)) return today;
    }
    return weekStart;
  }, [weekStart]);

  const weekDays = useMemo(() => {
    if (viewMode === 'day') return [currentDay];
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart, viewMode, currentDay]);

  const hours = useMemo(() => Array.from({ length: 10 }, (_, i) => i + 7), []); // 7AM - 4PM

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

  // Group leads by assigned CS / created_by (as "employees")
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

  const getLeadsForEmployeeAndDay = (empId: string, day: Date) =>
    leads.filter(l => {
      const lid = l.assigned_cs || l.created_by;
      return lid === empId && l.scheduled_date && isSameDay(new Date(l.scheduled_date + "T00:00:00"), day);
    });

  const getLeadPosition = (lead: Lead) => {
    if (!lead.scheduled_time_start) return null;
    const [h, m] = lead.scheduled_time_start.split(":").map(Number);
    const startHour = h + m / 60;
    let duration = 2;
    if (lead.scheduled_time_end) {
      const [eh, em] = lead.scheduled_time_end.split(":").map(Number);
      duration = (eh + em / 60) - startHour;
    }
    const top = ((startHour - 7) / 10) * 100;
    const width = (duration / 10) * 100;
    return { left: `${top}%`, width: `${Math.max(width, 8)}%` };
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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Dispatching</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setWeekStart(subWeeks(weekStart, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="px-4 font-medium" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
            Today
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>

          <span className="text-sm font-medium text-muted-foreground ml-2">
            {format(weekStart, "MMMM yyyy")}
          </span>

          <div className="flex items-center ml-4 bg-muted rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${viewMode === 'week' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
            >
              Week
            </button>
          </div>
        </div>
      </div>

      {/* Dispatching Grid - Employee Rows */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}>
        <Card className="border-border/60 overflow-hidden">
          <CardContent className="p-0 overflow-x-auto">
            <div className="min-w-[900px]">
              {/* Time header */}
              <div className="flex border-b border-border/60 bg-muted/30">
                <div className="w-[120px] shrink-0 p-3 border-r border-border/40">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    GMT {new Date().getTimezoneOffset() / -60 > 0 ? '+' : ''}{new Date().getTimezoneOffset() / -60}
                  </span>
                </div>
                <div className="flex-1 flex">
                  {hours.map(h => (
                    <div key={h} className="flex-1 px-2 py-3 text-center border-r border-border/30 last:border-r-0">
                      <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
                        {h > 12 ? `${h - 12} PM` : h === 12 ? '12 PM' : `${h} AM`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Employee rows */}
              {loading ? (
                <div className="p-8 text-center text-muted-foreground text-sm">Loading schedule...</div>
              ) : employees.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">No scheduled leads this week</div>
              ) : (
                employees.map((emp, empIndex) => {
                  const colorClass = EMPLOYEE_COLORS[empIndex % EMPLOYEE_COLORS.length];
                  const blockColor = BLOCK_COLORS[empIndex % BLOCK_COLORS.length];

                  // For week view, show one row per employee per day that has leads
                  const daysWithLeads = weekDays.filter(day => getLeadsForEmployeeAndDay(emp.id, day).length > 0);

                  if (daysWithLeads.length === 0) return null;

                  return daysWithLeads.map((day, dayIndex) => {
                    const dayLeads = getLeadsForEmployeeAndDay(emp.id, day);
                    return (
                      <div key={`${emp.id}-${day.toISOString()}`} className="flex border-b border-border/40 last:border-b-0">
                        {/* Employee info */}
                        <div className="w-[120px] shrink-0 p-3 border-r border-border/40 flex flex-col items-center justify-center gap-1.5">
                          {dayIndex === 0 && (
                            <>
                              <span className="text-[11px] font-medium text-foreground truncate max-w-full">
                                {emp.name.split(' ').map(n => n[0] + n.slice(1, 2)).join(' ') + '.'}
                              </span>
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className={`text-[10px] font-bold ${colorClass}`}>
                                  {getInitials(emp.name)}
                                </AvatarFallback>
                              </Avatar>
                            </>
                          )}
                          <span className="text-[9px] text-muted-foreground font-medium">
                            {format(day, 'EEE dd')}
                          </span>
                        </div>

                        {/* Timeline */}
                        <div className="flex-1 relative h-16">
                          {/* Grid lines */}
                          <div className="absolute inset-0 flex">
                            {hours.map(h => (
                              <div key={h} className="flex-1 border-r border-border/20 last:border-r-0" />
                            ))}
                          </div>

                          {/* Lead blocks */}
                          {dayLeads.map(lead => {
                            const pos = getLeadPosition(lead);
                            if (!pos) return null;
                            return (
                              <motion.div
                                key={lead.id}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                whileHover={{ scale: 1.02, zIndex: 10 }}
                                className={`absolute top-1.5 bottom-1.5 rounded-lg px-2 py-1 cursor-pointer border text-white shadow-sm hover:shadow-lg transition-shadow flex items-center gap-1.5 ${blockColor}`}
                                style={{ left: pos.left, width: pos.width }}
                                onClick={() => setSelectedLead(lead)}
                              >
                                <Wrench className="h-3 w-3 shrink-0 opacity-80" />
                                <span className="text-[11px] font-semibold truncate">{lead.customer_name}</span>
                                <Avatar className="h-5 w-5 shrink-0 ml-auto">
                                  <AvatarFallback className={`text-[7px] font-bold ${colorClass}`}>
                                    {getInitials(emp.name)}
                                  </AvatarFallback>
                                </Avatar>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
                })
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Lead detail dialog */}
      <Dialog open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <DialogContent className="sm:max-w-lg">
          {selectedLead && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <span>{selectedLead.customer_name}</span>
                  <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[selectedLead.status]}`}>
                    {STATUS_LABELS[selectedLead.status]}
                  </Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="grid gap-3 text-sm">
                  <span className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded w-fit">{selectedLead.job_id}</span>
                  {selectedLead.customer_phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" /> <span className="text-foreground">{selectedLead.customer_phone}</span>
                    </div>
                  )}
                  {selectedLead.address && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" /> <span className="text-foreground">{selectedLead.address}</span>
                    </div>
                  )}
                  {selectedLead.service_type && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Wrench className="h-4 w-4" /> <span className="text-foreground font-medium">{selectedLead.service_type}</span>
                    </div>
                  )}
                  <div className="border rounded-xl p-4 bg-muted/20 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Schedule</p>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span className="font-medium">
                        {selectedLead.scheduled_date && format(new Date(selectedLead.scheduled_date + "T00:00:00"), "EEEE, MMMM d, yyyy")}
                      </span>
                    </div>
                    {selectedLead.scheduled_time_start && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        <span>
                          {formatTime(selectedLead.scheduled_time_start)}
                          {selectedLead.scheduled_time_end && ` – ${formatTime(selectedLead.scheduled_time_end)}`}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    Created by <strong className="text-foreground">{profiles[selectedLead.created_by] || "Unknown"}</strong>
                  </div>
                </div>
                <Button className="w-full gap-2" onClick={() => { setSelectedLead(null); navigate(`/leads/${selectedLead.id}`); }}>
                  Open Lead Details
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
