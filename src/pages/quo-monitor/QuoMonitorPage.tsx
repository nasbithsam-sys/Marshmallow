import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Eye,
  EyeOff,
  GripVertical,
  Inbox,
  MessageSquare,
  Pin,
  PinOff,
  Power,
  RefreshCw,
  Search,
  Settings2,
  Table2,
  Tags,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  QUO_AI_SECTIONS,
  type QuoAiSection,
} from "@/lib/quo-ai";
import { STATUS_LABELS, type LeadStatus } from "@/lib/constants";

const NEEDS_ATTENTION_STATUSES: ReadonlySet<LeadStatus> = new Set([
  "cancelled",
  "cancellation_requested",
  "paid",
  "job_done",
  "partial_paid",
]);

type ConversationRow = {
  id: string;
  quo_conversation_id: string;
  customer_name: string | null;
  customer_number: string | null;
  last_message_preview: string | null;
  last_message_time: string | null;
  last_message_at: string | null;
  last_customer_message_at: string | null;
  last_agent_message_at: string | null;
  current_ai_section: QuoAiSection | null;
  current_priority: "low" | "medium" | "high" | "urgent" | null;
  linked_lead_id: string | null;
  ai_tags: string[] | null;
  rolling_ai_summary: string | null;
  last_ai_analyzed_at: string | null;
  raw_payload?: unknown;
  quo_messages?: Array<{ text: string | null }>;
  quo_ai_conversation_state?: QuoOpsState[] | QuoOpsState | null;
  quo_phone_numbers?: {
    id: string;
    quo_phone_number_id: string | null;
    name: string | null;
    label: string | null;
    number: string | null;
    display_number: string | null;
  } | null;
  ai_conversation_states?: AiState[] | AiState | null;
  ai_reminders?: AiReminder[];
  ai_lead_links?: AiLeadLink[];
};

type AiState = {
  section: QuoAiSection;
  priority: "low" | "medium" | "high" | "urgent";
  customer_state: string;
  lead_state: string | null;
  needs_reply: boolean;
  should_create_lead: boolean;
  should_link_lead: boolean;
  should_create_reminder: boolean;
  is_possible_dead: boolean;
  is_lost: boolean;
  lost_reason: string | null;
  confidence: number;
  risk_level: "safe" | "moderate" | "risky";
  evidence: Array<{ message_id?: string; quote?: string; why_it_matters?: string }>;
  human_review_status: string;
  latest_decision_id: string | null;
};

type QuoOpsState = {
  conversation_id: string;
  waiting_on: "staff" | "customer" | "technician" | "manager" | "no_one" | "unknown";
  urgency_level: "low" | "medium" | "high" | "critical";
  confidence: number | string | null;
  risk_level: "low" | "medium" | "high" | "critical" | null;
  requires_human_review: boolean | null;
  human_review_reason: string | null;
  last_ai_checked_at: string | null;
};

type AiReminder = {
  id: string;
  reminder_type: string;
  due_at: string;
  status: "pending" | "done" | "cancelled";
  reason: string | null;
};

type AiLeadLink = {
  id: string;
  lead_id: string;
  match_type: string;
  confidence: number;
  leads?: {
    id: string;
    job_id: string;
    customer_name: string;
    status: string;
  } | null;
};

type MessageRow = {
  id: string;
  sender: "customer" | "agent";
  text: string | null;
  message_time: string | null;
  media?: unknown[] | null;
};

type NumberPreference = {
  id: string;
  phone_number_id: string;
  label_override: string | null;
  emoji: string | null;
  hidden: boolean;
  sort_order: number | null;
};

type PinnedConversation = {
  id: string;
  conversation_id: string;
  sort_order: number | null;
  created_at: string;
};

type AdminControlStatus = {
  success: boolean;
  ingestion_paused: boolean;
};

type DbError = { message: string } | null;
type DbResult<T> = PromiseLike<{ data: T | null; error: DbError }>;
type DbCountResult<T> = PromiseLike<{ data: T | null; error: DbError; count?: number | null }>;
type LooseQuery<T = unknown> = {
  select: <Next = T>(columns?: string, options?: unknown) => LooseQuery<Next>;
  insert: <Next = T>(values: unknown) => LooseQuery<Next>;
  update: <Next = T>(values: unknown) => LooseQuery<Next>;
  upsert: <Next = T>(values: unknown, options?: unknown) => LooseQuery<Next>;
  delete: <Next = T>() => LooseQuery<Next>;
  eq: (column: string, value: unknown) => LooseQuery<T>;
  neq: (column: string, value: unknown) => LooseQuery<T>;
  not: (column: string, operator: string, value: unknown) => LooseQuery<T>;
  in: (column: string, values: unknown[]) => LooseQuery<T>;
  gte: (column: string, value: unknown) => LooseQuery<T>;
  order: (column: string, options?: unknown) => LooseQuery<T>;
  limit: (count: number) => LooseQuery<T>;
  range: (from: number, to: number) => LooseQuery<T>;
  single: () => DbResult<T>;
  maybeSingle: () => DbResult<T>;
  then: DbCountResult<T>["then"];
};
type LooseSupabase = {
  from: <T = unknown>(table: string) => LooseQuery<T>;
};

type ManualAiRunResult = {
  queued: number;
  picked?: number;
  processed?: number;
  failed?: number;
  skipped?: number;
  tagged?: number;
  ai_calls?: number;
  budget_mode?: string;
  remaining: number;
};

const sectionFilters = ["all", ...QUO_AI_SECTIONS] as const;
const priorityClasses: Record<string, string> = {
  low: "border-slate-200 bg-slate-50 text-slate-700",
  medium: "border-amber-200 bg-amber-50 text-amber-800",
  high: "border-orange-200 bg-orange-50 text-orange-800",
  urgent: "border-red-200 bg-red-50 text-red-800",
  critical: "border-red-300 bg-red-100 text-red-900",
};

function getState(conversation: ConversationRow) {
  const state = conversation.ai_conversation_states;
  const legacyState = Array.isArray(state) ? state[0] ?? null : state ?? null;
  if (legacyState) return legacyState;

  const opsState = Array.isArray(conversation.quo_ai_conversation_state)
    ? conversation.quo_ai_conversation_state[0] ?? null
    : conversation.quo_ai_conversation_state ?? null;
  if (!opsState) return null;

  const priority = opsState.urgency_level === "critical" ? "urgent" : opsState.urgency_level;
  const section: QuoAiSection = opsState.requires_human_review
    ? "needs_human_review"
    : opsState.waiting_on === "staff" || opsState.waiting_on === "manager"
      ? "needs_reply"
      : "waiting_for_customer";

  return {
    section,
    priority,
    customer_state: opsState.waiting_on,
    lead_state: null,
    needs_reply: opsState.waiting_on === "staff" || opsState.waiting_on === "manager",
    should_create_lead: false,
    should_link_lead: false,
    should_create_reminder: false,
    is_possible_dead: false,
    is_lost: false,
    lost_reason: opsState.human_review_reason,
    confidence: Number(opsState.confidence ?? 0),
    risk_level: opsState.risk_level === "high" || opsState.risk_level === "critical" ? "risky" : opsState.risk_level === "medium" ? "moderate" : "safe",
    evidence: [],
    human_review_status: opsState.requires_human_review ? "pending" : "none",
    latest_decision_id: null,
  } satisfies AiState;
}

function getAiAnalyzedAt(conversation: ConversationRow) {
  const opsState = Array.isArray(conversation.quo_ai_conversation_state)
    ? conversation.quo_ai_conversation_state[0] ?? null
    : conversation.quo_ai_conversation_state ?? null;
  return conversation.last_ai_analyzed_at ?? opsState?.last_ai_checked_at ?? null;
}

function getSection(conversation: ConversationRow) {
  return getState(conversation)?.section ?? conversation.current_ai_section ?? "needs_human_review";
}

function getPriority(conversation: ConversationRow) {
  return getState(conversation)?.priority ?? conversation.current_priority ?? "medium";
}

function formatDate(value?: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Invalid date" : date.toLocaleString();
}

function formatShortDate(value?: string | null) {
  if (!value) return "No activity";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Invalid"
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatUsPhone(value?: string | null) {
  if (!value) return "No number";
  const digits = value.replace(/\D/g, "");
  const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
  if (last10.length !== 10) return value;
  return `(${last10.slice(0, 3)}) ${last10.slice(3, 6)}-${last10.slice(6)}`;
}

function getFlagEmojiUrl(value: string) {
  const codePoints = Array.from(value.trim()).map((char) => char.codePointAt(0));
  const isFlag =
    codePoints.length === 2 &&
    codePoints.every((codePoint) => typeof codePoint === "number" && codePoint >= 0x1f1e6 && codePoint <= 0x1f1ff);

  return isFlag
    ? `https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${codePoints.map((codePoint) => codePoint!.toString(16)).join("-")}.svg`
    : null;
}

function QuoEmoji({ value, className = "" }: { value: string; className?: string }) {
  const flagUrl = getFlagEmojiUrl(value);

  if (flagUrl) {
    return <img src={flagUrl} alt={value} className={`inline-block h-4 w-4 align-[-0.125em] ${className}`} loading="lazy" />;
  }

  return <span className={className}>{value}</span>;
}

function toTitleCase(value: string) {
  return value
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getScenarioTag(conversation: ConversationRow) {
  // Only surface a tag when the AI actually produced a specific, situational one.
  // We intentionally do NOT fall back to generic section buckets ("Hot Lead",
  // "Waiting Customer Response", etc.) — the row should either show the
  // real AI-generated tag describing this chat, or "AI pending".
  const firstAiTag = conversation.ai_tags?.find((tag) => tag && tag.trim());
  if (firstAiTag) return toTitleCase(firstAiTag);

  const state = getState(conversation);
  if (state?.lost_reason) return toTitleCase(state.lost_reason);

  return "";
}

function getTableSortWeight(conversation: ConversationRow) {
  const section = getSection(conversation);
  if (section === "urgent_complaint") return 0;
  if (section === "hot_lead" || section === "new_interested_lead" || section === "needs_reply") return 1;
  if (section === "appointment_mentioned" || section === "waiting_for_customer") return 2;
  if (section === "follow_up_due_today" || section === "follow_up_tomorrow" || section === "future_follow_up") return 3;
  if (section === "needs_human_review" || section === "already_added_to_crm") return 4;
  if (section === "possible_dead") return 7;
  if (section === "lost_found_other_tech") return 8;
  if (section === "not_a_lead_spam_wrong_number") return 9;
  return 5;
}

function getLastMessageSide(conversation: ConversationRow) {
  const customerTime = conversation.last_customer_message_at ? new Date(conversation.last_customer_message_at).getTime() : 0;
  const agentTime = conversation.last_agent_message_at ? new Date(conversation.last_agent_message_at).getTime() : 0;
  if (!customerTime && !agentTime) return "Unknown";
  return customerTime >= agentTime ? "Customer" : "Us";
}

function getQuoNumberLabel(conversation: ConversationRow) {
  const number = conversation.quo_phone_numbers;
  return number?.label || number?.name || number?.display_number || number?.number || "Unknown Quo Number";
}

function getPreferredQuoNumberLabel(conversation: ConversationRow, preference?: NumberPreference | null) {
  return preference?.label_override?.trim() || getQuoNumberLabel(conversation);
}

function getPreferredQuoNumberEmoji(preference?: NumberPreference | null) {
  return preference?.emoji?.trim() || "Q";
}

function getQuoNumberDisplay(conversation: ConversationRow) {
  const number = conversation.quo_phone_numbers;
  return formatUsPhone(number?.display_number || number?.number || number?.quo_phone_number_id || null);
}

function getPayloadPhoneNumberId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as Record<string, unknown>;
  const data = payload.data && typeof payload.data === "object" ? payload.data as Record<string, unknown> : payload;
  const object = data.object && typeof data.object === "object" ? data.object as Record<string, unknown> : null;
  const message = data.message && typeof data.message === "object" ? data.message as Record<string, unknown> : object;
  const direct = message?.phoneNumberId ?? message?.phone_number_id ?? data.phoneNumberId ?? data.phone_number_id;
  return typeof direct === "string" && direct.trim() ? direct : null;
}

function getPayloadMedia(value: unknown): unknown[] {
  if (!value || typeof value !== "object") return [];
  const payload = value as Record<string, unknown>;
  const data = payload.data && typeof payload.data === "object" ? payload.data as Record<string, unknown> : payload;
  const object = data.object && typeof data.object === "object" ? data.object as Record<string, unknown> : null;
  const message = data.message && typeof data.message === "object" ? data.message as Record<string, unknown> : object;
  return Array.isArray(message?.media) ? message.media : [];
}

function getQuoChatUrl(conversation: ConversationRow) {
  const phoneNumberId = conversation.quo_phone_numbers?.quo_phone_number_id || getPayloadPhoneNumberId(conversation.raw_payload);
  if (phoneNumberId) {
    return `https://my.quo.com/inbox/${encodeURIComponent(phoneNumberId)}/c/${encodeURIComponent(conversation.quo_conversation_id)}`;
  }

  return `https://my.quo.com/inbox/c/${encodeURIComponent(conversation.quo_conversation_id)}`;
}

function getConversationTags(conversation: ConversationRow) {
  const tags = [getScenarioTag(conversation), ...(conversation.ai_tags ?? [])]
    .map((tag) => toTitleCase(tag))
    .filter((tag) => tag && tag !== "Needs Human Review")
    .filter((tag, index, all) => all.indexOf(tag) === index);
  return tags;
}

function summarizeMedia(media: unknown[] | null | undefined) {
  if (!Array.isArray(media) || media.length === 0) return null;
  let images = 0;
  let videos = 0;
  let audio = 0;

  media.forEach((item) => {
    const mediaItem = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const type = String(mediaItem.type ?? mediaItem.contentType ?? mediaItem.mime_type ?? mediaItem.mimeType ?? "").toLowerCase();
    const url = String(mediaItem.url ?? mediaItem.src ?? "").toLowerCase();
    if (type.includes("video") || /\.(mp4|mov|webm)(\?|$)/.test(url)) videos += 1;
    else if (type.includes("audio") || /\.(mp3|wav|m4a)(\?|$)/.test(url)) audio += 1;
    else images += 1;
  });

  const parts = [];
  if (images) parts.push(`${images} ${images === 1 ? "picture" : "pictures"}`);
  if (videos) parts.push(`${videos} ${videos === 1 ? "video" : "videos"}`);
  if (audio) parts.push(`${audio} ${audio === 1 ? "audio" : "audios"}`);
  return parts.join(", ");
}

function getMessagePreview(text: string | null | undefined, media?: unknown[] | null) {
  const trimmed = text?.trim();
  if (trimmed) return trimmed;
  return summarizeMedia(media) ?? "No message preview";
}

function getStoredMessageKind(message: Pick<MessageRow, "text" | "media" | "sender">) {
  const text = message.text?.trim().toLowerCase() ?? "";
  const mediaSummary = summarizeMedia(message.media);

  if (text.startsWith("call summary:")) return { label: "Call Summary", isCall: true };
  if (text.startsWith("call transcript:")) return { label: "Call Transcript", isCall: true };
  if (text.includes("call recording completed") || mediaSummary?.includes("audio")) return { label: "Call Recording", isCall: true };
  if (text.includes("call completed")) return { label: "Call", isCall: true };

  return { label: message.sender === "customer" ? "Customer" : "Us", isCall: false };
}

function getConversationPreview(conversation: ConversationRow) {
  return getMessagePreview(conversation.last_message_preview || conversation.rolling_ai_summary, getPayloadMedia(conversation.raw_payload));
}

function matchesDatePreset(value: string | null | undefined, preset: string, rangeStart: string, rangeEnd: string) {
  if (preset === "all") return true;
  if (!value) return false;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return false;

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  if (preset === "today") return time >= startOfToday.getTime();
  if (preset === "yesterday") {
    const start = new Date(startOfToday);
    start.setDate(start.getDate() - 1);
    return time >= start.getTime() && time < startOfToday.getTime();
  }
  if (preset === "week" || preset === "7d") return Date.now() - time <= 7 * 86400000;
  if (preset === "month") return Date.now() - time <= 30 * 86400000;
  if (preset === "custom") {
    const start = rangeStart ? new Date(`${rangeStart}T00:00:00`).getTime() : -Infinity;
    const end = rangeEnd ? new Date(`${rangeEnd}T23:59:59`).getTime() : Infinity;
    return time >= start && time <= end;
  }

  return true;
}

export default function QuoMonitorPage() {
  const queryClient = useQueryClient();
  const { user, role } = useAuth();
  const tableNumberScrollerRef = useRef<HTMLDivElement | null>(null);
  const loadMoreSentinelRef = useRef<HTMLTableRowElement | null>(null);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [sectionFilter, setSectionFilter] = useState<(typeof sectionFilters)[number]>("all");
  const [confidenceFilter, setConfidenceFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [linkedFilter, setLinkedFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState("");
  const [dateRangeStart, setDateRangeStart] = useState("");
  const [dateRangeEnd, setDateRangeEnd] = useState("");
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [tableNumberIds, setTableNumberIds] = useState<string[]>([]);

  // Manually-hidden customer numbers (last-10 digits) treated as internal chats.
  // Persisted in localStorage so hidden numbers stay hidden across reloads.
  const HIDDEN_INTERNAL_KEY = "quo-monitor-hidden-internal-numbers";
  const [hiddenInternalNumbers, setHiddenInternalNumbers] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = window.localStorage.getItem(HIDDEN_INTERNAL_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(list) ? list.filter((v): v is string => typeof v === "string") : []);
    } catch {
      return new Set();
    }
  });

  const toggleInternalHidden = (rawNumber: string | null | undefined) => {
    if (!rawNumber) return;
    const digits = rawNumber.replace(/\D/g, "");
    const key = digits.length >= 10 ? digits.slice(-10) : digits;
    if (!key) return;
    setHiddenInternalNumbers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        window.localStorage.setItem(HIDDEN_INTERNAL_KEY, JSON.stringify(Array.from(next)));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const db = supabase as unknown as LooseSupabase;
  const isAdmin = role === "admin";

  // Server-side pagination with automatic history hydration. The first large
  // page loads immediately, then remaining pages are pulled in so older chats
  // are available to date/search/number filters.
  const CONVERSATIONS_PAGE_SIZE = 300;

  // Ops-state table is small (<1k rows); fetch once, merge in memo below.
  const opsStatesQuery = useQuery({
    queryKey: ["quo-ai-ops-states"],
    queryFn: async () => {
      const { data, error } = await db
        .from("quo_ai_conversation_state")
        .select("conversation_id, waiting_on, urgency_level, confidence, risk_level, requires_human_review, human_review_reason, last_ai_checked_at");
      if (error) throw error;
      return (data ?? []) as QuoOpsState[];
    },
    staleTime: 30_000,
  });

  // Auto-fetch next page when the sentinel row scrolls into view.
  useEffect(() => {
    const node = loadMoreSentinelRef.current;
    if (!node) return;
    if (!conversationsQuery.hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !conversationsQuery.isFetchingNextPage) {
          conversationsQuery.fetchNextPage();
        }
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
    // Only re-observe when pagination state flips — depending on `data` or the
    // (referentially unstable) `fetchNextPage` rebuilds the observer on every
    // page load and leaves a short window where the sentinel is un-observed.
  }, [conversationsQuery.hasNextPage, conversationsQuery.isFetchingNextPage]);


  // Fetch all registered Quo phone numbers so we can detect internal conversations
  const phoneNumbersQuery = useQuery({
    queryKey: ["quo-phone-numbers-list"],
    queryFn: async () => {
      const { data, error } = await db
        .from("quo_phone_numbers")
        .select("number, display_number, quo_phone_number_id");
      if (error) throw error;
      return (data ?? []) as Array<{ number: string | null; display_number: string | null; quo_phone_number_id: string | null }>;
    },
    staleTime: 5 * 60_000,
  });


  // Build a set of last-10-digit normalized Quo phone numbers for fast lookups
  // Uses last-10-digit matching, consistent with how the rest of the codebase normalizes Quo numbers
  const knownQuoNumbers = useMemo(() => {
    const set = new Set<string>();
    const last10 = (s: string | null) => {
      if (!s) return null;
      const digits = s.replace(/\D/g, "");
      return digits.length >= 10 ? digits.slice(-10) : digits || null;
    };
    for (const row of (phoneNumbersQuery.data ?? [])) {
      const n = last10(row.number);
      const d = last10(row.display_number);
      const q = last10(row.quo_phone_number_id);
      if (n) set.add(n);
      if (d) set.add(d);
      if (q) set.add(q);
    }
    return set;
  }, [phoneNumbersQuery.data]);

  // Fetch all lead phone numbers so we can detect when a Quo chat is already
  // wired to a CRM lead by phone (not just via ai_lead_links / linked_lead_id).
  const leadsPhonesQuery = useQuery({
    queryKey: ["quo-monitor-lead-phones"],
    queryFn: async () => {
      const { data, error } = await db
        .from("leads")
        .select("id, job_id, customer_name, customer_phone, status")
        .not("customer_phone", "is", null);
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        job_id: string | null;
        customer_name: string | null;
        customer_phone: string | null;
        status: string | null;
      }>;
    },
    staleTime: 60_000,
  });

  const leadByPhoneKey = useMemo(() => {
    const map = new Map<string, { id: string; job_id: string | null; customer_name: string | null; status: string | null }>();
    for (const row of leadsPhonesQuery.data ?? []) {
      const digits = (row.customer_phone ?? "").replace(/\D/g, "");
      if (digits.length >= 10) {
        const key = digits.slice(-10);
        if (!map.has(key)) map.set(key, row);
      }
    }
    return map;
  }, [leadsPhonesQuery.data]);

  const leadPhoneKeys = useMemo(() => new Set(leadByPhoneKey.keys()), [leadByPhoneKey]);

  const isConversationInCrm = useMemo(() => {
    return (conversation: ConversationRow) => {
      if (conversation.linked_lead_id) return true;
      if (conversation.ai_lead_links && conversation.ai_lead_links.length > 0) return true;
      const digits = (conversation.customer_number ?? "").replace(/\D/g, "");
      if (digits.length >= 10 && leadPhoneKeys.has(digits.slice(-10))) return true;
      return false;
    };
  }, [leadPhoneKeys]);




  const messagesQuery = useQuery({
    queryKey: ["quo-ai-messages", selectedConvId],
    queryFn: async () => {
      if (!selectedConvId) return [];
      const allMessages: MessageRow[] = [];
      const PAGE_SIZE = 1000;

      for (let from = 0; from < 10000; from += PAGE_SIZE) {
        const { data, error } = await db
          .from("quo_messages")
          .select("id, sender, text, message_time, media")
          .eq("conversation_id", selectedConvId)
          .order("message_time", { ascending: true })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;

        const page = (data ?? []) as MessageRow[];
        allMessages.push(...page);
        if (page.length < PAGE_SIZE) break;
      }

      return allMessages;
    },
    enabled: Boolean(selectedConvId),
  });

  const adminStatusQuery = useQuery({
    queryKey: ["quo-admin-controls-status"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<AdminControlStatus>("quo-admin-controls", {
        body: { action: "get_status" },
      });
      if (error) throw error;
      return data ?? { success: true, ingestion_paused: false };
    },
    enabled: isAdmin,
  });

  const numberPreferencesQuery = useQuery({
    queryKey: ["quo-number-preferences"],
    queryFn: async () => {
      const { data, error } = await db
        .from("quo_number_preferences")
        .select("*")
        .order("sort_order", { ascending: true, nullsFirst: false });
      if (error) {
        if (error.message?.includes("quo_number_preferences")) return [];
        throw error;
      }
      return (data ?? []) as NumberPreference[];
    },
    enabled: isAdmin,
  });

  const pinnedConversationsQuery = useQuery({
    queryKey: ["quo-pinned-conversations"],
    queryFn: async () => {
      const { data, error } = await db
        .from("quo_pinned_conversations")
        .select("*")
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (error) {
        if (error.message?.includes("quo_pinned_conversations")) return [];
        throw error;
      }
      return (data ?? []) as PinnedConversation[];
    },
    enabled: isAdmin,
  });

  // Server-side full-text search over quo_messages. Only runs when the user
  // is actively searching, so the main list stays fast.
  const messageSearchQuery = useQuery({
    queryKey: ["quo-message-search", deferredSearch.trim().toLowerCase()],
    queryFn: async () => {
      const q = deferredSearch.trim();
      if (q.length < 2) return new Set<string>();
      const escaped = q.replace(/[%_,()]/g, (m) => `\\${m}`);
      const rows: Array<{ conversation_id: string | null }> = [];
      const PAGE_SIZE = 1000;

      for (let from = 0; from < 10000; from += PAGE_SIZE) {
        const { data, error } = await (db
          .from("quo_messages")
          .select("conversation_id") as any)
          .ilike("text", `%${escaped}%`)
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        const page = (data ?? []) as Array<{ conversation_id: string | null }>;
        rows.push(...page);
        if (page.length < PAGE_SIZE) break;
      }

      return new Set<string>(
        rows
          .map((r) => r.conversation_id)
          .filter((id): id is string => Boolean(id)),
      );
    },
    enabled: deferredSearch.trim().length >= 2,
    staleTime: 30_000,
  });

  const messageSearchHits = messageSearchQuery.data ?? null;

  const conversations = useMemo(() => {
    const pages = conversationsQuery.data?.pages ?? [];
    const flat = pages.flat();
    const opsByConversation = new Map((opsStatesQuery.data ?? []).map((state) => [state.conversation_id, state]));
    return flat.map((row) => ({
      ...row,
      quo_ai_conversation_state: opsByConversation.get(row.id) ?? row.quo_ai_conversation_state ?? null,
    }));
  }, [conversationsQuery.data, opsStatesQuery.data]);
  const numberPreferences = useMemo(() => numberPreferencesQuery.data ?? [], [numberPreferencesQuery.data]);
  const preferenceByNumberId = useMemo(
    () => new Map(numberPreferences.map((preference) => [preference.phone_number_id, preference])),
    [numberPreferences],
  );
  const pinnedConversations = useMemo(() => pinnedConversationsQuery.data ?? [], [pinnedConversationsQuery.data]);
  const pinnedConversationIds = useMemo(
    () => new Set(pinnedConversations.map((pin) => pin.conversation_id)),
    [pinnedConversations],
  );
  const numberOptions = useMemo(() => {
    const values = new Map<string, string>();
    conversations.forEach((conversation) => {
      const number = conversation.quo_phone_numbers;
      const id = number?.id;
      if (id) values.set(id, getPreferredQuoNumberLabel(conversation, preferenceByNumberId.get(id)));
    });
    return Array.from(values.entries());
  }, [conversations, preferenceByNumberId]);

  const filteredConversations = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    return conversations.filter((conversation) => {
      const state = getState(conversation);
      const section = getSection(conversation);
      const confidence = state?.confidence ?? 0;
      const linked = isConversationInCrm(conversation);
      const numberId = conversation.quo_phone_numbers?.id;
      const preference = numberId ? preferenceByNumberId.get(numberId) : null;
      const lastActivity = conversation.last_message_at ?? conversation.last_message_time;
      const scenarioTag = getScenarioTag(conversation);
      const rowTags = getConversationTags(conversation);

      if (sectionFilter !== "all" && section !== sectionFilter) return false;
      if (preference?.hidden) return false;

      // Filter out internal Quo-to-Quo staff conversations
      // These have a customer_number that matches one of our own registered Quo phone lines
      // Uses last-10-digit matching, consistent with the rest of the codebase
      if (conversation.customer_number) {
        const digits = conversation.customer_number.replace(/\D/g, "");
        const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
        if (last10 && knownQuoNumbers.has(last10)) return false;
        if (last10 && hiddenInternalNumbers.has(last10)) return false;
      } else {
        // No customer number = internal/system message, skip
        return false;
      }
      if (tableNumberIds.length > 0 && (!numberId || !tableNumberIds.includes(numberId))) return false;
      if (confidenceFilter === "high" && confidence < 0.9) return false;
      if (confidenceFilter === "review" && confidence >= 0.75) return false;
      if (linkedFilter === "linked" && !linked) return false;
      if (linkedFilter === "unlinked" && linked) return false;
      if (!matchesDatePreset(lastActivity, dateFilter, dateRangeStart, dateRangeEnd)) return false;
      if (tagFilter.trim() && !rowTags.some((tag) => tag.toLowerCase().includes(tagFilter.trim().toLowerCase()))) return false;
      if (query) {
        const haystack = [
          conversation.customer_name,
          conversation.customer_number,
          conversation.customer_number ? `@${conversation.customer_number.replace(/\s+/g, "")}` : null,
          conversation.last_message_preview,
          conversation.rolling_ai_summary,
          scenarioTag,
          ...rowTags,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const metaMatch = haystack.includes(query);
        const messageMatch = messageSearchHits ? messageSearchHits.has(conversation.id) : false;
        if (!metaMatch && !messageMatch) return false;
      }

      return true;
    });
  }, [
    conversations,
    confidenceFilter,
    dateFilter,
    dateRangeEnd,
    dateRangeStart,
    knownQuoNumbers,
    hiddenInternalNumbers,
    isConversationInCrm,
    linkedFilter,
    messageSearchHits,
    preferenceByNumberId,
    deferredSearch,
    sectionFilter,
    tableNumberIds,
    tagFilter,
  ]);

  const ingestionToggleMutation = useMutation({
    mutationFn: async (paused: boolean) => {
      const { data, error } = await supabase.functions.invoke<AdminControlStatus>("quo-admin-controls", {
        body: { action: "set_ingestion_paused", paused },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(data?.ingestion_paused ? "Quo ingestion paused" : "Quo ingestion resumed");
      queryClient.invalidateQueries({ queryKey: ["quo-admin-controls-status"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to update ingestion switch"),
  });


  const numberPreferenceMutation = useMutation({
    mutationFn: async ({ phoneNumberId, patch }: { phoneNumberId: string; patch: Partial<NumberPreference> }) => {
      const { error } = await db.from("quo_number_preferences").upsert(
        {
          phone_number_id: phoneNumberId,
          ...patch,
          updated_by: user?.id ?? null,
        },
        { onConflict: "phone_number_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quo-number-preferences"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to save number settings"),
  });

  const pinConversationMutation = useMutation({
    mutationFn: async ({ conversationId, pinned }: { conversationId: string; pinned: boolean }) => {
      if (pinned) {
        const { error } = await db.from("quo_pinned_conversations").delete().eq("conversation_id", conversationId);
        if (error) throw error;
        return;
      }

      if (pinnedConversations.length >= 50) {
        throw new Error("Pin limit reached. Unpin one chat before pinning another.");
      }

      const { error } = await db.from("quo_pinned_conversations").insert({
        conversation_id: conversationId,
        pinned_by: user?.id ?? null,
        sort_order: pinnedConversations.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quo-pinned-conversations"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to update pinned chat"),
  });

  const ingestionPaused = Boolean(adminStatusQuery.data?.ingestion_paused);
  const selectedMessages = messagesQuery.data ?? [];
  const selectedNumberLabel =
    tableNumberIds.length === 0
      ? "All visible numbers"
      : tableNumberIds.length === 1
        ? numberOptions.find(([id]) => id === tableNumberIds[0])?.[1] ?? "Selected number"
        : `${tableNumberIds.length} numbers selected`;
  const numberSummaries = useMemo(() => {
    const counts = new Map<string, { label: string; emoji: string; count: number; latest: string | null; urgent: number; hidden: boolean; sort: number }>();

    conversations.forEach((conversation) => {
      const number = conversation.quo_phone_numbers;
      const id = number?.id ?? "unknown";
      const preference = id !== "unknown" ? preferenceByNumberId.get(id) : null;
      const label = id === "unknown" ? "Other / Web" : getPreferredQuoNumberLabel(conversation, preference);
      const existing = counts.get(id) ?? {
        label,
        emoji: id === "unknown" ? "🌐" : getPreferredQuoNumberEmoji(preference),
        count: 0,
        latest: null,
        urgent: 0,
        hidden: Boolean(preference?.hidden),
        sort: id === "unknown" ? 9998 : (preference?.sort_order ?? 9999),
      };
      const lastActivity = conversation.last_message_at ?? conversation.last_message_time;
      existing.count += 1;
      existing.urgent += getPriority(conversation) === "urgent" ? 1 : 0;
      existing.latest =
        !existing.latest || (lastActivity && new Date(lastActivity).getTime() > new Date(existing.latest).getTime())
          ? lastActivity ?? existing.latest
          : existing.latest;
      counts.set(id, existing);
    });

    return Array.from(counts.entries()).sort(([, left], [, right]) => {
      if (left.hidden !== right.hidden) return Number(left.hidden) - Number(right.hidden);
      if (left.sort !== right.sort) return left.sort - right.sort;
      const leftTime = left.latest ? new Date(left.latest).getTime() : 0;
      const rightTime = right.latest ? new Date(right.latest).getTime() : 0;
      return rightTime - leftTime;
    });
  }, [conversations, preferenceByNumberId]);
  const tagSummaries = useMemo(() => {
    const counts = new Map<string, number>();

    conversations.forEach((conversation) => {
      getConversationTags(conversation)
        .filter((tag) => !tag.startsWith("@"))
        .forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1));
    });

    return Array.from(counts.entries()).sort((left, right) => right[1] - left[1]);
  }, [conversations]);

  const tagScenarioGroups = useMemo(() => {
    const scenarios: { key: string; label: string; match: (t: string) => boolean }[] = [
      {
        key: "lost",
        label: "Lost / Not Proceeding",
        match: (t) =>
          /(lost|found other|another tech|no longer|not interested|already fixed|fixed the issue|declined|cancel|too expensive|ghost|dead)/i.test(t),
      },
      {
        key: "hot",
        label: "Hot / Interested",
        match: (t) => /(hot|interested|new (interested )?(lead|customer)|ready|eager)/i.test(t),
      },
      {
        key: "reply",
        label: "Needs Reply",
        match: (t) => /(needs reply|customer needs reply|awaiting reply|reply needed)/i.test(t),
      },
      {
        key: "followup",
        label: "Follow Up",
        match: (t) => /(follow up|followup|check back|reach out)/i.test(t),
      },
      {
        key: "scheduling",
        label: "Scheduling",
        match: (t) => /(schedul|appointment|booking|book|reschedul)/i.test(t),
      },
      {
        key: "waiting",
        label: "Waiting Customer",
        match: (t) => /(waiting (for )?(customer|cx|cust)|waiting customer response|pending customer)/i.test(t),
      },
      {
        key: "quote",
        label: "Quote / Estimate",
        match: (t) => /(quote|estimate|pricing|price|invoice)/i.test(t),
      },
      {
        key: "urgent",
        label: "Urgent / Complaint",
        match: (t) => /(urgent|complaint|angry|upset|escalat|emergency)/i.test(t),
      },
      {
        key: "spam",
        label: "Spam / Wrong",
        match: (t) => /(spam|wrong number|not a lead|junk|bot)/i.test(t),
      },
      {
        key: "crm",
        label: "Already in CRM",
        match: (t) => /(already (in|added)|in crm|linked)/i.test(t),
      },
      {
        key: "review",
        label: "Human Review",
        match: (t) => /(human review|needs review|manual review|unclear)/i.test(t),
      },
    ];

    const groups = new Map<string, { key: string; label: string; tags: { tag: string; count: number }[] }>();
    const other: { tag: string; count: number }[] = [];

    tagSummaries.forEach(([tag, count]) => {
      const scenario = scenarios.find((s) => s.match(tag));
      if (!scenario) {
        other.push({ tag, count });
        return;
      }
      if (!groups.has(scenario.key)) {
        groups.set(scenario.key, { key: scenario.key, label: scenario.label, tags: [] });
      }
      groups.get(scenario.key)!.tags.push({ tag, count });
    });

    const ordered = scenarios
      .map((s) => groups.get(s.key))
      .filter((g): g is { key: string; label: string; tags: { tag: string; count: number }[] } => Boolean(g && g.tags.length));

    if (other.length) {
      ordered.push({ key: "other", label: "Other", tags: other });
    }

    return ordered;
  }, [tagSummaries]);

  const tableConversations = useMemo(() => {
    return filteredConversations.slice().sort((left, right) => {
      const leftPinned = pinnedConversationIds.has(left.id);
      const rightPinned = pinnedConversationIds.has(right.id);
      if (leftPinned !== rightPinned) return leftPinned ? -1 : 1;

      const leftWeight = getTableSortWeight(left);
      const rightWeight = getTableSortWeight(right);
      if (leftWeight !== rightWeight) return leftWeight - rightWeight;

      const leftTime = new Date(left.last_message_at ?? left.last_message_time ?? 0).getTime() || 0;
      const rightTime = new Date(right.last_message_at ?? right.last_message_time ?? 0).getTime() || 0;
      return rightTime - leftTime;
    });
  }, [filteredConversations, pinnedConversationIds]);
  const manualAiCandidates = useMemo(
    () =>
      tableConversations.filter((conversation) => {
        const realTags = getConversationTags(conversation);
        return getSection(conversation) === "needs_human_review" || realTags.length === 0;
      }),
    [tableConversations],
  );
  const visibleNumberSummaries = useMemo(
    () => numberSummaries.filter(([, item]) => !item.hidden),
    [numberSummaries],
  );

  const manualAiRunMutation = useMutation({
    mutationFn: async (): Promise<ManualAiRunResult> => {
      if (!isAdmin) throw new Error("Admin access required.");

      const batch = manualAiCandidates.slice(0, 50);
      if (batch.length === 0) {
        return { queued: 0, processed: 0, remaining: 0 };
      }

      // Enqueue fresh jobs for all candidates (debounce=0 so they're due immediately)
      // Note: ON CONFLICT on existing pending jobs may return null — that's fine,
      // those jobs are already pending and will be picked up by force_ai below
      for (const conversation of batch) {
        const priority = getPriority(conversation);
        await supabase.rpc("enqueue_quo_ai_job", {
          _conversation_id: conversation.id,
          _latest_message_id: null,
          _job_type: "message_analysis",
          _priority: priority === "urgent" ? "critical" : priority,
          _debounce_seconds: 0,
        });
      }

      // Invoke processor with force_ai=true — this bypasses run_after so ALL pending
      // jobs (including debounced ones) are processed immediately
      const { data, error } = await supabase.functions.invoke<Omit<ManualAiRunResult, "queued" | "remaining">>("ai-process-quo-jobs", {
        body: { batch_size: 50, force_ai: true },
      });
      if (error) throw error;

      return {
        queued: batch.length,
        picked: data?.picked,
        processed: data?.processed,
        failed: data?.failed,
        skipped: data?.skipped,
        tagged: data?.tagged,
        ai_calls: data?.ai_calls,
        budget_mode: data?.budget_mode,
        remaining: Math.max(manualAiCandidates.length - batch.length, 0),
      };
    },
    onSuccess: (result) => {
      if (result.queued === 0) {
        toast.info("No visible chats need AI tagging right now.");
      } else if ((result.skipped ?? 0) > 0 && (result.tagged ?? 0) === 0) {
        toast.warning(
          `AI skipped ${result.skipped ?? 0} chat${result.skipped === 1 ? "" : "s"} because budget mode is ${result.budget_mode ?? "limited"}. No tags were saved.`,
        );
      } else if ((result.processed ?? 0) > 0 && (result.tagged ?? 0) === 0) {
        toast.warning(
          `AI processed ${result.processed ?? 0} chat${result.processed === 1 ? "" : "s"} with ${result.ai_calls ?? 0} AI call${result.ai_calls === 1 ? "" : "s"} but saved 0 tags. Check model output quality.`,
        );
      } else {
        toast.success(
          `AI tagging run queued ${result.queued} chat${result.queued === 1 ? "" : "s"}; tagged ${result.tagged ?? 0}, processed ${result.processed ?? 0}, AI calls ${result.ai_calls ?? 0}. ${result.remaining} left in this view.`,
        );
      }
      queryClient.invalidateQueries({ queryKey: ["quo-ai-conversations"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to run AI tagging test"),
  });
  const toggleTableNumber = (id: string) => {
    setTableNumberIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };
  const scrollTableNumberList = (direction: -1 | 1) => {
    tableNumberScrollerRef.current?.scrollBy({
      left: direction * 420,
      behavior: "smooth",
    });
  };
  const moveNumberPreference = (phoneNumberId: string, direction: -1 | 1) => {
    const visible = numberSummaries.filter(([id]) => id !== "unknown");
    const index = visible.findIndex(([id]) => id === phoneNumberId);
    const target = visible[index + direction];
    if (index < 0 || !target) return;

    const currentPreference = preferenceByNumberId.get(phoneNumberId);
    const targetPreference = preferenceByNumberId.get(target[0]);
    numberPreferenceMutation.mutate({
      phoneNumberId,
      patch: { sort_order: targetPreference?.sort_order ?? index + direction },
    });
    numberPreferenceMutation.mutate({
      phoneNumberId: target[0],
      patch: { sort_order: currentPreference?.sort_order ?? index },
    });
  };

  useEffect(() => {
    if (!filteredConversations.length) {
      setSelectedConvId(null);
      return;
    }

    if (!selectedConvId || !filteredConversations.some((conversation) => conversation.id === selectedConvId)) {
      const first = filteredConversations[0];
      setSelectedConvId(first.id);
    }
  }, [filteredConversations, selectedConvId]);

  useEffect(() => {
    if (!isAdmin) return;

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleConversationRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["quo-ai-conversations"] });
      }, 250);
    };

    const upsertLiveConversation = (row: Partial<ConversationRow> | null | undefined) => {
      if (!row?.id) return;
      type InfShape = { pages: ConversationRow[][]; pageParams: unknown[] };
      queryClient.setQueryData<InfShape>(["quo-ai-conversations"], (current) => {
        if (!current) return current;
        const pages = current.pages.map((p) => p.slice());
        for (let i = 0; i < pages.length; i += 1) {
          const idx = pages[i].findIndex((c) => c.id === row.id);
          if (idx !== -1) {
            pages[i][idx] = { ...pages[i][idx], ...row } as ConversationRow;
            return { ...current, pages };
          }
        }
        // New conversation — prepend to the first page.
        if (pages.length === 0) pages.push([]);
        pages[0] = [{ ...(row as ConversationRow), quo_phone_numbers: null }, ...pages[0]];
        return { ...current, pages };
      });
    };

    const upsertLiveMessage = (row: Partial<MessageRow> | null | undefined) => {
      if (!row?.id || !selectedConvId) return;
      const conversationId = (row as Partial<MessageRow> & { conversation_id?: string | null }).conversation_id;
      if (conversationId !== selectedConvId) return;

      queryClient.setQueryData<MessageRow[]>(["quo-ai-messages", selectedConvId], (current = []) => {
        const normalized = row as MessageRow;
        const existingIndex = current.findIndex((message) => message.id === normalized.id);
        const next = existingIndex === -1 ? [...current, normalized] : current.map((message) => message.id === normalized.id ? { ...message, ...normalized } : message);
        return next.sort((left, right) => new Date(left.message_time ?? 0).getTime() - new Date(right.message_time ?? 0).getTime());
      });
    };

    const channel = supabase
      .channel("quo-monitor-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "quo_conversations" }, (payload) => {
        if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
          upsertLiveConversation(payload.new as Partial<ConversationRow>);
        }
        scheduleConversationRefresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "ai_conversation_states" }, scheduleConversationRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "quo_ai_conversation_state" }, scheduleConversationRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "ai_lead_links" }, scheduleConversationRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => {
        queryClient.invalidateQueries({ queryKey: ["quo-monitor-lead-phones"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "quo_pinned_conversations" }, () => {
        queryClient.invalidateQueries({ queryKey: ["quo-pinned-conversations"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "quo_messages" }, (payload) => {
        const changedConversationId =
          typeof payload.new === "object" && payload.new && "conversation_id" in payload.new
            ? String(payload.new.conversation_id)
            : typeof payload.old === "object" && payload.old && "conversation_id" in payload.old
              ? String(payload.old.conversation_id)
              : null;

        if (changedConversationId && changedConversationId === selectedConvId) {
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            upsertLiveMessage(payload.new as Partial<MessageRow>);
          }
          if (payload.eventType !== "INSERT") {
            queryClient.invalidateQueries({ queryKey: ["quo-ai-messages", selectedConvId] });
          }
        }

        scheduleConversationRefresh();
      })
      .subscribe();

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      void supabase.removeChannel(channel);
    };
  }, [isAdmin, queryClient, selectedConvId]);

  // Auto-trigger AI processing on page load if there are any pending jobs
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;

    const autoTriggerPendingJobs = async () => {
      try {
        // Check if there are any pending or failed jobs in the queue
        const db2 = supabase as unknown as LooseSupabase;
        const { data: pendingJobs, error } = (await db2
          .from("quo_ai_jobs")
          .select("id")
          .in("status", ["pending", "failed"])
          .limit(1)) as { data: Array<{ id: string }> | null; error: unknown };

        if (error || cancelled) return;

        if (pendingJobs && pendingJobs.length > 0) {
          // Silently invoke the processor — no toast, just background work
          await supabase.functions.invoke("ai-process-quo-jobs", {
            body: { batch_size: 50, force_ai: true },
          });
          if (!cancelled) {
            // Refresh conversations after a short delay to pick up new tags
            setTimeout(() => {
              queryClient.invalidateQueries({ queryKey: ["quo-ai-conversations"] });
            }, 4000);
          }
        }
      } catch {
        // Silent — auto-trigger failures should not surface errors to the user
      }
    };

    // Small delay so the page renders first
    const timer = setTimeout(autoTriggerPendingJobs, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isAdmin, queryClient]);

  return (
    <div className="quo-theme overflow-hidden rounded-2xl border border-slate-800 bg-[#111217] text-slate-100 shadow-2xl">
      <div className="grid h-[calc(100vh-96px)] min-h-[760px] grid-cols-1 max-lg:h-auto max-lg:min-h-0">
        <main className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#111217]">
<div className="space-y-4 border-b border-slate-800 bg-[#101116] px-5 py-4">
  <div className="flex flex-wrap items-center justify-between gap-3">
    <div>
      <div className="flex items-center gap-2 text-lg font-semibold text-white">
        <Table2 className="h-5 w-5 text-blue-300" />
        AI Tagged Chats
      </div>
      <div className="mt-1 text-sm text-slate-400">
        {filteredConversations.length} chats in {selectedNumberLabel}. AI updates only the conversation that received a new message.
      </div>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      {isAdmin && (
        <Button
          size="sm"
          variant="outline"
          className={`border-slate-700 bg-transparent hover:bg-slate-800 ${
            ingestionPaused ? "text-amber-200" : "text-emerald-200"
          }`}
          onClick={() => ingestionToggleMutation.mutate(!ingestionPaused)}
          disabled={adminStatusQuery.isLoading || ingestionToggleMutation.isPending}
        >
          <Power className="mr-2 h-4 w-4" />
          {ingestionPaused ? "Paused" : "Live"}
        </Button>
      )}
      {isAdmin && (
        <Button
          size="sm"
          variant="outline"
          className="border-cyan-700 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20 hover:text-cyan-100"
          onClick={() => manualAiRunMutation.mutate()}
          disabled={manualAiRunMutation.isPending || manualAiCandidates.length === 0}
          title="Runs AI tagging for up to 50 visible chats that have no real tag or still need human review."
        >
          <Tags className="mr-2 h-4 w-4" />
          {manualAiRunMutation.isPending ? "Running AI..." : `Run AI tags (${Math.min(manualAiCandidates.length, 50)})`}
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white"
        onClick={() => queryClient.invalidateQueries({ queryKey: ["quo-ai-conversations"] })}
      >
        <RefreshCw className="mr-2 h-4 w-4" />
        Refresh
      </Button>
    </div>
  </div>


  <div className="flex flex-wrap items-center gap-3">
    <div className="relative flex-1 min-w-[280px]">
      <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
      <Input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search customer number, AI tag, last message, or @phone"
        className="h-11 border-slate-800 bg-[#0b0c10] pl-9 text-slate-100 placeholder:text-slate-500"
      />
    </div>

    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        className={`h-9 border-slate-800 text-xs ${
          sectionFilter === "needs_reply" ? "bg-red-500/15 text-red-200 border-red-500/30" : "bg-[#0b0c10] text-slate-300"
        }`}
        onClick={() => setSectionFilter(sectionFilter === "needs_reply" ? "all" : "needs_reply")}
      >
        Needs reply
      </Button>
      <Button
        size="sm"
        variant="outline"
        className={`h-9 border-slate-800 text-xs ${
          confidenceFilter === "review" ? "bg-amber-500/15 text-amber-200 border-amber-500/30" : "bg-[#0b0c10] text-slate-300"
        }`}
        onClick={() => setConfidenceFilter(confidenceFilter === "review" ? "all" : "review")}
      >
        AI review
      </Button>
      <Button
        size="sm"
        variant="outline"
        className={`h-9 border-slate-800 text-xs ${
          linkedFilter === "linked" ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/30" : "bg-[#0b0c10] text-slate-300"
        }`}
        onClick={() => setLinkedFilter(linkedFilter === "linked" ? "all" : "linked")}
      >
        In CRM
      </Button>
      <Button
        size="sm"
        variant="outline"
        className={`h-9 border-slate-800 text-xs ${
          linkedFilter === "unlinked" ? "bg-cyan-500/15 text-cyan-200 border-cyan-500/30" : "bg-[#0b0c10] text-slate-300"
        }`}
        onClick={() => setLinkedFilter(linkedFilter === "unlinked" ? "all" : "unlinked")}
      >
        Not in CRM
      </Button>
      {(sectionFilter !== "all" || confidenceFilter !== "all" || linkedFilter !== "all" || dateFilter !== "all" || tagFilter !== "") && (
        <Button
          size="sm"
          variant="ghost"
          className="h-9 text-xs text-slate-400 hover:text-white"
          onClick={() => {
            setSectionFilter("all");
            setConfidenceFilter("all");
            setLinkedFilter("all");
            setDateFilter("all");
            setTagFilter("");
            setDateRangeStart("");
            setDateRangeEnd("");
          }}
        >
          Reset
        </Button>
      )}
    </div>
  </div>

  <div className="space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        <Inbox className="h-3.5 w-3.5" />
        Quo numbers
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 bg-[#0b0c10] p-1 rounded-xl border border-slate-800/80">
          {(["all", "today", "yesterday", "week", "month"] as ReadonlyArray<string>).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => {
                setDateFilter(preset);
                if (preset !== "custom") {
                  setDateRangeStart("");
                  setDateRangeEnd("");
                }
              }}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                dateFilter === preset
                  ? "bg-blue-500/20 text-blue-200 border border-blue-500/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {preset === "all" ? "All dates" : toTitleCase(preset)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            value={dateRangeStart}
            onChange={(event) => {
              setDateRangeStart(event.target.value);
              setDateFilter("custom");
            }}
            className="h-8 w-[125px] border-slate-800 bg-slate-900 text-xs text-slate-100 rounded-xl"
          />
          <span className="text-[10px] text-slate-500">to</span>
          <Input
            type="date"
            value={dateRangeEnd}
            onChange={(event) => {
              setDateRangeEnd(event.target.value);
              setDateFilter("custom");
            }}
            className="h-8 w-[125px] border-slate-800 bg-slate-900 text-xs text-slate-100 rounded-xl"
          />
        </div>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="h-9 w-9 shrink-0 rounded-full border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
        onClick={() => scrollTableNumberList(-1)}
        title="Scroll Quo numbers left"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div
        ref={tableNumberScrollerRef}
        className="flex min-w-0 flex-1 gap-2 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onWheel={(event) => {
          if (!tableNumberScrollerRef.current) return;
          if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
          event.preventDefault();
          tableNumberScrollerRef.current.scrollLeft += event.deltaY;
        }}
      >
        <button
          type="button"
          onClick={() => setTableNumberIds([])}
          className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition ${
            tableNumberIds.length === 0
              ? "border-blue-500 bg-blue-500/15 text-blue-100"
              : "border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600"
          }`}
        >
          All numbers
          <span className="ml-2 rounded-full bg-slate-950 px-2 py-0.5 text-[10px] text-slate-300">{filteredConversations.length}</span>
        </button>
        {visibleNumberSummaries.map(([id, item]) => (
          <button
            key={id}
            type="button"
            onClick={() => toggleTableNumber(id)}
            className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition ${
              tableNumberIds.includes(id)
                ? "border-blue-500 bg-blue-500/15 text-blue-100"
                : "border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600"
            }`}
          >
            <QuoEmoji value={item.emoji} className="mr-2" />
            {item.label}
            <span className="ml-2 rounded-full bg-slate-950 px-2 py-0.5 text-[10px] text-slate-300">{item.count}</span>
          </button>
        ))}
      </div>
      <Button
        type="button"
        size="icon"
        variant="outline"
        className="h-9 w-9 shrink-0 rounded-full border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white"
        onClick={() => scrollTableNumberList(1)}
        title="Scroll Quo numbers right"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
      {isAdmin && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 rounded-full border-slate-700 bg-transparent text-xs text-slate-200 hover:bg-slate-800 hover:text-white"
            >
              <Settings2 className="mr-2 h-4 w-4" />
              Manage numbers
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[720px] border-border bg-popover p-0 text-popover-foreground dark:border-slate-700 dark:bg-[#15161c] dark:text-slate-100" align="end">
            <div className="border-b border-slate-800 px-4 py-3">
              <div className="text-sm font-semibold">Quo number display</div>
              <div className="text-xs text-slate-400">
                Rename, add emoji, hide from table, or reorder. Drag a row or use arrows.
              </div>
            </div>
            <div className="max-h-[520px] overflow-auto p-3">
              {numberSummaries.filter(([id]) => id !== "unknown").map(([id, item], index) => {
                const preference = preferenceByNumberId.get(id);
                return (
                  <div
                    key={id}
                    draggable
                    onDragStart={(event) => event.dataTransfer.setData("text/plain", id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      const draggedId = event.dataTransfer.getData("text/plain");
                      if (!draggedId || draggedId === id) return;
                      const draggedPreference = preferenceByNumberId.get(draggedId);
                      numberPreferenceMutation.mutate({
                        phoneNumberId: draggedId,
                        patch: { sort_order: preference?.sort_order ?? index },
                      });
                      numberPreferenceMutation.mutate({
                        phoneNumberId: id,
                        patch: { sort_order: draggedPreference?.sort_order ?? index + 1 },
                      });
                    }}
                    className={`mb-2 grid grid-cols-[32px_52px_minmax(220px,1fr)_120px_120px] items-center gap-2 rounded-xl border px-3 py-2 ${
                      item.hidden ? "border-slate-800 bg-slate-950/70 opacity-60" : "border-slate-800 bg-slate-900/80"
                    }`}
                  >
                    <GripVertical className="h-4 w-4 cursor-grab text-slate-500" />
                    <Input
                      defaultValue={preference?.emoji ?? item.emoji}
                      maxLength={4}
                      onBlur={(event) =>
                        numberPreferenceMutation.mutate({ phoneNumberId: id, patch: { emoji: event.target.value } })
                      }
                      className="h-9 border-slate-700 bg-slate-950 text-center text-lg"
                      title="Emoji"
                    />
                    <div className="min-w-0">
                      <Input
                        defaultValue={preference?.label_override ?? item.label}
                        onBlur={(event) =>
                          numberPreferenceMutation.mutate({ phoneNumberId: id, patch: { label_override: event.target.value } })
                        }
                        className="h-9 border-slate-700 bg-slate-950 text-slate-100"
                        title="Number name"
                      />
                      <div className="mt-1 text-[11px] text-slate-500">{item.count} chats</div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white"
                      onClick={() => numberPreferenceMutation.mutate({ phoneNumberId: id, patch: { hidden: !item.hidden } })}
                    >
                      {item.hidden ? <Eye className="mr-2 h-4 w-4" /> : <EyeOff className="mr-2 h-4 w-4" />}
                      {item.hidden ? "Show" : "Hide"}
                    </Button>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-9 w-9 border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white"
                        onClick={() => moveNumberPreference(id, -1)}
                        disabled={index === 0}
                        title="Move up"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-9 w-9 border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white"
                        onClick={() => moveNumberPreference(id, 1)}
                        disabled={index === numberSummaries.filter(([numberId]) => numberId !== "unknown").length - 1}
                        title="Move down"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>

  <div className="flex flex-wrap items-center gap-2">
    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
      <Tags className="h-3.5 w-3.5" />
      AI tags:
    </div>
    <button
      type="button"
      onClick={() => setTagFilter("")}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        !tagFilter
          ? "border-emerald-500 bg-emerald-500/15 text-emerald-100"
          : "border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600"
      }`}
    >
      All tags
    </button>
    {tagScenarioGroups.map((group) => {
      const activeTag = group.tags.find((t) => t.tag === tagFilter);
      const groupActive = Boolean(activeTag);
      const groupCount = group.tags.reduce((sum, t) => sum + t.count, 0);
      return (
        <Popover key={group.key}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                groupActive
                  ? "border-emerald-500 bg-emerald-500/15 text-emerald-100"
                  : "border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600"
              }`}
            >
              <span>{group.label}</span>
              <span className="text-[10px] text-slate-500">{groupCount}</span>
              <ChevronDown className="h-3 w-3 opacity-70" />
              {activeTag && (
                <span className="ml-1 rounded-full bg-emerald-500/25 px-1.5 py-0.5 text-[10px] text-emerald-100">
                  {activeTag.tag}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 border-slate-800 bg-slate-950 p-2">
            <div className="mb-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {group.label}
            </div>
            <div className="flex flex-col gap-1">
              {group.tags.map(({ tag, count }) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setTagFilter(tagFilter === tag ? "" : tag)}
                  className={`flex items-center justify-between rounded-md border px-2 py-1.5 text-left text-xs font-medium transition ${
                    tagFilter === tag
                      ? "border-emerald-500 bg-emerald-500/15 text-emerald-100"
                      : "border-slate-800 bg-slate-900 text-slate-200 hover:border-slate-600"
                  }`}
                >
                  <span className="truncate">{tag}</span>
                  <span className="ml-2 shrink-0 text-[10px] text-slate-500">{count}</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      );
    })}
  </div>


</div>

<div className="min-h-0 flex-1 overflow-auto overscroll-contain">
  <table className="w-full min-w-[1560px] table-fixed text-left text-sm xl:min-w-[1680px]">
    <thead className="sticky top-0 z-10 border-b border-slate-800 bg-[#15161c] text-xs uppercase tracking-wide text-slate-500">
      <tr>
        <th className="w-[52px] px-3 py-3 font-semibold">Pin</th>
        <th className="w-[210px] px-3 py-3 font-semibold">Customer Number</th>
        <th className="w-[230px] px-3 py-3 font-semibold">AI Tags</th>
        <th className="w-[460px] px-3 py-3 font-semibold">Last Message</th>
        <th className="w-[118px] px-3 py-3 font-semibold">All Messages</th>
        <th className="w-[96px] px-3 py-3 font-semibold">Last Side</th>
        <th className="w-[170px] px-3 py-3 font-semibold">Date / Time</th>
        <th className="w-[126px] px-3 py-3 font-semibold">Confidence</th>
        <th className="w-[100px] px-3 py-3 font-semibold">Lead</th>
        <th className="w-[96px] px-3 py-3 text-right font-semibold">Quo</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-800">
      {conversationsQuery.isLoading ? (
        Array.from({ length: 8 }).map((_, index) => (
          <tr key={index}>
            <td colSpan={10} className="px-4 py-3">
              <Skeleton className="h-12 rounded-lg bg-slate-800" />
            </td>
          </tr>
        ))
      ) : filteredConversations.length === 0 ? (
        <tr>
          <td colSpan={10} className="px-4 py-16 text-center text-slate-400">
            No chats match this number, date, search, and tag filter.
          </td>
        </tr>
      ) : (
        tableConversations.map((conversation) => {
          const confidence = getState(conversation)?.confidence ?? 0;
          const linked = isConversationInCrm(conversation);
          const linkedLeadInfo = (() => {
            const digits = (conversation.customer_number ?? "").replace(/\D/g, "");
            if (digits.length < 10) return null;
            return leadByPhoneKey.get(digits.slice(-10)) ?? null;
          })();
          const leadStatus = (linkedLeadInfo?.status ?? null) as LeadStatus | null;
          const customerTime = conversation.last_customer_message_at
            ? new Date(conversation.last_customer_message_at).getTime()
            : 0;
          const agentTime = conversation.last_agent_message_at
            ? new Date(conversation.last_agent_message_at).getTime()
            : 0;
          const needsAttention =
            linked &&
            leadStatus !== null &&
            NEEDS_ATTENTION_STATUSES.has(leadStatus) &&
            customerTime > agentTime;
          const numberId = conversation.quo_phone_numbers?.id;
          const preference = numberId ? preferenceByNumberId.get(numberId) : null;
          const sourceLabel = getPreferredQuoNumberLabel(conversation, preference);
          const showSourceNumber = tableNumberIds.length !== 1;
          const pinned = pinnedConversationIds.has(conversation.id);
          const rowTags = getConversationTags(conversation);
          const lastMessage = getConversationPreview(conversation);
          const rowMessages =
            selectedConvId === conversation.id
              ? selectedMessages
              : [];
          return (
            <tr
              key={conversation.id}
              className={`cursor-pointer transition hover:bg-slate-900/70 ${
                selectedConvId === conversation.id ? "bg-blue-500/10" : ""
            }`}
            onClick={() => {
              setSelectedConvId(conversation.id);
            }}
          >
              <td className="px-3 py-3">
                <Button
                  size="icon"
                  variant="ghost"
                  className={`h-8 w-8 rounded-full ${
                    pinned ? "text-amber-300 hover:bg-amber-500/10" : "text-slate-500 hover:bg-slate-800 hover:text-slate-200"
                  }`}
                  onClick={(event) => {
                    event.stopPropagation();
                    pinConversationMutation.mutate({ conversationId: conversation.id, pinned });
                  }}
                  disabled={pinConversationMutation.isPending}
                  title={pinned ? "Unpin chat" : "Pin chat"}
                >
                  {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                </Button>
              </td>
              <td className="px-3 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-semibold shadow-[0_0_24px_rgba(168,85,247,0.28)]">
                    {conversation.customer_name
                      ? conversation.customer_name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)
                      : (conversation.customer_number || "#").replace(/\D/g, "").slice(-2) || "#"}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-slate-100">
                      {conversation.customer_name || formatUsPhone(conversation.customer_number)}
                    </div>
                    <div className="truncate text-xs text-slate-400 flex items-center gap-1.5">
                      {conversation.customer_name && (
                        <span>{formatUsPhone(conversation.customer_number)}</span>
                      )}
                      {showSourceNumber && (
                        <>
                          {conversation.customer_name && <span className="text-slate-600">•</span>}
                          <span className="flex items-center">
                            <QuoEmoji value={getPreferredQuoNumberEmoji(preference)} className="mr-1" />
                            {sourceLabel}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-3 py-3">
                {rowTags.length === 0 ? (
                  <span className="text-xs font-medium text-slate-500">AI pending</span>
                ) : (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        onClick={(event) => event.stopPropagation()}
                        className="group inline-flex max-w-[220px] items-center gap-1.5 rounded-full border border-cyan-300/20 bg-white/10 px-2.5 py-1 text-xs font-semibold text-cyan-50 shadow-[0_0_18px_rgba(34,211,238,0.16)] backdrop-blur-md transition hover:border-cyan-300/40 hover:bg-white/15"
                      >
                        <span className="truncate">{rowTags[0]}</span>
                        {rowTags.length > 1 && (
                          <span className="rounded-full bg-slate-900/60 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-100/80">
                            +{rowTags.length - 1}
                          </span>
                        )}
                        <ChevronRight className="h-3 w-3 rotate-90 text-cyan-100/60 transition group-hover:text-cyan-50" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="start"
                      className="w-64 border-border bg-popover p-3 text-popover-foreground dark:border-slate-700 dark:bg-[#15161c] dark:text-slate-100"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        Scenario
                      </div>
                      <div className="mb-3 rounded-lg border border-cyan-300/20 bg-cyan-500/10 px-2.5 py-1.5 text-sm font-semibold text-cyan-50">
                        {rowTags[0]}
                      </div>
                      {rowTags.length > 1 && (
                        <>
                          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                            Related tags
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {rowTags.slice(1).map((tag) => (
                              <span
                                key={`${conversation.id}-${tag}`}
                                className="rounded-full border border-slate-700/60 bg-slate-900/60 px-2 py-0.5 text-xs text-slate-200"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </>
                      )}
                    </PopoverContent>
                  </Popover>
                )}
              </td>
              <td className="px-3 py-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="line-clamp-2 text-left text-slate-200 underline-offset-4 hover:text-white hover:underline"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {lastMessage}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[420px] border-border bg-popover text-popover-foreground dark:border-slate-700 dark:bg-[#15161c] dark:text-slate-100">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Complete last message</div>
                    <div className="max-h-64 overflow-auto whitespace-pre-wrap text-sm leading-6 text-slate-100">{lastMessage}</div>
                  </PopoverContent>
                </Popover>
              </td>
              <td className="px-3 py-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedConvId(conversation.id);
                      }}
                    >
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Open
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[520px] border-border bg-popover p-0 text-popover-foreground dark:border-slate-700 dark:bg-[#15161c] dark:text-slate-100">
                    <div className="border-b border-slate-800 px-4 py-3">
                      <div className="text-sm font-semibold">
                        {conversation.customer_name
                          ? `${conversation.customer_name} (${formatUsPhone(conversation.customer_number)})`
                          : (formatUsPhone(conversation.customer_number) || "No customer number")}
                      </div>
                      <div className="text-xs text-slate-400">Stored messages received and sent in this conversation</div>
                    </div>
                    <div className="max-h-[420px] space-y-3 overflow-auto p-4">
                      {selectedConvId !== conversation.id || messagesQuery.isLoading ? (
                        <Skeleton className="h-20 rounded-lg bg-slate-800" />
                      ) : rowMessages.length === 0 ? (
                        <div className="text-sm text-slate-400">No stored messages yet.</div>
                      ) : (
                        rowMessages.map((message) => {
                          const kind = getStoredMessageKind(message);
                          return (
                            <div
                              key={message.id}
                              className={`rounded-xl border px-3 py-2 ${
                                kind.isCall
                                  ? "border-amber-400/20 bg-amber-500/10 text-amber-50"
                                  : message.sender === "customer"
                                    ? "border-transparent bg-slate-800 text-slate-100"
                                    : "border-transparent bg-blue-600/20 text-blue-50"
                              }`}
                            >
                              <div className="mb-1 flex items-center justify-between gap-3 text-[11px] uppercase tracking-wide text-slate-400">
                                <span>{kind.label}</span>
                                <span>{formatDate(message.message_time)}</span>
                              </div>
                              <div className="whitespace-pre-wrap text-sm leading-6">{getMessagePreview(message.text, message.media)}</div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </td>
              <td className="px-4 py-3">
                <Badge variant="outline" className="border-slate-700 bg-slate-900 text-slate-200">
                  {getLastMessageSide(conversation)}
                </Badge>
              </td>
              <td className="px-4 py-3 text-slate-400">
                {formatDate(conversation.last_message_at ?? conversation.last_message_time)}
              </td>
              <td className="px-4 py-3">
                <div className="space-y-1">
                  <div className="text-xs text-slate-300">{Math.round(confidence * 100)}% confidence</div>
                  <div className="text-xs text-slate-500">
                    {getAiAnalyzedAt(conversation) ? `AI ${formatShortDate(getAiAnalyzedAt(conversation))}` : "AI pending"}
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                {linked ? (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className="border-emerald-700 bg-emerald-500/10 text-emerald-200">
                        In CRM
                      </Badge>
                      {linkedLeadInfo?.job_id && (
                        <span className="font-mono text-[10px] text-slate-400">{linkedLeadInfo.job_id}</span>
                      )}
                    </div>
                    {leadStatus && (
                      <Badge variant="outline" className="w-fit border-slate-700 bg-slate-900 text-[10px] text-slate-200">
                        {STATUS_LABELS[leadStatus] ?? leadStatus}
                      </Badge>
                    )}
                    {needsAttention && (
                      <span className="inline-flex w-fit items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-200 animate-pulse">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                        Needs attention
                      </span>
                    )}
                  </div>
                ) : (
                  <Badge variant="outline" className="border-amber-700 bg-amber-500/10 text-amber-200">
                    Not in CRM
                  </Badge>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white"
                  onClick={(event) => {
                    event.stopPropagation();
                    window.open(getQuoChatUrl(conversation), "_blank");
                  }}
                >
                  <span className="mr-2 flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">
                    Q
                  </span>
                  Open
                </Button>
              </td>
            </tr>
          );
        })
      )}
      {conversationsQuery.hasNextPage && (
        <tr ref={loadMoreSentinelRef}>
          <td colSpan={10} className="px-4 py-6 text-center text-xs text-slate-500">
            {conversationsQuery.isFetchingNextPage ? "Loading more chats…" : "Scroll to load more"}
          </td>
        </tr>
      )}
    </tbody>
  </table>
</div>
        </main>
      </div>
    </div>
  );
}

