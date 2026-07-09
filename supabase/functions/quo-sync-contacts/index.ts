import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/quo-ai.ts";

type SupabaseClient = ReturnType<typeof createClient>;

type QuoContact = {
  id?: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  phoneNumbers?: Array<{ value?: string | null; number?: string | null }>;
  phone_numbers?: Array<{ value?: string | null; number?: string | null }>;
};

type PaginatedContacts = {
  data?: QuoContact[];
  nextPageToken?: string | null;
};

function extractCronSecret(value: unknown) {
  if (Array.isArray(value)) {
    return value.find((item): item is string => typeof item === "string" && item.trim().length > 0) ?? null;
  }
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof (value as Record<string, unknown>).secret === "string") {
    return String((value as Record<string, unknown>).secret);
  }
  return null;
}

function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  return digits.slice(-10); // match by last 10 digits
}

function buildDisplayName(contact: QuoContact): string | null {
  const explicit = (contact.name ?? "").trim();
  if (explicit) return explicit;
  const first = (contact.firstName ?? "").trim();
  const last = (contact.lastName ?? "").trim();
  const joined = [first, last].filter(Boolean).join(" ").trim();
  if (joined) return joined;
  const company = (contact.company ?? "").trim();
  return company || null;
}

async function requireAuth(req: Request, supabase: SupabaseClient) {
  const cronSecret = Deno.env.get("FUNCTION_CRON_SECRET");
  const requestSecret = req.headers.get("x-cron-secret");
  if (cronSecret && requestSecret === cronSecret) return null;

  if (requestSecret) {
    const { data: setting } = await supabase
      .from("quo_ai_settings")
      .select("value")
      .eq("key", "cron_secret")
      .maybeSingle();
    const storedCronSecret = extractCronSecret(setting?.value);
    if (storedCronSecret && requestSecret === storedCronSecret) return null;
  }

  const authHeader = req.headers.get("Authorization");
  const serviceRoleKey = Deno.env.get("SB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : null;
  const apiKey = req.headers.get("apikey");

  if (serviceRoleKey && (bearerToken === serviceRoleKey || apiKey === serviceRoleKey)) return null;

  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  const { data: { user }, error } = await supabase.auth.getUser(bearerToken ?? "");
  if (error || !user) return jsonResponse({ error: "Unauthorized" }, 401);

  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (roleData?.role !== "admin") {
    return jsonResponse({ error: "Admin access required" }, 403);
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey =
      Deno.env.get("SB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const quoApiKey = Deno.env.get("QUO_API_KEY");
    const quoBaseUrl = Deno.env.get("QUO_API_BASE_URL") ?? "https://api.openphone.com/v1";

    if (!supabaseUrl || !serviceRoleKey || !quoApiKey) {
      return jsonResponse({ error: "Missing Supabase or Quo API configuration." }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authErr = await requireAuth(req, supabase);
    if (authErr) return authErr;

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const overwrite = body?.overwrite === true;
    const maxPages = Math.min(Number(body?.maxPages ?? 50), 200);

    // 1. Build a set of customer numbers that need names.
    const { data: pending, error: pendingError } = await supabase
      .from("quo_conversations")
      .select("id, customer_name, customer_number")
      .not("customer_number", "is", null)
      .neq("customer_number", "");
    if (pendingError) throw pendingError;

    const needsName = new Map<string, string[]>(); // normalized digits -> conversation ids
    for (const row of pending ?? []) {
      if (!overwrite && row.customer_name && row.customer_name.trim().length > 0) continue;
      const key = normalizePhone(row.customer_number);
      if (!key) continue;
      const arr = needsName.get(key) ?? [];
      arr.push(row.id as string);
      needsName.set(key, arr);
    }

    // 2. Paginate through Quo contacts and build phone -> name map for matches.
    const phoneToName = new Map<string, string>();
    let pageToken: string | null | undefined = undefined;
    let pagesFetched = 0;
    let totalContacts = 0;

    do {
      const params = new URLSearchParams();
      params.set("maxResults", "50");
      if (pageToken) params.set("pageToken", pageToken);

      const resp = await fetch(`${quoBaseUrl}/contacts?${params.toString()}`, {
        headers: { Authorization: quoApiKey, Accept: "application/json" },
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Quo contacts request failed (${resp.status}): ${text.slice(0, 200)}`);
      }
      const payload = (await resp.json()) as PaginatedContacts;
      const contacts = payload?.data ?? [];
      totalContacts += contacts.length;

      for (const contact of contacts) {
        const name = buildDisplayName(contact);
        if (!name) continue;
        const numbers = contact.phoneNumbers ?? contact.phone_numbers ?? [];
        for (const entry of numbers) {
          const key = normalizePhone(entry?.value ?? entry?.number ?? null);
          if (!key) continue;
          if (needsName.has(key) && !phoneToName.has(key)) {
            phoneToName.set(key, name);
          }
        }
      }

      pageToken = payload?.nextPageToken ?? null;
      pagesFetched += 1;
    } while (pageToken && pagesFetched < maxPages);

    // 3. Apply updates.
    let updated = 0;
    for (const [key, name] of phoneToName.entries()) {
      const ids = needsName.get(key);
      if (!ids || ids.length === 0) continue;
      const { error: updateError } = await supabase
        .from("quo_conversations")
        .update({ customer_name: name })
        .in("id", ids);
      if (!updateError) updated += ids.length;
    }

    return jsonResponse({
      success: true,
      scanned_conversations: needsName.size,
      contacts_scanned: totalContacts,
      pages_fetched: pagesFetched,
      matched: phoneToName.size,
      conversations_updated: updated,
      overwrite,
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown contact sync error",
      },
      500,
    );
  }
});
