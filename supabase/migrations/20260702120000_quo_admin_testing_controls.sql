INSERT INTO public.quo_ai_settings (key, value, description)
VALUES
  (
    'quo_webhook_ingestion_paused',
    'false'::jsonb,
    'Admin testing switch. When true, quo-webhook acknowledges incoming Quo webhooks but does not store conversations, messages, or AI jobs.'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  updated_at = NOW();
