
-- 1. Revoke public EXECUTE on cron_* SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.cron_ai_reminder_checker() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cron_ai_sweep_conversations() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cron_ai_daily_brief() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cron_ai_process_quo_jobs() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cron_quo_sync_contacts() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cron_quo_reconcile_sync() FROM anon, authenticated, PUBLIC;

-- Also lock down internal helpers not meant to be RPC'd
REVOKE EXECUTE ON FUNCTION public.enqueue_quo_ai_job(uuid, uuid, text, text, integer) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_user_delete_cleanup() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_quo_pinned_conversation_limit() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_lead_tag_role_access() FROM anon, authenticated, PUBLIC;

-- has_role and can_access_quo_ai are used by RLS policies via auth.uid() — they need to
-- remain callable by authenticated users. Keep them as-is.

-- 2. Add search_path to handle_user_delete_cleanup (only function missing it)
CREATE OR REPLACE FUNCTION public.handle_user_delete_cleanup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  UPDATE public.leads SET created_by = NULL WHERE created_by = OLD.id;
  UPDATE public.leads SET assigned_cs = NULL WHERE assigned_cs = OLD.id;
  UPDATE public.lead_notes SET user_id = NULL WHERE user_id = OLD.id;
  UPDATE public.activity_logs SET user_id = NULL WHERE user_id = OLD.id;
  DELETE FROM public.lead_shares WHERE shared_with_user_id = OLD.id OR shared_by = OLD.id;
  DELETE FROM public.user_roles WHERE user_id = OLD.id;
  DELETE FROM public.navigation_permissions WHERE user_id = OLD.id;
  DELETE FROM public.status_permissions WHERE user_id = OLD.id;
  DELETE FROM public.notifications WHERE user_id = OLD.id;
  DELETE FROM public.user_access_codes WHERE user_id = OLD.id;
  DELETE FROM public.profiles WHERE id = OLD.id;
  RETURN OLD;
END;
$function$;

-- 3. Fix pinned-conversation limit to be per-user (currently counts everyone's pins)
CREATE OR REPLACE FUNCTION public.enforce_quo_pinned_conversation_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  IF NEW.pinned_by IS NOT NULL AND (
    SELECT count(*) FROM public.quo_pinned_conversations WHERE pinned_by = NEW.pinned_by
  ) >= 50 THEN
    RAISE EXCEPTION 'Pin limit reached. Unpin one chat before pinning another.';
  END IF;
  RETURN NEW;
END;
$function$;

-- 4. Normalize cron_secret parsing across all cron_* functions.
-- Previously cron_ai_reminder_checker/sweep/daily_brief used (value->>0)::text which
-- only works when value is a JSON array. Standardize on the same CASE parser used
-- by cron_ai_process_quo_jobs and cron_quo_* so any storage shape works.
CREATE OR REPLACE FUNCTION public.cron_ai_reminder_checker()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  service_key text;
  c_secret text;
  c_value jsonb;
BEGIN
  SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
  SELECT value INTO c_value FROM public.quo_ai_settings WHERE key = 'cron_secret';
  c_secret := CASE jsonb_typeof(c_value)
    WHEN 'array' THEN c_value->>0
    WHEN 'string' THEN trim(both '"' from c_value::text)
    WHEN 'object' THEN c_value->>'secret'
    ELSE NULL
  END;

  PERFORM net.http_post(
    url := 'http://kong:8000/functions/v1/ai-reminder-checker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', COALESCE(service_key, ''),
      'Authorization', CASE WHEN service_key IS NOT NULL THEN 'Bearer ' || service_key ELSE '' END,
      'x-cron-secret', COALESCE(c_secret, '')
    ),
    body := '{}'::jsonb
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.cron_ai_sweep_conversations()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  service_key text;
  c_secret text;
  c_value jsonb;
BEGIN
  SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
  SELECT value INTO c_value FROM public.quo_ai_settings WHERE key = 'cron_secret';
  c_secret := CASE jsonb_typeof(c_value)
    WHEN 'array' THEN c_value->>0
    WHEN 'string' THEN trim(both '"' from c_value::text)
    WHEN 'object' THEN c_value->>'secret'
    ELSE NULL
  END;

  PERFORM net.http_post(
    url := 'http://kong:8000/functions/v1/ai-sweep-conversations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', COALESCE(service_key, ''),
      'Authorization', CASE WHEN service_key IS NOT NULL THEN 'Bearer ' || service_key ELSE '' END,
      'x-cron-secret', COALESCE(c_secret, '')
    ),
    body := '{}'::jsonb
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.cron_ai_daily_brief()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  service_key text;
  c_secret text;
  c_value jsonb;
BEGIN
  SELECT decrypted_secret INTO service_key FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
  SELECT value INTO c_value FROM public.quo_ai_settings WHERE key = 'cron_secret';
  c_secret := CASE jsonb_typeof(c_value)
    WHEN 'array' THEN c_value->>0
    WHEN 'string' THEN trim(both '"' from c_value::text)
    WHEN 'object' THEN c_value->>'secret'
    ELSE NULL
  END;

  PERFORM net.http_post(
    url := 'http://kong:8000/functions/v1/ai-daily-brief',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', COALESCE(service_key, ''),
      'Authorization', CASE WHEN service_key IS NOT NULL THEN 'Bearer ' || service_key ELSE '' END,
      'x-cron-secret', COALESCE(c_secret, '')
    ),
    body := '{}'::jsonb
  );
END;
$function$;
