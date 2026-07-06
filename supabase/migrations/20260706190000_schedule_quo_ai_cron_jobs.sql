-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1. Insert default empty cron_secret setting if it doesn't exist
INSERT INTO public.quo_ai_settings (key, value, description)
VALUES (
    'cron_secret',
    '""'::jsonb,
    'Secret token used by pg_cron helper functions to authorize calls to AI Edge Functions. Must match Deno FUNCTION_CRON_SECRET secret.'
)
ON CONFLICT (key) DO NOTHING;

-- 1b. Ensure Quo Webhook Ingestion is active (unpaused / out of testing mode)
INSERT INTO public.quo_ai_settings (key, value, description)
VALUES (
    'quo_webhook_ingestion_paused',
    'false'::jsonb,
    'Admin testing switch. When true, quo-webhook acknowledges incoming Quo webhooks but does not store conversations, messages, or AI jobs.'
)
ON CONFLICT (key) DO UPDATE SET
  value = 'false'::jsonb,
  updated_at = NOW();

-- 2. SQL Helper Functions to securely trigger Edge Functions via pg_net and vault secrets
CREATE OR REPLACE FUNCTION public.cron_ai_process_quo_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  service_key text;
  c_secret text;
BEGIN
  -- Retrieve service role key from vault
  SELECT decrypted_secret INTO service_key 
  FROM vault.decrypted_secrets 
  WHERE name = 'service_role_key' LIMIT 1;
  
  -- Retrieve cron secret setting
  SELECT (value->>0)::text INTO c_secret 
  FROM public.quo_ai_settings 
  WHERE key = 'cron_secret';

  PERFORM net.http_post(
    url := 'http://kong:8000/functions/v1/ai-process-quo-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', service_key,
      'Authorization', 'Bearer ' || service_key,
      'x-cron-secret', COALESCE(c_secret, '')
    ),
    body := '{}'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cron_ai_reminder_checker()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  service_key text;
  c_secret text;
BEGIN
  -- Retrieve service role key from vault
  SELECT decrypted_secret INTO service_key 
  FROM vault.decrypted_secrets 
  WHERE name = 'service_role_key' LIMIT 1;
  
  -- Retrieve cron secret setting
  SELECT (value->>0)::text INTO c_secret 
  FROM public.quo_ai_settings 
  WHERE key = 'cron_secret';

  PERFORM net.http_post(
    url := 'http://kong:8000/functions/v1/ai-reminder-checker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', service_key,
      'Authorization', 'Bearer ' || service_key,
      'x-cron-secret', COALESCE(c_secret, '')
    ),
    body := '{}'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cron_ai_sweep_conversations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  service_key text;
  c_secret text;
BEGIN
  -- Retrieve service role key from vault
  SELECT decrypted_secret INTO service_key 
  FROM vault.decrypted_secrets 
  WHERE name = 'service_role_key' LIMIT 1;
  
  -- Retrieve cron secret setting
  SELECT (value->>0)::text INTO c_secret 
  FROM public.quo_ai_settings 
  WHERE key = 'cron_secret';

  PERFORM net.http_post(
    url := 'http://kong:8000/functions/v1/ai-sweep-conversations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', service_key,
      'Authorization', 'Bearer ' || service_key,
      'x-cron-secret', COALESCE(c_secret, '')
    ),
    body := '{}'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cron_ai_daily_brief()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  service_key text;
  c_secret text;
BEGIN
  -- Retrieve service role key from vault
  SELECT decrypted_secret INTO service_key 
  FROM vault.decrypted_secrets 
  WHERE name = 'service_role_key' LIMIT 1;
  
  -- Retrieve cron secret setting
  SELECT (value->>0)::text INTO c_secret 
  FROM public.quo_ai_settings 
  WHERE key = 'cron_secret';

  PERFORM net.http_post(
    url := 'http://kong:8000/functions/v1/ai-daily-brief',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', service_key,
      'Authorization', 'Bearer ' || service_key,
      'x-cron-secret', COALESCE(c_secret, '')
    ),
    body := '{}'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cron_quo_reconcile_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  service_key text;
  c_secret text;
BEGIN
  -- Retrieve service role key from vault
  SELECT decrypted_secret INTO service_key 
  FROM vault.decrypted_secrets 
  WHERE name = 'service_role_key' LIMIT 1;
  
  -- Retrieve cron secret setting
  SELECT (value->>0)::text INTO c_secret 
  FROM public.quo_ai_settings 
  WHERE key = 'cron_secret';

  PERFORM net.http_post(
    url := 'http://kong:8000/functions/v1/quo-reconcile-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', service_key,
      'Authorization', 'Bearer ' || service_key,
      'x-cron-secret', COALESCE(c_secret, '')
    ),
    body := '{}'::jsonb
  );
END;
$$;

-- 3. Safely unschedule existing jobs to avoid conflicts
SELECT cron.unschedule(jobname)
FROM cron.job
WHERE jobname IN (
    'ai-process-quo-jobs-cron',
    'ai-reminder-checker-cron',
    'ai-sweep-conversations-cron',
    'ai-daily-brief-cron',
    'quo-reconcile-sync-cron'
);

-- 4. Schedule pg_cron tasks targeting the helper functions
SELECT cron.schedule(
    'ai-process-quo-jobs-cron',
    '*/1 * * * *', -- Run every 1 minute
    'SELECT public.cron_ai_process_quo_jobs()'
);

SELECT cron.schedule(
    'ai-reminder-checker-cron',
    '*/3 * * * *', -- Run every 3 minutes
    'SELECT public.cron_ai_reminder_checker()'
);

SELECT cron.schedule(
    'ai-sweep-conversations-cron',
    '*/15 * * * *', -- Run every 15 minutes
    'SELECT public.cron_ai_sweep_conversations()'
);

SELECT cron.schedule(
    'ai-daily-brief-cron',
    '0 6 * * *', -- Run every morning at 6:00 AM
    'SELECT public.cron_ai_daily_brief()'
);

SELECT cron.schedule(
    'quo-reconcile-sync-cron',
    '0 * * * *', -- Run every hour
    'SELECT public.cron_quo_reconcile_sync()'
);
