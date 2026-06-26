import React, { useState, useMemo } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  MessageSquare, 
  Search,
  Filter,
  AlertCircle,
  CheckCircle2,
  Clock,
  Skull,
  ExternalLink,
  UserPlus
} from "lucide-react";
import { mockConversations, mockNumberStats, QuoConversation } from "./mockData";

export default function QuoMonitorPage() {
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("today");
  const [statusFilter, setStatusFilter] = useState("all");
  const [directionFilter, setDirectionFilter] = useState("all");
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);

  const stats = useMemo(() => {
    return mockNumberStats.reduce((acc, curr) => ({
      incomingToday: acc.incomingToday + curr.incomingToday,
      outgoingToday: acc.outgoingToday + curr.outgoingToday,
      needsFollowUp: acc.needsFollowUp + curr.needsFollowUp,
      importantLeads: acc.importantLeads + curr.importantLeads,
      delayedReplies: acc.delayedReplies + curr.delayedReplies,
      deadConversations: acc.deadConversations + curr.deadConversations,
    }), {
      incomingToday: 0,
      outgoingToday: 0,
      needsFollowUp: 0,
      importantLeads: 0,
      delayedReplies: 0,
      deadConversations: 0,
    });
  }, []);

  const filteredConversations = useMemo(() => {
    return mockConversations.filter(c => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (directionFilter !== "all" && c.direction !== directionFilter) return false;
      if (search) {
        const query = search.toLowerCase();
        if (!c.customerName.toLowerCase().includes(query) && !c.customerNumber.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [search, statusFilter, directionFilter]);

  const selectedConversation = useMemo(() => {
    return mockConversations.find(c => c.id === selectedConvId) || null;
  }, [selectedConvId]);

  const handleAction = (actionName: string) => {
    toast.success(`${actionName} triggered`, {
      description: "This is a UI-only mock action."
    });
  };

  const getStatusBadgeVariant = (status: QuoConversation["status"]) => {
    switch (status) {
      case "Important": return "default";
      case "Needs Follow-Up": return "secondary";
      case "Delayed Reply": return "destructive";
      case "Dead Lead": return "outline";
      default: return "secondary";
    }
  };

  const getPriorityBadgeColor = (priority: QuoConversation["priority"]) => {
    switch (priority) {
      case "High": return "bg-red-100 text-red-800 border-red-200 dark:bg-red-500/20 dark:text-red-300";
      case "Medium": return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-300";
      case "Low": return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-500/20 dark:text-gray-300";
      default: return "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quo Monitor</h1>
          <p className="text-sm text-muted-foreground">
            Read-only inbox mirror. Monitor conversations, AI analysis, and messaging health.
          </p>
        </div>
      </div>

      {/* Top Dashboard Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard title="Incoming (Today)" value={stats.incomingToday} icon={<ArrowDownLeft className="h-4 w-4 text-emerald-500" />} />
        <StatCard title="Outgoing (Today)" value={stats.outgoingToday} icon={<ArrowUpRight className="h-4 w-4 text-orange-500" />} />
        <StatCard title="Needs Follow-Up" value={stats.needsFollowUp} icon={<Clock className="h-4 w-4 text-yellow-500" />} />
        <StatCard title="Important Leads" value={stats.importantLeads} icon={<AlertCircle className="h-4 w-4 text-red-500" />} />
        <StatCard title="Delayed Replies" value={stats.delayedReplies} icon={<MessageSquare className="h-4 w-4 text-purple-500" />} />
        <StatCard title="Dead Convos" value={stats.deadConversations} icon={<Skull className="h-4 w-4 text-gray-500" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel: Conversation List */}
        <Card className="lg:col-span-1 h-[600px] flex flex-col">
          <CardHeader className="pb-3 border-b space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Conversations</CardTitle>
              <Badge variant="secondary">{filteredConversations.length}</Badge>
            </div>
            
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name or number..."
                className="pl-9 h-9 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="Important">Important</SelectItem>
                  <SelectItem value="Needs Follow-Up">Needs Follow-Up</SelectItem>
                  <SelectItem value="Delayed Reply">Delayed</SelectItem>
                  <SelectItem value="Dead Lead">Dead</SelectItem>
                </SelectContent>
              </Select>

              <Select value={directionFilter} onValueChange={setDirectionFilter}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder="Direction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dirs</SelectItem>
                  <SelectItem value="incoming">Incoming</SelectItem>
                  <SelectItem value="outgoing">Outgoing</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {filteredConversations.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No conversations found.
                </div>
              ) : (
                filteredConversations.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => setSelectedConvId(conv.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selectedConvId === conv.id 
                        ? "bg-primary/5 border-primary/20" 
                        : "bg-card hover:bg-muted/50 border-transparent"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="font-medium text-sm truncate pr-2">
                        {conv.customerName !== "Unknown" ? conv.customerName : conv.customerNumber}
                      </div>
                      <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {conv.lastMessageTime}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mb-2 line-clamp-1">
                      {conv.direction === "incoming" ? "↓" : "↑"} {conv.lastMessagePreview}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      <Badge variant={getStatusBadgeVariant(conv.status)} className="text-[10px] px-1.5 py-0">
                        {conv.status}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getPriorityBadgeColor(conv.priority)}`}>
                        {conv.priority}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground ml-auto self-center truncate max-w-[80px]">
                        {conv.numberName}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* Right Panel: Thread and Analysis */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {!selectedConversation ? (
            <Card className="h-[600px] flex items-center justify-center bg-muted/20 border-dashed">
              <div className="text-center">
                <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-20" />
                <p className="text-muted-foreground text-sm">Select a conversation to view details</p>
              </div>
            </Card>
          ) : (
            <>
              {/* Message Thread */}
              <Card className="flex-1 min-h-[350px] flex flex-col">
                <CardHeader className="py-3 px-4 border-b bg-muted/20">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle className="text-base">{selectedConversation.customerName}</CardTitle>
                      <CardDescription className="text-xs mt-0.5">{selectedConversation.customerNumber}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleAction("Open in Quo")}>
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                        Open in Quo
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {selectedConversation.messages.map(msg => {
                      const isCustomer = msg.sender === "customer";
                      return (
                        <div key={msg.id} className={`flex ${isCustomer ? "justify-start" : "justify-end"}`}>
                          <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                            isCustomer 
                              ? "bg-muted text-foreground rounded-tl-none" 
                              : "bg-primary text-primary-foreground rounded-tr-none"
                          }`}>
                            <div>{msg.text}</div>
                            <div className={`text-[10px] mt-1 ${isCustomer ? "text-muted-foreground" : "text-primary-foreground/70"} text-right`}>
                              {msg.time}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </Card>

              {/* Analysis & Actions Panel */}
              <Card className="shrink-0 border-primary/20 shadow-sm bg-gradient-to-br from-card to-primary/5">
                <CardHeader className="py-3 px-4 border-b/50">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <SparklesIcon className="h-4 w-4 text-primary" />
                      Conversation Analysis
                    </CardTitle>
                    <Badge variant={getStatusBadgeVariant(selectedConversation.status)}>
                      {selectedConversation.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 grid gap-4 grid-cols-1 md:grid-cols-2">
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium mb-1">AI Rule Result</p>
                      <p className="text-sm font-semibold">{selectedConversation.analysis.aiRuleResult}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium mb-1">Reasoning</p>
                      <p className="text-sm">{selectedConversation.analysis.reason}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium mb-1">Suggested Action</p>
                      <p className="text-sm text-primary font-medium">{selectedConversation.analysis.suggestedAction}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3 border-l pl-4 md:pl-4">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium mb-1">Response Delay</p>
                      <p className="text-sm font-medium">{selectedConversation.analysis.responseDelay}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Last Customer Reply</p>
                        <p className="text-xs font-medium">{selectedConversation.analysis.lastCustomerReplyTime}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Last Agent Reply</p>
                        <p className="text-xs font-medium">{selectedConversation.analysis.lastAgentReplyTime}</p>
                      </div>
                    </div>
                    <div className="pt-2 flex flex-wrap gap-2">
                      <Button size="sm" variant="default" className="text-xs h-8" onClick={() => handleAction("Create Lead")}>
                        <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                        Create Lead
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => handleAction("Mark Important")}>
                        <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
                        Important
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => handleAction("Mark Followed Up")}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                        Followed Up
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Number-wise Activity Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Number-wise Activity</CardTitle>
          <CardDescription>Daily performance and backlog per line</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number Name</TableHead>
                <TableHead className="text-right">Incoming Today</TableHead>
                <TableHead className="text-right">Outgoing Today</TableHead>
                <TableHead className="text-right">Needs Follow-Up</TableHead>
                <TableHead className="text-right">Important Leads</TableHead>
                <TableHead className="text-right">Delayed Replies</TableHead>
                <TableHead className="text-right">Dead Convos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockNumberStats.map((stat) => (
                <TableRow key={stat.id}>
                  <TableCell className="font-medium">{stat.numberName}</TableCell>
                  <TableCell className="text-right text-emerald-600 dark:text-emerald-400 font-medium">{stat.incomingToday}</TableCell>
                  <TableCell className="text-right text-orange-600 dark:text-orange-400 font-medium">{stat.outgoingToday}</TableCell>
                  <TableCell className="text-right font-medium">{stat.needsFollowUp}</TableCell>
                  <TableCell className="text-right text-red-600 dark:text-red-400 font-medium">{stat.importantLeads}</TableCell>
                  <TableCell className="text-right font-medium">{stat.delayedReplies}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{stat.deadConversations}</TableCell>
                </TableRow>
              ))}
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
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{title}</div>
          <div className="mt-1.5 text-2xl font-bold tracking-tight">{value}</div>
        </div>
        <div className="bg-muted/50 p-2 rounded-full">
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}

function SparklesIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
      <path d="M5 3v4" />
      <path d="M19 17v4" />
      <path d="M3 5h4" />
      <path d="M17 19h4" />
    </svg>
  );
}
