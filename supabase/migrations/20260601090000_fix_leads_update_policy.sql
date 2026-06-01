-- Fix leads UPDATE RLS policy to allow any authenticated user who has a role
-- (processor, customer_service, opr) to update leads, not just the creator/assigned_cs.
-- The application layer (useChangeableStatuses + canChange) enforces which statuses
-- they may change to; the DB policy just needs to permit the row write.

DROP POLICY IF EXISTS "Authorized users can update leads" ON public.leads;

CREATE POLICY "Authorized users can update leads"
  ON public.leads FOR UPDATE TO authenticated
  USING (
    -- Lead creator can always update
    created_by = auth.uid()
    -- Assigned CS can always update
    OR assigned_cs = auth.uid()
    -- Admins can always update
    OR public.has_role(auth.uid(), 'admin')
    -- Any user with a non-no_role can update (app layer enforces status limits)
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role != 'no_role'
    )
  );
