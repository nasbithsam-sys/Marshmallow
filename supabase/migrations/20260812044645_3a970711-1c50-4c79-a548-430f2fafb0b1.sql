CREATE OR REPLACE FUNCTION public.can_use_quick_chat(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.navigation_permissions np
      WHERE np.user_id = _user_id
        AND np.nav_section = 'quick_chat'
        AND np.allowed IS TRUE
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_use_quick_chat(uuid) TO authenticated;

DROP POLICY IF EXISTS "Admins can queue outbound messages" ON public.quo_outbound_messages;
DROP POLICY IF EXISTS "Admins can view outbound messages" ON public.quo_outbound_messages;
DROP POLICY IF EXISTS "Admins can update outbound messages" ON public.quo_outbound_messages;

CREATE POLICY "Quick chat users can queue outbound messages"
ON public.quo_outbound_messages FOR INSERT TO authenticated
WITH CHECK (public.can_use_quick_chat((SELECT auth.uid())) AND created_by = (SELECT auth.uid()));

CREATE POLICY "Quick chat users can view outbound messages"
ON public.quo_outbound_messages FOR SELECT TO authenticated
USING (public.can_use_quick_chat((SELECT auth.uid())));

CREATE POLICY "Quick chat users can update outbound messages"
ON public.quo_outbound_messages FOR UPDATE TO authenticated
USING (public.can_use_quick_chat((SELECT auth.uid())))
WITH CHECK (public.can_use_quick_chat((SELECT auth.uid())));