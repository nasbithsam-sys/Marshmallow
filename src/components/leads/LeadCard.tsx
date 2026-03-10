import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Lead, LeadStatus, STATUS_LABELS, STATUS_COLORS, ALL_LEAD_STATUSES } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { UserCircle, Phone, MapPin, Wrench, Trash2, Pencil, DollarSign, MessageSquare, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import NoteThread from "./NoteThread";
import { motion } from "framer-motion";
import { cardHover, cardTap } from "@/lib/motion";

interface LeadCardProps {
  lead: Lead;
  profiles: Record<string, string>;
  onRefresh: () => void;
}

export default function LeadCard({ lead, profiles, onRefresh }: LeadCardProps) {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const [changingStatus, setChangingStatus] = useState(false);
  const [csOpen, setCsOpen] = useState(false);
  const [processorOpen, setProcessorOpen] = useState(false);

  const isAdmin = role === "admin";
  const isCS = role === "customer_service";
  const isProcessor = role === "processor";

  const handleStatusChange = async (newStatus: string) => {
    setChangingStatus(true);
    const { error } = await supabase
      .from("leads")
      .update({ status: newStatus as LeadStatus, last_edited_by: user?.id, updated_at: new Date().toISOString() })
      .eq("id", lead.id);
    setChangingStatus(false);
    if (error) toast.error("Failed to update status");
    else {
      toast.success(`Status → ${STATUS_LABELS[newStatus as LeadStatus]}`);
      onRefresh();
    }
  };

  const handleDelete = async () => {
    const { error } = await supabase.from("leads").delete().eq("id", lead.id);
    if (error) toast.error("Failed to delete lead");
    else { toast.success("Lead deleted"); onRefresh(); }
  };

  const isUrgent = lead.status === "urgent_job";

  return (
    <motion.div whileHover={cardHover} whileTap={cardTap}>
      <Card className={`overflow-hidden rounded-xl border-border/60 flex flex-col transition-colors ${isUrgent ? "ring-2 ring-destructive/30 shadow-destructive/5" : ""}`}>
        {isUrgent && <div className="h-1 w-full bg-gradient-to-r from-destructive to-destructive/60" />}

        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 pb-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <UserCircle className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground truncate text-sm">{lead.customer_name}</p>
              <p className="font-mono text-[10px] text-muted-foreground">{lead.job_id}</p>
            </div>
          </div>
          <Badge className={`shrink-0 text-[10px] font-medium px-2.5 py-0.5 rounded-full ${STATUS_COLORS[lead.status]}`}>
            {STATUS_LABELS[lead.status]}
          </Badge>
        </div>

        {/* Meta info */}
        <div className="px-3 sm:px-4 space-y-1.5 text-[12px] text-muted-foreground">
          {lead.customer_phone && (
            <span className="flex items-center gap-1.5">
              <Phone className="h-3 w-3 text-muted-foreground/60" /> {lead.customer_phone}
            </span>
          )}
          {lead.address && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3 text-muted-foreground/60" /> <span className="truncate">{lead.address}</span>
            </span>
          )}
          {lead.service_type && (
            <span className="flex items-center gap-1.5">
              <Wrench className="h-3 w-3 text-muted-foreground/60" /> {lead.service_type}
            </span>
          )}
        </div>

        {/* CS Notes preview */}
        {lead.cs_notes && (
          <div className="mx-3 sm:mx-4 mt-3 rounded-lg border-l-4 border-amber-400 bg-amber-50 dark:bg-amber-950/20 p-2.5">
            <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 mb-0.5">CS Notes</p>
            <p className="text-[12px] text-foreground/80 line-clamp-2">{lead.cs_notes}</p>
          </div>
        )}

        {/* Processor Notes preview */}
        {(isProcessor || isAdmin) && lead.processor_notes && (
          <div className="mx-3 sm:mx-4 mt-2 rounded-lg border-l-4 border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 p-2.5">
            <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 mb-0.5">Processor Notes</p>
            <p className="text-[12px] text-foreground/80 line-clamp-2">{lead.processor_notes}</p>
          </div>
        )}

        {/* Note Threads */}
        {(isCS || isAdmin) && (
          <div className="mx-3 sm:mx-4 mt-3">
            <Collapsible open={csOpen} onOpenChange={setCsOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between h-8 text-[12px] text-muted-foreground hover:text-foreground px-2">
                  <span className="flex items-center gap-1.5"><MessageSquare className="h-3 w-3" /> CS Notes Thread</span>
                  <motion.span animate={{ rotate: csOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </motion.span>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-1">
                <NoteThread leadId={lead.id} noteType="cs" label="CS Notes" profiles={profiles} />
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        {(isProcessor || isAdmin) && (
          <div className="mx-3 sm:mx-4 mt-2">
            <Collapsible open={processorOpen} onOpenChange={setProcessorOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between h-8 text-[12px] text-muted-foreground hover:text-foreground px-2">
                  <span className="flex items-center gap-1.5"><MessageSquare className="h-3 w-3" /> Processor Notes Thread</span>
                  <motion.span animate={{ rotate: processorOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </motion.span>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-1">
                <NoteThread leadId={lead.id} noteType="processor" label="Processor Notes" profiles={profiles} />
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        {/* Last edited */}
        {lead.last_edited_by && (
          <div className="mx-3 sm:mx-4 mt-3 rounded-lg bg-orange-100 dark:bg-orange-950/30 px-3 py-1.5">
            <p className="text-[11px] text-orange-700 dark:text-orange-400">
              Last edited {new Date(lead.updated_at).toLocaleDateString()} by{" "}
              <span className="font-semibold">{profiles[lead.last_edited_by] || "Unknown"}</span>
            </p>
          </div>
        )}

        {/* Created by */}
        <div className="px-3 sm:px-4 pt-2 pb-1">
          <p className="text-[10px] text-muted-foreground/60">
            Created by {profiles[lead.created_by] || "Unknown"} · {new Date(lead.created_at).toLocaleDateString()}
          </p>
        </div>

        {/* Actions */}
        <div className="mt-auto p-3 sm:p-4 pt-2 space-y-2">
          <Select value={lead.status} onValueChange={handleStatusChange} disabled={changingStatus}>
            <SelectTrigger className="w-full h-8 text-[12px]">
              <SelectValue placeholder="Change Status" />
            </SelectTrigger>
            <SelectContent>
              {ALL_LEAD_STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="text-[12px]">{STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="flex-1 h-8 text-[12px]" onClick={() => navigate(`/leads/${lead.id}`)}>
              <Pencil className="h-3 w-3 mr-1" /> Edit
            </Button>
            <Button variant="outline" size="sm" className="flex-1 h-8 text-[12px]" onClick={() => handleStatusChange("paid")} disabled={lead.status === "paid"}>
              <DollarSign className="h-3 w-3 mr-1" /> Mark Paid
            </Button>
            {isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete lead?</AlertDialogTitle>
                    <AlertDialogDescription>This will permanently delete "{lead.customer_name}". This action cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}