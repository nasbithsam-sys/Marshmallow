UPDATE public.quo_ai_settings
SET value = jsonb_build_array(encode(gen_random_bytes(32), 'hex')),
    updated_at = now()
WHERE key = 'cron_secret'
  AND (
    value IS NULL
    OR value = '""'::jsonb
    OR value = '[]'::jsonb
    OR value = '{}'::jsonb
  );

CREATE OR REPLACE FUNCTION public.cron_ai_process_quo_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  service_key text;
  c_secret text;
  c_value jsonb;
BEGIN
  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key' LIMIT 1;

  SELECT value INTO c_value
  FROM public.quo_ai_settings
  WHERE key = 'cron_secret';

  c_secret := CASE jsonb_typeof(c_value)
    WHEN 'array' THEN c_value->>0
    WHEN 'string' THEN trim(both '"' from c_value::text)
    WHEN 'object' THEN c_value->>'secret'
    ELSE NULL
  END;

  PERFORM net.http_post(
    url := 'https://kxiqholnmhkwhdkhtopp.supabase.co/functions/v1/ai-process-quo-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', COALESCE(service_key, ''),
      'Authorization', CASE WHEN service_key IS NOT NULL THEN 'Bearer ' || service_key ELSE '' END,
      'x-cron-secret', COALESCE(c_secret, '')
    ),
    body := '{"batch_size":5}'::jsonb,
    timeout_milliseconds := 1000
  );
END;
$function$;