import { supabase } from "@/integrations/supabase/client";

export type QuoLeadStatus =
  | "raw"
  | "spam"
  | "contacted"
  | "qualified_lead"
  | "rejected"
  | "successfully_completed";

export interface QuoStatusConfig {
  label: string;
  badgeClass: string;
  description: string;
}

export const QUO_LEAD_STATUS_CONFIG: Record<QuoLeadStatus, QuoStatusConfig> = {
  raw: {
    label: "Raw",
    badgeClass: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 hover:bg-slate-200",
    description: "New unique number (message sent or received)",
  },
  spam: {
    label: "Spam",
    badgeClass: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-300 hover:bg-zinc-200",
    description: "Marketing / spam call / junk",
  },
  contacted: {
    label: "Contacted",
    badgeClass: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 hover:bg-blue-100",
    description: "Real lead, outreach made, awaiting response",
  },
  qualified_lead: {
    label: "Qualified Lead",
    badgeClass: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 hover:bg-emerald-100",
    description: "Urgent, interested",
  },
  rejected: {
    label: "Rejected",
    badgeClass: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 hover:bg-rose-100",
    description: "Price declined, not interested, hung-up, scam suspicion",
  },
  successfully_completed: {
    label: "Successfully Completed",
    badgeClass: "bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 hover:bg-teal-100",
    description: "Lead successfully completed",
  },
};

export const QUO_LEAD_STATUS_KEYS = Object.keys(
  QUO_LEAD_STATUS_CONFIG
) as QuoLeadStatus[];

/**
 * Normalizes any legacy or custom status into one of our 6 standard QuoLeadStatuses
 */
export function normalizeQuoLeadStatus(rawStatus?: string | null): QuoLeadStatus {
  if (!rawStatus) return "raw";
  const lower = rawStatus.toLowerCase().trim();

  if (lower === "raw" || lower === "new") return "raw";
  if (lower === "spam" || lower === "junk") return "spam";
  if (lower === "contacted" || lower === "outreach") return "contacted";
  if (lower === "qualified_lead" || lower === "qualified" || lower === "urgent") return "qualified_lead";
  if (lower === "rejected" || lower === "declined" || lower === "scam") return "rejected";
  if (lower === "successfully_completed" || lower === "completed" || lower === "done") return "successfully_completed";

  return "raw";
}

/**
 * Formats any UTC date/timestamp strictly in US/Eastern Time Zone (America/New_York)
 */
export function formatEasternTime(
  dateInput: string | Date | null | undefined,
  mode: "time" | "short" | "full" = "time"
): string {
  if (!dateInput) return "—";
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return "—";

  try {
    if (mode === "time") {
      // e.g. "09:02 AM"
      return date.toLocaleTimeString("en-US", {
        timeZone: "America/New_York",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    }

    if (mode === "short") {
      // e.g. "Aug 8, 09:02 AM"
      return date.toLocaleString("en-US", {
        timeZone: "America/New_York",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    }

    // e.g. "Aug 8, 2026, 09:02 AM EDT"
    return date.toLocaleString("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZoneName: "short",
    });
  } catch (err) {
    console.error("Error formatting Eastern Time", err);
    return date.toLocaleTimeString();
  }
}

/**
 * Converts a YYYY-MM-DD date string picked in Eastern Time into UTC timestamp bounds
 */
export function getEasternDateBounds(dateStr: string, boundary: "start" | "end"): Date | null {
  if (!dateStr) return null;
  try {
    // Check if current NY offset is EDT (-04:00) or EST (-05:00)
    const tempDate = new Date(`${dateStr}T12:00:00Z`);
    const nyTimeStr = tempDate.toLocaleString("en-US", { timeZone: "America/New_York", timeZoneName: "short" });
    const isEDT = nyTimeStr.includes("EDT");
    const offsetStr = isEDT ? "-04:00" : "-05:00";

    const isoStr = boundary === "start" ? `${dateStr}T00:00:00.000${offsetStr}` : `${dateStr}T23:59:59.999${offsetStr}`;
    const date = new Date(isoStr);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

/**
 * Formats phone number into standard US readable format (e.g. +1 (415) 555-0142)
 */
export function formatUsPhone(value?: string | null): string {
  if (!value) return "No number";
  const digits = value.replace(/\D/g, "");
  const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
  if (last10.length !== 10) return value;
  return `+1 (${last10.slice(0, 3)}) ${last10.slice(3, 6)}-${last10.slice(6)}`;
}

/**
 * Constructs or extracts the QUO Chat Link for a conversation
 */
export function getQuoChatUrl(quoConversationId?: string | null, customerNumber?: string | null): string {
  if (!quoConversationId && !customerNumber) return "#";

  if (quoConversationId && (quoConversationId.startsWith("http://") || quoConversationId.startsWith("https://"))) {
    return quoConversationId;
  }

  if (quoConversationId) {
    return `https://app.openphone.com/messages/${quoConversationId}`;
  }

  const cleanPhone = customerNumber ? customerNumber.replace(/\D/g, "") : "";
  return `https://app.openphone.com/messages?phone=${cleanPhone}`;
}

/**
 * Generates realistic mock test data for QUO Dashboard (Phone numbers, conversations, and messages)
 */
export async function generateMockQuoData(): Promise<{ success: boolean; count: number }> {
  try {
    // 1. Ensure sample QUO Phone Numbers exist
    const { data: existingNumbers } = await supabase.from("quo_phone_numbers").select("id, number");
    let numberIds: string[] = existingNumbers?.map((n) => n.id) || [];

    if (numberIds.length === 0) {
      const samplePhoneNumbers = [
        { quo_phone_number_id: "num_main_01", number: "+14155550100", name: "Main Line - (415) 555-0100", label: "Main Office" },
        { quo_phone_number_id: "num_emergency_02", number: "+14155550200", name: "Emergency Line - (415) 555-0200", label: "Emergency Dispatch" },
        { quo_phone_number_id: "num_marketing_03", number: "+14155550300", name: "Marketing Campaign - (415) 555-0300", label: "Google Ads Line" },
        { quo_phone_number_id: "num_support_04", number: "+14155550400", name: "Customer Service - (415) 555-0400", label: "CS Support" },
      ];

      const { data: insertedNumbers, error: numError } = await supabase
        .from("quo_phone_numbers")
        .insert(samplePhoneNumbers)
        .select("id");

      if (numError) {
        console.error("Error inserting sample numbers", numError);
      } else if (insertedNumbers) {
        numberIds = insertedNumbers.map((n) => n.id);
      }
    }

    const sampleMockLeads = [
      { name: "John Smith", phone: "+14155550142", status: "qualified_lead", preview: "Hi, I have an urgent water leak under my kitchen sink." },
      { name: "Emily Davis", phone: "+14155550198", status: "spam", preview: "We offer SEO ranking services for small businesses." },
      { name: "Michael Johnson", phone: "+14155550177", status: "contacted", preview: "Hi, how much do you charge for electrical outlet installation?" },
      { name: "Sarah Wilson", phone: "+14155550163", status: "rejected", preview: "No thanks, the quote is higher than my budget." },
      { name: "David Martinez", phone: "+14155550155", status: "successfully_completed", preview: "Job completed! Thanks for sending technician Alex so quickly." },
      { name: "Jessica Taylor", phone: "+14155550189", status: "raw", preview: "Hey, do you service the Downtown area?" },
      { name: "Robert Anderson", phone: "+14155550133", status: "qualified_lead", preview: "Need HVAC repair before tomorrow morning if possible." },
      { name: "Amanda Thomas", phone: "+14155550122", status: "contacted", preview: "I received your estimate. Can we schedule for Friday?" },
      { name: "James Jackson", phone: "+14155550111", status: "raw", preview: "Is someone available to answer a quick question?" },
      { name: "Rachel White", phone: "+14155550199", status: "successfully_completed", preview: "Invoice paid! Great service." },
    ];

    let insertedCount = 0;
    const now = Date.now();

    for (let i = 0; i < sampleMockLeads.length; i++) {
      const mock = sampleMockLeads[i];
      const hoursAgo = i * 3.5;
      const createdAtIso = new Date(now - hoursAgo * 3600 * 1000).toISOString();
      const numId = numberIds[i % numberIds.length] || null;

      const conversationIdStr = `conv_mock_${now}_${i}`;

      const { data: convData, error: convErr } = await supabase
        .from("quo_conversations")
        .insert({
          quo_conversation_id: conversationIdStr,
          customer_name: mock.name,
          customer_number: mock.phone,
          number_id: numId,
          status: mock.status,
          current_status: mock.status,
          last_message_preview: mock.preview,
          last_message_time: createdAtIso,
          last_message_at: createdAtIso,
          created_at: createdAtIso,
          updated_at: createdAtIso,
        })
        .select("id")
        .single();

      if (convErr) {
        console.error("Error inserting mock conversation", convErr);
        continue;
      }

      if (convData) {
        insertedCount++;

        // Add 2 sample messages per conversation
        await supabase.from("quo_messages").insert([
          {
            quo_message_id: `msg_mock_in_${now}_${i}`,
            conversation_id: convData.id,
            sender: "customer",
            direction: "inbound",
            text: mock.preview,
            message_time: new Date(new Date(createdAtIso).getTime() - 1000 * 60 * 5).toISOString(),
          },
          {
            quo_message_id: `msg_mock_out_${now}_${i}`,
            conversation_id: convData.id,
            sender: "agent",
            direction: "outbound",
            text: `Hello ${mock.name}, thank you for contacting us! We're reviewing your inquiry now.`,
            message_time: createdAtIso,
          },
        ]);
      }
    }

    return { success: true, count: insertedCount };
  } catch (err) {
    console.error("Failed to generate mock QUO data", err);
    return { success: false, count: 0 };
  }
}
