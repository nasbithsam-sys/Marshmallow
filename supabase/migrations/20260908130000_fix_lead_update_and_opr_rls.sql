-- Migration: Fix lead updates, grant trigger execution to authenticated users, and sync OPR/CS RLS policies
-- =========================================================================================

-- 1. Ensure authenticated users have EXECUTE privileges on trigger functions that execute on leads/notes/photos
GRANT EXECUTE ON FUNCTION public.set_lead_user_snapshot_names() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_lead_note_user_snapshot_name() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_lead_photo_user_snapshot_name() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_payment_request_user_snapshot_names() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_cancellation_request_user_snapshot_names() TO authenticated;

-- 2. Update Authorized users can update leads policy
DROP POLICY IF EXISTS "Authorized users can update leads" ON public.leads;
CREATE POLICY "Authorized users can update leads"
  ON public.leads FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR assigned_cs = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'processor'::public.app_role)
    OR public.has_role(auth.uid(), 'opr'::public.app_role)
    OR public.has_role(auth.uid(), 'cs_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'customer_service'::public.app_role)
  )
  WITH CHECK (
    (
      created_by = auth.uid()
      OR assigned_cs = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'processor'::public.app_role)
      OR public.has_role(auth.uid(), 'opr'::public.app_role)
      OR public.has_role(auth.uid(), 'cs_admin'::public.app_role)
      OR public.has_role(auth.uid(), 'customer_service'::public.app_role)
    )
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'processor'::public.app_role)
      OR public.has_role(auth.uid(), 'opr'::public.app_role)
      OR status <> 'scammed'
    )
    AND (
      NOT public.has_role(auth.uid(), 'cs_admin'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'processor'::public.app_role)
      OR public.has_role(auth.uid(), 'opr'::public.app_role)
      OR status NOT IN ('paid','partial_paid','cancelled','job_done','scammed')
    )
  );

-- 3. Update Scoped lead access SELECT policy
DROP POLICY IF EXISTS "Scoped lead access" ON public.leads;
CREATE POLICY "Scoped lead access" ON public.leads
FOR SELECT TO authenticated
USING (
  CASE
    WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN TRUE
    WHEN public.has_role(auth.uid(), 'processor'::public.app_role) THEN TRUE
    WHEN public.has_role(auth.uid(), 'opr'::public.app_role) THEN TRUE
    WHEN public.has_role(auth.uid(), 'cs_admin'::public.app_role) THEN
      status NOT IN ('paid','partial_paid','cancelled','job_done','scammed')
    ELSE (
      status <> 'scammed'
      AND (
        created_by = auth.uid()
        OR assigned_cs = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.lead_shares
          WHERE lead_shares.lead_id = leads.id
            AND lead_shares.shared_with_user_id = auth.uid()
        )
      )
    )
  END
);

-- 4. Update Users can view accessible leads SELECT policy
DROP POLICY IF EXISTS "Users can view accessible leads" ON public.leads;
CREATE POLICY "Users can view accessible leads"
  ON public.leads FOR SELECT
  TO authenticated
  USING (
    (created_by = auth.uid())
    OR (assigned_cs = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'processor'::app_role)
    OR has_role(auth.uid(), 'opr'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.lead_shares
      WHERE lead_shares.lead_id = leads.id
        AND lead_shares.shared_with_user_id = auth.uid()
    )
  );

-- 5. Update notifications INSERT policy to allow OPR and CS Admin alerts
DROP POLICY IF EXISTS "Self or admin can create notifications" ON public.notifications;
CREATE POLICY "Self or admin can create notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'processor'::public.app_role)
    OR public.has_role(auth.uid(), 'opr'::public.app_role)
    OR public.has_role(auth.uid(), 'cs_admin'::public.app_role)
    OR public.has_role(auth.uid(), 'customer_service'::public.app_role)
  );
