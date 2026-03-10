import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Lead, LeadStatus, STATUS_LABELS, STATUS_DOT_COLORS, ALL_LEAD_STATUSES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Download } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import LeadCard from "@/components/leads/LeadCard";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "@/lib/motion";

const PAGE_SIZES = [20, 40, 60, 100];

export default function LeadsPage() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(0);
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  const statusFilter = searchParams.get("status") || "all";
  const isAdmin = role === "admin";
  const isCS = role === "customer_service";

  const setStatusFilter = (value: string) => {
    setPage(0);
    if (value === "all") setSearchParams({});
    else setSearchParams({ status: value });
  };

  useEffect(() => {
    fetchLeads();
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    const { data } = await supabase.from("profiles").select("id, full_name");
    if (data) {
      const map: Record<string, string> = {};
      data.forEach((p: any) => (map[p.id] = p.full_name));
      setProfiles(map);
    }
  };

  const fetchLeads = async () => {
    setLoading(true);
    let query = supabase.from("leads").select("*").order("created_at", { ascending: false });
    // CS can only see their own leads
    if (isCS && user) {
      query = query.eq("created_by", user.id);
    }
    const { data } = await query;
    if (data) setLeads(data as Lead[]);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    let result = leads;
    if (statusFilter !== "all") result = result.filter((l) => l.status === statusFilter);
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.customer_name.toLowerCase().includes(s) ||
          l.job_id.toLowerCase().includes(s) ||
          l.customer_phone?.toLowerCase().includes(s) ||
          l.address?.toLowerCase().includes(s) ||
          l.service_type?.toLowerCase().includes(s)
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
  }, [leads, search, statusFilter]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const exportData = (format: "csv" | "xlsx") => {
    const data = filtered.map((l) => ({
      "Job ID": l.job_id,
      "Customer Name": l.customer_name,
      "Phone": l.customer_phone || "",
      "Address": l.address || "",
      "Service Type": l.service_type || "",
      "Status": STATUS_LABELS[l.status],
      "CS Notes": l.cs_notes || "",
      "Processor Notes": l.processor_notes || "",
      "Scheduled Date": l.scheduled_date || "",
      "Created At": new Date(l.created_at).toLocaleString(),
      "Updated At": new Date(l.updated_at).toLocaleString(),
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");

    const statusLabel = statusFilter !== "all" ? `_${statusFilter}` : "";
    const filename = `leads${statusLabel}_${new Date().toISOString().slice(0, 10)}`;

    if (format === "csv") {
      XLSX.writeFile(wb, `${filename}.csv`, { bookType: "csv" });
    } else {
      XLSX.writeFile(wb, `${filename}.xlsx`);
    }
    toast.success(`Exported ${data.length} leads as ${format.toUpperCase()}`);
  };

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {statusFilter !== "all" ? (
              <span className="flex items-center gap-2">
                <span className={`h-3 w-3 rounded-full ${STATUS_DOT_COLORS[statusFilter as LeadStatus]}`} />
                {STATUS_LABELS[statusFilter as LeadStatus]}
              </span>
            ) : "All Leads"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length} lead{filtered.length !== 1 ? "s" : ""}
            {totalPages > 1 && ` · Page ${page + 1} of ${totalPages}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Only admin can export */}
          {isAdmin && (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="gap-1.5 h-9 text-xs" onClick={() => exportData("csv")}>
                <Download className="h-3.5 w-3.5" /> CSV
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 h-9 text-xs" onClick={() => exportData("xlsx")}>
                <Download className="h-3.5 w-3.5" /> XLSX
              </Button>
            </div>
          )}
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Button onClick={() => navigate("/leads/new")} className="gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow">
              <Plus className="h-4 w-4" /> New Lead
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Search & Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name, phone, address, job ID..." className="pl-9 bg-card border-border/60 focus-visible:ring-primary/30" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[220px] bg-card border-border/60"><SelectValue placeholder="Filter by status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {ALL_LEAD_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                <span className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${STATUS_DOT_COLORS[s]}`} />
                  {STATUS_LABELS[s]}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}>
          <SelectTrigger className="w-full sm:w-[120px] bg-card border-border/60"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((s) => <SelectItem key={s} value={String(s)}>Show {s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Lead card grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <Card key={i} className="h-64 animate-pulse bg-muted/40 border-border/40 rounded-xl" />)}
        </div>
      ) : paged.length === 0 ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
          <Card className="flex h-44 items-center justify-center text-muted-foreground border-dashed border-2">No leads found</Card>
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
              <LeadCard
                lead={lead}
                profiles={profiles}
                onRefresh={fetchLeads}
              />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-center gap-2 pt-2"
        >
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <div className="flex gap-1">
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let p = i;
              if (totalPages > 7) {
                if (page < 4) p = i;
                else if (page > totalPages - 5) p = totalPages - 7 + i;
                else p = page - 3 + i;
              }
              return (
                <Button key={p} variant={p === page ? "default" : "outline"} size="sm" className="w-9" onClick={() => setPage(p)}>
                  {p + 1}
                </Button>
              );
            })}
          </div>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </motion.div>
      )}
    </div>
  );
}
