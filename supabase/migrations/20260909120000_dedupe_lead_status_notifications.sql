-- Lead status alerts (Urgent Job / Need Tech / Job in Progress / Quote Updated) were inserted
-- once per recipient on every status change, so a lead flipped repeatedly stacked one unread
-- notification per flip and buried users in popups.
--
-- This adds a dispatcher that keeps at most ONE unread alert per (user, lead, title): an existing
-- unread row is refreshed in place with the newest message, and only users without one get a new
-- row. It has to run SECURITY DEFINER because the notifications SELECT/UPDATE policies are
-- self-only, so the sender cannot see or touch other recipients' rows.

-- Makes the per-recipient existence check cheap.
CREATE INDEX IF NOT EXISTS notifications_unread_lead_title_idx
  ON public.notifications (lead_id, title, user_id)
  WHERE read = false;

CREATE OR REPLACE FUNCTION public.dispatch_lead_status_notification(
  p_lead_id uuid,
  p_title text,
  p_message text,
  p_user_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_inserted integer := 0;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Mirrors the "Self or admin can create notifications" INSERT policy: only roles that could
  -- already write notifications for other users may dispatch through this function.
  IF NOT (
    public.has_role(v_actor, 'admin'::public.app_role)
    OR public.has_role(v_actor, 'processor'::public.app_role)
    OR public.has_role(v_actor, 'opr'::public.app_role)
    OR public.has_role(v_actor, 'cs_admin'::public.app_role)
    OR public.has_role(v_actor, 'customer_service'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Not permitted to dispatch lead notifications';
  END IF;

  IF p_lead_id IS NULL OR p_user_ids IS NULL OR array_length(p_user_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  -- Refresh the alert a recipient has not read yet (e.g. a new expected completion date)
  -- instead of stacking a second copy of it.
  UPDATE public.notifications n
     SET message = p_message,
         created_at = now()
   WHERE n.lead_id = p_lead_id
     AND n.title = p_title
     AND n.read = false
     AND n.user_id = ANY (p_user_ids);

  INSERT INTO public.notifications (user_id, title, message, lead_id, read)
  SELECT DISTINCT t.recipient, p_title, p_message, p_lead_id, false
    FROM unnest(p_user_ids) AS t(recipient)
   WHERE t.recipient IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
         FROM public.notifications n
        WHERE n.user_id = t.recipient
          AND n.lead_id = p_lead_id
          AND n.title = p_title
          AND n.read = false
     );

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_lead_status_notification(uuid, text, text, uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.dispatch_lead_status_notification(uuid, text, text, uuid[]) TO authenticated;
