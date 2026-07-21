import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TechnicianDialog, TechnicianRecord } from "@/components/technicians/TechnicianDialog";
import { ImportTechniciansDialog } from "@/components/technicians/ImportTechniciansDialog";
import { toast } from "@/hooks/use-toast";
import {
  fetchAllTechnicians,
  fetchTechniciansPage,
  TECHNICIANS_ROOT_KEY,
} from "@/lib/technicians";
import { toTelHref } from "@/lib/phone";
import {
  Contact,
  Plus,
  Upload,
  Download,
  Search,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  Copy,
  X,
} from "lucide-react";

const PAGE_SIZE_OPTIONS = [100, 200, 500, 1000] as const;
type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];
const DEFAULT_PAGE_SIZE: PageSizeOption = 200;
const PAGE_SIZE_STORAGE_KEY = "marshmallow.technicians.pageSize";

function loadInitialPageSize(): PageSizeOption {
  try {
    const raw = localStorage.getItem(PAGE_SIZE_STORAGE_KEY);
    const n = raw ? Number(raw) : NaN;
    if (PAGE_SIZE_OPTIONS.includes(n as PageSizeOption)) return n as PageSizeOption;
  } catch {
    // ignore storage errors
  }
  return DEFAULT_PAGE_SIZE;
}

function buildPageWindow(current: number, total: number): Array<number | "ellipsis-left" | "ellipsis-right"> {
  if (total <= 1) return total === 1 ? [1] : [];
  const pages = new Set<number>([1, total, current]);
  for (let i = 1; i <= 2; i++) {
    if (current - i >= 1) pages.add(current - i);
    if (current + i <= total) pages.add(current + i);
  }
  const sorted = Array.from(pages).sort((a, b) => a - b);
  const out: Array<number | "ellipsis-left" | "ellipsis-right"> = [];
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    if (i > 0 && p - sorted[i - 1] > 1) {
      out.push(p < current ? "ellipsis-left" : "ellipsis-right");
    }
    out.push(p);
  }
  return out;
}

const COPY_COLUMNS = ["Name", "Phone Number", "Service", "Area", "Quo Chat Link", "Notes"] as const;

/** Strip tabs/newlines from a single clipboard cell so one row stays on one TSV line. */
function sanitizeClipboardCell(value: string | null | undefined): string {
  if (value == null) return "";
  return String(value).replace(/[\t\r\n]+/g, " ").trim();
}

function technicianToClipboardCells(t: TechnicianRecord): string[] {
  return [
    sanitizeClipboardCell(t.name),
    sanitizeClipboardCell(t.phone_number),
    sanitizeClipboardCell(t.service),
    sanitizeClipboardCell(t.area),
    sanitizeClipboardCell(t.chat_link),
    sanitizeClipboardCell(t.notes),
  ];
}

function buildTechniciansTsv(techs: TechnicianRecord[]): string {
  const header = COPY_COLUMNS.join("\t");
  const body = techs.map((t) => technicianToClipboardCells(t).join("\t"));
  return [header, ...body].join("\n");
}

function buildSingleTechnicianText(t: TechnicianRecord): string {
  const pairs: Array<[string, string | null | undefined]> = [
    ["Name", t.name],
    ["Phone Number", t.phone_number],
    ["Service", t.service],
    ["Area", t.area],
    ["Quo Chat Link", t.chat_link],
    ["Notes", t.notes],
  ];
  return pairs
    .filter(([, v]) => v != null && String(v).trim() !== "")
    .map(([k, v]) => `${k}: ${String(v).replace(/\r?\n/g, " ").trim()}`)
    .join("\n");
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy path
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function sortTechnicians(list: TechnicianRecord[]): TechnicianRecord[] {
  return [...list].sort((a, b) => {
    const nameCmp = (a.name ?? "").localeCompare(b.name ?? "", undefined, { sensitivity: "base" });
    if (nameCmp !== 0) return nameCmp;
    return (a.id ?? "").localeCompare(b.id ?? "");
  });
}

export default function TechniciansPage() {
  const qc = useQueryClient();
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const [addOpen, setAddOpen] = useState(false);
  const [editTech, setEditTech] = useState<TechnicianRecord | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTech, setDeleteTech] = useState<TechnicianRecord | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pageSize, setPageSize] = useState<PageSizeOption>(() => loadInitialPageSize());
  const [currentPage, setCurrentPage] = useState(1);
  // Selected technicians persisted across pagination/search by id.
  const [selected, setSelected] = useState<Map<string, TechnicianRecord>>(() => new Map());
  const tableScrollRef = useRef<HTMLDivElement | null>(null);

  // Debounce search input
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  // Reset to page 1 whenever search or page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, pageSize]);

  // Persist page size
  useEffect(() => {
    try {
      localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(pageSize));
    } catch {
      // ignore
    }
  }, [pageSize]);

  // Total-only query for the page header (uses the shared full-list cache when available)
  const totalCountQuery = useQuery({
    queryKey: [...TECHNICIANS_ROOT_KEY, "count"] as const,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("technicians")
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 60_000,
  });

  const paginatedQuery = useQuery({
    queryKey: [
      ...TECHNICIANS_ROOT_KEY,
      "paginated",
      { page: currentPage, pageSize, search: debouncedSearch },
    ] as const,
    queryFn: () =>
      fetchTechniciansPage({ page: currentPage, pageSize, search: debouncedSearch }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const rows = paginatedQuery.data?.technicians ?? [];
  const filteredTotal = paginatedQuery.data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize));
  const hasResults = filteredTotal > 0;

  // Clamp current page when total shrinks
  useEffect(() => {
    if (paginatedQuery.data && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [paginatedQuery.data, currentPage, totalPages]);

  // Scroll table container to top on page/pageSize/search change
  useEffect(() => {
    tableScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [currentPage, pageSize, debouncedSearch]);

  const startRecord = hasResults ? (currentPage - 1) * pageSize + 1 : 0;
  const endRecord = hasResults ? Math.min(currentPage * pageSize, filteredTotal) : 0;
  const headerTotal = totalCountQuery.data ?? 0;

  const invalidateAll = async () => {
    await qc.invalidateQueries({ queryKey: TECHNICIANS_ROOT_KEY });
  };

  const handleSaved = async (_saved: TechnicianRecord) => {
    await invalidateAll();
  };

  const handleConfirmDelete = async () => {
    if (!deleteTech) return;
    const { error } = await supabase.from("technicians").delete().eq("id", deleteTech.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Technician deleted" });
      // If we're on a page that just became empty, step back one.
      if (rows.length === 1 && currentPage > 1) setCurrentPage((p) => p - 1);
      await invalidateAll();
    }
    setDeleteTech(null);
  };

  const EXPORT_HEADERS = ["Technician Name", "Phone Number", "Service", "Area", "Quo Chat Link", "Notes"];
  const toExportRow = (t: TechnicianRecord) => ({
    "Technician Name": t.name ?? "",
    "Phone Number": t.phone_number ?? "",
    Service: t.service ?? "",
    Area: t.area ?? "",
    "Quo Chat Link": t.chat_link ?? "",
    Notes: t.notes ?? "",
  });
  const [exporting, setExporting] = useState(false);

  const download = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  const getExportRows = async () => {
    // Export the full dataset (respecting current search when active).
    setExporting(true);
    try {
      const all = await fetchAllTechnicians();
      const q = debouncedSearch.toLowerCase();
      const filtered = q
        ? all.filter((t) =>
            [t.name, t.service, t.area, t.notes, t.chat_link, t.phone_number]
              .some((v) => (v ?? "").toString().toLowerCase().includes(q)),
          )
        : all;
      return filtered.map(toExportRow);
    } finally {
      setExporting(false);
    }
  };

  const exportCsv = async () => {
    const data = await getExportRows();
    const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
    const csv = [
      EXPORT_HEADERS.join(","),
      ...data.map((r) => EXPORT_HEADERS.map((h) => esc((r as Record<string, string>)[h] ?? "")).join(",")),
    ].join("\n");
    download(new Blob([csv], { type: "text/csv;charset=utf-8" }), `technicians-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const exportXlsx = async () => {
    const data = await getExportRows();
    const ws = XLSX.utils.json_to_sheet(data, { header: EXPORT_HEADERS });
    const phoneColIdx = EXPORT_HEADERS.indexOf("Phone Number");
    for (let i = 0; i < data.length; i++) {
      const addr = XLSX.utils.encode_cell({ r: i + 1, c: phoneColIdx });
      const cell = ws[addr];
      if (cell) { cell.t = "s"; cell.v = String(cell.v ?? ""); cell.z = "@"; }
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Technicians");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    download(
      new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      `technicians-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
  };

  const isSearching = debouncedSearch.length > 0;
  const pageWindow = useMemo(() => buildPageWindow(currentPage, totalPages), [currentPage, totalPages]);
  const disablePrev = currentPage <= 1 || !hasResults;
  const disableNext = currentPage >= totalPages || !hasResults;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Contact className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Technicians</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalCountQuery.isLoading ? "Loading…" : `${headerTotal.toLocaleString()} technicians`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={exporting}>
                  {exporting ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-1.5 h-4 w-4" />
                  )}
                  Export
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
              placeholder="Search by name, phone, service, area, chat link, notes"
              className="h-8 pl-7 text-xs"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <div ref={tableScrollRef} className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone Number</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>Chat Link</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedQuery.isPending && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {paginatedQuery.isError && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm py-10">
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-destructive">
                        {(paginatedQuery.error as Error)?.message ?? "Failed to load technicians."}
                      </span>
                      <Button size="sm" variant="outline" onClick={() => paginatedQuery.refetch()}>
                        Retry
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {!paginatedQuery.isPending && !paginatedQuery.isError && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">
                    {isSearching
                      ? "No technicians match your search."
                      : "No technicians yet. Add one manually or import from CSV/XLSX."}
                  </TableCell>
                </TableRow>
              )}
              {rows.map((t) => {
                const tel = toTelHref(t.phone_number);
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>
                      {t.phone_number && tel ? (
                        <a href={tel} className="text-primary hover:underline">{t.phone_number}</a>
                      ) : (
                        <span className="text-muted-foreground text-xs">No phone number</span>
                      )}
                    </TableCell>
                    <TableCell>{t.service || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="max-w-[280px] truncate" title={t.area}>{t.area}</TableCell>
                    <TableCell className="max-w-[220px] truncate">
                      {t.chat_link ? (
                        <a
                          href={t.chat_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                          title={t.chat_link}
                        >
                          Open chat
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[320px] truncate text-muted-foreground" title={t.notes ?? ""}>
                      {t.notes || <span className="text-muted-foreground">—</span>}
                    </TableCell>
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
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Pagination footer */}
        <div className="flex flex-col gap-3 border-t border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="whitespace-nowrap">
              {isSearching
                ? `Showing ${startRecord.toLocaleString()}–${endRecord.toLocaleString()} of ${filteredTotal.toLocaleString()} matching technicians`
                : `Showing ${startRecord.toLocaleString()}–${endRecord.toLocaleString()} of ${filteredTotal.toLocaleString()} technicians`}
            </span>
            {paginatedQuery.isFetching && !paginatedQuery.isPending && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-label="Loading" />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <label htmlFor="tech-page-size" className="text-xs text-muted-foreground whitespace-nowrap">
                Technicians per page
              </label>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  const n = Number(v);
                  if (PAGE_SIZE_OPTIONS.includes(n as PageSizeOption)) setPageSize(n as PageSizeOption);
                }}
              >
                <SelectTrigger id="tech-page-size" className="h-8 w-[92px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)} className="text-xs">
                      {n.toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <nav className="flex items-center gap-1" aria-label="Technicians pagination">
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8"
                onClick={() => setCurrentPage(1)}
                disabled={disablePrev}
                aria-label="Go to first page"
                title="Go to first page"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={disablePrev}
                aria-label="Go to previous page"
                title="Go to previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              {pageWindow.map((item, idx) => {
                if (item === "ellipsis-left" || item === "ellipsis-right") {
                  return (
                    <span
                      key={`${item}-${idx}`}
                      className="px-1.5 text-xs text-muted-foreground select-none"
                      aria-hidden="true"
                    >
                      …
                    </span>
                  );
                }
                const active = item === currentPage;
                return (
                  <Button
                    key={item}
                    size="sm"
                    variant={active ? "default" : "outline"}
                    className="h-8 min-w-[2rem] px-2 text-xs"
                    onClick={() => setCurrentPage(item)}
                    aria-current={active ? "page" : undefined}
                    aria-label={`Go to page ${item}`}
                    disabled={!hasResults}
                  >
                    {item}
                  </Button>
                );
              })}

              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={disableNext}
                aria-label="Go to next page"
                title="Go to next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8"
                onClick={() => setCurrentPage(totalPages)}
                disabled={disableNext}
                aria-label="Go to last page"
                title="Go to last page"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </nav>
          </div>
        </div>
      </Card>

      <TechnicianDialog
        open={addOpen || editTech !== null}
        onOpenChange={(o) => { if (!o) { setAddOpen(false); setEditTech(null); } }}
        technician={editTech}
        onSaved={handleSaved}
      />
      <ImportTechniciansDialog open={importOpen} onOpenChange={setImportOpen} onImported={invalidateAll} />

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
