-- Replace the Ready To Schedule workflow status with a role-controlled tag.
UPDATE public.leads
SET
  status = 'waiting_complete_details',
  cs_tag = COALESCE(cs_tag, 'ready_to_schedule'),
  updated_at = now()
WHERE status = 'ready_to_schedule';

UPDATE public.lead_cancellation_requests
SET previous_status = 'waiting_complete_details'
WHERE previous_status = 'ready_to_schedule';

DELETE FROM public.lead_status_visibility WHERE status = 'ready_to_schedule';
DELETE FROM public.status_permissions WHERE status = 'ready_to_schedule';

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_cs_tag_allowed_values;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_cs_tag_allowed_values
  CHECK (
    cs_tag IS NULL
    OR cs_tag IN ('confirmation_sent', 'waiting_schedule_confirmation', 'booked', 'ready_to_schedule')
  ) NOT VALID;

CREATE OR REPLACE FUNCTION public.enforce_lead_tag_role_access()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.cs_tag IS NOT DISTINCT FROM OLD.cs_tag OR NEW.cs_tag IS NULL OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF has_role(auth.uid(), 'customer_service'::app_role)
     AND NEW.cs_tag IN ('confirmation_sent', 'waiting_schedule_confirmation', 'booked') THEN
    RETURN NEW;
  END IF;

  IF has_role(auth.uid(), 'processor'::app_role)
     AND NEW.cs_tag = 'ready_to_schedule' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'You do not have permission to assign this lead tag';
END;
$$;

DROP TRIGGER IF EXISTS leads_enforce_tag_role_access ON public.leads;
CREATE TRIGGER leads_enforce_tag_role_access
  BEFORE UPDATE OF cs_tag ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_lead_tag_role_access();
