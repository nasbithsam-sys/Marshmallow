import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { CheckCircle2, AlertTriangle, Monitor, RefreshCw, Smartphone, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface LeadReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface UserStats {
  userId: string;
  fullName: string;
  extensionCount: number;
  crmCount: number;
  totalCount: number;
}

interface LeadAuditRow {
  id: string;
  jobId: string;
  customerName: string;
  customerPhone: string;
  createdAt: string;
  createdByName: string;
  status: string;
}

export default function LeadReportDialog({ open, onOpenChange }: LeadReportDialogProps) {
  const { user, role } = useAuth();
  const [range, setRange] = useState<"today" | "yesterday" | "7d" | "30d">("today");
  const [loading, setLoading] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [rawLeads, setRawLeads] = useState<any[]>([]);

  const isCS = role === "customer_service";

  // Fetch all profiles to resolve creator names
  useEffect(() => {
    if (!open) return;

    const fetchProfiles = async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name");
      if (error) {
        console.error("Error fetching profiles:", error);
        return;
      }
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((p) => {
          map[p.id] = p.full_name;
        });
        setProfiles(map);
      }
    };

    void fetchProfiles();
  }, [open]);

  // Fetch leads based on date range
  const fetchReportData = async () => {
    setLoading(true);
    try {
      let start = new Date();
      if (range === "today") {
        start.setHours(0, 0, 0, 0);
      } else if (range === "yesterday") {
        start.setDate(start.getDate() - 1);
        start.setHours(0, 0, 0, 0);
      } else if (range === "7d") {
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
      } else if (range === "30d") {
        start.setDate(start.getDate() - 30);
        start.setHours(0, 0, 0, 0);
      }

      let query = supabase
        .from("leads")
        .select("id, created_at, created_by, reference_name, job_id, customer_name, customer_phone, status")
        .gte("created_at", start.toISOString());

      if (range === "yesterday") {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        query = query.lt("created_at", todayStart.toISOString());
      }

      // If user is CS, Supabase RLS will automatically restrict results,
      // but let's query explicitly just to be clean
      if (isCS && user) {
        query = query.eq("created_by", user.id);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;
      setRawLeads(data ?? []);
    } catch (error: any) {
      toast.error(error.message || "Failed to load report data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      void fetchReportData();
    }
  }, [open, range]);

  // Compute stats per user
  const userStatsList = useMemo(() => {
    const statsMap: Record<string, UserStats> = {};

    // Initialize map with known profiles (only if user is admin/processor, or CS user themselves)
    Object.entries(profiles).forEach(([id, name]) => {
      if (!isCS || (user && id === user.id)) {
        statsMap[id] = {
          userId: id,
          fullName: name,
          extensionCount: 0,
          crmCount: 0,
          totalCount: 0,
        };
      }
    });

    // Process leads
    rawLeads.forEach((lead) => {
      const creatorId = lead.created_by;
      const isExtension = lead.reference_name === "Chrome Extension";

      if (!statsMap[creatorId]) {
        // Fallback for users not in profiles
        statsMap[creatorId] = {
          userId: creatorId,
          fullName: profiles[creatorId] || `User (${creatorId.slice(0, 8)})`,
          extensionCount: 0,
          crmCount: 0,
          totalCount: 0,
        };
      }

      const stats = statsMap[creatorId];
      if (isExtension) {
        stats.extensionCount++;
      } else {
        stats.crmCount++;
      }
      stats.totalCount++;
    });

    // Return list, filter out users who have 0 leads in this range (except current user)
    return Object.values(statsMap)
      .filter((s) => s.totalCount > 0 || (user && s.userId === user.id))
      .sort((a, b) => b.totalCount - a.totalCount);
  }, [rawLeads, profiles, isCS, user]);

  // Compute total aggregates
  const totals = useMemo(() => {
    let extension = 0;
    let crm = 0;
    rawLeads.forEach((lead) => {
      if (lead.reference_name === "Chrome Extension") {
        extension++;
      } else {
        crm++;
      }
    });
    return {
      extension,
      crm,
      total: rawLeads.length,
    };
  }, [rawLeads]);

  // Map extension leads for recent captures audit list
  const extensionLeads = useMemo<LeadAuditRow[]>(() => {
    return rawLeads
      .filter((lead) => lead.reference_name === "Chrome Extension")
      .map((lead) => ({
        id: lead.id,
        jobId: lead.job_id,
        customerName: lead.customer_name,
        customerPhone: lead.customer_phone,
        createdAt: lead.created_at,
        createdByName: profiles[lead.created_by] || `User (${lead.created_by.slice(0, 8)})`,
        status: lead.status,
      }))
      .slice(0, 20); // Top 20 for audit
  }, [rawLeads, profiles]);

  const rangeLabels = {
    today: "Today",
    yesterday: "Yesterday",
    "7d": "Last 7 Days",
    "30d": "Last 30 Days",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto rounded-3xl border border-border/60 bg-card/95 shadow-brand backdrop-blur-xl">
        <DialogHeader className="flex flex-row items-center justify-between border-b border-border/50 pb-4">
          <div>
            <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
              Lead Submission Report
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              Audit lead submissions across CRM channels and extensions.
            </DialogDescription>
          </div>

          <div className="flex items-center gap-3 pr-6">
            <Select value={range} onValueChange={(val: any) => setRange(val)}>
              <SelectTrigger className="w-[140px] h-9 rounded-xl border border-border/60">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-xl border-border/60"
              onClick={() => void fetchReportData()}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </DialogHeader>

        {/* Aggregated Totals Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mt-4">
          <Card className="rounded-2xl border-border/50 bg-muted/[0.12] shadow-none">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Extension Leads
                </p>
                <p className="text-2xl font-bold text-foreground mt-1.5 tabular-nums">
                  {totals.extension}
                </p>
              </div>
              <div className="h-9 w-9 rounded-xl bg-primary/[0.08] text-primary flex items-center justify-center border border-primary/10">
                <Smartphone className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50 bg-muted/[0.12] shadow-none">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Direct CRM Leads
                </p>
                <p className="text-2xl font-bold text-foreground mt-1.5 tabular-nums">
                  {totals.crm}
                </p>
              </div>
              <div className="h-9 w-9 rounded-xl bg-[hsl(var(--success)/0.08)] text-[hsl(var(--success))] flex items-center justify-center border border-[hsl(var(--success)/0.12)]">
                <Monitor className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/50 bg-muted/[0.12] shadow-none">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Total Leads Added
                </p>
                <p className="text-2xl font-bold text-foreground mt-1.5 tabular-nums">
                  {totals.total}
                </p>
              </div>
              <div className="h-9 w-9 rounded-xl bg-muted text-foreground flex items-center justify-center border border-border">
                <Users className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* User Breakdown Table */}
        <div className="mt-6 space-y-3">
          <h3 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5">
            User Statistics Breakdown ({rangeLabels[range]})
          </h3>
          <div className="overflow-hidden rounded-2xl border border-border/50 bg-card">
            <Table>
              <TableHeader className="bg-muted/[0.22]">
                <TableRow>
                  <TableHead className="font-semibold text-xs py-3 px-4">User Name</TableHead>
                  <TableHead className="font-semibold text-xs py-3 px-4 text-center">Extension Leads</TableHead>
                  <TableHead className="font-semibold text-xs py-3 px-4 text-center">Direct CRM Leads</TableHead>
                  <TableHead className="font-semibold text-xs py-3 px-4 text-right">Total Submissions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && userStatsList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm py-8 text-muted-foreground">
                      Loading statistics...
                    </TableCell>
                  </TableRow>
                ) : userStatsList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm py-8 text-muted-foreground">
                      No leads submitted in this date range.
                    </TableCell>
                  </TableRow>
                ) : (
                  userStatsList.map((stat) => (
                    <TableRow key={stat.userId} className="hover:bg-muted/[0.05]">
                      <TableCell className="font-medium text-sm py-3 px-4">
                        {stat.fullName}
                        {user && stat.userId === user.id && (
                          <Badge variant="secondary" className="ml-2 text-[9px] px-1.5 py-0">
                            You
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm py-3 px-4 tabular-nums">
                        {stat.extensionCount}
                      </TableCell>
                      <TableCell className="text-center font-mono text-sm py-3 px-4 tabular-nums">
                        {stat.crmCount}
                      </TableCell>
                      <TableCell className="text-right font-semibold font-mono text-sm py-3 px-4 tabular-nums">
                        {stat.totalCount}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Audit Log for Extension leads */}
        <div className="mt-8 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5">
              Recent Extension Captures
            </h3>
            <span className="text-[10px] text-muted-foreground">
              Showing last {extensionLeads.length} extension leads
            </span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border/50 bg-card">
            <Table>
              <TableHeader className="bg-muted/[0.22]">
                <TableRow>
                  <TableHead className="font-semibold text-xs py-3 px-4">Captured At</TableHead>
                  <TableHead className="font-semibold text-xs py-3 px-4">Job ID</TableHead>
                  <TableHead className="font-semibold text-xs py-3 px-4">Customer Name</TableHead>
                  <TableHead className="font-semibold text-xs py-3 px-4">Created By</TableHead>
                  <TableHead className="font-semibold text-xs py-3 px-4 text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && extensionLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm py-8 text-muted-foreground">
                      Loading audit trail...
                    </TableCell>
                  </TableRow>
                ) : extensionLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm py-8 text-muted-foreground">
                      No extension leads captured in this range.
                    </TableCell>
                  </TableRow>
                ) : (
                  extensionLeads.map((lead) => (
                    <TableRow key={lead.id} className="hover:bg-muted/[0.05]">
                      <TableCell className="text-xs text-muted-foreground py-3 px-4">
                        {format(new Date(lead.createdAt), "MMM d, h:mm a")}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-semibold py-3 px-4">
                        {lead.jobId}
                      </TableCell>
                      <TableCell className="text-sm py-3 px-4">
                        <div className="font-medium">{lead.customerName || "No Name"}</div>
                        <div className="text-xs text-muted-foreground font-mono">{lead.customerPhone || "No Phone"}</div>
                      </TableCell>
                      <TableCell className="text-sm py-3 px-4 text-muted-foreground">
                        {lead.createdByName}
                      </TableCell>
                      <TableCell className="text-right py-3 px-4">
                        <Badge
                          variant="outline"
                          className="capitalize text-[10px] px-1.5 py-0 border-border/80"
                        >
                          {lead.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
