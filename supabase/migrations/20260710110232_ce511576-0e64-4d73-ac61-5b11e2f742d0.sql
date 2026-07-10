DROP POLICY IF EXISTS "Read shares for accessible leads" ON public.lead_shares;
CREATE POLICY "Read shares for accessible leads" ON public.lead_shares
FOR SELECT USING (
  shared_with_user_id = (SELECT auth.uid())
  OR shared_by = (SELECT auth.uid())
  OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
);