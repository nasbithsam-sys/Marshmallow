DROP POLICY IF EXISTS "Scoped lead access" ON public.leads;
CREATE POLICY "Scoped lead access" ON public.leads
FOR SELECT TO authenticated
USING (
  CASE
    WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN TRUE
    WHEN public.has_role(auth.uid(), 'processor'::public.app_role) THEN TRUE
    WHEN public.has_role(auth.uid(), 'cs_admin'::public.app_role) THEN
      status NOT IN ('paid','partial_paid','cancelled','job_done','scammed')
    WHEN public.has_role(auth.uid(), 'opr'::public.app_role) THEN
      status = 'urgent_job'
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

DROP POLICY IF EXISTS "Authorized users can update leads" ON public.leads;
CREATE POLICY "Authorized users can update leads"
  ON public.leads FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR assigned_cs = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'processor'::public.app_role)
    OR public.has_role(auth.uid(), 'cs_admin'::public.app_role)
  )
  WITH CHECK (
    (
      created_by = auth.uid()
      OR assigned_cs = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'processor'::public.app_role)
      OR public.has_role(auth.uid(), 'cs_admin'::public.app_role)
    )
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'processor'::public.app_role)
      OR status <> 'scammed'
    )
    AND (
      NOT public.has_role(auth.uid(), 'cs_admin'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'processor'::public.app_role)
      OR status NOT IN ('paid','partial_paid','cancelled','job_done','scammed')
    )
  );

INSERT INTO public.lead_status_visibility (role, user_id, status, is_visible)
VALUES
  ('customer_service', NULL, 'scammed', FALSE),
  ('opr', NULL, 'scammed', FALSE),
  ('cs_admin', NULL, 'scammed', FALSE),
  ('cs_admin', NULL, 'paid', FALSE),
  ('cs_admin', NULL, 'partial_paid', FALSE),
  ('cs_admin', NULL, 'cancelled', FALSE),
  ('cs_admin', NULL, 'job_done', FALSE)
ON CONFLICT DO NOTHING;
