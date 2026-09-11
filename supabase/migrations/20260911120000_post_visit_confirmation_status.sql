-- "Post-visit confirmation" moves from a lead tag to a lead status, and is not pinned.
--
-- Leads still carrying the tag are moved onto the status, since the tag meant exactly that
-- state. The tag is then removed from the allowed values and from the tag trigger. The status
-- itself needs no database change: leads.status is plain text with no check constraint.

UPDATE public.leads
   SET status = 'post_visit_confirmation',
       cs_tag = NULL,
       updated_at = now()
 WHERE cs_tag = 'post_visit_confirmation';

ALTER TABLE public.leads
  DROP CONSTRAINT IF EXISTS leads_cs_tag_allowed_values;

ALTER TABLE public.leads
  ADD CONSTRAINT leads_cs_tag_allowed_values
  CHECK (
    cs_tag IS NULL
    OR cs_tag IN (
      'confirmation_sent',
      'waiting_schedule_confirmation',
      'booked',
      'ready_to_schedule',
      'incomplete_details'
    )
  ) NOT VALID;

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
