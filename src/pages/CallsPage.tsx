import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowDownLeft, ArrowUpRight, Phone, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Direction = "incoming" | "outgoing";
type CallFlag =
  | "spam"
  | "marketing"
  | "lead"
  | "future_customer"
  | "in_progress"
  | "done"
  | "scheduled"
  | "cancelled";

interface CallRow {
  id: string;
  direction: Direction;
  number_name: string;
  customer_message: string | null;
  flag: CallFlag;
  linked_lead_id: string | null;
  handled_by: string | null;
  call_date: string;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const FLAG_LABELS: Record<CallFlag, string> = {
  spam: "Spam",
  marketing: "Marketing",
  lead: "Lead",
  future_customer: "Will Need (Future)",
  in_progress: "In Progress",
  done: "Done",
  scheduled: "Scheduled",
  cancelled: "Cancelled",
};

const FLAG_COLOR: Record<CallFlag, string> = {
  spam: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-200 dark:border-rose-500/30",
  marketing: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-500/30",
  lead: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/15 dark:text-blue-200 dark:border-blue-500/30",
  future_customer: "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-500/15 dark:text-violet-200 dark:border-violet-500/30",
  in_progress: "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-500/15 dark:text-sky-200 dark:border-sky-500/30",
  done: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:border-emerald-500/30",
  scheduled: "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-200 dark:border-cyan-500/30",
  cancelled: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-500/15 dark:text-gray-200 dark:border-gray-500/30",
};

const ALL_FLAGS = Object.keys(FLAG_LABELS) as CallFlag[];

function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day + 6) % 7; // Monday start
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export default function CallsPage() {
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const isAdmin = role === "admin";
  const isCS = role === "customer_service";
  const canCreate = isAdmin || isCS;

  const [dirFilter, setDirFilter] = useState<"all" | Direction>("all");
  const [flagFilter, setFlagFilter] = useState<"all" | CallFlag>("all");
  const [search, setSearch] = useState("");
  const [range, setRange] = useState<"week" | "all">("week");
  const [open, setOpen] = useState(false);

  const { data: calls = [], isLoading } = useQuery({
    queryKey: ["calls"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calls")
        .select("*")
        .order("call_date", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as CallRow[];
    },
  });

  const weekStart = useMemo(() => startOfWeek(new Date()), []);
  const filtered = useMemo(() => {
    return calls.filter((c) => {
      if (range === "week" && new Date(c.call_date) < weekStart) return false;
      if (dirFilter !== "all" && c.direction !== dirFilter) return false;
      if (flagFilter !== "all" && c.flag !== flagFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${c.number_name} ${c.customer_message ?? ""} ${c.notes ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [calls, dirFilter, flagFilter, search, range, weekStart]);

  const weekCalls = useMemo(
    () => calls.filter((c) => new Date(c.call_date) >= weekStart),
    [calls, weekStart],
  );

  const stats = useMemo(() => {
    const total = weekCalls.length;
    const incoming = weekCalls.filter((c) => c.direction === "incoming").length;
    const outgoing = weekCalls.filter((c) => c.direction === "outgoing").length;
    const byFlag: Record<CallFlag, number> = ALL_FLAGS.reduce(
      (a, f) => ({ ...a, [f]: 0 }),
      {} as Record<CallFlag, number>,
    );
    weekCalls.forEach((c) => {
      byFlag[c.flag] = (byFlag[c.flag] || 0) + 1;
    });
    return { total, incoming, outgoing, byFlag };
  }, [weekCalls]);

  const updateFlag = async (id: string, flag: CallFlag) => {
    const { error } = await supabase.from("calls").update({ flag }).eq("id", id);
    if (error) {
      toast.error("Failed to update flag");
      return;
    }
    toast.success("Flag updated");
    qc.invalidateQueries({ queryKey: ["calls"] });
  };

  const deleteCall = async (id: string) => {
    if (!confirm("Delete this call entry?")) return;
    const { error } = await supabase.from("calls").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete");
      return;
    }
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["calls"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calls Log</h1>
          <p className="text-sm text-muted-foreground">
            Track every incoming & outgoing call. Flag each as Spam, Marketing, Lead, and more.
          </p>
        </div>
        {canCreate && (
          <NewCallDialog
            open={open}
            onOpenChange={setOpen}
            userId={user!.id}
            onCreated={() => qc.invalidateQueries({ queryKey: ["calls"] })}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard title="This Week" value={stats.total} icon={<Phone className="h-4 w-4" />} />
        <StatCard title="Incoming" value={stats.incoming} icon={<ArrowDownLeft className="h-4 w-4 text-emerald-500" />} />
        <StatCard title="Outgoing" value={stats.outgoing} icon={<ArrowUpRight className="h-4 w-4 text-orange-500" />} />
        <StatCard title="Leads" value={stats.byFlag.lead + stats.byFlag.future_customer} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Weekly breakdown by flag</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {ALL_FLAGS.map((f) => (
            <button
              key={f}
              onClick={() => setFlagFilter(flagFilter === f ? "all" : f)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${FLAG_COLOR[f]} ${flagFilter === f ? "ring-2 ring-primary/40" : ""}`}
            >
              {FLAG_LABELS[f]} · {stats.byFlag[f]}
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={range} onValueChange={(v) => setRange(v as "week" | "all")}>
              <TabsList>
                <TabsTrigger value="week">This Week</TabsTrigger>
                <TabsTrigger value="all">All Time</TabsTrigger>
              </TabsList>
            </Tabs>
            <Select value={dirFilter} onValueChange={(v) => setDirFilter(v as typeof dirFilter)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All directions</SelectItem>
                <SelectItem value="incoming">Incoming</SelectItem>
                <SelectItem value="outgoing">Outgoing</SelectItem>
              </SelectContent>
            </Select>
            <Select value={flagFilter} onValueChange={(v) => setFlagFilter(v as typeof flagFilter)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All flags</SelectItem>
                {ALL_FLAGS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {FLAG_LABELS[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            placeholder="Search number, name, message…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-xs"
          />
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Direction</TableHead>
                <TableHead>Number / Name</TableHead>
                <TableHead>Customer Message</TableHead>
                <TableHead>Flag</TableHead>
                <TableHead>Date</TableHead>
                {(isAdmin || isCS) && <TableHead className="w-12"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    No calls match.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => {
                  const canEdit = isAdmin || (isCS && c.created_by === user?.id);
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        {c.direction === "incoming" ? (
                          <Badge variant="outline" className="gap-1 text-emerald-700 dark:text-emerald-300">
                            <ArrowDownLeft className="h-3 w-3" /> In
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="gap-1 text-orange-700 dark:text-orange-300">
                            <ArrowUpRight className="h-3 w-3" /> Out
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{c.number_name}</TableCell>
                      <TableCell className="max-w-md">
                        <div className="line-clamp-2 text-sm">{c.customer_message || "—"}</div>
                        {c.notes && (
                          <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{c.notes}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {canEdit ? (
                          <Select value={c.flag} onValueChange={(v) => updateFlag(c.id, v as CallFlag)}>
                            <SelectTrigger className={`h-8 w-[160px] border ${FLAG_COLOR[c.flag]}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ALL_FLAGS.map((f) => (
                                <SelectItem key={f} value={f}>
                                  {FLAG_LABELS[f]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${FLAG_COLOR[c.flag]}`}>
                            {FLAG_LABELS[c.flag]}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(c.call_date).toLocaleString()}
                      </TableCell>
                      {(isAdmin || isCS) && (
                        <TableCell>
                          {canEdit && (
                            <Button variant="ghost" size="icon" onClick={() => deleteCall(c.id)}>
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: number; icon?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{title}</div>
          <div className="mt-1 text-2xl font-bold tracking-tight">{value}</div>
        </div>
        {icon}
      </CardContent>
    </Card>
  );
}

function NewCallDialog({
  open,
  onOpenChange,
  userId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  onCreated: () => void;
}) {
  const [direction, setDirection] = useState<Direction>("incoming");
  const [numberName, setNumberName] = useState("");
  const [message, setMessage] = useState("");
  const [flag, setFlag] = useState<CallFlag>("lead");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setDirection("incoming");
      setNumberName("");
      setMessage("");
      setFlag("lead");
      setNotes("");
    }
  }, [open]);

  const submit = async () => {
    if (!numberName.trim()) {
      toast.error("Number / name is required");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("calls").insert({
      direction,
      number_name: numberName.trim(),
      customer_message: message.trim() || null,
      flag,
      notes: notes.trim() || null,
      created_by: userId,
      handled_by: userId,
    });
    setSaving(false);
    if (error) {
      toast.error("Failed to log call");
      return;
    }
    toast.success("Call logged");
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Phone className="mr-2 h-4 w-4" />
          Log Call
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log a new call</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Direction *</Label>
            <div className="mt-2 flex gap-2">
              {(["incoming", "outgoing"] as Direction[]).map((d) => (
                <button
                  key={d}
                  onClick={() => setDirection(d)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition ${
                    direction === d
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {d === "incoming" ? "↓ Incoming" : "↑ Outgoing"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Number / Name *</Label>
            <Input value={numberName} onChange={(e) => setNumberName(e.target.value)} placeholder="+1 555… or caller name" />
          </div>
          <div>
            <Label>Customer Message</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What did the customer say / want?"
              rows={3}
            />
          </div>
          <div>
            <Label>Flag *</Label>
            <Select value={flag} onValueChange={(v) => setFlag(v as CallFlag)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_FLAGS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {FLAG_LABELS[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Internal Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Log Call"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
