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

  RAISE EXCEPTION 'You do not have permission to assign this lead tag';
END;
$function$;