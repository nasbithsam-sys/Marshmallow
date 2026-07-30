
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS cs_tag text;

DROP POLICY IF EXISTS "Scoped lead access" ON public.leads;
CREATE POLICY "Scoped lead access" ON public.leads
FOR SELECT TO authenticated
USING (
  (created_by = auth.uid())
  OR (assigned_cs = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'processor'::app_role)
  OR (has_role(auth.uid(), 'opr'::app_role) AND status = 'urgent_job')
  OR EXISTS (
    SELECT 1 FROM lead_shares
    WHERE lead_shares.lead_id = leads.id
      AND lead_shares.shared_with_user_id = auth.uid()
  )
);
