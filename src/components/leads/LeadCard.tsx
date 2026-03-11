import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Lead, LeadStatus, STATUS_LABELS, ALL_LEAD_STATUSES } from "@/lib/constants";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { UserCircle, Phone, MapPin, Wrench, Trash2, Pencil, MessageSquare, ChevronDown, ArrowUpRight, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import NoteThread from "./NoteThread";
import PaymentDialog from "./PaymentDialog";
import LeadShareDialog from "./LeadShareDialog";
import StatusBadge from "./StatusBadge";
import ImageLightbox from "./ImageLightbox";
import { adminApi } from "@/lib/admin-api";
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
  const [generalOpen, setGeneralOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const isAdmin = role === "admin";
  const isCS = role === "customer_service";
  const isProcessor = role === "processor";
  const isPaid = lead.status === "paid";

  useEffect(() => {
    fetchPhotos();
  }, [lead.id]);

  const fetchPhotos = async () => {
    const { data } = await supabase
      .from("lead_photos")
      .select("photo_url")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: true });
    if (data) setPhotos(data.map((p: any) => p.photo_url));
  };

  const allImages = [
    ...(isPaid && lead.payment_screenshot_url ? [lead.payment_screenshot_url] : []),
    ...photos,
  ];

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (isPaid) return;

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
    try {
      await adminApi.deleteLead(lead.id);
      toast.success("Lead deleted");
      onRefresh();
    } catch (err: any) {
      toast.error("Failed to delete lead: " + (err.message || "Unknown error"));
    }
  };

  const isUrgent = lead.status === "urgent_job";

  return (
    <motion.div
      whileHover={{ y: -3, transition: { type: "spring", stiffness: 400, damping: 30 } }}
    >
      <Card className={`overflow-hidden flex flex-col group ${isUrgent ? "ring-1 ring-destructive/15" : ""}`}>
        {isUrgent && (
          <div className="h-0.5 w-full bg-gradient-to-r from-destructive via-destructive/60 to-transparent" />
        )}

        {/* Header */}
        <div className="flex items-center justify-between p-4 pb-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-primary/6 flex items-center justify-center shrink-0 border border-primary/8">
              <UserCircle className="h-4.5 w-4.5 text-primary/70" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground truncate text-[13px] tracking-[-0.01em]">{lead.customer_name}</p>
              <p className="font-mono text-[10px] text-muted-foreground/50">{lead.job_id}</p>
            </div>
          </div>
          <StatusBadge status={lead.status} size="sm" />
        </div>

        {/* Meta */}
        <div className="px-4 space-y-1 text-[12px] text-muted-foreground">
          {lead.customer_phone && (
            <span className="flex items-center gap-2">
              <Phone className="h-3 w-3 text-muted-foreground/30" /> {lead.customer_phone}
            </span>
          )}
          {lead.address && (
            <span className="flex items-center gap-2">
              <MapPin className="h-3 w-3 text-muted-foreground/30" /> <span className="truncate">{lead.address}</span>
            </span>
          )}
          {lead.service_type && (
            <span className="flex items-center gap-2">
              <Wrench className="h-3 w-3 text-muted-foreground/30" /> {lead.service_type}
            </span>
          )}
        </div>

        {/* Payment Screenshot + Photos */}
        {allImages.length > 0 && (
          <div className="px-4 mt-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <ImageIcon className="h-3 w-3 text-muted-foreground/40" />
              <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider font-medium">
                {isPaid && lead.payment_screenshot_url ? 'Payment & Photos' : 'Photos'}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {allImages.map((url, i) => (
                <button
                  key={i}
                  onClick={() => openLightbox(i)}
                  className="h-12 w-12 rounded-md overflow-hidden border border-border/40 hover:border-primary/40 transition-colors cursor-pointer"
                >
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* General Notes Thread */}
        <div className="mx-4 mt-3">
          <Collapsible open={generalOpen} onOpenChange={setGeneralOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between h-8 text-[12px] text-muted-foreground hover:text-foreground rounded-lg px-2">
                <span className="flex items-center gap-1.5"><MessageSquare className="h-3 w-3" /> Notes</span>
                <motion.span animate={{ rotate: generalOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown className="h-3.5 w-3.5" />
                </motion.span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-1">
              <NoteThread leadId={lead.id} noteType="general" label="Notes" profiles={profiles} />
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* CS Notes Thread */}
        {(isCS || isAdmin) && (
          <div className="mx-4 mt-2">
            <Collapsible open={csOpen} onOpenChange={setCsOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between h-8 text-[12px] text-muted-foreground hover:text-foreground rounded-lg px-2">
                  <span className="flex items-center gap-1.5"><MessageSquare className="h-3 w-3" /> CS Notes</span>
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

        {/* Processor Notes Thread */}
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
          <div className="mx-4 mt-3 rounded-lg bg-warning/6 border border-warning/10 px-3 py-1.5">
            <p className="text-[10px] text-muted-foreground">
              Last edited {new Date(lead.updated_at).toLocaleDateString()} by{" "}
              <span className="font-semibold text-foreground">{profiles[lead.last_edited_by] || "Unknown"}</span>
            </p>
          </div>
        )}

        {/* Created by */}
        <div className="px-4 pt-2 pb-1">
          <p className="text-[10px] text-muted-foreground/40">
            Created by {profiles[lead.created_by] || "Unknown"} · {new Date(lead.created_at).toLocaleDateString()}
          </p>
        </div>

        {/* Actions */}
        <div className="mt-auto p-4 pt-2 space-y-2">
          <Select value={lead.status} onValueChange={handleStatusChange} disabled={changingStatus || isPaid}>
            <SelectTrigger className={`w-full h-9 text-[12px] rounded-lg ${isPaid ? 'opacity-60 cursor-not-allowed' : ''}`}>
              <SelectValue placeholder="Change Status" />
            </SelectTrigger>
            <SelectContent>
              {ALL_LEAD_STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="text-[12px]">{STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="flex-1 h-9 text-[12px] gap-1.5" onClick={() => navigate(`/leads/${lead.id}`)}>
              <Pencil className="h-3 w-3" /> Edit
              <ArrowUpRight className="h-3 w-3 ml-auto opacity-30" />
            </Button>
            {isAdmin && (
              <LeadShareDialog leadId={lead.id} customerName={lead.customer_name} />
            )}
            {isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9 text-destructive/50 hover:text-destructive hover:bg-destructive/5 hover:border-destructive/20">
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

        <PaymentDialog
          open={paymentOpen}
          onOpenChange={(open) => { setPaymentOpen(open); if (!open) setPendingStatus(null); }}
          onConfirm={handlePaymentConfirm}
          loading={paymentLoading}
        />

        <ImageLightbox
          images={allImages}
          initialIndex={lightboxIndex}
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
        />
      </Card>
    </motion.div>
  );
}
