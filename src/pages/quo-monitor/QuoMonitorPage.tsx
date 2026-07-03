import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bot,
  CalendarClock,
  CalendarDays,
  Clock3,
  CheckCircle2,
  ExternalLink,
  Filter,
  Inbox,
  Link2,
  MessageSquare,
  MoreHorizontal,
  Phone,
  Power,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  ClipboardList,
  Table2,
  Trash2,
  Tags,
  UserRound,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AddLeadDialog from "@/components/leads/AddLeadDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  QUO_AI_SECTION_LABELS,
  QUO_AI_SECTIONS,
  type QuoAiSection,
} from "@/lib/quo-ai";
import type { LucideIcon } from "lucide-react";

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
};

type DecisionRow = {
  id: string;
  output_json: Record<string, unknown>;
  model_used: string | null;
  confidence: number;
  risk_level: string;
  applied_actions: unknown[];
  skipped_actions: unknown[];
  needs_human_review: boolean;
  reason: string | null;
  estimated_cost_usd: number | null;
  created_at: string;
};

type QuoAiTask = {
  id: string;
  conversation_id: string;
  task_type: string;
  title: string;
  instructions: string | null;
  priority: "low" | "medium" | "high" | "critical";
  status: "open" | "done" | "snoozed" | "cancelled" | "needs_review";
  due_at: string | null;
  assigned_role: string;
  requires_human_review: boolean;
};

type DailyBrief = {
  id: string;
  brief_date: string;
  summary: string | null;
  metrics: Record<string, unknown>;
  urgent_items: unknown[];
  created_at: string;
};

type CostLog = {
  estimated_cost: number | string | null;
  model: string;
  feature: string;
};

type AdminControlStatus = {
  success: boolean;
  ingestion_paused: boolean;
};

type AdminDeleteResult = {
  success: boolean;
  deleted: number;
};

type DbError = { message: string } | null;
type DbResult<T> = PromiseLike<{ data: T | null; error: DbError }>;
type DbCountResult<T> = PromiseLike<{ data: T | null; error: DbError; count?: number | null }>;
type LooseQuery<T = unknown> = {
  select: <Next = T>(columns?: string, options?: unknown) => LooseQuery<Next>;
  insert: <Next = T>(values: unknown) => LooseQuery<Next>;
  update: <Next = T>(values: unknown) => LooseQuery<Next>;
  upsert: <Next = T>(values: unknown, options?: unknown) => LooseQuery<Next>;
  eq: (column: string, value: unknown) => LooseQuery<T>;
  in: (column: string, values: unknown[]) => LooseQuery<T>;
  gte: (column: string, value: unknown) => LooseQuery<T>;
  order: (column: string, options?: unknown) => LooseQuery<T>;
  limit: (count: number) => LooseQuery<T>;
  single: () => DbResult<T>;
  maybeSingle: () => DbResult<T>;
  then: DbCountResult<T>["then"];
};
type LooseSupabase = {
  from: <T = unknown>(table: string) => LooseQuery<T>;
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
  return Array.isArray(state) ? state[0] ?? null : state ?? null;
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

function isSameDay(value: string, offsetDays = 0) {
  const date = new Date(value);
  const target = new Date();
  target.setDate(target.getDate() + offsetDays);
  return date.toDateString() === target.toDateString();
}

function toTitleCase(value: string) {
  return value
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getScenarioTag(conversation: ConversationRow) {
  const firstAiTag = conversation.ai_tags?.find((tag) => tag && tag.trim());
  if (firstAiTag) return toTitleCase(firstAiTag);

  const state = getState(conversation);
  if (state?.lost_reason) return toTitleCase(state.lost_reason);

  const section = getSection(conversation);
  const friendly: Record<string, string> = {
    needs_reply: "Customer Needs Reply",
    new_interested_lead: "New Interested Customer",
    hot_lead: "Hot Lead",
    follow_up_due_today: "Follow Up Due Today",
    follow_up_tomorrow: "Follow Up Tomorrow",
    future_follow_up: "Future Follow Up",
    appointment_mentioned: "Scheduling Needed",
    waiting_for_customer: "Waiting Customer Response",
    possible_dead: "Customer Ghosted",
    lost_found_other_tech: "Customer Found Other Tech",
    urgent_complaint: "Complaint Or Urgent Issue",
    already_added_to_crm: "Already In CRM",
    not_a_lead_spam_wrong_number: "Spam Or Wrong Number",
    needs_human_review: "Needs Human Review",
  };

  return friendly[section] ?? toTitleCase(section);
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

function getQuoNumberDisplay(conversation: ConversationRow) {
  const number = conversation.quo_phone_numbers;
  return number?.display_number || number?.number || number?.quo_phone_number_id || "No number";
}

function getQuoChatUrl(conversation: ConversationRow) {
  const phoneNumberId = conversation.quo_phone_numbers?.quo_phone_number_id;
  if (phoneNumberId) {
    return `https://my.quo.com/inbox/${encodeURIComponent(phoneNumberId)}/c/${encodeURIComponent(conversation.quo_conversation_id)}`;
  }

  return `https://my.quo.com/inbox`;
}

function getConversationTags(conversation: ConversationRow) {
  const tags = [getScenarioTag(conversation), ...(conversation.ai_tags ?? [])]
    .map((tag) => toTitleCase(tag))
    .filter((tag, index, all) => tag && all.indexOf(tag) === index);
  const phoneTag = conversation.customer_number ? `@${conversation.customer_number.replace(/\s+/g, "")}` : null;
  return phoneTag ? [...tags, phoneTag] : tags;
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
  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState<(typeof sectionFilters)[number]>("all");
  const [numberFilter, setNumberFilter] = useState("all");
  const [confidenceFilter, setConfidenceFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [linkedFilter, setLinkedFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"inbox" | "table">("table");
  const [tagFilter, setTagFilter] = useState("");
  const [dateRangeStart, setDateRangeStart] = useState("");
  const [dateRangeEnd, setDateRangeEnd] = useState("");
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [overrideSection, setOverrideSection] = useState<QuoAiSection>("needs_human_review");
  const [showAddLead, setShowAddLead] = useState(false);

  const db = supabase as unknown as LooseSupabase;
  const isAdmin = role === "admin";

  const conversationsQuery = useQuery({
    queryKey: ["quo-ai-conversations"],
    queryFn: async () => {
      const { data, error } = await db
        .from("quo_conversations")
        .select(`
          *,
          quo_phone_numbers (*),
          ai_conversation_states (*),
          ai_reminders (*),
          ai_lead_links (*, leads (id, job_id, customer_name, status))
        `)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(300);

      if (error) throw error;
      return (data ?? []) as ConversationRow[];
    },
  });

  const selectedConversation = useMemo(
    () => conversationsQuery.data?.find((conversation) => conversation.id === selectedConvId) ?? null,
    [conversationsQuery.data, selectedConvId],
  );

  const messagesQuery = useQuery({
    queryKey: ["quo-ai-messages", selectedConvId],
    queryFn: async () => {
      if (!selectedConvId) return [];
      const { data, error } = await db
        .from("quo_messages")
        .select("id, sender, text, message_time")
        .eq("conversation_id", selectedConvId)
        .order("message_time", { ascending: true })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as MessageRow[];
    },
    enabled: Boolean(selectedConvId),
  });

  const decisionsQuery = useQuery({
    queryKey: ["quo-ai-decisions", selectedConvId],
    queryFn: async () => {
      if (!selectedConvId) return [];
      const { data, error } = await db
        .from("ai_decisions")
        .select("*")
        .eq("conversation_id", selectedConvId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return (data ?? []) as DecisionRow[];
    },
    enabled: Boolean(selectedConvId),
  });

  const tasksQuery = useQuery({
    queryKey: ["quo-ai-tasks"],
    queryFn: async () => {
      const { data, error } = await db
        .from("quo_ai_tasks")
        .select("*")
        .in("status", ["open", "needs_review", "snoozed"])
        .order("due_at", { ascending: true, nullsFirst: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as QuoAiTask[];
    },
  });

  const briefQuery = useQuery({
    queryKey: ["quo-ai-daily-brief"],
    queryFn: async () => {
      const { data, error } = await db
        .from("quo_ai_daily_briefs")
        .select("*")
        .order("brief_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as DailyBrief | null;
    },
  });

  const costQuery = useQuery({
    queryKey: ["quo-ai-cost-today"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data, error } = await db
        .from("quo_ai_cost_logs")
        .select("estimated_cost, model, feature")
        .gte("created_at", today.toISOString())
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as CostLog[];
    },
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

  const conversations = useMemo(() => conversationsQuery.data ?? [], [conversationsQuery.data]);
  const numberOptions = useMemo(() => {
    const values = new Map<string, string>();
    conversations.forEach((conversation) => {
      const number = conversation.quo_phone_numbers;
      const id = number?.id;
      if (id) values.set(id, number.label || number.name || number.display_number || number.number || "Unknown Number");
    });
    return Array.from(values.entries());
  }, [conversations]);

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();
    return conversations.filter((conversation) => {
      const state = getState(conversation);
      const section = getSection(conversation);
      const confidence = state?.confidence ?? 0;
      const linked = Boolean(conversation.linked_lead_id || conversation.ai_lead_links?.length);
      const numberId = conversation.quo_phone_numbers?.id;
      const lastActivity = conversation.last_message_at ?? conversation.last_message_time;
      const scenarioTag = getScenarioTag(conversation);

      if (sectionFilter !== "all" && section !== sectionFilter) return false;
      if (numberFilter !== "all" && numberId !== numberFilter) return false;
      if (confidenceFilter === "high" && confidence < 0.9) return false;
      if (confidenceFilter === "review" && confidence >= 0.75) return false;
      if (linkedFilter === "linked" && !linked) return false;
      if (linkedFilter === "unlinked" && linked) return false;
      if (!matchesDatePreset(lastActivity, dateFilter, dateRangeStart, dateRangeEnd)) return false;
      if (tagFilter.trim() && !scenarioTag.toLowerCase().includes(tagFilter.trim().toLowerCase())) return false;
      if (query) {
        const haystack = [
          conversation.customer_name,
          conversation.customer_number,
          conversation.customer_number ? `@${conversation.customer_number.replace(/\s+/g, "")}` : null,
          conversation.last_message_preview,
          conversation.rolling_ai_summary,
          scenarioTag,
          ...(conversation.ai_tags ?? []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [conversations, confidenceFilter, dateFilter, dateRangeEnd, dateRangeStart, linkedFilter, numberFilter, search, sectionFilter, tagFilter]);

  const stats = useMemo(() => {
    const tasks = tasksQuery.data ?? [];
    const conversationStats = conversations.reduce(
      (acc, conversation) => {
        const section = getSection(conversation);
        const reminders = conversation.ai_reminders ?? [];
        if (section === "needs_reply") acc.needsReply += 1;
        if (section === "new_interested_lead" || section === "hot_lead") acc.newLeads += 1;
        if (section === "urgent_complaint") acc.urgent += 1;
        if (section === "needs_human_review") acc.needsReview += 1;
        if (section === "possible_dead") acc.possibleDead += 1;
        if (reminders.some((reminder) => reminder.status === "pending" && isSameDay(reminder.due_at))) {
          acc.followUpsToday += 1;
        }
        return acc;
      },
      { needsReply: 0, newLeads: 0, followUpsToday: 0, urgent: 0, needsReview: 0, possibleDead: 0 },
    );

    return {
      ...conversationStats,
      needsReview:
        conversationStats.needsReview +
        tasks.filter((task) => task.status === "needs_review" || task.requires_human_review).length,
    };
  }, [conversations, tasksQuery.data]);

  const openTasks = tasksQuery.data ?? [];
  const selectedTasks = selectedConvId ? openTasks.filter((task) => task.conversation_id === selectedConvId) : [];
  const overdueTasks = openTasks.filter((task) => task.due_at && new Date(task.due_at).getTime() < Date.now());
  const todayAiSpend = useMemo(
    () => (costQuery.data ?? []).reduce((sum, row) => sum + Number(row.estimated_cost ?? 0), 0),
    [costQuery.data],
  );

  const audit = async (action: string, details: Record<string, unknown>) => {
    if (!user || !selectedConvId) return;
    await db.from("ai_audit_logs").insert({
      conversation_id: selectedConvId,
      user_id: user.id,
      action,
      details,
    });
  };

  const overrideMutation = useMutation({
    mutationFn: async ({ section, reviewed = false }: { section: QuoAiSection; reviewed?: boolean }) => {
      if (!selectedConvId) throw new Error("No conversation selected.");
      const priority = section === "urgent_complaint" ? "urgent" : section === "possible_dead" ? "low" : "medium";

      const { error: stateError } = await db.from("ai_conversation_states").upsert(
        {
          conversation_id: selectedConvId,
          section,
          priority,
          customer_state: section === "not_a_lead_spam_wrong_number" ? "not_lead" : "unclear",
          confidence: 1,
          risk_level: "safe",
          needs_reply: section === "needs_reply",
          is_possible_dead: section === "possible_dead",
          is_lost: section === "lost_found_other_tech",
          human_review_status: reviewed ? "reviewed" : "not_needed",
          evidence: [],
        },
        { onConflict: "conversation_id" },
      );
      if (stateError) throw stateError;

      const { error: conversationError } = await db
        .from("quo_conversations")
        .update({
          current_ai_section: section,
          current_priority: priority,
          last_ai_analyzed_at: new Date().toISOString(),
        })
        .eq("id", selectedConvId);
      if (conversationError) throw conversationError;

      await audit("manual_override", { section, reviewed });
    },
    onSuccess: () => {
      toast.success("Conversation updated");
      queryClient.invalidateQueries({ queryKey: ["quo-ai-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["quo-ai-decisions", selectedConvId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to update conversation"),
  });

  const reminderMutation = useMutation({
    mutationFn: async (reminderId: string) => {
      const { error } = await db
        .from("ai_reminders")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .eq("id", reminderId);
      if (error) throw error;
      await audit("complete_reminder", { reminder_id: reminderId });
    },
    onSuccess: () => {
      toast.success("Reminder completed");
      queryClient.invalidateQueries({ queryKey: ["quo-ai-conversations"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to complete reminder"),
  });

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedConvId) throw new Error("No conversation selected.");
      const { error } = await supabase.functions.invoke("ai-analyze-conversation", {
        body: { conversation_id: selectedConvId },
      });
      if (error) throw error;
      await audit("run_ai_analysis", {});
    },
    onSuccess: () => {
      toast.success("AI analysis queued");
      queryClient.invalidateQueries({ queryKey: ["quo-ai-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["quo-ai-decisions", selectedConvId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to run analysis"),
  });

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

  const deleteConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const { data, error } = await supabase.functions.invoke<AdminDeleteResult>("quo-admin-controls", {
        body: { action: "delete_conversation", conversation_id: conversationId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Quo chat deleted");
      setSelectedConvId(null);
      queryClient.invalidateQueries({ queryKey: ["quo-ai-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["quo-ai-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["quo-ai-cost-today"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Failed to delete Quo chat"),
  });

  const deleteAllConversationsMutation = useMutation({
    mutationFn: async () => {
      const confirmation = window.prompt('Type "DELETE QUO TEST CHATS" to delete all stored Quo Monitor chats.');
      if (confirmation !== "DELETE QUO TEST CHATS") throw new Error("Bulk delete cancelled.");

      const { data, error } = await supabase.functions.invoke<AdminDeleteResult>("quo-admin-controls", {
        body: { action: "delete_all_conversations", confirm: confirmation },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Deleted ${data?.deleted ?? 0} Quo chats`);
      setSelectedConvId(null);
      queryClient.invalidateQueries({ queryKey: ["quo-ai-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["quo-ai-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["quo-ai-cost-today"] });
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "Bulk delete cancelled.") return;
      toast.error(error instanceof Error ? error.message : "Failed to delete Quo chats");
    },
  });

  const selectedState = selectedConversation ? getState(selectedConversation) : null;
  const selectedLead = selectedConversation?.ai_lead_links?.[0]?.leads ?? null;
  const latestDecision = decisionsQuery.data?.[0] ?? null;
  const ingestionPaused = Boolean(adminStatusQuery.data?.ingestion_paused);
  const selectedMessages = messagesQuery.data ?? [];
  const selectedNumberLabel =
    numberFilter === "all"
      ? "All inboxes"
      : numberOptions.find(([id]) => id === numberFilter)?.[1] ?? "Selected inbox";
  const numberSummaries = useMemo(() => {
    const counts = new Map<string, { label: string; count: number; latest: string | null; urgent: number }>();

    conversations.forEach((conversation) => {
      const number = conversation.quo_phone_numbers;
      const id = number?.id ?? "unknown";
      const label = number?.label || number?.name || number?.display_number || number?.number || "Unknown Number";
      const existing = counts.get(id) ?? { label, count: 0, latest: null, urgent: 0 };
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
      const leftTime = left.latest ? new Date(left.latest).getTime() : 0;
      const rightTime = right.latest ? new Date(right.latest).getTime() : 0;
      return rightTime - leftTime;
    });
  }, [conversations]);

  useEffect(() => {
    if (!filteredConversations.length) {
      setSelectedConvId(null);
      return;
    }

    if (!selectedConvId || !filteredConversations.some((conversation) => conversation.id === selectedConvId)) {
      const first = filteredConversations[0];
      setSelectedConvId(first.id);
      setOverrideSection(getSection(first));
    }
  }, [filteredConversations, selectedConvId]);

  const renderInboxUi = true;

  return renderInboxUi ? (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#111217] text-slate-100 shadow-2xl">
      <div className={`grid h-[calc(100vh-96px)] min-h-[760px] max-lg:h-auto max-lg:min-h-0 max-lg:grid-cols-1 ${
        viewMode === "table"
          ? "grid-cols-[76px_minmax(320px,380px)_minmax(620px,1fr)]"
          : "grid-cols-[76px_minmax(290px,360px)_minmax(420px,1fr)_minmax(300px,360px)] max-2xl:grid-cols-[76px_minmax(280px,340px)_1fr]"
      }`}>
        <aside className="flex flex-col border-r border-slate-800 bg-[#0b0c10] max-lg:hidden">
          <div className="flex h-16 items-center justify-center border-b border-slate-800">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-violet-600 text-sm font-bold">
              Q
            </div>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-2">
            <button
              type="button"
              onClick={() => setNumberFilter("all")}
              className={`group flex w-full flex-col items-center gap-1 rounded-xl p-2 text-[11px] transition ${
                numberFilter === "all" ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-900 hover:text-white"
              }`}
              title="All inboxes"
            >
              <Inbox className="h-5 w-5" />
              <span>All</span>
            </button>
            {numberSummaries.map(([id, item]) => (
              <button
                key={id}
                type="button"
                onClick={() => setNumberFilter(id)}
                className={`relative flex w-full flex-col items-center gap-1 rounded-xl p-2 text-[10px] transition ${
                  numberFilter === id ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-900 hover:text-white"
                }`}
                title={item.label}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-[11px] font-semibold">
                  {item.label.slice(0, 2).toUpperCase()}
                </span>
                <span className="w-full truncate">{item.count}</span>
                {item.urgent > 0 && (
                  <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-[#0b0c10]" />
                )}
              </button>
            ))}
          </div>
          {isAdmin && (
            <div className="space-y-2 border-t border-slate-800 p-2">
              <button
                type="button"
                onClick={() => ingestionToggleMutation.mutate(!ingestionPaused)}
                disabled={adminStatusQuery.isLoading || ingestionToggleMutation.isPending}
                className={`flex w-full flex-col items-center gap-1 rounded-xl p-2 text-[10px] transition ${
                  ingestionPaused ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/10 text-emerald-300"
                }`}
                title={ingestionPaused ? "Resume Quo ingestion" : "Pause Quo ingestion"}
              >
                <Power className="h-4 w-4" />
                {ingestionPaused ? "Paused" : "Live"}
              </button>
            </div>
          )}
        </aside>

        <section className="flex min-w-0 flex-col border-r border-slate-800 bg-[#15161c]">
          <div className="border-b border-slate-800 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-base font-semibold">{viewMode === "table" ? "Quo Numbers" : "Chats"}</div>
                <div className="text-xs text-slate-400">
                  {viewMode === "table" ? "Pick a number to filter the table" : selectedNumberLabel}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border border-slate-800 bg-[#0f1015] p-1">
                  <button
                    type="button"
                    onClick={() => setViewMode("table")}
                    className={`rounded-md px-2 py-1 text-xs ${viewMode === "table" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
                    title="Table view"
                  >
                    <Table2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("inbox")}
                    className={`rounded-md px-2 py-1 text-xs ${viewMode === "inbox" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"}`}
                    title="Chat view"
                  >
                    <MessageSquare className="h-4 w-4" />
                  </button>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-slate-300 hover:bg-slate-800 hover:text-white"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["quo-ai-conversations"] })}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-300 hover:bg-slate-800 hover:text-white">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search customer, phone, tag, message"
                className="border-slate-800 bg-[#0f1015] pl-9 text-slate-100 placeholder:text-slate-500"
              />
            </div>
            {viewMode === "table" && (
              <div className="mt-3 space-y-3">
                <div className="relative">
                  <Tags className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <Input
                    value={tagFilter}
                    onChange={(event) => setTagFilter(event.target.value)}
                    placeholder="Search AI tag: quote, ghosted, scheduled..."
                    className="border-slate-800 bg-[#0f1015] pl-9 text-slate-100 placeholder:text-slate-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    value={dateRangeStart}
                    onChange={(event) => {
                      setDateRangeStart(event.target.value);
                      setDateFilter("custom");
                    }}
                    className="border-slate-800 bg-[#0f1015] text-slate-100"
                  />
                  <Input
                    type="date"
                    value={dateRangeEnd}
                    onChange={(event) => {
                      setDateRangeEnd(event.target.value);
                      setDateFilter("custom");
                    }}
                    className="border-slate-800 bg-[#0f1015] text-slate-100"
                  />
                </div>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setSectionFilter("all");
                  setDateFilter("all");
                  setConfidenceFilter("all");
                  setLinkedFilter("all");
                  setTagFilter("");
                  setDateRangeStart("");
                  setDateRangeEnd("");
                }}
                className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-medium text-blue-200"
              >
                Open
              </button>
              <button
                type="button"
                onClick={() => setDateFilter("today")}
                className={`rounded-full px-3 py-1 text-xs font-medium ${dateFilter === "today" ? "bg-blue-500/20 text-blue-200" : "bg-slate-800 text-slate-200 hover:bg-slate-700"}`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setDateFilter("yesterday")}
                className={`rounded-full px-3 py-1 text-xs font-medium ${dateFilter === "yesterday" ? "bg-blue-500/20 text-blue-200" : "bg-slate-800 text-slate-200 hover:bg-slate-700"}`}
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => setDateFilter("week")}
                className={`rounded-full px-3 py-1 text-xs font-medium ${dateFilter === "week" ? "bg-blue-500/20 text-blue-200" : "bg-slate-800 text-slate-200 hover:bg-slate-700"}`}
              >
                Week
              </button>
              <button
                type="button"
                onClick={() => setDateFilter("month")}
                className={`rounded-full px-3 py-1 text-xs font-medium ${dateFilter === "month" ? "bg-blue-500/20 text-blue-200" : "bg-slate-800 text-slate-200 hover:bg-slate-700"}`}
              >
                Month
              </button>
              <button
                type="button"
                onClick={() => setSectionFilter("needs_reply")}
                className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700"
              >
                Needs reply
              </button>
              <button
                type="button"
                onClick={() => setConfidenceFilter("review")}
                className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700"
              >
                AI review
              </button>
              <button
                type="button"
                onClick={() => setLinkedFilter("unlinked")}
                className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700"
              >
                Unlinked
              </button>
            </div>
          </div>

          <ScrollArea className="flex-1">
            {viewMode === "table" ? (
              <div className="space-y-2 p-2">
                <button
                  type="button"
                  onClick={() => setNumberFilter("all")}
                  className={`w-full rounded-xl p-3 text-left transition ${
                    numberFilter === "all" ? "bg-[#24252d]" : "hover:bg-[#1d1e25]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-xs font-bold">
                      ALL
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-100">All Quo Numbers</div>
                      <div className="text-xs text-slate-400">{conversations.length} customer chats</div>
                    </div>
                  </div>
                </button>
                {numberSummaries.map(([id, item]) => {
                  const matchingConversation = conversations.find((conversation) => conversation.quo_phone_numbers?.id === id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setNumberFilter(id)}
                      className={`w-full rounded-xl p-3 text-left transition ${
                        numberFilter === id ? "bg-[#24252d]" : "hover:bg-[#1d1e25]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-xs font-bold">
                          {item.label.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-slate-100">{item.label}</div>
                          <div className="truncate text-xs text-slate-400">
                            {matchingConversation ? getQuoNumberDisplay(matchingConversation) : "No number"}
                          </div>
                        </div>
                        <div className="rounded-full bg-slate-900 px-2 py-1 text-[11px] text-slate-300">{item.count}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {conversationsQuery.isLoading ? (
                  Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-xl bg-slate-800" />)
                ) : filteredConversations.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-400">No chats in this inbox.</div>
                ) : (
                  filteredConversations.map((conversation) => {
                    const section = getSection(conversation);
                    const priority = getPriority(conversation);
                    const linked = Boolean(conversation.linked_lead_id || conversation.ai_lead_links?.length);
                    const name = conversation.customer_name || conversation.customer_number || "Unknown Customer";
                    return (
                      <button
                        key={conversation.id}
                        type="button"
                        onClick={() => {
                          setSelectedConvId(conversation.id);
                          setOverrideSection(section);
                        }}
                        className={`w-full rounded-xl p-3 text-left transition ${
                          selectedConvId === conversation.id ? "bg-[#24252d]" : "hover:bg-[#1d1e25]"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-semibold">
                            {name.slice(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <div className="truncate text-sm font-semibold text-slate-100">{name}</div>
                              <div className="shrink-0 text-[11px] text-slate-500">
                                {formatShortDate(conversation.last_message_at ?? conversation.last_message_time)}
                              </div>
                            </div>
                            <div className="mt-1 truncate text-xs text-slate-400">
                              {conversation.last_message_preview || conversation.rolling_ai_summary || "No message preview"}
                            </div>
                            <div className="mt-2 flex items-center gap-1.5">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] ${priorityClasses[priority]}`}>
                                {priority}
                              </span>
                              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                                {QUO_AI_SECTION_LABELS[section]}
                              </span>
                              {linked && <Link2 className="ml-auto h-3.5 w-3.5 text-emerald-300" />}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </ScrollArea>
        </section>

        <main className="flex min-w-0 flex-col bg-[#111217]">
          {viewMode === "table" ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
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
                  <Badge variant="outline" className="border-slate-700 bg-slate-900 text-slate-200">
                    <CalendarDays className="mr-1 h-3.5 w-3.5" />
                    {dateFilter === "all" ? "All dates" : toTitleCase(dateFilter)}
                  </Badge>
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

              <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full min-w-[1240px] text-left text-sm">
                  <thead className="sticky top-0 z-10 border-b border-slate-800 bg-[#15161c] text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Customer Number</th>
                      <th className="px-4 py-3 font-semibold">AI Tags</th>
                      <th className="px-4 py-3 font-semibold">Last Message</th>
                      <th className="px-4 py-3 font-semibold">All Messages</th>
                      <th className="px-4 py-3 font-semibold">Last Side</th>
                      <th className="px-4 py-3 font-semibold">Date / Time</th>
                      <th className="px-4 py-3 font-semibold">Confidence</th>
                      <th className="px-4 py-3 font-semibold">Lead</th>
                      <th className="px-4 py-3 text-right font-semibold">Quo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {conversationsQuery.isLoading ? (
                      Array.from({ length: 8 }).map((_, index) => (
                        <tr key={index}>
                          <td colSpan={9} className="px-4 py-3">
                            <Skeleton className="h-12 rounded-lg bg-slate-800" />
                          </td>
                        </tr>
                      ))
                    ) : filteredConversations.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-16 text-center text-slate-400">
                          No chats match this number, date, search, and tag filter.
                        </td>
                      </tr>
                    ) : (
                      filteredConversations.map((conversation) => {
                        const scenarioTag = getScenarioTag(conversation);
                        const priority = getPriority(conversation);
                        const confidence = getState(conversation)?.confidence ?? 0;
                        const linked = Boolean(conversation.linked_lead_id || conversation.ai_lead_links?.length);
                        const rowTags = getConversationTags(conversation);
                        const lastMessage = conversation.last_message_preview || conversation.rolling_ai_summary || "No message preview";
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
                              setOverrideSection(getSection(conversation));
                            }}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-semibold">
                                  {(conversation.customer_number || "#").slice(-2)}
                                </div>
                                <div className="min-w-0">
                                  <div className="truncate font-semibold text-slate-100">{conversation.customer_number || "No customer number"}</div>
                                  <div className="truncate text-xs text-slate-400">{getQuoNumberLabel(conversation)}</div>
                                </div>
                              </div>
                            </td>
                            <td className="max-w-[260px] px-4 py-3">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {rowTags.slice(0, 3).map((tag, index) => (
                                  <span
                                    key={`${conversation.id}-${tag}`}
                                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                      index === 0 && tag === scenarioTag ? priorityClasses[priority] : "bg-slate-800 text-slate-200"
                                    }`}
                                  >
                                    {tag}
                                  </span>
                                ))}
                                {rowTags.length > 3 && (
                                  <span className="rounded-full bg-slate-900 px-2 py-1 text-xs text-slate-400">
                                    +{rowTags.length - 3}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="max-w-[320px] px-4 py-3">
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
                                <PopoverContent className="w-[420px] border-slate-700 bg-[#15161c] text-slate-100">
                                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Complete last message</div>
                                  <div className="max-h-64 overflow-auto whitespace-pre-wrap text-sm leading-6 text-slate-100">{lastMessage}</div>
                                </PopoverContent>
                              </Popover>
                            </td>
                            <td className="px-4 py-3">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setSelectedConvId(conversation.id);
                                      setOverrideSection(getSection(conversation));
                                    }}
                                  >
                                    <MessageSquare className="mr-2 h-4 w-4" />
                                    Open
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[520px] border-slate-700 bg-[#15161c] p-0 text-slate-100">
                                  <div className="border-b border-slate-800 px-4 py-3">
                                    <div className="text-sm font-semibold">{conversation.customer_number || "No customer number"}</div>
                                    <div className="text-xs text-slate-400">Stored messages received and sent in this conversation</div>
                                  </div>
                                  <div className="max-h-[420px] space-y-3 overflow-auto p-4">
                                    {selectedConvId !== conversation.id || messagesQuery.isLoading ? (
                                      <Skeleton className="h-20 rounded-lg bg-slate-800" />
                                    ) : rowMessages.length === 0 ? (
                                      <div className="text-sm text-slate-400">No stored messages yet.</div>
                                    ) : (
                                      rowMessages.map((message) => (
                                        <div
                                          key={message.id}
                                          className={`rounded-xl px-3 py-2 ${
                                            message.sender === "customer" ? "bg-slate-800 text-slate-100" : "bg-blue-600/20 text-blue-50"
                                          }`}
                                        >
                                          <div className="mb-1 flex items-center justify-between gap-3 text-[11px] uppercase tracking-wide text-slate-400">
                                            <span>{message.sender === "customer" ? "Customer" : "Us"}</span>
                                            <span>{formatDate(message.message_time)}</span>
                                          </div>
                                          <div className="whitespace-pre-wrap text-sm leading-6">{message.text || "No text"}</div>
                                        </div>
                                      ))
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
                                  {conversation.last_ai_analyzed_at ? `AI ${formatShortDate(conversation.last_ai_analyzed_at)}` : "AI pending"}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {linked ? (
                                <Badge variant="outline" className="border-emerald-700 bg-emerald-500/10 text-emerald-200">
                                  Linked
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="border-amber-700 bg-amber-500/10 text-amber-200">
                                  Not linked
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
                  </tbody>
                </table>
              </div>
            </>
          ) : !selectedConversation ? (
            <div className="flex h-full items-center justify-center p-10 text-center text-slate-400">
              <div>
                <MessageSquare className="mx-auto mb-4 h-12 w-12 opacity-40" />
                <div className="text-lg font-semibold text-slate-200">Select a chat</div>
                <p className="mt-2 text-sm">Choose an inbox on the left, then pick a conversation.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500 text-sm font-bold">
                    {(selectedConversation.customer_name || selectedConversation.customer_number || "U").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-white">
                      {selectedConversation.customer_name || selectedConversation.customer_number || "Unknown Customer"}
                    </div>
                    <div className="truncate text-xs text-slate-400">
                      {selectedConversation.customer_number || "No phone"} ·{" "}
                      {selectedConversation.quo_phone_numbers?.label ||
                        selectedConversation.quo_phone_numbers?.name ||
                        selectedConversation.quo_phone_numbers?.display_number ||
                        "Unknown Quo number"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-slate-300 hover:bg-slate-800 hover:text-white"
                    onClick={() => analyzeMutation.mutate()}
                    disabled={analyzeMutation.isPending}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Run AI
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-slate-300 hover:bg-slate-800 hover:text-white"
                    onClick={() => window.open(getQuoChatUrl(selectedConversation), "_blank")}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Quo
                  </Button>
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="mx-auto max-w-4xl space-y-4 p-5">
                  <div className="rounded-xl border border-violet-500/20 bg-[#171822] p-4 shadow-lg">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-violet-200">
                        <Bot className="h-4 w-4" />
                        AI Case Summary
                      </div>
                      <Badge variant={selectedState?.human_review_status === "pending" ? "destructive" : "secondary"}>
                        {Math.round(Number(selectedState?.confidence ?? 0) * 100)}% confidence
                      </Badge>
                    </div>
                    <p className="text-sm leading-6 text-slate-300">
                      {latestDecision?.reason || selectedConversation.rolling_ai_summary || "No AI summary saved yet. Run AI after messages arrive."}
                    </p>
                    {selectedTasks.length > 0 && (
                      <div className="mt-4 border-t border-slate-800 pt-3">
                        <div className="mb-2 text-xs font-semibold text-slate-400">Next steps</div>
                        <ul className="space-y-2 text-sm text-slate-300">
                          {selectedTasks.slice(0, 3).map((task) => (
                            <li key={task.id} className="flex gap-2">
                              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-violet-400" />
                              <span>{task.instructions || task.title}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {messagesQuery.isLoading ? (
                    Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-16 rounded-xl bg-slate-800" />)
                  ) : selectedMessages.length ? (
                    selectedMessages.map((message) => {
                      const isCustomer = message.sender === "customer";
                      return (
                        <div key={message.id} className={`flex items-end gap-2 ${isCustomer ? "justify-start" : "justify-end"}`}>
                          {isCustomer && (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-pink-500 text-xs font-bold">
                              {(selectedConversation.customer_name || "C").slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div
                            className={`max-w-[72%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                              isCustomer ? "bg-[#24252d] text-slate-100" : "bg-blue-600 text-white"
                            }`}
                          >
                            <div>{message.text || "[Media or empty message]"}</div>
                            <div className={`mt-1 text-[11px] ${isCustomer ? "text-slate-500" : "text-blue-100/80"}`}>
                              {formatDate(message.message_time)}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="py-12 text-center text-sm text-slate-400">No messages stored for this chat.</p>
                  )}
                </div>
              </ScrollArea>

              <div className="border-t border-slate-800 p-4">
                <div className="rounded-xl border border-blue-500/40 bg-[#15161c] p-3">
                  <div className="text-sm text-slate-500">Write a message...</div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>CRM is read-only. Reply from Quo.</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white"
                      onClick={() => window.open(getQuoChatUrl(selectedConversation), "_blank")}
                    >
                      Open in Quo
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>

        {viewMode === "inbox" && <aside className="quo-inspector flex min-w-0 flex-col border-l border-slate-800 bg-[#15161c] max-2xl:hidden">
          {!selectedConversation ? (
            <div className="p-6 text-sm text-slate-400">Select a conversation to see AI and customer context.</div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="space-y-5 p-5">
                <div className="text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-violet-500 text-xl font-bold">
                    {(selectedConversation.customer_name || selectedConversation.customer_number || "U").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="mt-3 text-lg font-semibold">{selectedConversation.customer_name || "Unknown Customer"}</div>
                  <div className="text-sm text-slate-400">{selectedConversation.customer_number || "No phone"}</div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Button size="icon" variant="ghost" className="bg-slate-800 text-slate-200 hover:bg-slate-700">
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="bg-slate-800 text-slate-200 hover:bg-slate-700">
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="bg-slate-800 text-slate-200 hover:bg-slate-700">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>

                <div className="rounded-xl border border-slate-800 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <Sparkles className="h-4 w-4 text-violet-300" />
                    AI Status
                  </div>
                  <div className="space-y-2 text-sm">
                    <InfoLine label="Section" value={QUO_AI_SECTION_LABELS[getSection(selectedConversation)]} />
                    <InfoLine label="Priority" value={getPriority(selectedConversation)} />
                    <InfoLine label="Risk" value={selectedState?.risk_level ?? "unknown"} />
                    <InfoLine label="Last analyzed" value={formatDate(selectedConversation.last_ai_analyzed_at)} />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <ClipboardList className="h-4 w-4 text-slate-300" />
                    Tasks
                  </div>
                  {selectedTasks.length ? (
                    <div className="space-y-3">
                      {selectedTasks.slice(0, 5).map((task) => (
                        <div key={task.id} className="rounded-lg bg-slate-900/70 p-3">
                          <div className="flex items-center gap-2">
                            <Badge variant={task.status === "needs_review" ? "destructive" : "secondary"}>
                              {task.status.replace("_", " ")}
                            </Badge>
                            <span className="text-sm font-medium">{task.title}</span>
                          </div>
                          <div className="mt-2 text-xs text-slate-400">
                            {task.due_at ? `Due ${formatDate(task.due_at)}` : "No due date"}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-400">No open AI tasks.</div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-800 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <UserRound className="h-4 w-4 text-slate-300" />
                    Contact
                  </div>
                  <div className="space-y-2 text-sm">
                    <InfoLine label="Phone" value={selectedConversation.customer_number || "Not set"} />
                    <InfoLine label="Inbox" value={selectedNumberLabel} />
                    <InfoLine label="Lead" value={selectedLead?.job_id || selectedConversation.linked_lead_id || "Not linked"} />
                  </div>
                  {!selectedConversation.linked_lead_id && (
                    <Button size="sm" className="mt-4 w-full" onClick={() => setShowAddLead(true)}>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Create Lead
                    </Button>
                  )}
                </div>

                <div className="rounded-xl border border-slate-800 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <Clock3 className="h-4 w-4 text-slate-300" />
                    Manual Controls
                  </div>
                  <div className="space-y-2">
                    <Select value={overrideSection} onValueChange={(value) => setOverrideSection(value as QuoAiSection)}>
                      <SelectTrigger className="border-slate-700 bg-slate-900 text-slate-100"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {QUO_AI_SECTIONS.map((section) => (
                          <SelectItem key={section} value={section}>{QUO_AI_SECTION_LABELS[section]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button className="w-full" onClick={() => overrideMutation.mutate({ section: overrideSection })} disabled={overrideMutation.isPending}>
                      Move Section
                    </Button>
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => overrideMutation.mutate({ section: getSection(selectedConversation), reviewed: true })}
                      disabled={overrideMutation.isPending}
                    >
                      Mark Reviewed
                    </Button>
                    {isAdmin && (
                      <Button
                        className="w-full"
                        variant="destructive"
                        onClick={() => {
                          const ok = window.confirm("Delete this stored Quo chat and related AI data from CRM? This does not delete the chat in Quo.");
                          if (ok) deleteConversationMutation.mutate(selectedConversation.id);
                        }}
                        disabled={deleteConversationMutation.isPending}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Chat
                      </Button>
                    )}
                  </div>
                </div>

                {isAdmin && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                    <div className="mb-3 text-sm font-semibold text-amber-200">Admin testing</div>
                    <div className="mb-3 flex items-center justify-between rounded-lg bg-slate-950/40 p-3">
                      <span className="text-sm text-slate-200">Ingestion paused</span>
                      <Switch
                        checked={ingestionPaused}
                        disabled={adminStatusQuery.isLoading || ingestionToggleMutation.isPending}
                        onCheckedChange={(checked) => ingestionToggleMutation.mutate(checked)}
                      />
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      disabled={deleteAllConversationsMutation.isPending}
                      onClick={() => deleteAllConversationsMutation.mutate()}
                    >
                      Delete All Test Chats
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </aside>}
      </div>

      {selectedConversation && (
        <AddLeadDialog
          open={showAddLead}
          onOpenChange={setShowAddLead}
          onSuccess={() => {
            setShowAddLead(false);
            queryClient.invalidateQueries({ queryKey: ["quo-ai-conversations"] });
          }}
          initialData={{
            customer_name: selectedConversation.customer_name || "",
            customer_phone: selectedConversation.customer_number || "",
            direction: "incoming",
          }}
        />
      )}
    </div>
  ) : (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Quo AI Assistant</h1>
          <p className="text-sm text-muted-foreground">
            Conservative conversation triage, lead linking, reminders, and human review.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["quo-ai-conversations"] })}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard title="Needs Reply" value={stats.needsReply} icon={MessageSquare} />
        <StatCard title="New Leads" value={stats.newLeads} icon={UserPlus} />
        <StatCard title="Follow-Ups Today" value={stats.followUpsToday} icon={CalendarClock} />
        <StatCard title="Urgent" value={stats.urgent} icon={AlertTriangle} />
        <StatCard title="Needs Review" value={stats.needsReview} icon={ShieldAlert} />
        <StatCard title="Possible Dead" value={stats.possibleDead} icon={Filter} />
      </div>

      {isAdmin && (
        <Card className={ingestionPaused ? "border-amber-300 bg-amber-50/60" : ""}>
          <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Power className="h-4 w-4" />
                Admin Testing Controls
                <Badge variant={ingestionPaused ? "destructive" : "secondary"}>
                  {ingestionPaused ? "Ingestion Paused" : "Ingestion On"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Pause stops future Quo webhooks from creating conversations, messages, and AI jobs. Quo still receives a successful response.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2">
                <Switch
                  checked={ingestionPaused}
                  disabled={adminStatusQuery.isLoading || ingestionToggleMutation.isPending}
                  onCheckedChange={(checked) => ingestionToggleMutation.mutate(checked)}
                />
                <span className="text-sm">{ingestionPaused ? "Paused" : "Receiving"}</span>
              </div>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteAllConversationsMutation.isPending}
                onClick={() => deleteAllConversationsMutation.mutate()}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete All Test Chats
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader className="border-b p-4">
            <CardTitle className="text-base">Today&apos;s Operations Brief</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            <p className="text-sm text-muted-foreground">
              {briefQuery.data?.summary || "No daily brief generated yet. Run ai-daily-brief after AI jobs start producing tasks."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{openTasks.length} open tasks</Badge>
              <Badge variant={overdueTasks.length ? "destructive" : "secondary"}>{overdueTasks.length} overdue</Badge>
              <Badge variant="outline">${todayAiSpend.toFixed(4)} AI today</Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="border-b p-4">
            <CardTitle className="text-base">AI Task Queues</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 p-4 text-sm">
            <QueueMetric label="Due / Overdue" value={overdueTasks.length} />
            <QueueMetric label="Needs Review" value={openTasks.filter((task) => task.requires_human_review).length} />
            <QueueMetric label="Complaints" value={openTasks.filter((task) => task.task_type.includes("complaint")).length} />
            <QueueMetric label="Hot / Quote" value={openTasks.filter((task) => task.task_type.includes("quote") || task.task_type.includes("hot")).length} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-7">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search phone, name, summary, or message"
              className="pl-9"
            />
          </div>
          <Select value={sectionFilter} onValueChange={(value) => setSectionFilter(value as typeof sectionFilter)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {sectionFilters.map((section) => (
                <SelectItem key={section} value={section}>
                  {section === "all" ? "All Sections" : QUO_AI_SECTION_LABELS[section]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={numberFilter} onValueChange={setNumberFilter}>
            <SelectTrigger><SelectValue placeholder="Quo number" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Quo Numbers</SelectItem>
              {numberOptions.map(([id, label]) => (
                <SelectItem key={id} value={id}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={confidenceFilter} onValueChange={setConfidenceFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Confidence</SelectItem>
              <SelectItem value="high">90%+</SelectItem>
              <SelectItem value="review">Below 75%</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Dates</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
            </SelectContent>
          </Select>
          <Select value={linkedFilter} onValueChange={setLinkedFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Linked + Unlinked</SelectItem>
              <SelectItem value="linked">Linked</SelectItem>
              <SelectItem value="unlinked">Unlinked</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(360px,0.9fr)_minmax(520px,1.4fr)]">
        <Card className="min-h-[680px]">
          <CardHeader className="border-b p-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Conversation Queue</CardTitle>
              <Badge variant="secondary">{filteredConversations.length}</Badge>
            </div>
          </CardHeader>
          <ScrollArea className="h-[620px]">
            <div className="space-y-2 p-3">
              {conversationsQuery.isLoading ? (
                Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-lg" />)
              ) : filteredConversations.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">No conversations match the filters.</div>
              ) : (
                filteredConversations.map((conversation) => {
                  const state = getState(conversation);
                  const section = getSection(conversation);
                  const priority = getPriority(conversation);
                  const linked = Boolean(conversation.linked_lead_id || conversation.ai_lead_links?.length);
                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => {
                        setSelectedConvId(conversation.id);
                        setOverrideSection(section);
                      }}
                      className={`w-full rounded-lg border bg-card p-3 text-left transition hover:bg-muted/50 ${
                        selectedConvId === conversation.id ? "border-primary/50 ring-1 ring-primary/25" : "border-border"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">
                            {conversation.customer_name || conversation.customer_number || "Unknown Customer"}
                          </div>
                          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span className="truncate">{conversation.customer_number || "No phone"}</span>
                          </div>
                        </div>
                        <Badge variant="outline" className={priorityClasses[priority]}>
                          {priority}
                        </Badge>
                      </div>
                      <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                        {conversation.last_message_preview || conversation.rolling_ai_summary || "No message preview"}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <Badge variant={section === "needs_human_review" ? "destructive" : "secondary"}>
                          {QUO_AI_SECTION_LABELS[section]}
                        </Badge>
                        {linked && <Badge variant="outline"><Link2 className="mr-1 h-3 w-3" />Linked</Badge>}
                        {state && <Badge variant="outline">{Math.round(state.confidence * 100)}%</Badge>}
                        <span className="ml-auto text-xs text-muted-foreground">
                          {formatShortDate(conversation.last_message_at ?? conversation.last_message_time)}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </Card>

        <div className="space-y-4">
          {!selectedConversation ? (
            <Card className="flex min-h-[680px] items-center justify-center border-dashed bg-muted/20">
              <div className="text-center text-sm text-muted-foreground">
                <MessageSquare className="mx-auto mb-3 h-10 w-10 opacity-30" />
                Select a conversation to review AI evidence, messages, reminders, and overrides.
              </div>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader className="border-b p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">
                        {selectedConversation.customer_name || selectedConversation.customer_number || "Unknown Customer"}
                      </CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {selectedConversation.customer_number || "No phone"} via{" "}
                        {selectedConversation.quo_phone_numbers?.label ||
                          selectedConversation.quo_phone_numbers?.name ||
                          selectedConversation.quo_phone_numbers?.display_number ||
                          "Unknown Quo number"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => analyzeMutation.mutate()} disabled={analyzeMutation.isPending}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Run AI
                      </Button>
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            if (!selectedConversation) return;
                            const ok = window.confirm("Delete this stored Quo chat and related AI data from CRM? This does not delete the chat in Quo.");
                            if (ok) deleteConversationMutation.mutate(selectedConversation.id);
                          }}
                          disabled={deleteConversationMutation.isPending}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Chat
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(getQuoChatUrl(selectedConversation), "_blank")}
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open Chat
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-4 p-4 lg:grid-cols-2">
                  <div className="space-y-3">
                    <div className="rounded-lg border p-3">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">AI Decision</div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={getSection(selectedConversation) === "needs_human_review" ? "destructive" : "secondary"}>
                          {QUO_AI_SECTION_LABELS[getSection(selectedConversation)]}
                        </Badge>
                        <Badge variant="outline" className={priorityClasses[getPriority(selectedConversation)]}>
                          {getPriority(selectedConversation)}
                        </Badge>
                        {selectedState && <Badge variant="outline">{Math.round(selectedState.confidence * 100)}% confidence</Badge>}
                        {selectedState && <Badge variant="outline">{selectedState.risk_level}</Badge>}
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">
                        {latestDecision?.reason || selectedConversation.rolling_ai_summary || "No AI summary saved yet."}
                      </p>
                      {selectedState?.evidence?.length ? (
                        <div className="mt-3 space-y-2">
                          {selectedState.evidence.map((item, index) => (
                            <div key={`${item.message_id}-${index}`} className="rounded-md bg-muted/60 p-2 text-xs">
                              <div className="font-medium">{item.quote || "Evidence message"}</div>
                              <div className="mt-1 text-muted-foreground">{item.why_it_matters}</div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-lg border p-3">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Manual Override</div>
                      <div className="flex flex-wrap gap-2">
                        <Select value={overrideSection} onValueChange={(value) => setOverrideSection(value as QuoAiSection)}>
                          <SelectTrigger className="w-[260px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {QUO_AI_SECTIONS.map((section) => (
                              <SelectItem key={section} value={section}>{QUO_AI_SECTION_LABELS[section]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button onClick={() => overrideMutation.mutate({ section: overrideSection })} disabled={overrideMutation.isPending}>
                          Move Section
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => overrideMutation.mutate({ section: getSection(selectedConversation), reviewed: true })}
                          disabled={overrideMutation.isPending}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Mark Reviewed
                        </Button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => overrideMutation.mutate({ section: "not_a_lead_spam_wrong_number", reviewed: true })}>
                          Mark Not Lead
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => overrideMutation.mutate({ section: "lost_found_other_tech", reviewed: true })}>
                          Mark Lost
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => overrideMutation.mutate({ section: "waiting_for_customer", reviewed: true })}>
                          Restore From Possible Dead
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-lg border p-3">
                      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <ClipboardList className="h-3.5 w-3.5" />
                        AI Tasks / Follow-Ups
                      </div>
                      {selectedTasks.length ? (
                        <div className="space-y-2">
                          {selectedTasks.slice(0, 6).map((task) => (
                            <div key={task.id} className="rounded-md bg-muted/50 p-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={task.status === "needs_review" ? "destructive" : "secondary"}>
                                  {task.status.replace("_", " ")}
                                </Badge>
                                <Badge variant="outline" className={priorityClasses[task.priority]}>
                                  {task.priority}
                                </Badge>
                                <span className="text-sm font-medium">{task.title}</span>
                              </div>
                              {task.instructions && <p className="mt-2 text-xs text-muted-foreground">{task.instructions}</p>}
                              <div className="mt-1 text-[11px] text-muted-foreground">
                                {task.assigned_role}
                                {task.due_at ? ` - due ${formatDate(task.due_at)}` : ""}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No open AI tasks for this conversation.</p>
                      )}
                    </div>

                    <div className="rounded-lg border p-3">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lead Link</div>
                      {selectedLead || selectedConversation.linked_lead_id ? (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-sm font-medium">{selectedLead?.customer_name || "Linked Lead"}</div>
                            <div className="text-xs text-muted-foreground">{selectedLead?.job_id || selectedConversation.linked_lead_id}</div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(`/leads/${selectedLead?.id || selectedConversation.linked_lead_id}`, "_blank")}
                          >
                            Open Lead
                          </Button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm text-muted-foreground">No linked CRM lead.</p>
                          <Button size="sm" onClick={() => setShowAddLead(true)}>
                            <UserPlus className="mr-2 h-4 w-4" />
                            Create Lead
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="rounded-lg border p-3">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reminders</div>
                      {selectedConversation.ai_reminders?.length ? (
                        <div className="space-y-2">
                          {selectedConversation.ai_reminders.map((reminder) => (
                            <div key={reminder.id} className="flex items-start justify-between gap-3 rounded-md bg-muted/50 p-2">
                              <div>
                                <div className="text-sm font-medium capitalize">{reminder.reminder_type.replace("_", " ")}</div>
                                <div className="text-xs text-muted-foreground">{formatDate(reminder.due_at)}</div>
                                {reminder.reason && <div className="mt-1 text-xs">{reminder.reason}</div>}
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={reminder.status !== "pending" || reminderMutation.isPending}
                                onClick={() => reminderMutation.mutate(reminder.id)}
                              >
                                {reminder.status === "pending" ? "Complete" : reminder.status}
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No AI reminders for this conversation.</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader className="border-b p-4">
                    <CardTitle className="text-base">Full Chat</CardTitle>
                  </CardHeader>
                  <ScrollArea className="h-[420px]">
                    <div className="space-y-3 p-4">
                      {messagesQuery.isLoading ? (
                        Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-16 rounded-lg" />)
                      ) : messagesQuery.data?.length ? (
                        messagesQuery.data.map((message) => {
                          const isCustomer = message.sender === "customer";
                          return (
                            <div key={message.id} className={`flex ${isCustomer ? "justify-start" : "justify-end"}`}>
                              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${isCustomer ? "bg-muted" : "bg-primary text-primary-foreground"}`}>
                                <div>{message.text || "[Media or empty message]"}</div>
                                <div className={`mt-1 text-[11px] ${isCustomer ? "text-muted-foreground" : "text-primary-foreground/75"}`}>
                                  {formatDate(message.message_time)}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="py-10 text-center text-sm text-muted-foreground">No messages stored.</p>
                      )}
                    </div>
                  </ScrollArea>
                </Card>

                <Card>
                  <CardHeader className="border-b p-4">
                    <CardTitle className="text-base">Decision Audit</CardTitle>
                  </CardHeader>
                  <ScrollArea className="h-[420px]">
                    <div className="space-y-3 p-4">
                      {decisionsQuery.isLoading ? (
                        Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-lg" />)
                      ) : decisionsQuery.data?.length ? (
                        decisionsQuery.data.map((decision) => (
                          <div key={decision.id} className="rounded-lg border p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={decision.needs_human_review ? "destructive" : "secondary"}>
                                {decision.needs_human_review ? "Review" : "Applied"}
                              </Badge>
                              <Badge variant="outline">{Math.round(Number(decision.confidence || 0) * 100)}%</Badge>
                              <Badge variant="outline">{decision.model_used || "rule-engine"}</Badge>
                              {decision.estimated_cost_usd ? (
                                <Badge variant="outline">${Number(decision.estimated_cost_usd).toFixed(4)}</Badge>
                              ) : null}
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">{decision.reason || "No reason stored."}</p>
                            <div className="mt-2 text-xs text-muted-foreground">{formatDate(decision.created_at)}</div>
                          </div>
                        ))
                      ) : (
                        <p className="py-10 text-center text-sm text-muted-foreground">No AI decisions stored yet.</p>
                      )}
                    </div>
                  </ScrollArea>
                </Card>
              </div>
            </>
          )}
        </div>
      </div>

      {selectedConversation && (
        <AddLeadDialog
          open={showAddLead}
          onOpenChange={setShowAddLead}
          onSuccess={() => {
            setShowAddLead(false);
            queryClient.invalidateQueries({ queryKey: ["quo-ai-conversations"] });
          }}
          initialData={{
            customer_name: selectedConversation.customer_name || "",
            customer_phone: selectedConversation.customer_number || "",
            direction: "incoming",
          }}
        />
      )}
    </div>
  );
}

function QueueMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: number;
  icon: LucideIcon;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
          <div className="mt-1 text-2xl font-semibold">{value}</div>
        </div>
        <div className="rounded-lg border bg-muted/50 p-2">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </CardContent>
    </Card>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="min-w-0 truncate text-right text-slate-200">{value}</span>
    </div>
  );
}
