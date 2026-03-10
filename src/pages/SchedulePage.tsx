import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Lead, STATUS_LABELS, STATUS_COLORS } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Clock, MapPin, Phone, User, Calendar, Wrench, AlertTriangle, CheckCircle2 } from "lucide-react";
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, isToday } from "date-fns";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/motion";

export default function SchedulePage() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const hours = useMemo(() => Array.from({ length: 13 }, (_, i) => i + 7), []);

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

  const getLeadsForDay = (day: Date) =>
    leads.filter((l) => l.scheduled_date && isSameDay(new Date(l.scheduled_date + "T00:00:00"), day));

  const getLeadPosition = (lead: Lead) => {
    if (!lead.scheduled_time_start) return null;
    const [h, m] = lead.scheduled_time_start.split(":").map(Number);
    const startHour = h + m / 60;
    let duration = 2;
    if (lead.scheduled_time_end) {
      const [eh, em] = lead.scheduled_time_end.split(":").map(Number);
      duration = (eh + em / 60) - startHour;
    }
    const top = ((startHour - 7) / 13) * 100;
    const height = (duration / 13) * 100;
    return { top: `${top}%`, height: `${Math.max(height, 5)}%` };
  };

  const formatTime = (t: string | null) => {
    if (!t) return "";
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
  };

  const todayJobs = leads.filter((l) => l.scheduled_date && isToday(new Date(l.scheduled_date + "T00:00:00"))).length;
  const urgentJobs = leads.filter((l) => l.status === "urgent_job").length;
  const completedJobs = leads.filter((l) => l.status === "job_done" || l.status === "paid").length;

  const stats = [
    { label: "This Week", value: leads.length, icon: Calendar, color: "text-primary bg-primary/10" },
    { label: "Today", value: todayJobs, icon: Clock, color: "text-emerald-600 bg-emerald-500/10" },
    { label: "Urgent", value: urgentJobs, icon: AlertTriangle, color: "text-destructive bg-destructive/10" },
    { label: "Completed", value: completedJobs, icon: CheckCircle2, color: "text-sky-600 bg-sky-500/10" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" /> Schedule
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {format(weekStart, "MMMM d")} – {format(addDays(weekStart, 6), "MMMM d, yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setWeekStart(subWeeks(weekStart, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="px-4 font-medium" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
            Today
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((stat) => (
          <motion.div key={stat.label} variants={staggerItem}>
            <motion.div whileHover={{ y: -2, scale: 1.02 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
              <Card className="p-3 sm:p-4 border-border/60">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${stat.color}`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{stat.label}</p>
                    <p className="text-xl sm:text-2xl font-bold text-foreground leading-tight">{stat.value}</p>
                  </div>
                </div>
              </Card>
            </motion.div>
          </motion.div>
        ))}
      </motion.div>

      {/* Calendar grid */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.5 }}>
        <Card className="border-border/60 overflow-hidden">
          <CardContent className="p-0 overflow-x-auto">
            <div className="min-w-[900px]">
              {/* Day headers */}
              <div className="grid grid-cols-8 border-b border-border/60 bg-muted/30">
                <div className="p-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-border/40">Time</div>
                {weekDays.map((day) => {
                  const today = isToday(day);
                  const dayLeadCount = getLeadsForDay(day).length;
                  return (
                    <div key={day.toISOString()} className={`p-3 text-center border-r border-border/40 last:border-r-0 transition-colors ${today ? "bg-primary/5" : ""}`}>
                      <p className={`text-[10px] font-semibold uppercase tracking-wider ${today ? "text-primary" : "text-muted-foreground"}`}>
                        {format(day, "EEE")}
                      </p>
                      <div className={`mt-1 inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-all ${
                        today ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25" : "text-foreground"
                      }`}>
                        {format(day, "d")}
                      </div>
                      {dayLeadCount > 0 && (
                        <p className={`text-[9px] mt-0.5 font-medium ${today ? "text-primary" : "text-muted-foreground"}`}>
                          {dayLeadCount} job{dayLeadCount > 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Time grid */}
              <div className="grid grid-cols-8 relative">
                <div className="border-r border-border/40">
                  {hours.map((h) => (
                    <div key={h} className="h-16 border-b border-border/30 px-3 py-1 flex items-start">
                      <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
                        {h > 12 ? `${h - 12} PM` : h === 12 ? "12 PM" : `${h} AM`}
                      </span>
                    </div>
                  ))}
                </div>

                {weekDays.map((day) => {
                  const dayLeads = getLeadsForDay(day);
                  const today = isToday(day);
                  return (
                    <div key={day.toISOString()} className={`relative border-r border-border/40 last:border-r-0 ${today ? "bg-primary/[0.02]" : ""}`}>
                      {hours.map((h) => (
                        <div key={h} className="h-16 border-b border-border/30 border-dashed" />
                      ))}
                      {dayLeads.map((lead) => {
                        const pos = getLeadPosition(lead);
                        if (!pos) return null;
                        return (
                          <motion.div
                            key={lead.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            whileHover={{ scale: 1.03, zIndex: 10 }}
                            transition={{ type: "spring", stiffness: 400, damping: 25 }}
                            className={`absolute left-1 right-1 rounded-lg px-2 py-1.5 text-xs cursor-pointer shadow-sm hover:shadow-lg border ${STATUS_COLORS[lead.status]}`}
                            style={{ top: pos.top, height: pos.height, minHeight: "32px" }}
                            onClick={() => setSelectedLead(lead)}
                          >
                            <p className="font-semibold truncate text-[11px]">{lead.customer_name}</p>
                            {lead.scheduled_time_start && (
                              <p className="opacity-70 text-[9px] flex items-center gap-0.5">
                                <Clock className="h-2.5 w-2.5" />
                                {formatTime(lead.scheduled_time_start)}
                              </p>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
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