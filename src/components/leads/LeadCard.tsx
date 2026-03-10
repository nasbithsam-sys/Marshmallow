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
import { UserCircle, Phone, MapPin, Wrench, Trash2, Pencil, MessageSquare, ChevronDown, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import NoteThread from "./NoteThread";
import PaymentDialog from "./PaymentDialog";
import LeadShareDialog from "./LeadShareDialog";
import StatusBadge from "./StatusBadge";
import { motion } from "framer-motion";

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
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);

  const isAdmin = role === "admin";
  const isCS = role === "customer_service";
  const isProcessor = role === "processor";

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === 'paid') {
      setPendingStatus(newStatus);
      setPaymentOpen(true);
      return;
    }

    setChangingStatus(true);
    const { error } = await supabase
      .from("leads")
      .update({ status: newStatus as LeadStatus, last_edited_by: user?.id, updated_at: new Date().toISOString() })
      .eq("id", lead.id);
    setChangingStatus(false);
    if (error) toast.error("Failed to update status");
    else {
      toast.success(`Status → ${STATUS_LABELS[newStatus as LeadStatus]}`);
      if (newStatus === 'urgent_job' || newStatus === 'need_tech') {
        const { data: roles } = await supabase.from('user_roles').select('user_id, role').in('role', ['admin', 'processor']);
        if (roles) {
          const statusLabel = newStatus === 'urgent_job' ? 'Urgent Job' : 'Need Tech';
          const notifs = roles.map((r: any) => ({
            user_id: r.user_id,
            title: `🚨 ${statusLabel}`,
            message: `Lead "${lead.customer_name}" changed to ${statusLabel}`,
            lead_id: lead.id,
            read: false,
          }));
          await supabase.from('notifications').insert(notifs);
        }
      }
      onRefresh();
    }
  };

  const handlePaymentConfirm = async (amount: number, screenshotFile: File | null) => {
    setPaymentLoading(true);
    let screenshotUrl: string | null = null;

    if (screenshotFile) {
      const ext = screenshotFile.name.split('.').pop();
      const path = `payments/${lead.id}_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('lead-photos').upload(path, screenshotFile);
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('lead-photos').getPublicUrl(path);
        screenshotUrl = urlData.publicUrl;
      }
    }

    const { error } = await supabase
      .from("leads")
      .update({
        status: 'paid' as LeadStatus,
        amount,
        payment_amount: amount,
        payment_screenshot_url: screenshotUrl,
        last_edited_by: user?.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", lead.id);

    setPaymentLoading(false);
    setPaymentOpen(false);
    setPendingStatus(null);

    if (error) toast.error("Failed to update status");
    else {
      toast.success("Payment recorded & status updated to Paid");
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
    <motion.div
      whileHover={{ y: -4, transition: { type: "spring", stiffness: 400, damping: 30 } }}
      whileTap={{ scale: 0.98, transition: { duration: 0.1 } }}
    >
      <Card className={`overflow-hidden rounded-2xl border-border/50 flex flex-col transition-all duration-300 shadow-premium-sm hover:shadow-premium-lg ${isUrgent ? "ring-2 ring-destructive/20 shadow-red-100" : ""}`}>
        {isUrgent && (
          <div className="h-1 w-full bg-gradient-to-r from-destructive via-red-400 to-destructive/40" />
        )}

        {/* Header */}
        <div className="flex items-center justify-between p-4 pb-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center shrink-0 border border-primary/10">
              <UserCircle className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground truncate text-sm">{lead.customer_name}</p>
              <p className="font-mono text-[10px] text-muted-foreground/60">{lead.job_id}</p>
            </div>
          </div>
          <StatusBadge status={lead.status} size="sm" />
        </div>

        {/* Meta info */}
        <div className="px-4 space-y-1.5 text-[12px] text-muted-foreground">
          {lead.customer_phone && (
            <span className="flex items-center gap-2">
              <Phone className="h-3 w-3 text-muted-foreground/40" /> {lead.customer_phone}
            </span>
          )}
          {lead.address && (
            <span className="flex items-center gap-2">
              <MapPin className="h-3 w-3 text-muted-foreground/40" /> <span className="truncate">{lead.address}</span>
            </span>
          )}
          {lead.service_type && (
            <span className="flex items-center gap-2">
              <Wrench className="h-3 w-3 text-muted-foreground/40" /> {lead.service_type}
            </span>
          )}
        </div>

        {/* Note Threads */}
        {(isCS || isAdmin) && (
          <div className="mx-4 mt-3">
            <Collapsible open={csOpen} onOpenChange={setCsOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between h-8 text-[12px] text-muted-foreground hover:text-foreground rounded-lg px-2">
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
          <div className="mx-4 mt-2">
            <Collapsible open={processorOpen} onOpenChange={setProcessorOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between h-8 text-[12px] text-muted-foreground hover:text-foreground rounded-lg px-2">
                  <span className="flex items-center gap-1.5"><MessageSquare className="h-3 w-3" /> Processor Notes</span>
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
          <div className="mx-4 mt-3 rounded-xl bg-amber-50 border border-amber-100 px-3 py-1.5">
            <p className="text-[11px] text-amber-700">
              Last edited {new Date(lead.updated_at).toLocaleDateString()} by{" "}
              <span className="font-semibold">{profiles[lead.last_edited_by] || "Unknown"}</span>
            </p>
          </div>
        )}

        {/* Created by */}
        <div className="px-4 pt-2 pb-1">
          <p className="text-[10px] text-muted-foreground/50">
            Created by {profiles[lead.created_by] || "Unknown"} · {new Date(lead.created_at).toLocaleDateString()}
          </p>
        </div>

        {/* Actions */}
        <div className="mt-auto p-4 pt-2 space-y-2">
          <Select value={lead.status} onValueChange={handleStatusChange} disabled={changingStatus}>
            <SelectTrigger className="w-full h-9 text-[12px] rounded-xl bg-muted/30 border-border/40 hover:bg-muted/50 transition-colors">
              <SelectValue placeholder="Change Status" />
            </SelectTrigger>
            <SelectContent>
              {ALL_LEAD_STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="text-[12px]">{STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex-1">
              <Button variant="outline" size="sm" className="w-full h-9 text-[12px] rounded-xl gap-1.5 border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all" onClick={() => navigate(`/leads/${lead.id}`)}>
                <Pencil className="h-3 w-3" /> Edit
                <ArrowUpRight className="h-3 w-3 ml-auto opacity-40" />
              </Button>
            </motion.div>
            {isAdmin && (
              <LeadShareDialog leadId={lead.id} customerName={lead.customer_name} />
            )}
            {isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl text-destructive/60 hover:text-destructive hover:bg-destructive/5 hover:border-destructive/20 transition-all">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete lead?</AlertDialogTitle>
                    <AlertDialogDescription>This will permanently delete "{lead.customer_name}". This action cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground rounded-xl">Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        <PaymentDialog
          open={paymentOpen}
          onOpenChange={(open) => { setPaymentOpen(open); if (!open) setPendingStatus(null); }}
          onConfirm={handlePaymentConfirm}
          loading={paymentLoading}
        />
      </Card>
    </motion.div>
  );
}
