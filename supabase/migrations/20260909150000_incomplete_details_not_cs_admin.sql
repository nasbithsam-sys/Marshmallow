-- CS Admins are not Quotation Masters: the Quote to Send queue is hidden from them, they are no
-- longer alerted when a lead becomes Pending to Send, and they no longer raise the Incomplete
-- details tag — they are the ones the alert goes to. Processors, Admins and anyone flagged
-- profiles.is_quotation_master keep it.
CREATE OR REPLACE FUNCTION public.enforce_lead_tag_role_access()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.cs_tag IS NOT DISTINCT FROM OLD.cs_tag OR NEW.cs_tag IS NULL OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF has_role(auth.uid(), 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  IF has_role(auth.uid(), 'customer_service'::app_role)
     AND NEW.cs_tag IN ('ready_to_schedule', 'confirmation_sent', 'waiting_schedule_confirmation', 'booked') THEN
    RETURN NEW;
  END IF;

  IF has_role(auth.uid(), 'cs_admin'::app_role)
     AND NEW.cs_tag IN ('ready_to_schedule', 'confirmation_sent', 'waiting_schedule_confirmation', 'booked') THEN
    RETURN NEW;
  END IF;

  IF has_role(auth.uid(), 'processor'::app_role)
     AND NEW.cs_tag IN ('ready_to_schedule', 'waiting_schedule_confirmation') THEN
    RETURN NEW;
  END IF;

  -- Incomplete details: Processors and anyone flagged as a Quotation Master.
  IF NEW.cs_tag = 'incomplete_details'
     AND (
       has_role(auth.uid(), 'processor'::app_role)
       OR EXISTS (
         SELECT 1
           FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.is_quotation_master = true
       )
     ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'You do not have permission to assign this lead tag';
END;
$function$;

DROP TRIGGER IF EXISTS leads_enforce_tag_role_access ON public.leads;
CREATE TRIGGER leads_enforce_tag_role_access
  BEFORE UPDATE OF cs_tag ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_lead_tag_role_access();
