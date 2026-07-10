CREATE OR REPLACE FUNCTION public.set_lead_user_snapshot_names()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.created_by IS NOT NULL AND NEW.created_by_name IS NULL THEN
    SELECT COALESCE(NULLIF(trim(full_name), ''), email, 'Unknown user') INTO NEW.created_by_name
    FROM public.profiles WHERE id = NEW.created_by;
  END IF;

  IF NEW.last_edited_by IS NOT NULL AND NEW.last_edited_by_name IS NULL THEN
    SELECT COALESCE(NULLIF(trim(full_name), ''), email, 'Unknown user') INTO NEW.last_edited_by_name
    FROM public.profiles WHERE id = NEW.last_edited_by;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS set_lead_user_snapshot_names ON public.leads;
CREATE TRIGGER set_lead_user_snapshot_names
  BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_lead_user_snapshot_names();

CREATE OR REPLACE FUNCTION public.set_lead_note_user_snapshot_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.user_id IS NOT NULL AND NEW.user_name IS NULL THEN
    SELECT COALESCE(NULLIF(trim(full_name), ''), email, 'Unknown user') INTO NEW.user_name
    FROM public.profiles WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS set_lead_note_user_snapshot_name ON public.lead_notes;
CREATE TRIGGER set_lead_note_user_snapshot_name
  BEFORE INSERT OR UPDATE ON public.lead_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_lead_note_user_snapshot_name();

CREATE OR REPLACE FUNCTION public.set_lead_photo_user_snapshot_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.uploaded_by IS NOT NULL AND NEW.uploaded_by_name IS NULL THEN
    SELECT COALESCE(NULLIF(trim(full_name), ''), email, 'Unknown user') INTO NEW.uploaded_by_name
    FROM public.profiles WHERE id = NEW.uploaded_by;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS set_lead_photo_user_snapshot_name ON public.lead_photos;
CREATE TRIGGER set_lead_photo_user_snapshot_name
  BEFORE INSERT OR UPDATE ON public.lead_photos
  FOR EACH ROW EXECUTE FUNCTION public.set_lead_photo_user_snapshot_name();

CREATE OR REPLACE FUNCTION public.set_payment_request_user_snapshot_names()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.requested_by IS NOT NULL AND NEW.requested_by_name IS NULL THEN
    SELECT COALESCE(NULLIF(trim(full_name), ''), email, 'Unknown user') INTO NEW.requested_by_name
    FROM public.profiles WHERE id = NEW.requested_by;
  END IF;

  IF NEW.reviewed_by IS NOT NULL AND NEW.reviewed_by_name IS NULL THEN
    SELECT COALESCE(NULLIF(trim(full_name), ''), email, 'Unknown user') INTO NEW.reviewed_by_name
    FROM public.profiles WHERE id = NEW.reviewed_by;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS set_payment_request_user_snapshot_names ON public.lead_payment_requests;
CREATE TRIGGER set_payment_request_user_snapshot_names
  BEFORE INSERT OR UPDATE ON public.lead_payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_payment_request_user_snapshot_names();

CREATE OR REPLACE FUNCTION public.set_cancellation_request_user_snapshot_names()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.requested_by IS NOT NULL AND NEW.requested_by_name IS NULL THEN
    SELECT COALESCE(NULLIF(trim(full_name), ''), email, 'Unknown user') INTO NEW.requested_by_name
    FROM public.profiles WHERE id = NEW.requested_by;
  END IF;

  IF NEW.reviewed_by IS NOT NULL AND NEW.reviewed_by_name IS NULL THEN
    SELECT COALESCE(NULLIF(trim(full_name), ''), email, 'Unknown user') INTO NEW.reviewed_by_name
    FROM public.profiles WHERE id = NEW.reviewed_by;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS set_cancellation_request_user_snapshot_names ON public.lead_cancellation_requests;
CREATE TRIGGER set_cancellation_request_user_snapshot_names
  BEFORE INSERT OR UPDATE ON public.lead_cancellation_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_cancellation_request_user_snapshot_names();

REVOKE ALL ON FUNCTION public.set_lead_user_snapshot_names() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_lead_note_user_snapshot_name() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_lead_photo_user_snapshot_name() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_payment_request_user_snapshot_names() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_cancellation_request_user_snapshot_names() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_lead_user_snapshot_names() TO service_role;
GRANT EXECUTE ON FUNCTION public.set_lead_note_user_snapshot_name() TO service_role;
GRANT EXECUTE ON FUNCTION public.set_lead_photo_user_snapshot_name() TO service_role;
GRANT EXECUTE ON FUNCTION public.set_payment_request_user_snapshot_names() TO service_role;
GRANT EXECUTE ON FUNCTION public.set_cancellation_request_user_snapshot_names() TO service_role;