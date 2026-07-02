CREATE OR REPLACE FUNCTION public.can_access_quo_ai()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'processor'::public.app_role)
    OR public.has_role(auth.uid(), 'customer_service'::public.app_role);
$$;

DROP POLICY IF EXISTS "Allow authenticated read on quo_phone_numbers" ON public.quo_phone_numbers;
DROP POLICY IF EXISTS "Allow authenticated read on quo_conversations" ON public.quo_conversations;
DROP POLICY IF EXISTS "Allow authenticated read on quo_messages" ON public.quo_messages;
DROP POLICY IF EXISTS "Allow authenticated read on quo_conversation_flags" ON public.quo_conversation_flags;
DROP POLICY IF EXISTS "Allow authenticated read on quo_sync_logs" ON public.quo_sync_logs;

CREATE POLICY "Authorized read on quo_phone_numbers"
  ON public.quo_phone_numbers FOR SELECT TO authenticated
  USING (public.can_access_quo_ai());

CREATE POLICY "Authorized read on quo_conversations"
  ON public.quo_conversations FOR SELECT TO authenticated
  USING (public.can_access_quo_ai());

CREATE POLICY "Authorized read on quo_messages"
  ON public.quo_messages FOR SELECT TO authenticated
  USING (public.can_access_quo_ai());

CREATE POLICY "Authorized read on quo_conversation_flags"
  ON public.quo_conversation_flags FOR SELECT TO authenticated
  USING (public.can_access_quo_ai());

CREATE POLICY "Authorized read on quo_sync_logs"
  ON public.quo_sync_logs FOR SELECT TO authenticated
  USING (public.can_access_quo_ai());

DROP POLICY IF EXISTS "Authenticated read quo webhook events" ON public.quo_webhook_events;
DROP POLICY IF EXISTS "Authenticated read ai decisions" ON public.ai_decisions;
DROP POLICY IF EXISTS "Authenticated read ai conversation states" ON public.ai_conversation_states;
DROP POLICY IF EXISTS "Authenticated read ai reminders" ON public.ai_reminders;
DROP POLICY IF EXISTS "Authenticated read ai review queue" ON public.ai_review_queue;
DROP POLICY IF EXISTS "Authenticated read ai lead links" ON public.ai_lead_links;
DROP POLICY IF EXISTS "Authenticated read ai audit logs" ON public.ai_audit_logs;

CREATE POLICY "Authorized read quo webhook events"
  ON public.quo_webhook_events FOR SELECT TO authenticated
  USING (public.can_access_quo_ai());

CREATE POLICY "Authorized read ai decisions"
  ON public.ai_decisions FOR SELECT TO authenticated
  USING (public.can_access_quo_ai());

CREATE POLICY "Authorized read ai conversation states"
  ON public.ai_conversation_states FOR SELECT TO authenticated
  USING (public.can_access_quo_ai());

CREATE POLICY "Authorized read ai reminders"
  ON public.ai_reminders FOR SELECT TO authenticated
  USING (public.can_access_quo_ai());

CREATE POLICY "Authorized read ai review queue"
  ON public.ai_review_queue FOR SELECT TO authenticated
  USING (public.can_access_quo_ai());

CREATE POLICY "Authorized read ai lead links"
  ON public.ai_lead_links FOR SELECT TO authenticated
  USING (public.can_access_quo_ai());

CREATE POLICY "Authorized read ai audit logs"
  ON public.ai_audit_logs FOR SELECT TO authenticated
  USING (public.can_access_quo_ai());
