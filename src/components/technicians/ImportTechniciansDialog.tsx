import { useState } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { geocodeAddress, normalizeAddress } from "@/lib/geo";
import { Loader2, FileSpreadsheet } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
}

interface Row {
  name: string;
  area: string;
  service: string;
  notes: string;
  valid: boolean;
  reason?: string;
}

function normalizeKey(k: string) {
  return k.trim().toLowerCase().replace(/\s+/g, "_");
}

function parseCsv(text: string): Record<string, string>[] {
  // Minimal CSV parser: supports quoted fields and commas within quotes.
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

  const reset = () => { setRows([]); setFileName(null); };

  const handleFile = async (file: File) => {
    setFileName(file.name);
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

    const parsed: Row[] = raw.map((r) => {
      const name = (r.name ?? "").trim();
      const area = (r.area ?? "").trim();
      const service = (r.service ?? "").trim();
      const notes = (r.notes ?? "").trim();
      if (!name || !area) return { name, area, service, notes, valid: false, reason: "Missing Name or Area" };
      return { name, area, service, notes, valid: true };
    });
    setRows(parsed);
  };

  const validRows = rows.filter((r) => r.valid);
  const invalidRows = rows.filter((r) => !r.valid);

  const handleImport = async () => {
    if (!validRows.length) return;
    setImporting(true);
    try {
      // Fetch existing techs to skip duplicates by normalized name+area.
      const { data: existing } = await supabase.from("technicians").select("name, area");
      const seen = new Set(
        (existing ?? []).map((t) => `${normalizeAddress(t.name)}|${normalizeAddress(t.area)}`),
      );

      let inserted = 0;
      let skipped = invalidRows.length;
      const { data: { user } } = await supabase.auth.getUser();

      const toInsert: Array<{ name: string; area: string; service: string | null; notes: string | null; latitude: number | null; longitude: number | null; created_by: string | null }> = [];
      for (const r of validRows) {
        const key = `${normalizeAddress(r.name)}|${normalizeAddress(r.area)}`;
        if (seen.has(key)) { skipped++; continue; }
        seen.add(key);
        toInsert.push({
          name: r.name,
          area: r.area,
          service: r.service || null,
          notes: r.notes || null,
          latitude: null,
          longitude: null,
          created_by: user?.id ?? null,
        });
      }

      // Insert in chunks of 100 first (fast). Geocoding runs asynchronously afterwards.
      for (let i = 0; i < toInsert.length; i += 100) {
        const chunk = toInsert.slice(i, i + 100);
        const { data, error } = await supabase.from("technicians").insert(chunk).select("id, area");
        if (error) {
          toast({ title: "Import error", description: error.message, variant: "destructive" });
          break;
        }
        inserted += data?.length ?? 0;

        // Geocode & backfill coords in the background (no await for the UI)
        if (data) {
          (async () => {
            for (const row of data) {
              const coords = await geocodeAddress(row.area);
              if (coords) {
                await supabase.from("technicians").update({ latitude: coords.latitude, longitude: coords.longitude }).eq("id", row.id);
              }
            }
            onImported?.();
          })();
        }
      }

      toast({
        title: "Import complete",
        description: `${inserted} technicians imported. ${skipped} rows skipped.`,
      });
      onImported?.();
      onOpenChange(false);
      reset();
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Technicians</DialogTitle>
          <DialogDescription>
            Upload a .csv or .xlsx with columns: Name, Area, Service, Notes. Name and Area are required.
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
          {rows.length > 0 && (
            <div className="rounded-md border">
              <div className="flex items-center justify-between border-b px-3 py-2 text-xs">
                <span className="font-medium">Preview</span>
                <span>
                  <span className="text-emerald-600 dark:text-emerald-400">{validRows.length} valid</span>
                  {" · "}
                  <span className="text-amber-600 dark:text-amber-400">{invalidRows.length} skipped</span>
                </span>
              </div>
              <div className="max-h-64 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 text-left">
                    <tr>
                      <th className="px-3 py-1.5">Name</th>
                      <th className="px-3 py-1.5">Area</th>
                      <th className="px-3 py-1.5">Service</th>
                      <th className="px-3 py-1.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 100).map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-1.5">{r.name || <em className="text-muted-foreground">missing</em>}</td>
                        <td className="px-3 py-1.5">{r.area || <em className="text-muted-foreground">missing</em>}</td>
                        <td className="px-3 py-1.5">{r.service || <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-3 py-1.5">
                          {r.valid
                            ? <span className="text-emerald-600 dark:text-emerald-400">Valid</span>
                            : <span className="text-amber-600 dark:text-amber-400">{r.reason}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>Cancel</Button>
          <Button onClick={handleImport} disabled={importing || validRows.length === 0}>
            {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Import {validRows.length} technicians
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
