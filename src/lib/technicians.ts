import { supabase } from "@/integrations/supabase/client";
import type { TechnicianRecord } from "@/components/technicians/TechnicianDialog";

export const TECHNICIAN_SELECT =
  "id, name, area, service, notes, chat_link, phone_number, latitude, longitude";

const PAGE_SIZE = 1000;
const MAX_PAGES = 50; // hard safety cap = 50,000 rows

export async function fetchAllTechnicians(): Promise<TechnicianRecord[]> {
  const byId = new Map<string, TechnicianRecord>();
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("technicians")
      .select(TECHNICIAN_SELECT)
      .order("name", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to);
    if (error) throw error;
    const rows = (data ?? []) as TechnicianRecord[];
    for (const r of rows) if (r?.id) byId.set(r.id, r);
    if (rows.length < PAGE_SIZE) break;
  }
  return Array.from(byId.values()).sort((a, b) =>
    (a.name ?? "").localeCompare(b.name ?? "", undefined, { sensitivity: "base" }),
  );
}

export const TECHNICIANS_QUERY_KEY = ["technicians"] as const;

export function upsertTechnicianInList(
  list: TechnicianRecord[] | undefined,
  tech: TechnicianRecord,
): TechnicianRecord[] {
  const base = list ? list.filter((t) => t.id !== tech.id) : [];
  base.push(tech);
  return base.sort((a, b) =>
    (a.name ?? "").localeCompare(b.name ?? "", undefined, { sensitivity: "base" }),
  );
}
