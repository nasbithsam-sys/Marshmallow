import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Filter,
  Link2,
  MessageSquare,
  Phone,
  Power,
  RefreshCw,
  Search,
  ShieldAlert,
  ClipboardList,
  Trash2,
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

export default function QuoMonitorPage() {
  const queryClient = useQueryClient();
  const { user, role } = useAuth();
  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState<(typeof sectionFilters)[number]>("all");
  const [numberFilter, setNumberFilter] = useState("all");
  const [confidenceFilter, setConfidenceFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [linkedFilter, setLinkedFilter] = useState("all");
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

      if (sectionFilter !== "all" && section !== sectionFilter) return false;
      if (numberFilter !== "all" && numberId !== numberFilter) return false;
      if (confidenceFilter === "high" && confidence < 0.9) return false;
      if (confidenceFilter === "review" && confidence >= 0.75) return false;
      if (linkedFilter === "linked" && !linked) return false;
      if (linkedFilter === "unlinked" && linked) return false;
      if (dateFilter === "today" && (!lastActivity || !isSameDay(lastActivity))) return false;
      if (dateFilter === "7d" && (!lastActivity || Date.now() - new Date(lastActivity).getTime() > 7 * 86400000)) return false;
      if (query) {
        const haystack = [
          conversation.customer_name,
          conversation.customer_number,
          conversation.last_message_preview,
          conversation.rolling_ai_summary,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [conversations, confidenceFilter, dateFilter, linkedFilter, numberFilter, search, sectionFilter]);

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

  return (
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
                        onClick={() => window.open(`https://app.openphone.com/conversations/${selectedConversation.quo_conversation_id}`, "_blank")}
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
