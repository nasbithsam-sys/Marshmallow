
CREATE OR REPLACE FUNCTION public.cron_quo_sync_contacts()
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
    url := 'https://kxiqholnmhkwhdkhtopp.supabase.co/functions/v1/quo-sync-contacts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', COALESCE(service_key, ''),
      'Authorization', CASE WHEN service_key IS NOT NULL THEN 'Bearer ' || service_key ELSE '' END,
      'x-cron-secret', COALESCE(c_secret, '')
    ),
    body := '{"overwrite": false, "maxPages": 100}'::jsonb,
    timeout_milliseconds := 2000
  );
END;
$function$;

-- Unschedule prior copy if exists, then schedule every 30 minutes
DO $$
BEGIN
  PERFORM cron.unschedule('quo-sync-contacts-every-30min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'quo-sync-contacts-every-30min',
  '*/30 * * * *',
  $$SELECT public.cron_quo_sync_contacts();$$
);
