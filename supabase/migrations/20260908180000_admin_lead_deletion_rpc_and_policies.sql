-- Create an RPC to safely delete a lead and all dependent data
CREATE OR REPLACE FUNCTION public.delete_lead_by_admin(target_lead_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job_id text;
  v_caller_role text;
  v_is_cs_admin_mgr boolean;
BEGIN
  -- Get caller role
  SELECT role::text INTO v_caller_role FROM public.user_roles WHERE user_id = auth.uid();
  SELECT can_manage_users INTO v_is_cs_admin_mgr FROM public.profiles WHERE id = auth.uid();

  IF v_caller_role != 'admin' AND NOT (v_caller_role = 'cs_admin' AND v_is_cs_admin_mgr = true) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  -- Get job_id for return
  SELECT job_id INTO v_job_id FROM public.leads WHERE id = target_lead_id;

  -- Delete from dependent tables
  DELETE FROM public.lead_notes WHERE lead_id = target_lead_id;
  DELETE FROM public.lead_photos WHERE lead_id = target_lead_id;
  DELETE FROM public.lead_shares WHERE lead_id = target_lead_id;
  DELETE FROM public.lead_updates WHERE lead_id = target_lead_id;
  DELETE FROM public.notifications WHERE lead_id = target_lead_id;
  DELETE FROM public.lead_payments WHERE lead_id = target_lead_id;
  DELETE FROM public.lead_cancellation_requests WHERE lead_id = target_lead_id;
  DELETE FROM public.lead_operator_assignments WHERE lead_id = target_lead_id;

  -- Finally, delete the lead
  DELETE FROM public.leads WHERE id = target_lead_id;

  RETURN json_build_object('success', true, 'job_id', v_job_id);
END;
$$;

-- Add RLS policies for direct deletes (if RPC fails)
CREATE POLICY "Admins can delete leads" ON public.leads FOR DELETE TO authenticated USING (
  (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'admin'
);
CREATE POLICY "Admins can delete lead updates" ON public.lead_updates FOR DELETE TO authenticated USING (
  (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'admin'
);
CREATE POLICY "Admins can delete lead cancellation requests" ON public.lead_cancellation_requests FOR DELETE TO authenticated USING (
  (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'admin'
);
CREATE POLICY "Admins can delete lead notes" ON public.lead_notes FOR DELETE TO authenticated USING (
  (SELECT role FROM public.user_roles WHERE user_id = auth.uid()) = 'admin'
);
