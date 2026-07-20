import { useState } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { geocodeAddress, normalizeAddress } from "@/lib/geo";
import { Loader2, FileSpreadsheet, Download } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
}

interface Row {
  rowNumber: number;
  name: string;
  area: string;
  service: string;
  chat_link: string;
  notes: string;
}

interface FailedRow {
  rowNumber: number;
  name: string;
  area: string;
  reason: string;
}

function normalizeKey(k: string) {
  return k.trim().toLowerCase().replace(/\s+/g, "_");
}

function pick(r: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    if (r[k] != null && r[k] !== "") return r[k];
  }
  return "";
}

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { current.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        current.push(field); field = "";
        if (current.some((x) => x.trim() !== "")) rows.push(current);
        current = [];
      } else field += c;
    }
  }
  if (field !== "" || current.length) { current.push(field); if (current.some((x) => x.trim() !== "")) rows.push(current); }
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => normalizeKey(h));
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = (r[idx] ?? "").trim(); });
    return obj;
  });
}

export function ImportTechniciansDialog({ open, onOpenChange, onImported }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [failed, setFailed] = useState<FailedRow[]>([]);
  const [insertedCount, setInsertedCount] = useState<number | null>(null);

  const reset = () => { setRows([]); setFileName(null); setFailed([]); setInsertedCount(null); };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setFailed([]);
    setInsertedCount(null);
    const ext = file.name.toLowerCase().split(".").pop();
    let raw: Record<string, string>[] = [];
    try {
      if (ext === "csv") {
        const text = await file.text();
        raw = parseCsv(text);
      } else if (ext === "xlsx" || ext === "xls") {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
        raw = json.map((r) => {
          const out: Record<string, string> = {};
          for (const k in r) out[normalizeKey(k)] = String(r[k] ?? "").trim();
          return out;
        });
      } else {
        toast({ title: "Unsupported file", description: "Use .csv or .xlsx", variant: "destructive" });
        return;
      }
    } catch (e) {
      toast({ title: "Could not read file", description: e instanceof Error ? e.message : "Unknown error", variant: "destructive" });
      return;
    }

    const parsed: Row[] = raw.map((r, idx) => ({
      rowNumber: idx + 2, // +2 accounts for header row + 1-indexed
      name: (r.name ?? "").trim(),
      service: (r.service ?? "").trim(),
      area: (r.area ?? "").trim(),
      chat_link: pick(r, ["chat_link", "chat", "quo_chat_link", "link"]).trim(),
      notes: (r.notes ?? "").trim(),
    }));
    setRows(parsed);
  };

  const handleImport = async () => {
    if (!rows.length) return;
    setImporting(true);
    setFailed([]);
    setInsertedCount(null);
    try {
      const { data: existing } = await supabase.from("technicians").select("name, area");
      const seen = new Set(
        (existing ?? []).map((t) => `${normalizeAddress(t.name ?? "")}|${normalizeAddress(t.area ?? "")}`),
      );

      const failures: FailedRow[] = [];
      const { data: { user } } = await supabase.auth.getUser();

      type InsertPayload = {
        row: Row;
        payload: {
          name: string;
          area: string;
          service: string | null;
          chat_link: string | null;
          notes: string | null;
          latitude: null;
          longitude: null;
          created_by: string | null;
        };
      };
      const toInsert: InsertPayload[] = [];

      for (const r of rows) {
        if (!r.name && !r.area && !r.service && !r.chat_link && !r.notes) {
          failures.push({ rowNumber: r.rowNumber, name: r.name, area: r.area, reason: "Row is empty" });
          continue;
        }
        const key = `${normalizeAddress(r.name)}|${normalizeAddress(r.area)}`;
        if (seen.has(key)) {
          failures.push({ rowNumber: r.rowNumber, name: r.name, area: r.area, reason: "Duplicate of an existing technician" });
          continue;
        }
        seen.add(key);
        toInsert.push({
          row: r,
          payload: {
            name: r.name,
            area: r.area,
            service: r.service || null,
            chat_link: r.chat_link || null,
            notes: r.notes || null,
            latitude: null,
            longitude: null,
            created_by: user?.id ?? null,
          },
        });
      }

      let inserted = 0;
      const insertedIds: Array<{ id: string; area: string }> = [];

      // Try bulk insert per chunk; on failure fall back to per-row so we can capture exact failures.
      for (let i = 0; i < toInsert.length; i += 100) {
        const chunk = toInsert.slice(i, i + 100);
        const { data, error } = await supabase
          .from("technicians")
          .insert(chunk.map((c) => c.payload))
          .select("id, area");

        if (!error && data) {
          inserted += data.length;
          data.forEach((d) => insertedIds.push({ id: d.id as string, area: (d.area as string) ?? "" }));
          continue;
        }

        for (const c of chunk) {
          const { data: single, error: singleErr } = await supabase
            .from("technicians")
            .insert(c.payload)
            .select("id, area")
            .single();
          if (singleErr || !single) {
            failures.push({
              rowNumber: c.row.rowNumber,
              name: c.row.name,
              area: c.row.area,
              reason: singleErr?.message ?? "Insert failed",
            });
          } else {
            inserted++;
            insertedIds.push({ id: single.id as string, area: (single.area as string) ?? "" });
          }
        }
      }

      // Background geocoding
      if (insertedIds.length) {
        (async () => {
          for (const row of insertedIds) {
            if (!row.area) continue;
            const coords = await geocodeAddress(row.area);
            if (coords) {
              await supabase.from("technicians").update({ latitude: coords.latitude, longitude: coords.longitude }).eq("id", row.id);
            }
          }
          onImported?.();
        })();
      }

      setInsertedCount(inserted);
      setFailed(failures);

      toast({
        title: "Import complete",
        description: `${inserted} imported. ${failures.length} failed.`,
      });
      onImported?.();
    } finally {
      setImporting(false);
    }
  };

  const downloadFailedCsv = () => {
    if (!failed.length) return;
    const headers = ["Row", "Name", "Area", "Reason"];
    const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
    const csv = [
      headers.join(","),
      ...failed.map((f) => [f.rowNumber, f.name, f.area, f.reason].map((x) => esc(String(x ?? ""))).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `technicians-import-failed-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Technicians</DialogTitle>
          <DialogDescription>
            Upload a .csv or .xlsx with columns: Name, Service, Area, Chat Link, Notes. All fields are optional.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex items-center gap-2">
            <Input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
          </div>
          {fileName && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{fileName}</span>
            </div>
          )}
          {rows.length > 0 && insertedCount === null && (
            <div className="rounded-md border">
              <div className="flex items-center justify-between border-b px-3 py-2 text-xs">
                <span className="font-medium">Preview</span>
                <span className="text-muted-foreground">{rows.length} rows detected</span>
              </div>
              <div className="max-h-64 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 text-left">
                    <tr>
                      <th className="px-3 py-1.5">Name</th>
                      <th className="px-3 py-1.5">Service</th>
                      <th className="px-3 py-1.5">Area</th>
                      <th className="px-3 py-1.5">Chat Link</th>
                      <th className="px-3 py-1.5">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 100).map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-1.5">{r.name || <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-3 py-1.5">{r.service || <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-3 py-1.5">{r.area || <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-3 py-1.5 max-w-[160px] truncate" title={r.chat_link}>{r.chat_link || <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-3 py-1.5 max-w-[160px] truncate" title={r.notes}>{r.notes || <span className="text-muted-foreground">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {insertedCount !== null && (
            <div className="rounded-md border">
              <div className="flex items-center justify-between border-b px-3 py-2 text-xs">
                <span className="font-medium">Import Report</span>
                <span>
                  <span className="text-emerald-600 dark:text-emerald-400">{insertedCount} imported</span>
                  {" · "}
                  <span className="text-amber-600 dark:text-amber-400">{failed.length} failed</span>
                </span>
              </div>
              {failed.length > 0 ? (
                <>
                  <div className="max-h-64 overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/40 text-left">
                        <tr>
                          <th className="px-3 py-1.5 w-14">Row</th>
                          <th className="px-3 py-1.5">Name</th>
                          <th className="px-3 py-1.5">Area</th>
                          <th className="px-3 py-1.5">Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {failed.map((f, i) => (
                          <tr key={i} className="border-t">
                            <td className="px-3 py-1.5">{f.rowNumber}</td>
                            <td className="px-3 py-1.5">{f.name || <span className="text-muted-foreground">—</span>}</td>
                            <td className="px-3 py-1.5">{f.area || <span className="text-muted-foreground">—</span>}</td>
                            <td className="px-3 py-1.5 text-amber-600 dark:text-amber-400">{f.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="border-t px-3 py-2">
                    <Button variant="outline" size="sm" onClick={downloadFailedCsv}>
                      <Download className="mr-1.5 h-3.5 w-3.5" /> Download failed rows (CSV)
                    </Button>
                  </div>
                </>
              ) : (
                <div className="px-3 py-4 text-center text-xs text-emerald-600 dark:text-emerald-400">
                  All rows imported successfully.
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            {insertedCount !== null ? "Close" : "Cancel"}
          </Button>
          {insertedCount === null && (
            <Button onClick={handleImport} disabled={importing || rows.length === 0}>
              {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Import {rows.length} rows
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
