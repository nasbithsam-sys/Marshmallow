import { useEffect, useState } from "react";
import { Download, FileText, Database, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DOC_SECTIONS,
  DOC_SUBTITLE,
  DOC_TITLE,
  DOC_VERSION,
  type DocBlock,
} from "@/lib/documentation-content";
import { generateDocumentationPdf } from "@/lib/documentation-pdf";
import { supabase } from "@/integrations/supabase/client";

function Block({ block }: { block: DocBlock }) {
  if (block.type === "p") {
    return (
      <p className={`text-[13px] leading-relaxed text-foreground/85 ${block.italic ? "italic text-muted-foreground" : ""}`}>
        {block.text}
      </p>
    );
  }
  if (block.type === "bullet") {
    return (
      <li className="ml-5 list-disc text-[13px] leading-relaxed text-foreground/85 marker:text-primary/60">
        {block.text}
      </li>
    );
  }
  if (block.type === "kv") {
    return (
      <p className="text-[13px] leading-relaxed text-foreground/85">
        <span className="font-semibold text-foreground">{block.label}:</span> {block.value}
      </p>
    );
  }
  if (block.type === "table") {
    return (
      <div className="overflow-x-auto rounded-lg border border-border/60">
        <table className="w-full text-[12px]">
          <thead className="bg-primary/8 text-foreground">
            <tr>
              {block.headers.map((h) => (
                <th key={h} className="px-3 py-2 text-left font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, i) => (
              <tr key={i} className="border-t border-border/40">
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-2 align-top text-foreground/85">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return null;
}

export function DocumentationTab() {
  const [downloading, setDownloading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [placesCount, setPlacesCount] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    supabase
      .from("us_places")
      .select("*", { count: "exact", head: true })
      .then(({ count }) => {
        if (alive) setPlacesCount(count ?? 0);
      });
    return () => {
      alive = false;
    };
  }, [syncing]);

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const doc = generateDocumentationPdf();
      doc.save("Account-Boosters-CRM-Documentation.pdf");
      toast.success("Documentation downloaded");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF");
    } finally {
      setDownloading(false);
    }
  };

  const handleSyncPlaces = async () => {
    if (syncing) return;
    setSyncing(true);
    const toastId = toast.loading("Syncing US population dataset (this can take a minute)…");
    try {
      const { data, error } = await supabase.functions.invoke("sync-us-places", { body: {} });
      if (error) {
        const msg = (data as { error?: string } | null)?.error ?? error.message;
        toast.error(msg || "Sync failed", { id: toastId });
        return;
      }
      const d = data as { imported?: number; skipped?: number; population_vintage?: number };
      toast.success(
        `Sync complete · ${d.imported ?? 0} places imported${
          d.population_vintage ? ` (population ${d.population_vintage})` : ""
        }`,
        { id: toastId },
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed", { id: toastId });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-border/60 bg-card/95">
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/8 p-2.5 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[15px] font-semibold tracking-tight">{DOC_TITLE} — {DOC_SUBTITLE}</p>
              <p className="text-[12px] text-muted-foreground">
                {DOC_VERSION} · Full reference: roles, statuses, tags, workflows, and tech stack.
              </p>
            </div>
          </div>
          <Button onClick={handleDownload} disabled={downloading} className="gap-2">
            <Download className="h-4 w-4" />
            {downloading ? "Preparing…" : "Download PDF"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/95">
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/8 p-2.5 text-primary">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[15px] font-semibold tracking-tight">US Population Dataset</p>
              <p className="text-[12px] text-muted-foreground">
                Powers the “Top 5 Nearby Populated Areas” lead-form box. Sync once, then refresh
                yearly when new Census ACS data is available.
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Places loaded: {placesCount == null ? "…" : placesCount.toLocaleString("en-US")}
              </p>
            </div>
          </div>
          <Button onClick={handleSyncPlaces} disabled={syncing} className="gap-2" variant="outline">
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
            {syncing ? "Syncing…" : "Sync Population Data"}
          </Button>
        </CardContent>
      </Card>


      <div className="space-y-4">
        {DOC_SECTIONS.map((section) => (
          <Card key={section.id} className="border-border/60 bg-card/95">
            <CardContent className="space-y-3 p-5">
              <h2 className="text-[15px] font-bold tracking-tight text-foreground">{section.title}</h2>
              <div className="space-y-2">
                {section.blocks.map((block, i) => (
                  <Block key={i} block={block} />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
