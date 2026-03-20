-- Fix 1: Restrict notifications INSERT to own user_id only
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.notifications;
CREATE POLICY "Users insert own notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Fix 2: Scope leads SELECT to owner/assigned/admin/shared
DROP POLICY IF EXISTS "Authenticated can read leads" ON public.leads;
CREATE POLICY "Scoped lead access"
  ON public.leads FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR assigned_cs = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'processor')
    OR EXISTS (
      SELECT 1 FROM public.lead_shares
      WHERE lead_shares.lead_id = leads.id
        AND lead_shares.shared_with_user_id = auth.uid()
    )
  );

-- Fix 3: Add RLS policies for lead_status_visibility (currently has RLS enabled but no policies)
CREATE POLICY "Authenticated can read status visibility"
  ON public.lead_status_visibility FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage status visibility"
  ON public.lead_status_visibility FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));