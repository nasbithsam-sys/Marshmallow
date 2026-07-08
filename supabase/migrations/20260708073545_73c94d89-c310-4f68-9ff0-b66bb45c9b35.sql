CREATE OR REPLACE FUNCTION public.cron_ai_process_quo_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  service_key text;
  c_secret text;
BEGIN
  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key' LIMIT 1;

  SELECT (value->>0)::text INTO c_secret
  FROM public.quo_ai_settings
  WHERE key = 'cron_secret';

  PERFORM net.http_post(
    url := 'https://kxiqholnmhkwhdkhtopp.supabase.co/functions/v1/ai-process-quo-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', service_key,
      'Authorization', 'Bearer ' || service_key,
      'x-cron-secret', COALESCE(c_secret, '')
    ),
    body := '{"batch_size":5}'::jsonb,
    timeout_milliseconds := 1000
  );
END;
$function$;