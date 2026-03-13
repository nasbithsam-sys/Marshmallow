import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Lead, LeadStatus, STATUS_LABELS, STATUS_DOT_COLORS, ALL_LEAD_STATUSES } from "@/lib/constants";
import { useAllowedStatuses } from "@/hooks/useAllowedStatuses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Search, Download, Share2 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import LeadCard from "@/components/leads/LeadCard";
import AddLeadDialog from "@/components/leads/AddLeadDialog";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem, heroTitle } from "@/lib/motion";

const PAGE_SIZES = [20, 40, 60, 100];

export default function LeadsPage() {
  const { user, role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [sharedLeads, setSharedLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(0);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<"my" | "shared">("my");
  const [showAddDialog, setShowAddDialog] = useState(false);

  const statusFilter = searchParams.get("status") || "all";
  const isAdmin = role === "admin";
  const isCS = role === "customer_service";

  const { filterLeads } = useAllowedStatuses();

  const setStatusFilter = (value: string) => {
    setPage(0);
    if (value === "all") setSearchParams({});
    else setSearchParams({ status: value });
  };

  useEffect(() => {
    if (!user || !role) return;

    fetchLeads();
    fetchProfiles();

    if (role === "customer_service") {
      fetchSharedLeads();
    } else {
      setSharedLeads([]);
    }
  }, [user?.id, role]);

  const fetchProfiles = async () => {
    const { data, error } = await supabase.from("profiles").select("id, full_name");

    if (error) {
      toast.error(error.message);
      return;
    }

    if (data) {
      const map: Record<string, string> = {};
      data.forEach((p: any) => {
        map[p.id] = p.full_name;
      });
      setProfiles(map);
    }
  };

  const fetchLeads = async () => {
    if (!user || !role) return;

    setLoading(true);

    let query = supabase.from("leads").select("*").order("created_at", { ascending: false });

    if (role === "customer_service") {
      query = query.eq("created_by", user.id);
    }

    const { data, error } = await query;

    if (error) {
      toast.error(error.message);
      setLeads([]);
    } else {
      setLeads((data ?? []) as Lead[]);
    }

    setLoading(false);
  };

  const fetchSharedLeads = async () => {
    if (!user || role !== "customer_service") return;

    const { data: shares, error: sharesError } = await supabase
      .from("lead_shares")
      .select("lead_id")
      .eq("shared_with_user_id", user.id);

    if (sharesError) {
      toast.error(sharesError.message);
      setSharedLeads([]);
      return;
    }

    if (!shares || shares.length === 0) {
      setSharedLeads([]);
      return;
    }

    const leadIds = shares.map((s: any) => s.lead_id);

    const { data: leadsData, error: leadsError } = await supabase
      .from("leads")
      .select("*")
      .in("id", leadIds)
      .order("created_at", { ascending: false });

    if (leadsError) {
      toast.error(leadsError.message);
      setSharedLeads([]);
      return;
    }

    setSharedLeads((leadsData ?? []) as Lead[]);
  };

  const currentLeads = activeTab === "shared" ? sharedLeads : leads;

  const filtered = useMemo(() => {
    let result = filterLeads([...currentLeads]);

    if (statusFilter !== "all") {
      result = result.filter((l) => l.status === statusFilter);
    }

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.customer_name?.toLowerCase().includes(s) ||
          l.job_id?.toLowerCase().includes(s) ||
          l.customer_phone?.toLowerCase().includes(s) ||
          l.address?.toLowerCase().includes(s) ||
          l.service_type?.toLowerCase().includes(s),
      );
    }

    result.sort((a, b) => {
      if (a.status === "urgent_job" && b.status !== "urgent_job") return -1;
      if (b.status === "urgent_job" && a.status !== "urgent_job") return 1;
      if (a.status === "cancelled" && b.status !== "cancelled") return 1;
      if (b.status === "cancelled" && a.status !== "cancelled") return -1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return result;
  }, [currentLeads, search, statusFilter, filterLeads]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const urgentCount = leads.filter((l) => l.status === "urgent_job").length;
  const scheduledCount = leads.filter((l) => l.status === "scheduled").length;
  const activeCount = leads.filter(
    (l) => l.status !== "cancelled" && l.status !== "paid" && l.status !== "job_done",
  ).length;

  const exportData = (format: "csv" | "xlsx") => {
    const data = filtered.map((l) => ({
      "Job ID": l.job_id,
      "Customer Name": l.customer_name,
      Phone: l.customer_phone || "",
      Email: l.customer_email || "",
      "Number Name": l.number_name || "",
      Address: l.address || "",
      City: l.city || "",
      State: l.state || "",
      "Zip Code": l.zip_code || "",
      "Service Type": l.service_type || "",
      Status: STATUS_LABELS[l.status],
      "Scheduled Date": l.scheduled_date || "",
      "Scheduled Time Start": l.scheduled_time_start || "",
      "Scheduled Time End": l.scheduled_time_end || "",
      Quote: l.quote || "",
      "Service Details": l.service_details || "",
      "Customer Schedule Requirements": l.customer_schedule_requirements || "",
      Reference: l.reference_name || "",
      "Tech Name": l.tech_name || "",
      "Tech Number": l.tech_number || "",
      Terms: l.terms || "",
      "Labor Amount": l.labor_amount != null ? l.labor_amount : "",
      "Material Amount": l.material_amount != null ? l.material_amount : "",
      "For You Amount": l.for_you_amount != null ? l.for_you_amount : "",
      "For Us Amount": l.for_us_amount != null ? l.for_us_amount : "",
      "CS Notes": l.cs_notes || "",
      "Processor Notes": l.processor_notes || "",
      "Payment Amount": l.payment_amount != null ? l.payment_amount : "",
      "Created By": profiles[l.created_by] || l.created_by,
      "Last Edited By": l.last_edited_by ? profiles[l.last_edited_by] || l.last_edited_by : "",
      "Created At": new Date(l.created_at).toLocaleString(),
      "Updated At": l.updated_at ? new Date(l.updated_at).toLocaleString() : "",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");

    const filename = `leads_${new Date().toISOString().slice(0, 10)}`;
    XLSX.writeFile(wb, `${filename}.${format}`, format === "csv" ? { bookType: "csv" } : undefined);

    toast.success(`Exported ${data.length} leads`);
  };

  const handleRefresh = async () => {
    await fetchLeads();
    if (role === "customer_service") {
      await fetchSharedLeads();
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <motion.div variants={heroTitle} initial="initial" animate="animate">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {statusFilter !== "all" ? (
              <span className="flex items-center gap-2.5">
                <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT_COLORS[statusFilter as LeadStatus]}`} />
                {STATUS_LABELS[statusFilter as LeadStatus]}
              </span>
            ) : (
              "All Leads"
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} lead{filtered.length !== 1 ? "s" : ""}
            {totalPages > 1 && ` · Page ${page + 1} of ${totalPages}`}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15, duration: 0.35 }}
          className="flex items-center gap-2 flex-wrap"
        >
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-[12px]">
                  <Download className="h-3.5 w-3.5" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportData("csv")}>Export as CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportData("xlsx")}>Export as XLSX</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Button onClick={() => setShowAddDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            New Lead
          </Button>

          <AddLeadDialog
            open={showAddDialog}
            onOpenChange={setShowAddDialog}
            onSuccess={() => {
              fetchLeads();
              if (role === "customer_service") {
                fetchSharedLeads();
              }
            }}
          />
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex gap-2.5 flex-wrap"
      >
        <div className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-card border border-border/50 text-sm shadow-premium-xs">
          <span className="w-2 h-2 rounded-full bg-primary" />
          <span className="font-bold text-foreground tabular-nums">{activeCount}</span>
          <span className="text-muted-foreground text-[12px]">Active</span>
        </div>

        {urgentCount > 0 && (
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-destructive/5 border border-destructive/10 text-sm shadow-premium-xs">
            <span className="w-2 h-2 rounded-full bg-destructive status-pulse" />
            <span className="font-bold text-destructive tabular-nums">{urgentCount}</span>
            <span className="text-destructive/70 text-[12px]">Urgent</span>
          </div>
        )}

        {scheduledCount > 0 && (
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-card border border-border/50 text-sm shadow-premium-xs">
            <span className="w-2 h-2 rounded-full bg-primary/50" />
            <span className="font-bold tabular-nums">{scheduledCount}</span>
            <span className="text-muted-foreground text-[12px]">Scheduled</span>
          </div>
        )}
      </motion.div>

      {isCS && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex gap-1 bg-muted/50 rounded-lg p-1 w-fit border border-border/30"
        >
          <button
            onClick={() => {
              setActiveTab("my");
              setPage(0);
            }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              activeTab === "my"
                ? "bg-card text-foreground shadow-premium-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            My Leads
          </button>

          <button
            onClick={() => {
              setActiveTab("shared");
              setPage(0);
            }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center gap-1.5 ${
              activeTab === "shared"
                ? "bg-card text-foreground shadow-premium-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Share2 className="h-3.5 w-3.5" />
            Shared with me
            {sharedLeads.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                {sharedLeads.length}
              </span>
            )}
          </button>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <div className="relative flex-1 group">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40 transition-colors group-focus-within:text-primary" />
          <Input
            placeholder="Search by name, phone, address, job ID..."
            className="pl-10 h-10"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[200px] h-10">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {ALL_LEAD_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                <span className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_COLORS[s]}`} />
                  {STATUS_LABELS[s]}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={String(pageSize)}
          onValueChange={(v) => {
            setPageSize(Number(v));
            setPage(0);
          }}
        >
          <SelectTrigger className="w-full sm:w-[110px] h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((s) => (
              <SelectItem key={s} value={String(s)}>
                Show {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </motion.div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-56 rounded-xl skeleton-shimmer border border-border/30" />
          ))}
        </div>
      ) : paged.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35 }}
        >
          <Card className="flex flex-col h-48 items-center justify-center border-dashed border-2 border-border/40 gap-3">
            <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center">
              <Search className="h-5 w-5 text-muted-foreground/30" />
            </div>
            <p className="font-medium text-foreground text-sm">
              {activeTab === "shared" ? "No leads have been shared with you yet" : "No leads found"}
            </p>
            <p className="text-[12px] text-muted-foreground">
              {search || statusFilter !== "all"
                ? "Try adjusting your search or filter"
                : 'Click "New Lead" to get started'}
            </p>
          </Card>
        </motion.div>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          {paged.map((lead) => (
            <motion.div key={lead.id} variants={staggerItem} layout>
              <LeadCard lead={lead} profiles={profiles} onRefresh={handleRefresh} />
            </motion.div>
          ))}
        </motion.div>
      )}

      {totalPages > 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-center gap-1.5 pt-2"
        >
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>

          <div className="flex gap-1">
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let p = i;

              if (totalPages > 7) {
                if (page < 4) p = i;
                else if (page > totalPages - 5) p = totalPages - 7 + i;
                else p = page - 3 + i;
              }

              return (
                <Button
                  key={p}
                  variant={p === page ? "default" : "outline"}
                  size="sm"
                  className="w-9"
                  onClick={() => setPage(p)}
                >
                  {p + 1}
                </Button>
              );
            })}
          </div>

          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </motion.div>
      )}
    </div>
  );
}
