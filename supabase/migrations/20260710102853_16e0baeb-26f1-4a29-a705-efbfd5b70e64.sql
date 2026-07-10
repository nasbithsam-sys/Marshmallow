
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker=on) AS
SELECT id, full_name FROM public.profiles;

GRANT SELECT ON public.profiles_public TO authenticated;

DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Self or admin can view profile"
  ON public.profiles FOR SELECT
  USING (id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Authenticated can read updates" ON public.lead_updates;
CREATE POLICY "Read updates for accessible leads"
  ON public.lead_updates FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.leads WHERE leads.id = lead_updates.lead_id));

DROP POLICY IF EXISTS "Authenticated users manage notes" ON public.lead_notes;
CREATE POLICY "Read notes for accessible leads"
  ON public.lead_notes FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.leads WHERE leads.id = lead_notes.lead_id));
CREATE POLICY "Author can insert notes for accessible leads"
  ON public.lead_notes FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.leads WHERE leads.id = lead_notes.lead_id));
CREATE POLICY "Author or admin can update notes"
  ON public.lead_notes FOR UPDATE
  USING (user_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role));
CREATE POLICY "Author or admin can delete notes"
  ON public.lead_notes FOR DELETE
  USING (user_id = (SELECT auth.uid()) OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Authenticated users can view lead_shares" ON public.lead_shares;
CREATE POLICY "Read shares for accessible leads"
  ON public.lead_shares FOR SELECT
  USING (
    shared_with_user_id = (SELECT auth.uid())
    OR shared_by = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR EXISTS (SELECT 1 FROM public.leads WHERE leads.id = lead_shares.lead_id)
  );

DROP POLICY IF EXISTS "Authenticated can read calls" ON public.calls;
CREATE POLICY "Read calls scoped to owner admin or linked lead"
  ON public.calls FOR SELECT
  USING (
    created_by = (SELECT auth.uid())
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR public.has_role((SELECT auth.uid()), 'processor'::public.app_role)
    OR (linked_lead_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.leads WHERE leads.id = calls.linked_lead_id))
  );

DROP POLICY IF EXISTS "Authenticated can read cancellation requests" ON public.lead_cancellation_requests;
CREATE POLICY "Read cancellation requests for accessible leads"
  ON public.lead_cancellation_requests FOR SELECT
  USING (
    public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
    OR public.has_role((SELECT auth.uid()), 'processor'::public.app_role)
    OR requested_by = (SELECT auth.uid())
    OR EXISTS (SELECT 1 FROM public.leads WHERE leads.id = lead_cancellation_requests.lead_id)
  );
