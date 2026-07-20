import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TechnicianDialog, TechnicianRecord } from "@/components/technicians/TechnicianDialog";
import { ImportTechniciansDialog } from "@/components/technicians/ImportTechniciansDialog";
import { toast } from "@/hooks/use-toast";
import { Contact, Plus, Upload, Download, Search, Pencil, Trash2, ChevronDown } from "lucide-react";

export default function TechniciansPage() {
  const qc = useQueryClient();
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const [addOpen, setAddOpen] = useState(false);
  const [editTech, setEditTech] = useState<TechnicianRecord | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTech, setDeleteTech] = useState<TechnicianRecord | null>(null);
  const [search, setSearch] = useState("");

  const techniciansQuery = useQuery({
    queryKey: ["technicians"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("technicians")
        .select("id, name, area, service, notes, chat_link, latitude, longitude")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TechnicianRecord[];
    },
    staleTime: 60_000,
  });

  const rows = techniciansQuery.data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((t) =>
      [t.name, t.service, t.area, t.notes, t.chat_link].some((v) => (v ?? "").toLowerCase().includes(q)),
    );
  }, [rows, search]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["technicians"] });

  const handleConfirmDelete = async () => {
    if (!deleteTech) return;
    const { error } = await supabase.from("technicians").delete().eq("id", deleteTech.id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Technician deleted" }); refresh(); }
    setDeleteTech(null);
  };

  const exportRows = () => filtered.map((t) => ({
    Name: t.name ?? "",
    Service: t.service ?? "",
    Area: t.area ?? "",
    "Chat Link": t.chat_link ?? "",
    Notes: t.notes ?? "",
  }));

  const EXPORT_HEADERS = ["Name", "Service", "Area", "Chat Link", "Notes"];

  const download = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  const exportCsv = () => {
    const data = exportRows();
    const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
    const csv = [EXPORT_HEADERS.join(","), ...data.map((r) => EXPORT_HEADERS.map((h) => esc((r as Record<string, string>)[h] ?? "")).join(","))].join("\n");
    download(new Blob([csv], { type: "text/csv;charset=utf-8" }), `technicians-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const exportXlsx = () => {
    const ws = XLSX.utils.json_to_sheet(exportRows(), { header: EXPORT_HEADERS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Technicians");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    download(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `technicians-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Contact className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Technicians</h1>
            <p className="text-xs text-muted-foreground mt-0.5">{rows.length} technicians</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="mr-1.5 h-4 w-4" /> Export
                  <ChevronDown className="ml-1 h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportCsv}>Export as CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={exportXlsx}>Export as XLSX</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1.5 h-4 w-4" /> Import
          </Button>
          <Button size="sm" onClick={() => { setEditTech(null); setAddOpen(true); }}>
            <Plus className="mr-1.5 h-4 w-4" /> Add Technician
          </Button>
        </div>
      </div>

      <Card className="border-border/60">
        <CardContent className="p-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, service, area, chat link, notes"
              className="h-8 pl-7 text-xs"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {techniciansQuery.isLoading && (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">Loading…</TableCell></TableRow>
              )}
              {!techniciansQuery.isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-10">
                    {rows.length === 0 ? "No technicians yet. Add one manually or import from CSV/XLSX." : "No technicians match your search."}
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>{t.service || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="max-w-[280px] truncate" title={t.area}>{t.area}</TableCell>
                  <TableCell className="max-w-[320px] truncate text-muted-foreground" title={t.notes ?? ""}>{t.notes || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setEditTech(t)} title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteTech(t)} title="Delete">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <TechnicianDialog
        open={addOpen || editTech !== null}
        onOpenChange={(o) => { if (!o) { setAddOpen(false); setEditTech(null); } }}
        technician={editTech}
        onSaved={refresh}
      />
      <ImportTechniciansDialog open={importOpen} onOpenChange={setImportOpen} onImported={refresh} />

      <AlertDialog open={!!deleteTech} onOpenChange={(o) => !o && setDeleteTech(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this technician?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTech?.name} will be permanently removed. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
