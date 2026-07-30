-- Restore policies dropped by mistake

CREATE POLICY "Authorized read ai reminders"
  ON public.ai_reminders FOR SELECT TO authenticated
  USING (public.can_access_quo_ai());

CREATE POLICY "Users read active updates for their role"
  ON public.crm_updates FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role::text = ANY(crm_updates.target_roles)
    )
  );

CREATE POLICY "CS and processors can create cancellation requests"
ON public.lead_cancellation_requests
FOR INSERT
TO authenticated
WITH CHECK ((requested_by = auth.uid()) AND (requested_by_role IN ('customer_service', 'processor')));

CREATE POLICY "Processors can create payment requests"
ON public.lead_payment_requests
FOR INSERT
TO authenticated
WITH CHECK ((requested_by = auth.uid()) AND public.has_role(auth.uid(), 'processor'::public.app_role));

CREATE POLICY "Users can view accessible leads"
  ON public.leads FOR SELECT
  TO authenticated
  USING (
    (created_by = auth.uid())
    OR (assigned_cs = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'processor'::app_role)
    OR (
      has_role(auth.uid(), 'opr'::app_role) AND 
      EXISTS (
        SELECT 1 FROM public.lead_operator_assignments loa
        WHERE loa.lead_id = leads.id AND loa.operator_user_id = auth.uid()
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.lead_shares
      WHERE lead_shares.lead_id = leads.id
        AND lead_shares.shared_with_user_id = auth.uid()
    )
  );

CREATE POLICY "Authorized read quo ai tags"
  ON public.quo_ai_tags FOR SELECT TO authenticated
  USING (public.can_access_quo_ai());

CREATE POLICY "Authorized read quo ai tasks"
  ON public.quo_ai_tasks FOR SELECT TO authenticated
  USING (public.can_access_quo_ai());

CREATE POLICY "Admins read quo number preferences"
  ON public.quo_number_preferences FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins read quo pinned conversations"
  ON public.quo_pinned_conversations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

