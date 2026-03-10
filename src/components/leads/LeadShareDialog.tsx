import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
    const [profilesRes, sharesRes] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email"),
      supabase.from("lead_shares").select("shared_with_user_id").eq("lead_id", leadId),
    ]);

    if (profilesRes.data) {
      const sharedIds = new Set((sharesRes.data || []).map((s: any) => s.shared_with_user_id));

      setCsrUsers(
        profilesRes.data
          .filter((p: any) => p.id !== user?.id)
          .map((p: any) => ({
            user_id: p.id,
            display_name: p.full_name,
            email: p.email,
            isShared: sharedIds.has(p.id),
          }))
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
    } else {
      await supabase.from("lead_shares").delete().eq("lead_id", leadId).eq("shared_with_user_id", userId);
    }
    await fetchCSRUsers();
    toast.success(share ? "Lead shared" : "Share removed");
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={(e) => e.stopPropagation()}>
          <Share2 className="h-3.5 w-3.5" /> Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="text-base">Share "{customerName}"</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">Select users who should see this lead.</p>
        <div className="space-y-2 max-h-64 overflow-y-auto mt-2">
          {csrUsers.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No users found.</p>
          )}
          {csrUsers.map((csr, i) => (
            <motion.div
              key={csr.user_id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, type: "spring", stiffness: 300, damping: 25 }}
              className="flex items-center justify-between rounded-lg border border-border/60 p-3 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={csr.isShared}
                  onCheckedChange={(checked) => toggleShare(csr.user_id, !!checked)}
                  disabled={saving}
                />
                <div>
                  <p className="text-sm font-medium">{csr.display_name}</p>
                  <p className="text-xs text-muted-foreground">{csr.email}</p>
                </div>
              </div>
              {csr.isShared && (
                <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
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