import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Share2 } from "lucide-react";
import { motion } from "framer-motion";

interface Props {
  leadId: string;
  customerName: string;
}

interface CSRUser {
  user_id: string;
  display_name: string;
  email: string | null;
  isShared: boolean;
}

export default function LeadShareDialog({ leadId, customerName }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [csrUsers, setCsrUsers] = useState<CSRUser[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) fetchCSRUsers();
  }, [open]);

  const fetchCSRUsers = async () => {
    const [rolesRes, sharesRes] = await Promise.all([
      supabase.from("user_roles").select("user_id, role").eq("role", "customer_service"),
      supabase.from("lead_shares").select("shared_with_user_id").eq("lead_id", leadId),
    ]);

    if (rolesRes.data) {
      const csUserIds = rolesRes.data.map((r: any) => r.user_id);
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", csUserIds);

      const sharedIds = new Set((sharesRes.data || []).map((s: any) => s.shared_with_user_id));

      setCsrUsers(
        (profiles || [])
          .filter((p: any) => p.id !== user?.id)
          .map((p: any) => ({
            user_id: p.id,
            display_name: p.full_name,
            email: p.email,
            isShared: sharedIds.has(p.id),
          })),
      );
    }
  };

  const toggleShare = async (userId: string, share: boolean) => {
    setSaving(true);
    if (share) {
      await supabase.from("lead_shares").insert({
        lead_id: leadId,
        shared_with_user_id: userId,
        shared_by: user!.id,
      });
      await supabase.from("notifications").insert({
        user_id: userId,
        title: "📋 Lead Shared with You",
        message: `"${customerName}" has been shared with you by admin`,
        lead_id: leadId,
        read: false,
      });
    } else {
      await supabase.from("lead_shares").delete().eq("lead_id", leadId).eq("shared_with_user_id", userId);
    }
    await fetchCSRUsers();
    toast.success(share ? "Lead shared & notification sent" : "Share removed");
    setSaving(false);
  };

  const getInitials = (name: string) =>
    name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="h-9 w-9" onClick={(e) => e.stopPropagation()}>
          <Share2 className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="text-base">Share "{customerName}"</DialogTitle>
        </DialogHeader>
        <p className="text-[12px] text-muted-foreground">
          Select CS users who should see this lead. They'll receive a notification.
        </p>
        <div className="space-y-2 max-h-64 overflow-y-auto mt-2">
          {csrUsers.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No CS users found.</p>
          )}
          {csrUsers.map((csr, i) => (
            <motion.div
              key={csr.user_id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, type: "spring", stiffness: 350, damping: 28 }}
              className="flex items-center justify-between rounded-xl border border-border/40 p-3 hover:bg-muted/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={csr.isShared}
                  onCheckedChange={(checked) => toggleShare(csr.user_id, !!checked)}
                  disabled={saving}
                />
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-primary/8 text-primary text-[9px] font-bold">
                    {getInitials(csr.display_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-[13px] font-medium">{csr.display_name}</p>
                  <p className="text-[11px] text-muted-foreground/50">{csr.email}</p>
                </div>
              </div>
              {csr.isShared && (
                <Badge
                  variant="outline"
                  className="text-[10px] bg-primary/6 text-primary border-primary/12 font-semibold"
                >
                  Shared
                </Badge>
              )}
            </motion.div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
