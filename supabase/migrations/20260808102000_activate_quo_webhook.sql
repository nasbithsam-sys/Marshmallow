-- Migration: Activate QUO Webhook Ingestion so new messages are received and stored

INSERT INTO public.quo_ai_settings (key, value, description, updated_at)
VALUES (
  'quo_webhook_ingestion_paused',
  'false'::jsonb,
  'Quo webhook ingestion active: webhooks store conversations and messages.',
  now()
)
ON CONFLICT (key) DO UPDATE SET value = 'false'::jsonb, updated_at = now();
